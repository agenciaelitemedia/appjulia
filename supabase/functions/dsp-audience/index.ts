// ============================================================
// dsp-audience — resolução de filtros, materialização e refresh de públicos
//
// Ações:
//   resolve_preview  { client_id, filters }        → { total, sample[] }
//   materialize      { audience_id, actor? }      → insere contatos resolvidos
//   refresh          { audience_id, apply, actor? } → diff (novos/removidos) e aplica
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { toE164Br, isValidBrPhone, phoneVariants } from '../_shared/dsp-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_AUDIENCE = 20000;

interface AudienceFilters {
  channel_type?: string | null;
  queue_ids?: string[];
  tag_ids?: string[];
  cod_agents?: string[];
  contact_search?: string | null;
  only_with_conversation?: boolean;
  conversation_status?: string[];
  assigned_to?: string[];
  last_interaction_days?: number | null;
  no_reply_days?: number | null;
  crm_julia_stage_ids?: number[];
  builder_board_ids?: string[];
  builder_pipeline_ids?: string[];
  builder_status?: string[];
  campaign_ids?: string[];
  campaign_result?: string | null;
  contract_status?: string[];
  in_followup?: boolean;
  limit?: number | null;
}

interface ResolvedContact {
  phone: string;
  name: string | null;
  contact_id: string | null;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function legacyQuery(query: string, params: unknown[]): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/db-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ action: 'raw', data: { query, params } }),
  });
  if (!res.ok) throw new Error(`db-query falhou (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const rows = json?.data ?? json?.result ?? json;
  return Array.isArray(rows) ? rows : [];
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

/** Chave de comparação tolerante ao 9º dígito. */
function key(phone: string): string {
  const variants = phoneVariants(phone).sort((a, b) => a.length - b.length);
  return variants[0] ?? phone;
}

// ------------------------------------------------------------
// Resolução dos filtros
// ------------------------------------------------------------
async function resolveFilters(clientId: string, f: AudienceFilters): Promise<ResolvedContact[]> {
  const sets: Map<string, ResolvedContact>[] = [];
  const names = new Map<string, string>();
  const ids = new Map<string, string>();

  const needsChat =
    !!f.channel_type ||
    (f.cod_agents?.length ?? 0) > 0 ||
    !!f.contact_search ||
    f.only_with_conversation ||
    (f.queue_ids?.length ?? 0) > 0 ||
    (f.conversation_status?.length ?? 0) > 0 ||
    (f.assigned_to?.length ?? 0) > 0 ||
    (f.tag_ids?.length ?? 0) > 0 ||
    typeof f.last_interaction_days === 'number' ||
    typeof f.no_reply_days === 'number';

  // ---- 1) Conversas (filas, status, responsável, tags, tempos) ----
  let conversationContactIds: string[] | null = null;
  const needsConversations =
    (f.queue_ids?.length ?? 0) > 0 ||
    (f.conversation_status?.length ?? 0) > 0 ||
    (f.assigned_to?.length ?? 0) > 0 ||
    (f.tag_ids?.length ?? 0) > 0 ||
    typeof f.no_reply_days === 'number' ||
    f.only_with_conversation === true;

  if (needsConversations) {
    let q = admin.from('chat_conversations').select('id, contact_id').eq('client_id', clientId).limit(MAX_AUDIENCE);
    if (f.queue_ids?.length) q = q.in('queue_id', f.queue_ids);
    if (f.conversation_status?.length) q = q.in('status', f.conversation_status);
    if (f.assigned_to?.length) q = q.in('assigned_to', f.assigned_to);
    if (typeof f.no_reply_days === 'number' && f.no_reply_days > 0) {
      q = q.lt('last_customer_message_at', daysAgoIso(f.no_reply_days));
    }
    const { data, error } = await q;
    if (error) throw error;
    let convs = (data ?? []) as { id: string; contact_id: string }[];

    if (f.tag_ids?.length) {
      const { data: tagRows, error: tagErr } = await admin
        .from('chat_conversation_tags')
        .select('conversation_id')
        .in('tag_id', f.tag_ids)
        .limit(MAX_AUDIENCE);
      if (tagErr) throw tagErr;
      const allowed = new Set((tagRows ?? []).map((r: any) => r.conversation_id));
      convs = convs.filter((c) => allowed.has(c.id));
    }
    conversationContactIds = [...new Set(convs.map((c) => c.contact_id).filter(Boolean))];
  }

  // ---- 2) Contatos do chat ----
  if (needsChat) {
    const set = new Map<string, ResolvedContact>();
    if (conversationContactIds && conversationContactIds.length === 0) {
      sets.push(set);
    } else {
      const chunks: string[][] = conversationContactIds
        ? chunk(conversationContactIds, 300)
        : [[]];
      for (const ch of chunks) {
        let q = admin
          .from('chat_contacts')
          .select('id, phone, name, wa_name, lead_full_name')
          .eq('client_id', clientId)
          .eq('is_group', false)
          .limit(MAX_AUDIENCE);
        if (ch.length) q = q.in('id', ch);
        if (f.channel_type) q = q.eq('channel_source', f.channel_type);
        if (f.cod_agents?.length) q = q.in('cod_agent', f.cod_agents);
        if (f.contact_search) q = q.or(`name.ilike.%${f.contact_search}%,phone.ilike.%${f.contact_search}%`);
        if (typeof f.last_interaction_days === 'number' && f.last_interaction_days > 0) {
          q = q.gte('last_message_at', daysAgoIso(f.last_interaction_days));
        }
        const { data, error } = await q;
        if (error) throw error;
        for (const row of (data ?? []) as any[]) {
          const phone = toE164Br(row.phone);
          if (!isValidBrPhone(phone)) continue;
          const k = key(phone);
          const name = row.name || row.wa_name || row.lead_full_name || null;
          set.set(k, { phone, name, contact_id: row.id });
          if (name) names.set(k, name);
          ids.set(k, row.id);
        }
      }
      sets.push(set);
    }
  }

  // ---- 3) CRM Builder (painéis / etapas / status) ----
  if ((f.builder_board_ids?.length ?? 0) > 0 || (f.builder_pipeline_ids?.length ?? 0) > 0 || (f.builder_status?.length ?? 0) > 0) {
    let q = admin
      .from('crm_deals')
      .select('contact_phone, contact_name')
      .eq('client_id', clientId)
      .limit(MAX_AUDIENCE);
    if (f.builder_board_ids?.length) q = q.in('board_id', f.builder_board_ids);
    if (f.builder_pipeline_ids?.length) q = q.in('pipeline_id', f.builder_pipeline_ids);
    if (f.builder_status?.length) q = q.in('status', f.builder_status);
    const { data, error } = await q;
    if (error) throw error;
    const set = new Map<string, ResolvedContact>();
    for (const row of (data ?? []) as any[]) {
      const phone = toE164Br(row.contact_phone);
      if (!isValidBrPhone(phone)) continue;
      const k = key(phone);
      set.set(k, { phone, name: row.contact_name ?? null, contact_id: null });
      if (row.contact_name && !names.has(k)) names.set(k, row.contact_name);
    }
    sets.push(set);
  }

  // ---- 4) Campanhas anteriores ----
  if ((f.campaign_ids?.length ?? 0) > 0) {
    let q = admin
      .from('dsp_recipients')
      .select('phone_e164, name, contact_id, status')
      .eq('client_id', clientId)
      .in('campaign_id', f.campaign_ids!)
      .limit(MAX_AUDIENCE);
    if (f.campaign_result === 'sent') q = q.in('status', ['sent', 'delivered', 'read', 'replied']);
    else if (f.campaign_result === 'replied') q = q.eq('status', 'replied');
    else if (f.campaign_result === 'failed') q = q.in('status', ['failed', 'error']);
    const { data, error } = await q;
    if (error) throw error;
    const set = new Map<string, ResolvedContact>();
    for (const row of (data ?? []) as any[]) {
      const phone = toE164Br(row.phone_e164);
      if (!isValidBrPhone(phone)) continue;
      const k = key(phone);
      set.set(k, { phone, name: row.name ?? null, contact_id: row.contact_id ?? null });
      if (row.name && !names.has(k)) names.set(k, row.name);
      if (row.contact_id && !ids.has(k)) ids.set(k, row.contact_id);
    }
    sets.push(set);
  }

  // ---- 5) Base legada (CRM Julia, contratos, follow-up) ----
  const codAgents = (f.cod_agents ?? []).filter(Boolean);

  if ((f.crm_julia_stage_ids?.length ?? 0) > 0 && codAgents.length) {
    const rows = await legacyQuery(
      `SELECT whatsapp_number, contact_name
         FROM crm_atendimento_cards
        WHERE cod_agent = ANY($1::text[])
          AND stage_id = ANY($2::int[])
        LIMIT ${MAX_AUDIENCE}`,
      [codAgents, f.crm_julia_stage_ids],
    );
    sets.push(legacySet(rows, 'whatsapp_number', 'contact_name', names));
  }

  if ((f.contract_status?.length ?? 0) > 0 && codAgents.length) {
    const rows = await legacyQuery(
      `SELECT DISTINCT whatsapp_number, signer_name
         FROM sing_document
        WHERE cod_agent = ANY($1::text[])
          AND status_document = ANY($2::text[])
        LIMIT ${MAX_AUDIENCE}`,
      [codAgents, f.contract_status],
    );
    sets.push(legacySet(rows, 'whatsapp_number', 'signer_name', names));
  }

  if (f.in_followup && codAgents.length) {
    const rows = await legacyQuery(
      `SELECT DISTINCT session_id::text AS whatsapp_number
         FROM public.followup_queue_temp
        WHERE cod_agent = ANY($1::bigint[])
        LIMIT ${MAX_AUDIENCE}`,
      [codAgents],
    );
    sets.push(legacySet(rows, 'whatsapp_number', null, names));
  }

  if (!sets.length) return [];

  // Interseção (AND) entre todos os grupos de filtros usados
  sets.sort((a, b) => a.size - b.size);
  const base = sets[0];
  const out: ResolvedContact[] = [];
  for (const [k, contact] of base) {
    if (sets.every((s) => s.has(k))) {
      out.push({
        phone: contact.phone,
        name: names.get(k) ?? contact.name ?? null,
        contact_id: ids.get(k) ?? contact.contact_id ?? null,
      });
    }
  }

  out.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const limit = Math.min(f.limit && f.limit > 0 ? f.limit : MAX_AUDIENCE, MAX_AUDIENCE);
  return out.slice(0, limit);
}

function legacySet(
  rows: any[],
  phoneCol: string,
  nameCol: string | null,
  names: Map<string, string>,
): Map<string, ResolvedContact> {
  const set = new Map<string, ResolvedContact>();
  for (const row of rows) {
    const phone = toE164Br(row[phoneCol]);
    if (!isValidBrPhone(phone)) continue;
    const k = key(phone);
    const name = nameCol ? (row[nameCol] ?? null) : null;
    set.set(k, { phone, name, contact_id: null });
    if (name && !names.has(k)) names.set(k, name);
  }
  return set;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------
// Persistência
// ------------------------------------------------------------
async function loadAudience(audienceId: string) {
  const { data, error } = await admin.from('dsp_audiences').select('*').eq('id', audienceId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Público não encontrado');
  return data as any;
}

async function insertContacts(
  audience: any,
  contacts: ResolvedContact[],
  source: string,
  actor: string | null,
): Promise<number> {
  let inserted = 0;
  for (const part of chunk(contacts, 500)) {
    const rows = part.map((c) => ({
      audience_id: audience.id,
      client_id: audience.client_id,
      phone_e164: c.phone,
      name: c.name,
      first_name: c.name ? String(c.name).trim().split(/\s+/)[0] : null,
      contact_id: c.contact_id,
      source,
      status: 'active',
      created_by: actor,
    }));
    const { error, count } = await admin
      .from('dsp_audience_contacts')
      .upsert(rows, { onConflict: 'audience_id,phone_e164', ignoreDuplicates: false, count: 'exact' } as any);
    if (error) throw error;
    inserted += count ?? part.length;
  }
  return inserted;
}

async function syncCounters(audienceId: string) {
  const { count: total } = await admin
    .from('dsp_audience_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('audience_id', audienceId)
    .eq('status', 'active');
  await admin
    .from('dsp_audiences')
    .update({ total_contacts: total ?? 0, last_resolved_at: new Date().toISOString() })
    .eq('id', audienceId);
  return total ?? 0;
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { action, ...payload } = await req.json();

    if (action === 'resolve_preview') {
      const clientId = String(payload.client_id ?? '');
      if (!clientId) return json({ error: 'client_id obrigatório' }, 400);
      const contacts = await resolveFilters(clientId, (payload.filters ?? {}) as AudienceFilters);
      return json({
        ok: true,
        total: contacts.length,
        sample: contacts.slice(0, Number(payload.sample_size ?? 200)),
      });
    }

    if (action === 'materialize') {
      const audience = await loadAudience(String(payload.audience_id ?? ''));
      if (audience.source_type !== 'filter') return json({ error: 'Público não é baseado em filtros' }, 400);
      const contacts = await resolveFilters(String(audience.client_id), (audience.filters ?? {}) as AudienceFilters);
      await insertContacts(audience, contacts, 'filter', payload.actor ?? null);
      const total = await syncCounters(audience.id);
      return json({ ok: true, resolved: contacts.length, total });
    }

    if (action === 'refresh') {
      const audience = await loadAudience(String(payload.audience_id ?? ''));
      if (audience.source_type !== 'filter') return json({ error: 'Público não é baseado em filtros' }, 400);

      const resolved = await resolveFilters(String(audience.client_id), (audience.filters ?? {}) as AudienceFilters);
      const resolvedKeys = new Map(resolved.map((c) => [key(c.phone), c]));

      const { data: current, error } = await admin
        .from('dsp_audience_contacts')
        .select('id, phone_e164, status')
        .eq('audience_id', audience.id)
        .limit(MAX_AUDIENCE);
      if (error) throw error;

      const currentKeys = new Map((current ?? []).map((r: any) => [key(r.phone_e164), r]));
      const toAdd = [...resolvedKeys.entries()].filter(([k]) => !currentKeys.has(k)).map(([, c]) => c);
      const toRemove = (current ?? []).filter(
        (r: any) => r.status === 'active' && !resolvedKeys.has(key(r.phone_e164)),
      );
      const toRestore = (current ?? []).filter(
        (r: any) => r.status === 'removed' && resolvedKeys.has(key(r.phone_e164)),
      );

      if (!payload.apply) {
        return json({
          ok: true,
          dry_run: true,
          resolved: resolved.length,
          current_active: (current ?? []).filter((r: any) => r.status === 'active').length,
          to_add: toAdd.length,
          to_remove: toRemove.length,
          to_restore: toRestore.length,
          sample_add: toAdd.slice(0, 50),
        });
      }

      if (toAdd.length) await insertContacts(audience, toAdd, 'filter', payload.actor ?? null);
      for (const part of chunk(toRemove.map((r: any) => r.id), 300)) {
        await admin
          .from('dsp_audience_contacts')
          .update({ status: 'removed', removed_at: new Date().toISOString() })
          .in('id', part);
      }
      for (const part of chunk(toRestore.map((r: any) => r.id), 300)) {
        await admin
          .from('dsp_audience_contacts')
          .update({ status: 'active', removed_at: null })
          .in('id', part);
      }
      const total = await syncCounters(audience.id);
      return json({
        ok: true,
        applied: true,
        added: toAdd.length,
        removed: toRemove.length,
        restored: toRestore.length,
        total,
      });
    }

    if (action === 'recount') {
      const total = await syncCounters(String(payload.audience_id ?? ''));
      return json({ ok: true, total });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error('[dsp-audience]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
