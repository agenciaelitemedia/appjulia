// MVP /mvp-chat — feed consolidado da lista de conversas.
//
// Objetivo: 1 round-trip HTTP do frontend devolve o card COMPLETO (badges de
// CRM da Julia, CRM Builder, ticket, Meta Ads, sessão Julia, SLA) já filtrado,
// ordenado e paginado no servidor.
//
// Isolado de propósito: não altera nem reutiliza nenhuma action do `db-query`
// e não toca em nenhuma função/query existente. Possui sua própria conexão com
// o Postgres legado (mesmo padrão de TLS/socket do projeto).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ------------------------------- external DB ------------------------------ */

function normalizeCaCert(input: string): string[] {
  let text = input.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!text.includes("BEGIN CERTIFICATE")) {
    try {
      const decoded = atob(text);
      if (decoded.includes("BEGIN CERTIFICATE")) text = decoded;
    } catch { /* ignore */ }
  }
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks) return [];
  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;
  return blocks.map((block) => {
    const b64 = block
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "");
    return `-----BEGIN CERTIFICATE-----\n${wrap64(b64)}\n-----END CERTIFICATE-----\n`;
  });
}

const rawCa = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
const caCerts = rawCa ? normalizeCaCert(rawCa) : [];
let pool: ReturnType<typeof postgres> | null = null;

function getPool() {
  if (pool) return pool;
  const url = (Deno.env.get("EXTERNAL_DB_URL") ?? "").trim();
  const isUnixSocket = url.includes("/.s.PGSQL.") || url.startsWith("socket:")
    || (Deno.env.get("EXTERNAL_DB_HOST") ?? "").includes("/.s.PGSQL.");
  const ssl = isUnixSocket ? false : caCerts.length > 0 ? { caCerts, rejectUnauthorized: true } : "require" as const;
  const opts = {
    ssl,
    connect_timeout: 15,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    max: 3,
    prepare: false,
    onconnect: async (conn: any) => {
      try {
        await conn.unsafe("SET statement_timeout = 20000");
        await conn.unsafe("SET timezone = 'America/Sao_Paulo'");
      } catch { /* ignore */ }
    },
  };
  pool = url
    ? postgres(url, opts as any)
    : postgres({
      host: Deno.env.get("EXTERNAL_DB_HOST"),
      port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "25061"),
      database: Deno.env.get("EXTERNAL_DB_DATABASE"),
      username: Deno.env.get("EXTERNAL_DB_USERNAME"),
      password: Deno.env.get("EXTERNAL_DB_PASSWORD"),
      ...opts,
    } as any);
  return pool;
}

/* ------------------------------- phone utils ------------------------------ */

function digits(v: unknown): string {
  return String(v ?? "").replace(/@.*/, "").replace(/\D/g, "");
}

/** Variações BR (com/sem 9º dígito, com/sem 55). */
function phoneVariants(phone: unknown): string[] {
  const d = digits(phone);
  if (!d) return [];
  const out = new Set<string>([d]);
  const withCc = d.startsWith("55") ? d : `55${d}`;
  out.add(withCc);
  const body = withCc.slice(2);
  const ddd = body.slice(0, 2);
  const rest = body.slice(2);
  if (rest.length === 9 && rest.startsWith("9")) {
    out.add(`55${ddd}${rest.slice(1)}`);
    out.add(`${ddd}${rest.slice(1)}`);
  } else if (rest.length === 8) {
    out.add(`55${ddd}9${rest}`);
    out.add(`${ddd}9${rest}`);
  }
  out.add(body);
  return [...out].filter(Boolean);
}

/** Chave canônica para casar telefones entre os dois bancos. */
function phoneKey(phone: unknown): string {
  const d = digits(phone);
  if (!d) return "";
  const withCc = d.startsWith("55") ? d : `55${d}`;
  const body = withCc.slice(2);
  const ddd = body.slice(0, 2);
  let rest = body.slice(2);
  if (rest.length === 9 && rest.startsWith("9")) rest = rest.slice(1);
  return `${ddd}${rest}`;
}

/* --------------------------------- types --------------------------------- */

interface Filters {
  client_id: string;
  queue_ids?: string[] | null;
  status?: string | null;
  tab?: string | null;
  owner?: string | null;
  owners?: string[] | null;
  unassigned?: boolean | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  tag_ids?: string[] | null;
  priority?: string | null;
  has_ticket?: boolean | null;
  has_crm_builder?: boolean | null;
  sla_status?: string[] | null;
  /** Filtros que dependem do banco legado (aplicados após o merge). */
  julia_stage?: string | null;
  julia_stage_ids?: (string | number)[] | null;
  julia_mode?: "julia" | "human" | null;
  has_campaign?: boolean | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
  /** Ignora o cache do banco legado (botão "Recarregar"). */
  refresh?: boolean | null;
}

