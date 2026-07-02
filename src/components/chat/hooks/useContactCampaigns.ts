import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';
import { normalizeBrPhone, brPhoneVariants } from '@/lib/phoneNormalize';
import { supabase } from '@/integrations/supabase/client';

export interface ContactCampaignRow {
  id: string | number;
  created_at: string;
  campaign_data: Record<string, any> | null;
}

/**
 * Builds every plausible digit-only variant of a phone: canonical (with 9),
 * legacy (without 9), with/without country code 55, and the raw digits.
 */
function buildPhoneVariants(phone: string | null | undefined): string[] {
  if (!phone) return [];
  const raw = String(phone).replace(/@.*/, '').replace(/\D/g, '');
  const canonical = normalizeBrPhone(phone);
  const set = new Set<string>();
  const push = (v?: string) => { if (v) set.add(v); };
  push(raw);
  push(canonical);
  for (const v of brPhoneVariants(phone)) push(v);
  for (const v of getBrPhoneVariants(raw)) push(v);
  for (const v of getBrPhoneVariants(canonical)) push(v);
  // Also without country code 55 (some registros gravam sem DDI)
  for (const v of [...set]) {
    if (v.startsWith('55') && v.length >= 12) set.add(v.slice(2));
  }
  return [...set].filter(Boolean);
}

/**
 * Fetches campaign ad records that originated the contact, matching by
 * phone (either `campaign_data.phone` or via `sessions.whatsapp_number`).
 * Returns [] when the contact was not brought in by any campaign.
 */
