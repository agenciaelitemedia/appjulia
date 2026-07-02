import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';
import { brPhoneVariants, normalizeBrPhone } from '@/lib/phoneNormalize';
import type { ContactCampaignRow } from './useContactCampaigns';
import type { PhoneStageInfo, PhoneAgentPair } from '@/hooks/useCRMStageByPhone';
import type { SessionPair } from '@/hooks/useAgentSessionStatusesBatch';

/**
 * Fase 2 · aggregator hook — substitui, no `ChatList`, as 3 chamadas
 * separadas (`useContactsCampaignsMap` + `useCRMStageByPhone` +
 * `useAgentSessionStatusesBatch`) por uma única invocação da edge function
 * `db-query` action `chat_bootstrap`. As 3 SELECTs continuam existindo,
 * mas rodam em paralelo dentro de uma mesma conexão do pool — 1 HTTP
 * round-trip em vez de 3, com 1 ciclo de retry em vez de 3.
 *
 * As saídas mantêm os mesmos formatos dos hooks originais para que os
 * consumidores existentes no `ChatList` continuem funcionando sem
 * alterações estruturais.
 */

// Persistent Meta-Ads cache — mesmo padrão do `useContactsCampaignsMap`.
// Hits vivem para sempre nesta sessão; misses expiram rapidamente para que
// leads que ainda não tinham `campaing_ads` gravado sejam reavaliados.
// LRU cap para evitar crescimento indefinido em sessões longas.
// TTL curto para que leads recém-chegados cuja campanha ainda não foi
// gravada em `campaing_ads` sejam reavaliados rapidamente (o webhook do
// Meta Ads costuma gravar em segundos). Um TTL longo fazia novos chats
// aparecerem sem badge por até 1 minuto.
const MISS_TTL_MS = 10_000;
const LRU_CAP = 10_000;
type CampCacheEntry = { row: ContactCampaignRow | null; expires: number; touched: number };
const campaignPhoneCache = new Map<string, CampCacheEntry>();

function touchCache(key: string, entry: CampCacheEntry) {
  campaignPhoneCache.set(key, { ...entry, touched: Date.now() });
  if (campaignPhoneCache.size > LRU_CAP) {
    // Evict misses first, then oldest hits. A burst of non-campaign phones must
    // never evict resolved campaign hits, otherwise the Meta Ads badge flashes
    // when the user scrolls or new conversations arrive.
    const sorted = [...campaignPhoneCache.entries()].sort((a, b) => {
      const aIsHit = !!a[1].row;
      const bIsHit = !!b[1].row;
      if (aIsHit !== bIsHit) return aIsHit ? 1 : -1;
      return a[1].touched - b[1].touched;
    });
    const toDrop = sorted.slice(0, campaignPhoneCache.size - LRU_CAP);
    for (const [k] of toDrop) campaignPhoneCache.delete(k);
  }
}

function buildCampaignVariants(phone: string): string[] {
  const raw = String(phone).replace(/@.*/, '').replace(/\D/g, '');
  const canonical = normalizeBrPhone(phone);
  const set = new Set<string>();
  const push = (v?: string) => { if (v) set.add(v); };
  push(raw);
  push(canonical);
  for (const v of brPhoneVariants(phone)) push(v);
  for (const v of getBrPhoneVariants(raw)) push(v);
  for (const v of getBrPhoneVariants(canonical)) push(v);
  for (const v of [...set]) {
    if (v.startsWith('55') && v.length >= 12) set.add(v.slice(2));
  }
  return [...set].filter(Boolean);
}

function getCachedCampaignEntry(phone: string, variants?: string[]): CampCacheEntry | undefined {
  const direct = campaignPhoneCache.get(phone);
  if (direct?.row) return direct;

  const vs = variants ?? buildCampaignVariants(phone);
  for (const v of vs) {
    const cached = campaignPhoneCache.get(v);
    if (cached?.row) return cached;
  }

  if (direct && direct.expires > Date.now()) return direct;
  return direct;
}

function isCampaignPhoneResolved(phone: string, variants?: string[]): boolean {
  const cached = getCachedCampaignEntry(phone, variants);
  if (!cached) return false;
  if (cached.row) return true;
  return cached.expires > Date.now();
}

function touchCampaignAliases(phone: string, variants: string[], row: ContactCampaignRow | null, now: number) {
  const expires = row ? Number.POSITIVE_INFINITY : now + MISS_TTL_MS;
  touchCache(phone, { row, expires, touched: now });

  // Cache hits under every normalized variant too. The chat row may later be
  // rendered with a different phone format (raw, canonical, legacy, no DDI),
  // and looking up only the original key makes the Meta Ads line appear/disappear.
  if (row) {
    for (const v of variants) {
      touchCache(v, { row, expires, touched: now });
    }
  }
}