const HARD_CAP = 1500;

/** Janelas de invalidação do cache do banco legado (segundos). */
const TTL_HOT = 60;      // conversas com mensagem nas últimas 24h
const TTL_COLD = 600;    // conversas antigas

interface LegacyEntry {
  julia_stage_id: string | null;
  julia_stage_name: string | null;
  julia_stage_color: string | null;
  has_julia_card: boolean;
  session_is_active: boolean | null;
  campaign: any | null;
  stale?: boolean;
}

/** Resumo compacto e seguro dos parâmetros (sem PII de busca completa). */
function summarizeParams(b: Filters, extra: Record<string, unknown> = {}) {
  return {
    client_id: String(b.client_id ?? ""),
    queue_ids: b.queue_ids?.length ?? 0,
    status: b.status ?? null,
    tab: b.tab ?? null,
    owner: b.owner ? "set" : null,
    owners: b.owners?.length ?? 0,
    unassigned: b.unassigned ?? null,
    search_len: b.search ? String(b.search).trim().length : 0,
    from: b.from ?? null,
    to: b.to ?? null,
    tag_ids: b.tag_ids?.length ?? 0,
    priority: b.priority ?? null,
    has_ticket: b.has_ticket ?? null,
    has_crm_builder: b.has_crm_builder ?? null,
    sla_status: b.sla_status?.length ?? 0,
    julia_stage: b.julia_stage ?? null,
    julia_stage_ids: b.julia_stage_ids?.length ?? 0,
    julia_mode: b.julia_mode ?? null,
    has_campaign: b.has_campaign ?? null,
    sort: b.sort ?? "recent",
    limit: b.limit ?? null,
    offset: b.offset ?? null,
    refresh: b.refresh ?? false,
    ...extra,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const reqId = crypto.randomUUID().slice(0, 8);
  let body: Filters;
  try {
    body = await req.json();
  } catch {
    console.error(`[mvp-chat-list-feed][${reqId}] invalid JSON body`);
    return json({ error: "Invalid JSON body", req_id: reqId }, 400);
  }
  if (!body?.client_id) {
    console.error(`[mvp-chat-list-feed][${reqId}] missing client_id; keys=${Object.keys(body ?? {}).join(",")}`);
    return json({ error: "client_id is required", req_id: reqId }, 400);
  }

  const limit = Math.min(Math.max(Number(body.limit ?? 30), 1), 200);
  const offset = Math.max(Number(body.offset ?? 0), 0);

  const stageIds = (body.julia_stage_ids ?? []).map((s) => String(s)).filter(Boolean);

  // Filtros que só podem ser avaliados depois do merge com o banco legado.
  const needsPostFilter = Boolean(
    body.julia_stage || stageIds.length || body.julia_mode || body.has_campaign != null,
  );

  console.log(
    `[mvp-chat-list-feed][${reqId}] request`,
    JSON.stringify(summarizeParams(body, {
      options_mode: (body as any).options === true,
      needs_post_filter: needsPostFilter,
    })),
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );


  /* --------------------- modo "options": listas de filtros ------------------ */
  if ((body as any).options === true) {
    const [ownersRes, stagesRes] = await Promise.all([
      supabase
        .from("chat_conversations")
        .select("assigned_to")
        .eq("client_id", String(body.client_id))
        .not("assigned_to", "is", null)
        .limit(5000),
      supabase
        .from("mvp_chat_legacy_cache")
        .select("julia_stage_id, julia_stage_name")
        .eq("client_id", String(body.client_id))
        .eq("has_julia_card", true)
        .limit(5000),
    ]);
    const owners = [...new Set(((ownersRes.data as any[]) ?? []).map((r) => String(r.assigned_to ?? "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    const stageMap = new Map<string, string>();
    for (const s of ((stagesRes.data as any[]) ?? [])) {
      if (s.julia_stage_id != null) stageMap.set(String(s.julia_stage_id), s.julia_stage_name ?? String(s.julia_stage_id));
    }
    const stages = [...stageMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    return json({ owners, stages });
  }

  /* ---------------------------- SQL A · Supabase --------------------------- */
  const tA = Date.now();
  const rpcParams = {
    p_client_id: String(body.client_id),
    p_queue_ids: body.queue_ids?.length ? body.queue_ids : null,
    p_status: body.status || null,
    p_tab: body.tab || null,
    p_owner: body.owner || null,
    p_owners: body.owners?.length ? body.owners : null,
    p_unassigned: body.unassigned ?? null,
    p_search: body.search || null,
    p_from: body.from || null,
    p_to: body.to || null,
    p_tag_ids: body.tag_ids?.length ? body.tag_ids : null,
    p_priority: body.priority || null,
    p_has_ticket: body.has_ticket ?? null,
    p_has_crm_builder: body.has_crm_builder ?? null,
    p_sla_status: body.sla_status?.length ? body.sla_status : null,
    p_sort: body.sort || "recent",
    p_limit: needsPostFilter ? HARD_CAP : limit,
    p_offset: needsPostFilter ? 0 : offset,
  };
  const rpcArgNames = Object.keys(rpcParams);
  const { data: feed, error: rpcError } = await supabase.rpc("mvp_chat_list_feed", rpcParams);
  const msSupabase = Date.now() - tA;

  if (rpcError) {
    const code = (rpcError as any)?.code ?? null;
    const details = (rpcError as any)?.details ?? null;
    const hint = (rpcError as any)?.hint ?? null;
    // PGRST203 = múltiplas funções candidatas com a mesma assinatura lógica.
    const ambiguous = code === "PGRST203"
      || /best candidate function/i.test(String(rpcError.message ?? ""));
    console.error(
      `[mvp-chat-list-feed][${reqId}] rpc error`,
      JSON.stringify({
        code,
        message: rpcError.message,
        details,
        hint,
        ambiguous_overload: ambiguous,
        supabase_ms: msSupabase,
        arg_count: rpcArgNames.length,
        arg_names: rpcArgNames,
        null_args: rpcArgNames.filter((k) => (rpcParams as any)[k] == null),
        params: summarizeParams(body, { needs_post_filter: needsPostFilter }),
      }),
    );
    if (ambiguous) {
      console.error(
        `[mvp-chat-list-feed][${reqId}] existem múltiplas versões de public.mvp_chat_list_feed no banco; ` +
        `remova as assinaturas antigas (a esperada tem ${rpcArgNames.length} argumentos: ${rpcArgNames.join(", ")})`,
      );
    }
    return json({
      error: rpcError.message,
      req_id: reqId,
      diagnostics: { code, details, hint, ambiguous_overload: ambiguous, arg_names: rpcArgNames },
    }, 500);
  }


  let rows: any[] = Array.isArray(feed?.rows) ? feed.rows : [];
  const counters = feed?.counters ?? {};

  /* ------------- cache do banco legado (invalidação por janela) ------------- */
  const nowMs = Date.now();
  const wanted = new Map<string, { phone: unknown; phone_key: string; cod_agent: string; ttl: number }>();
  for (const r of rows) {
    const key = phoneKey(r.phone);
    if (!key) continue;
    const cod = r.queue_cod_agent ? String(r.queue_cod_agent) : "";
    const ref = r.last_message_at ?? r.conversation_updated_at;
    const hot = ref ? nowMs - new Date(ref).getTime() < 864e5 : false;
    const ttl = hot ? TTL_HOT : TTL_COLD;
    const k = `${key}|${cod}`;
    const prev = wanted.get(k);
    if (!prev || ttl < prev.ttl) wanted.set(k, { phone: r.phone, phone_key: key, cod_agent: cod, ttl });
  }

  const legacy = new Map<string, LegacyEntry>();
  const missing: { phone: unknown; phone_key: string; cod_agent: string }[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;
  let msCache = 0;
  let usedStale = false;

  if (wanted.size > 0) {
    const tC = Date.now();
    const phoneKeys = [...new Set([...wanted.values()].map((w) => w.phone_key))];
    const { data: cached, error: cacheError } = await supabase
      .from("mvp_chat_legacy_cache")
      .select(
        "phone_key, cod_agent, julia_stage_id, julia_stage_name, julia_stage_color, has_julia_card, session_is_active, campaign, fetched_at",
      )
      .eq("client_id", String(body.client_id))
      .in("phone_key", phoneKeys);
    msCache = Date.now() - tC;
    if (cacheError) console.warn("[mvp-chat-list-feed] cache read error", cacheError.message);

    const byKey = new Map<string, any>();
    for (const c of cached ?? []) byKey.set(`${c.phone_key}|${c.cod_agent ?? ""}`, c);

    for (const [k, w] of wanted) {
      const c = byKey.get(k);
      const fresh = !!c && nowMs - new Date(c.fetched_at).getTime() < w.ttl * 1000;
      if (c) {
        legacy.set(k, {
          julia_stage_id: c.julia_stage_id ?? null,
          julia_stage_name: c.julia_stage_name ?? null,
          julia_stage_color: c.julia_stage_color ?? null,
          has_julia_card: !!c.has_julia_card,
          session_is_active: c.session_is_active ?? null,
          campaign: c.campaign ?? null,
          stale: !fresh,
        });
      }
      if (body.refresh || !fresh) {
        missing.push({ phone: w.phone, phone_key: w.phone_key, cod_agent: w.cod_agent });
        if (!c) cacheMisses++;
      } else {
        cacheHits++;
      }
    }
  }

  /* ---------------------------- SQL B · externo ---------------------------- */
  const variantSet = new Set<string>();
  const codAgents = new Set<string>();
  for (const m of missing) {
    for (const v of phoneVariants(m.phone)) variantSet.add(v);
    if (m.cod_agent) codAgents.add(m.cod_agent);
  }
  const variants = [...variantSet];
  const codes = [...codAgents];

  let msExternal = 0;
  let externalError: string | null = null;
  const stageByKey = new Map<string, any>();
  const sessionByKey = new Map<string, boolean | null>();
  const campaignByKey = new Map<string, any>();

  if (missing.length > 0 && variants.length > 0) {
    const tB = Date.now();
    try {
      const sql = getPool();
      const extRows = await sql.unsafe(
        `WITH stages AS (
           SELECT DISTINCT ON (c.whatsapp_number, c.cod_agent::text)
                  c.whatsapp_number::text AS phone,
                  c.cod_agent::text       AS cod_agent,
                  c.stage_id,
                  st.name  AS stage_name,
                  st.color AS stage_color,
                  c.updated_at
             FROM crm_atendimento_cards c
             LEFT JOIN crm_atendimento_stages st ON st.id = c.stage_id
            WHERE c.whatsapp_number::text = ANY($1::varchar[])
            ORDER BY c.whatsapp_number, c.cod_agent::text, c.updated_at DESC NULLS LAST
         ),
         sess AS (
           SELECT DISTINCT ON (s.whatsapp_number::text, a.cod_agent::text)
                  s.whatsapp_number::text AS phone,
                  a.cod_agent::text       AS cod_agent,
                  s.active
             FROM sessions s
             JOIN agents a ON a.id = s.agent_id
            WHERE s.whatsapp_number::text = ANY($1::varchar[])
              AND ($2::varchar[] IS NULL OR a.cod_agent::text = ANY($2::varchar[]))
            ORDER BY s.whatsapp_number::text, a.cod_agent::text, s.created_at DESC
         ),
         camps AS (
           SELECT DISTINCT ON (matched_phone)
                  matched_phone AS phone,
                  id, created_at, campaign_data
             FROM (
               SELECT ca.id,
                      ca.created_at,
                      (ca.campaign_data::jsonb) AS campaign_data,
                      regexp_replace(
                        COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone', ''), s.whatsapp_number::text, ''),
                        '\\D', '', 'g'
                      ) AS matched_phone
                 FROM campaing_ads ca
                 LEFT JOIN sessions s ON s.id = ca.session_id::bigint
             ) x
            WHERE matched_phone = ANY($1::varchar[])
            ORDER BY matched_phone, created_at DESC
         )
         SELECT 'stage' AS kind, phone, cod_agent,
                jsonb_build_object('stage_id', stage_id, 'stage_name', stage_name, 'stage_color', stage_color) AS payload
           FROM stages
         UNION ALL
         SELECT 'session', phone, cod_agent, jsonb_build_object('active', active) FROM sess
         UNION ALL
         SELECT 'campaign', phone, NULL, jsonb_build_object('id', id, 'created_at', created_at, 'campaign_data', campaign_data)
           FROM camps`,
        [variants, codes.length ? codes : null],
      );
      for (const r of extRows as any[]) {
        const key = phoneKey(r.phone);
        if (!key) continue;
        if (r.kind === "stage") {
          const composite = `${key}|${r.cod_agent ?? ""}`;
          stageByKey.set(composite, r.payload);
          if (!stageByKey.has(key)) stageByKey.set(key, r.payload);
        } else if (r.kind === "session") {
          const composite = `${key}|${r.cod_agent ?? ""}`;
          sessionByKey.set(composite, r.payload?.active ?? null);
          if (!sessionByKey.has(key)) sessionByKey.set(key, r.payload?.active ?? null);
        } else if (r.kind === "campaign") {
          if (!campaignByKey.has(key)) campaignByKey.set(key, r.payload);
        }
      }

      // grava o resultado fresco no cache (inclusive "sem dado", cache negativo)
      const upserts = missing.map((m) => {
        const composite = `${m.phone_key}|${m.cod_agent}`;
        const stage = stageByKey.get(composite) ?? stageByKey.get(m.phone_key) ?? null;
        const sessionActive = sessionByKey.has(composite)
          ? sessionByKey.get(composite)
          : (sessionByKey.get(m.phone_key) ?? null);
        const campaign = campaignByKey.get(m.phone_key) ?? null;
        const entry: LegacyEntry = {
          julia_stage_id: stage?.stage_id != null ? String(stage.stage_id) : null,
          julia_stage_name: stage?.stage_name ?? null,
          julia_stage_color: stage?.stage_color ?? null,
          has_julia_card: !!stage,
          session_is_active: sessionActive ?? null,
          campaign: campaign
            ? { id: campaign.id, created_at: campaign.created_at, campaign_data: campaign.campaign_data }
            : null,
        };
        legacy.set(composite, entry);
        return {
          client_id: String(body.client_id),
          phone_key: m.phone_key,
          cod_agent: m.cod_agent,
          ...entry,
          fetched_at: new Date().toISOString(),
        };
      });
      if (upserts.length) {
        const { error: upErr } = await supabase
          .from("mvp_chat_legacy_cache")
          .upsert(upserts, { onConflict: "client_id,phone_key,cod_agent" });
        if (upErr) console.warn("[mvp-chat-list-feed] cache write error", upErr.message);
      }
    } catch (e) {
      externalError = (e as Error)?.message ?? "external db error";
      console.warn("[mvp-chat-list-feed] external error", externalError);
    }
    msExternal = Date.now() - tB;
  }

  /* --------------------------------- merge -------------------------------- */
  rows = rows.map((r) => {
    const key = phoneKey(r.phone);
    const cod = r.queue_cod_agent ? String(r.queue_cod_agent) : "";
    const entry = legacy.get(`${key}|${cod}`) ?? legacy.get(`${key}|`) ?? null;
    if (entry?.stale) usedStale = true;
    return {
      ...r,
      phone_key: key,
      julia_stage_id: entry?.julia_stage_id ?? null,
      julia_stage_name: entry?.julia_stage_name ?? null,
      julia_stage_color: entry?.julia_stage_color ?? null,
      has_julia_card: entry?.has_julia_card ?? false,
      session_is_active: entry?.session_is_active ?? null,
      campaign: entry?.campaign ?? null,
    };
  });

  /* ------------------------ filtros pós-merge + página --------------------- */
  if (needsPostFilter) {
    rows = rows.filter((r) => {
      if (stageIds.length && !stageIds.includes(String(r.julia_stage_id ?? ""))) return false;
      if (!stageIds.length && body.julia_stage && String(r.julia_stage_name ?? "") !== body.julia_stage) return false;
      if (body.julia_mode === "julia" && r.session_is_active !== true) return false;
      if (body.julia_mode === "human" && r.session_is_active === true) return false;
      if (body.has_campaign === true && !r.campaign) return false;
      if (body.has_campaign === false && r.campaign) return false;
      return true;
    });
    const co = counters as any;
    co.total = rows.length;
    co.pending = rows.filter((r) => r.status === "pending").length;
    co.open = rows.filter((r) => r.status === "open").length;
    co.resolved = rows.filter((r) => r.status === "resolved").length;
    co.closed = rows.filter((r) => r.status === "closed").length;
    co.unread = rows.reduce((s, r) => s + (Number(r.unread_count) || 0), 0);
    co.sla_breached = rows.filter((r) => r.sla_status === "breached").length;
    co.sla_at_risk = rows.filter((r) => r.sla_status === "at_risk").length;
    rows = rows.slice(offset, offset + limit);
  }

  return json({
    rows,
    counters,
    has_more: needsPostFilter
      ? offset + rows.length < Number((counters as any).total ?? 0)
      : rows.length === limit,
    timings: {
      total_ms: Date.now() - t0,
      supabase_ms: msSupabase,
      cache_ms: msCache,
      external_ms: msExternal,
      external_error: externalError,
      external_stale: usedStale,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
      cache_refreshed: missing.length,
      sql_count: (missing.length > 0 && variants.length > 0 ? 2 : 1) + (wanted.size > 0 ? 1 : 0),
      rows: rows.length,
    },
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