export function useContactCampaigns(phone: string | null | undefined) {
  const variants = buildPhoneVariants(phone);

  return useQuery({
    queryKey: ['contact-campaigns', variants],
    queryFn: async () => {
      if (variants.length === 0) return [] as ContactCampaignRow[];
      const query = `
        SELECT ca.id,
               ca.created_at,
               (ca.campaign_data::jsonb) AS campaign_data
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::bigint
         WHERE regexp_replace(
                 COALESCE(
                   NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
                   s.whatsapp_number::text,
                   ''
                 ),
                 '\\D', '', 'g'
               ) = ANY($1::varchar[])
         ORDER BY ca.created_at DESC
         LIMIT 50
      `;
      const rows = await externalDb.raw<ContactCampaignRow>({
        query,
        params: [variants],
      });
      const out = rows || [];
      if (out.length === 0) {
        console.warn('[useContactCampaigns] no-match', { phone, variants });
      } else {
        console.info('[useContactCampaigns] lookup', { phone, variants, rowsFound: out.length });
      }
      return out;
    },
    enabled: variants.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

/**
 * Batched version of {@link useContactCampaigns}: takes a list of phones
 * and returns a Map keyed by the original (raw) phone → most recent
 * campaign row. Used by the chat list to decorate items with a Meta Ads
 * line without triggering N per-row queries.
 */
// Persistent in-memory cache across renders and hook instances.
// - HITS são mantidos para sempre na sessão (não re-consultados).
// - MISSES têm TTL curto (60s) para que conversas novas cujo `campaing_ads`
//   seja gravado logo após a chegada sejam re-consultadas e apareçam.
// TTL curto — permite que leads recém-chegados apareçam com Meta Ads
// assim que o webhook grava em `campaing_ads` (segundos após a mensagem).
const MISS_TTL_MS = 10_000;
// Fase 2 · item 13: LRU cap para evitar crescimento indefinido do cache
// em sessões longas com muitos telefones distintos.
const LRU_CAP = 2000;
type CacheEntry = { row: ContactCampaignRow | null; expires: number; touched: number };
const campaignPhoneCache = new Map<string, CacheEntry>();

function touchCache(key: string, entry: Omit<CacheEntry, 'touched'>) {
  campaignPhoneCache.set(key, { ...entry, touched: Date.now() });
  if (campaignPhoneCache.size > LRU_CAP) {
    const sorted = [...campaignPhoneCache.entries()].sort(
      (a, b) => a[1].touched - b[1].touched,
    );
    const drop = sorted.slice(0, campaignPhoneCache.size - LRU_CAP);
    for (const [k] of drop) campaignPhoneCache.delete(k);
  }
}

function isResolved(key: string): boolean {
  const e = campaignPhoneCache.get(key);
  if (!e) return false;
  if (e.row) return true; // hit — sempre válido
  return e.expires > Date.now(); // miss — válido enquanto não expirar
}

export function useContactsCampaignsMap(phones: (string | null | undefined)[]) {
  // Debounce input phone list — scroll-triggered updates coalesce into a single fetch.
  const [debouncedPhones, setDebouncedPhones] = React.useState<(string | null | undefined)[]>(phones);
  React.useEffect(() => {
    // Flush imediato quando houver phone novo (nunca visto no cache) — evita
    // segurar novos chats por 250 ms. Para simples re-renderizações, mantém
    // o debounce para agrupar updates.
    const hasNewPhone = phones.some(
      (p) => p && !campaignPhoneCache.has(String(p)),
    );
    if (hasNewPhone) {
      setDebouncedPhones(phones);
      return;
    }
    const id = setTimeout(() => setDebouncedPhones(phones), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phones.join('|')]);

  // Version bumps when the cache mutates so the returned map reflects freshly resolved phones.
  const [cacheVersion, setCacheVersion] = React.useState(0);

  // Periodic tick: a cada MISS_TTL_MS, força re-avaliação SOMENTE se houver
  // miss expirado real na lista atual — evita disparar re-render toda vez
  // que o tick estoura sem nada a fazer (era o comportamento anterior).
  React.useEffect(() => {
    const id = setInterval(() => {
      let hasExpiredMiss = false;
      const now = Date.now();
      for (const p of debouncedPhones) {
        if (!p) continue;
        const e = campaignPhoneCache.get(String(p));
        if (e && !e.row && e.expires <= now) {
          hasExpiredMiss = true;
          break;
        }
      }
      if (hasExpiredMiss) setCacheVersion((v) => v + 1);
    }, MISS_TTL_MS);
    return () => clearInterval(id);
  }, [debouncedPhones]);

  // Build "phone → variants" index; skip phones already resolved by the cache.
  const phoneToVariants = new Map<string, string[]>();
  const unresolvedVariants = new Set<string>();
  for (const p of debouncedPhones) {
    if (!p) continue;
    const key = String(p);
    if (phoneToVariants.has(key)) continue;
    const vs = buildPhoneVariants(p);
    if (vs.length === 0) continue;
    phoneToVariants.set(key, vs);
    if (isResolved(key)) continue; // hit persistente ou miss ainda válido
    for (const v of vs) unresolvedVariants.add(v);
  }
  const variantList = [...unresolvedVariants].sort();
  // Include cacheVersion in the key so the periodic tick re-runs the query
  // when there are still unresolved (or newly-expired-miss) phones.
  const cacheKey = `${variantList.join(',')}|v${cacheVersion}`;

  const query = useQuery({
    queryKey: ['contacts-campaigns-map', cacheKey],
    queryFn: async () => {
      if (variantList.length === 0) return null;
      const sql = `
        SELECT DISTINCT ON (matched_phone)
               ca.id,
               ca.created_at,
               (ca.campaign_data::jsonb) AS campaign_data,
               regexp_replace(
                 COALESCE(
                   NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
                   s.whatsapp_number::text,
                   ''
                 ),
                 '\\D', '', 'g'
               ) AS matched_phone
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::bigint
         WHERE regexp_replace(
                 COALESCE(
                   NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
                   s.whatsapp_number::text,
                   ''
                 ),
                 '\\D', '', 'g'
               ) = ANY($1::varchar[])
         ORDER BY matched_phone, ca.created_at DESC
      `;
      const rows = (await externalDb.raw<
        ContactCampaignRow & { matched_phone: string }
      >({ query: sql, params: [variantList] })) || [];
      // Index by matched_phone.
      const byMatched = new Map<string, ContactCampaignRow>();
      for (const r of rows) {
        if (r.matched_phone) byMatched.set(r.matched_phone, r);
      }
      // Fan-out: for each phone queried this round, cache hit OR confirmed miss.
      const now = Date.now();
      for (const [origPhone, vs] of phoneToVariants) {
        if (isResolved(origPhone)) continue;
        let hit: ContactCampaignRow | null = null;
        for (const v of vs) {
          const m = byMatched.get(v);
          if (m) { hit = m; break; }
        }
        touchCache(origPhone, {
          row: hit,
          // hits: sem expiração; misses: expiram em 60s
          expires: hit ? Number.POSITIVE_INFINITY : now + MISS_TTL_MS,
        });
      }
      return rows.length;
    },
    enabled: variantList.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  // Bump version whenever a fetch completes so consumers get the merged map.
  React.useEffect(() => {
    if (!query.isFetching && query.data !== undefined) {
      setCacheVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isFetching, query.dataUpdatedAt]);

  // Build the returned map from the persistent cache — includes ALL previously
  // resolved phones, so rows never lose their Meta Ads badge on scroll.
  const data = React.useMemo(() => {
    const result = new Map<string, ContactCampaignRow>();
    for (const p of debouncedPhones) {
      if (!p) continue;
      const key = String(p);
      const cached = campaignPhoneCache.get(key);
      if (cached?.row) result.set(key, cached.row);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPhones.join('|'), cacheVersion]);

  return { ...query, data };
}

export interface FirstInboundMessage {
  id: string;
  text: string | null;
  timestamp: string | null;
  conversation_id: string | null;
}

/**
 * Fetches the very first inbound message (from_me=false) the lead sent for
 * a given contact. Used to populate the "Frase do lead" block in the
 * Campanhas tab with the actual first chat message.
 */
export function useContactFirstInboundMessage(contactId: string | null | undefined) {
  return useQuery<FirstInboundMessage | null>({
    queryKey: ['contact-first-inbound', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, text, timestamp, conversation_id')
        .eq('contact_id', contactId)
        .eq('from_me', false)
        .not('text', 'is', null)
        .order('timestamp', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[useContactFirstInboundMessage] error', error);
        return null;
      }
      return (data as FirstInboundMessage) || null;
    },
    enabled: !!contactId,
    staleTime: 5 * 60_000,
  });
}