export interface UseChatBootstrapInput {
  /** Telefones (raw) para lookup de Meta Ads */
  campaignPhones: string[];
  /** (phone, codAgent) para lookup de etapa CRM */
  crmPairs: PhoneAgentPair[];
  /** (phone, codAgent) para lookup de status de sessão Julia */
  sessionPairs: SessionPair[];
}

export interface UseChatBootstrapResult {
  campaignByPhone: Map<string, ContactCampaignRow>;
  stageByPhone: Map<string, PhoneStageInfo>;
  sessionActiveMap: Map<string, boolean>;
  isFetching: boolean;
  stageByPhoneFetching: boolean;
  sessionStatusesFetching: boolean;
}

export function useChatBootstrap(
  input: UseChatBootstrapInput,
): UseChatBootstrapResult {
  const { campaignPhones, crmPairs, sessionPairs } = input;

  // ---------- Meta Ads variants (com cache persistente) ----------
  // Debounce dinâmico: quando aparece telefone NOVO (nunca visto no cache),
  // aplicamos flush imediato para não segurar novos chats por 250 ms. Só
  // debouncamos quando a mudança é apenas re-ordenação/paginção da lista.
  const [debouncedPhones, setDebouncedPhones] = React.useState<string[]>(campaignPhones);
  React.useEffect(() => {
    const hasNewPhone = campaignPhones.some(
      (p) => p && !campaignPhoneCache.has(String(p)),
    );
    if (hasNewPhone) {
      setDebouncedPhones(campaignPhones);
      return;
    }
    const id = setTimeout(() => setDebouncedPhones(campaignPhones), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignPhones.join('|')]);

  const [cacheVersion, setCacheVersion] = React.useState(0);

  // Tick apenas dispara re-render quando há de fato phone com miss expirado
  // aguardando nova avaliação — antes o setInterval acordava toda a lista
  // a cada 60s mesmo sem trabalho a fazer.
  React.useEffect(() => {
    const id = setInterval(() => {
      let hasExpiredMiss = false;
      const now = Date.now();
      for (const p of debouncedPhones) {
        if (!p) continue;
        const e = getCachedCampaignEntry(String(p));
        if (e && !e.row && e.expires <= now) { hasExpiredMiss = true; break; }
      }
      if (hasExpiredMiss) setCacheVersion((v) => v + 1);
    }, MISS_TTL_MS);
    return () => clearInterval(id);
  }, [debouncedPhones]);

  const campaignPhoneToVariants = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of debouncedPhones) {
      if (!p) continue;
      const key = String(p);
      if (m.has(key)) continue;
      const vs = buildCampaignVariants(p);
      if (vs.length > 0) m.set(key, vs);
    }
    return m;
  }, [debouncedPhones]);

  const unresolvedCampaignVariants = React.useMemo(() => {
    const set = new Set<string>();
    for (const [key, vs] of campaignPhoneToVariants) {
      if (isCampaignPhoneResolved(key, vs)) continue;
      for (const v of vs) set.add(v);
    }
    return [...set].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignPhoneToVariants, cacheVersion]);

  // ---------- CRM stages variants ----------
  const crmPhoneVariants = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of crmPairs) {
      const digits = (p.phone || '').replace(/\D/g, '');
      if (!digits) continue;
      for (const v of getBrPhoneVariants(digits)) set.add(v);
    }
    return [...set].sort();
  }, [crmPairs]);

  // ---------- Session pairs (cleaned) ----------
  const cleanedSessionPairs = React.useMemo(() => {
    return sessionPairs
      .map((p) => ({
        whatsappNumber: String(p.whatsappNumber || '').replace(/\D/g, ''),
        codAgent: String(p.codAgent || ''),
      }))
      .filter((p) => p.whatsappNumber && p.codAgent);
  }, [sessionPairs]);

  // Composite dedup key para o React Query
  const bootstrapKey = React.useMemo(() => {
    const cKey = unresolvedCampaignVariants.join(',');
    const rKey = crmPhoneVariants.join(',');
    const sKey = [...new Set(cleanedSessionPairs.map((p) => `${p.whatsappNumber}:${p.codAgent}`))]
      .sort()
      .join(',');
    // Version only matters for campaign misses that expire before React Query's
    // staleTime. Do not include it when there are no campaign phones pending,
    // otherwise CRM/session batches would refetch forever after every response.
    const campaignRetryKey = unresolvedCampaignVariants.length > 0 ? `v${cacheVersion}` : 'v0';
    return `${cKey}||${rKey}||${sKey}||${campaignRetryKey}`;
  }, [unresolvedCampaignVariants, crmPhoneVariants, cleanedSessionPairs, cacheVersion]);

  const enabled =
    unresolvedCampaignVariants.length > 0 ||
    crmPhoneVariants.length > 0 ||
    cleanedSessionPairs.length > 0;

  const query = useQuery({
    queryKey: ['chat-bootstrap', bootstrapKey],
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await externalDb.getChatBootstrap({
        campaignPhoneVariants: unresolvedCampaignVariants,
        crmPhoneVariants,
        sessionPairs: cleanedSessionPairs,
      });

      // Fan-out Meta Ads → cache persistente por telefone
      const byMatched = new Map<string, ContactCampaignRow>();
      for (const r of res.campaigns || []) {
        if (r.matched_phone) {
          byMatched.set(r.matched_phone, {
            id: r.id,
            created_at: r.created_at,
            campaign_data: r.campaign_data,
          });
        }
      }
      const now = Date.now();
      for (const [origPhone, vs] of campaignPhoneToVariants) {
        if (isCampaignPhoneResolved(origPhone, vs)) continue;
        let hit: ContactCampaignRow | null = null;
        for (const v of vs) {
          const m = byMatched.get(v);
          if (m) { hit = m; break; }
        }
        touchCampaignAliases(origPhone, vs, hit, now);
      }

      return res;
    },
  });

  // Bump version quando o fetch resolver — atualiza o mapa exposto
  React.useEffect(() => {
    if (!query.isFetching && query.data !== undefined) {
      setCacheVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isFetching, query.dataUpdatedAt]);

  // ---------- Reconstruir os 3 Maps ----------
  const campaignByPhone = React.useMemo(() => {
    const map = new Map<string, ContactCampaignRow>();
    for (const [key, cached] of campaignPhoneCache) {
      if (cached?.row) map.set(key, cached.row);
    }
    for (const p of debouncedPhones) {
      if (!p || map.has(String(p))) continue;
      const cached = getCachedCampaignEntry(String(p));
      if (cached?.row) map.set(String(p), cached.row);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPhones.join('|'), cacheVersion]);

  const stageByPhone = React.useMemo(() => {
    const map = new Map<string, PhoneStageInfo>();
    const rows = query.data?.crmStages ?? [];
    const phoneOnlySeen = new Set<string>();
    for (const r of rows) {
      const stored = String(r.whatsapp_number);
      const codAgent = String(r.cod_agent);
      const info: PhoneStageInfo = {
        stageId: Number(r.stage_id),
        stageName: r.stage_name ?? undefined,
        stageColor: r.stage_color ?? undefined,
      };
      const variants = getBrPhoneVariants(stored);
      for (const v of variants) map.set(`${v}|${codAgent}`, info);
      map.set(`${stored}|${codAgent}`, info);
      for (const v of variants) {
        if (!phoneOnlySeen.has(v)) {
          phoneOnlySeen.add(v);
          map.set(v, info);
        }
      }
      if (!phoneOnlySeen.has(stored)) {
        phoneOnlySeen.add(stored);
        map.set(stored, info);
      }
    }
    return map;
  }, [query.data]);

  const sessionActiveMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    const rows = query.data?.sessions ?? [];
    // Colapsa por (canonical phone, codAgent) preferindo active=true.
    const canonical = new Map<string, boolean>();
    for (const r of rows) {
      const rawPhone = String(r.whatsapp_number || '').replace(/\D/g, '');
      const codAgent = String(r.cod_agent || '');
      if (!rawPhone || !codAgent) continue;
      const canonPhone = normalizeBrPhone(rawPhone) || rawPhone;
      const key = `${canonPhone}:${codAgent}`;
      const incoming = !!r.active;
      const prev = canonical.get(key);
      canonical.set(key, prev === undefined ? incoming : prev || incoming);
    }
    canonical.forEach((active, key) => {
      const sep = key.lastIndexOf(':');
      const phone = key.slice(0, sep);
      const codAgent = key.slice(sep + 1);
      for (const v of brPhoneVariants(phone)) {
        map.set(`${v}:${codAgent}`, active);
      }
    });
    return map;
  }, [query.data]);

  return {
    campaignByPhone,
    stageByPhone,
    sessionActiveMap,
    isFetching: query.isFetching,
    stageByPhoneFetching: query.isFetching && crmPhoneVariants.length > 0,
    sessionStatusesFetching: query.isFetching && cleanedSessionPairs.length > 0,
  };
}