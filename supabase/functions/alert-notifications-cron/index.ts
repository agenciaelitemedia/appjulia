// ============================================
// alert-notifications-cron
// Disparo dos alertas do módulo "Notificações e Alertas".
// Gatilhos: no_response, qualified, disqualified,
//           contract_in_progress, contract_signed, flow_error
// Independente do módulo de Notificações de Contrato.
// ============================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { getAgentCredentials } from "../_shared/get-agent-credentials.ts";
import { createMessagingAdapter } from "../_shared/messaging-factory.ts";
import { fetchZapSignDocStatus, resolveZapsignToken } from "../_shared/x-julia/zapsign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SITUACOES: Record<string, string> = {
  no_response: "Lead parou de responder — recuperação",
  qualified: "Lead qualificado",
  disqualified: "Lead desqualificado",
  contract_in_progress: "Contrato em curso (aguardando assinatura)",
  contract_signed: "Contrato assinado",
  flow_error: "Erro de fluxo — atendimento sem destino",
};

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

function createConnection() {
  const externalDbUrl = (Deno.env.get("EXTERNAL_DB_URL") ?? "").trim();
  const rawCert = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
  const caCerts = rawCert ? normalizeCaCert(rawCert) : [];
  const ssl = caCerts.length > 0 ? { caCerts, rejectUnauthorized: true } : "require" as const;

  return externalDbUrl
    ? postgres(externalDbUrl, { ssl, connect_timeout: 15, idle_timeout: 20, max_lifetime: 60 * 30 })
    : postgres({
        host: Deno.env.get("EXTERNAL_DB_HOST"),
        port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "25061"),
        user: Deno.env.get("EXTERNAL_DB_USERNAME"),
        password: Deno.env.get("EXTERNAL_DB_PASSWORD"),
        database: Deno.env.get("EXTERNAL_DB_DATABASE"),
        ssl,
        connect_timeout: 15,
        idle_timeout: 20,
      });
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template || "";
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value ?? "");
  }
  return out;
}

function nowBrt(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date());
}

interface Candidate {
  leadPhone: string;
  leadName: string;
  caso: string;
  resumo: string;
  dedupeKey: string;
  sessionId?: number | null;
}

/** Variantes BR do telefone (com/sem o 9º dígito) para casar bases legadas. */
/**
 * Chave canônica do telefone do lead: últimos 8 dígitos.
 * Neutraliza variações de DDI/DDD/9º dígito, evitando alertas e cards
 * duplicados para o mesmo lead escrito de formas diferentes.
 */
function phoneKey(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "").slice(-8);
}

function brPhoneVariants(raw: string | null | undefined): string[] {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    if (d.length === 13 && d[4] === "9" && /[6-9]/.test(d[5] ?? "")) {
      out.add(`55${ddd}${d.slice(5)}`);
    } else if (d.length === 12 && /[6-9]/.test(d[4] ?? "")) {
      out.add(`55${ddd}9${d.slice(4)}`);
    }
  }
  return [...out].filter(Boolean);
}

/**
 * Etapa atual do lead no CRM da Julia.
 * 1) CRM clássico/legado (crm_atendimento_cards + crm_atendimento_stages)
 * 2) fallback X-Julia (xj_deals -> xj_pipelines)
 */
async function fetchCrmStage(
  supabase: any,
  sql: any,
  clientId: string | null,
  phone: string,
): Promise<string> {
  const variants = brPhoneVariants(phone);
  if (variants.length === 0) return "";

  // 1) CRM clássico (banco legado)
  try {
    const rows = await sql.unsafe(
      `SELECT COALESCE(s.name, '') AS stage_name
         FROM crm_atendimento_cards c
         LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
        WHERE c.whatsapp_number::text = ANY($1::varchar[])
        ORDER BY COALESCE(c.updated_at, c.created_at) DESC NULLS LAST
        LIMIT 1`,
      [variants],
    );
    const legacy = String(rows?.[0]?.stage_name ?? "").trim();
    if (legacy) return legacy;
  } catch (err) {
    console.warn("[alerts] etapa CRM legado não resolvida:", err);
  }

  // 2) Fallback X-Julia
  try {
    const tail = variants[0].slice(-8);
    let query = supabase
      .from("xj_deals")
      .select("pipeline_id, updated_at, contact_phone")
      .ilike("contact_phone", `%${tail}%`)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (clientId) query = query.eq("client_id", String(clientId));

    const { data: deals } = await query;
    const pipelineId = deals?.[0]?.pipeline_id;
    if (!pipelineId) return "";

    const { data: stage } = await supabase
      .from("xj_pipelines")
      .select("name")
      .eq("id", pipelineId)
      .maybeSingle();
    return String(stage?.name ?? "");
  } catch (err) {
    console.warn("[alerts] etapa X-Julia não resolvida:", err);
    return "";
  }
}

/** Resumo curto das últimas mensagens do lead (mensagens do chat omnichannel). */
async function buildResumo(supabase: any, phone: string): Promise<string> {
  try {
    const digits = String(phone ?? "").replace(/\D/g, "");
    if (!digits) return "Sem histórico de conversa.";
    const tail = digits.slice(-8);

    const { data: contacts } = await supabase
      .from("chat_contacts")
      .select("id")
      .ilike("phone", `%${tail}%`)
      .limit(5);

    const ids = (contacts ?? []).map((c: any) => c.id);
    if (ids.length === 0) return "Sem histórico de conversa.";

    // Resumo já gerado pela IA, quando existir.
    const { data: summaries } = await supabase
      .from("chat_conversation_summaries")
      .select("summary, created_at")
      .in("contact_id", ids)
      .order("created_at", { ascending: false })
      .limit(1);
    if (summaries && summaries.length > 0 && summaries[0].summary) {
      return String(summaries[0].summary).slice(0, 1200);
    }

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("text, caption, from_me, created_at")
      .in("contact_id", ids)
      .order("created_at", { ascending: false })
      .limit(12);

    if (!messages || messages.length === 0) return "Sem histórico de conversa.";

    return messages
      .reverse()
      .map((m: any) => {
        const who = m.from_me ? "Julia" : "Lead";
        const text = String(m.text || m.caption || "[mídia]").replace(/\s+/g, " ").slice(0, 180);
        return `${who}: ${text}`;
      })
      .join("\n");
  } catch (err) {
    console.warn("[alerts] resumo falhou:", err);
    return "Resumo indisponível.";
  }
}

/**
 * Gatilho "Cliente parou de responder" por silêncio real das mensagens.
 * Considera conversas do agente onde a última mensagem é nossa (Julia/atendente)
 * e o lead está sem responder há >= `minutes` minutos.
 */
async function fetchNoResponseCandidates(
  supabase: any,
  sql: any,
  codAgent: string,
  minutes: number,
): Promise<Candidate[]> {
  const now = Date.now();
  const floor = new Date(now - 2 * 24 * 60 * 60_000).toISOString();

  let clientId: string | null = null;
  try {
    const rows = await sql.unsafe(
      `SELECT client_id::text AS client_id FROM public.agents WHERE cod_agent::text = $1 LIMIT 1`,
      [codAgent],
    );
    clientId = rows?.[0]?.client_id ?? null;
  } catch (err) {
    console.warn(`[alerts] client_id não resolvido para ${codAgent}:`, err);
  }
  if (!clientId) return [];

  const { data: convs, error } = await supabase
    .from("chat_conversations")
    .select("id, contact_id, last_customer_message_at, last_message_from_me, status")
    .eq("client_id", clientId)
    .eq("last_message_from_me", true)
    .in("status", ["pending", "open"])
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!convs || convs.length === 0) return [];

  const contactIds = [...new Set(convs.map((conv: any) => conv.contact_id).filter(Boolean))];
  const { data: contactRows, error: contactsError } = await supabase
    .from("chat_contacts")
    .select("id, phone, name")
    .in("id", contactIds);
  if (contactsError) throw contactsError;
  const byId = new Map((contactRows ?? []).map((contact: any) => [contact.id, contact]));

  const conversationIds = convs.map((conv: any) => conv.id);
  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("conversation_id, from_me, timestamp, internal_note")
    .in("conversation_id", conversationIds)
    .order("timestamp", { ascending: false })
    .limit(Math.max(conversationIds.length * 20, 500));
  if (messagesError) throw messagesError;
  const lastMessageByConversation = new Map<string, any>();
  for (const message of messages ?? []) {
    if (message.internal_note) continue;
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message);
    }
  }

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const conv of convs) {
    const lastMessage = lastMessageByConversation.get(conv.id);
    const lastMessageMs = lastMessage?.timestamp ? new Date(lastMessage.timestamp).getTime() : Number.NaN;
    if (!lastMessage?.from_me || !Number.isFinite(lastMessageMs)) continue;
    if (lastMessageMs < new Date(floor).getTime()) continue;
    if (lastMessageMs + minutes * 60_000 > now) continue;

    const contact = byId.get(conv.contact_id);
    const phone = String(contact?.phone ?? "").replace(/\D/g, "");
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);

    // Sessão da Julia (banco legado) para o modo Assumir + caso jurídico.
    let sessionId: number | null = null;
    let caso = "";
    try {
      const rows = await sql.unsafe(
        `SELECT s.id::bigint AS id, COALESCE(s.case_legal, '') AS caso
           FROM public.sessions s
           JOIN public.agents a ON a.id = s.agent_id
          WHERE a.cod_agent::text = $1
            AND right(regexp_replace(s.whatsapp_number::text, '\\D', '', 'g'), 8) = right($2, 8)
          ORDER BY s.id DESC
          LIMIT 1`,
        [codAgent, phone],
      );
      sessionId = rows?.[0]?.id ? Number(rows[0].id) : null;
      caso = String(rows?.[0]?.caso ?? "");
    } catch (err) {
      console.warn(`[alerts] sessão não resolvida para ${phone}:`, err);
    }

    const marker = String(lastMessage.timestamp).slice(0, 16).replace(/\D/g, "");
    out.push({
      leadPhone: phone,
      leadName: String(contact?.name ?? ""),
      caso,
      resumo: "",
      sessionId,
      dedupeKey: `${phoneKey(phone)}:nores:${marker}`,
    });
  }
  return out;
}

async function fetchCandidates(
  sql: any,
  codAgent: string,
  triggerKey: string,
  stageIds: string[],
): Promise<Candidate[]> {
  if (triggerKey === "qualified" || triggerKey === "disqualified") {
    if (stageIds.length === 0) return [];
    const rows = await sql.unsafe(
      `SELECT c.whatsapp_number::text AS phone,
              COALESCE(c.contact_name, '') AS name,
              COALESCE(st.name, '') AS stage_name,
              c.stage_id::text AS stage_id,
              to_char(COALESCE(c.stage_entered_at, c.updated_at), 'YYYYMMDDHH24MI') AS marker,
              s.id::bigint AS session_id,
              COALESCE(s.case_legal, '') AS caso
         FROM crm_atendimento_cards c
         LEFT JOIN crm_atendimento_stages st ON st.id = c.stage_id
         LEFT JOIN sessions s ON s.whatsapp_number::text = c.whatsapp_number::text
        WHERE c.cod_agent::text = $1
          AND c.stage_id::text = ANY($2::varchar[])
          AND COALESCE(c.stage_entered_at, c.updated_at) >= NOW() - INTERVAL '2 days'
        ORDER BY COALESCE(c.stage_entered_at, c.updated_at) DESC`,
      [codAgent, stageIds],
    );
    return (rows ?? []).map((r: any) => ({
      leadPhone: String(r.phone ?? ""),
      leadName: String(r.name ?? ""),
      caso: String(r.caso || r.stage_name || ""),
      resumo: "",
      sessionId: r.session_id ? Number(r.session_id) : null,
      dedupeKey: `${phoneKey(r.phone)}:${r.stage_id}:${r.marker ?? ""}`,
    }));
  }

  if (triggerKey === "contract_in_progress" || triggerKey === "contract_signed") {
    const status = triggerKey === "contract_signed" ? "SIGNED" : "CREATED";
    const rows = await sql.unsafe(
      `SELECT DISTINCT ON (d.cod_document)
              d.cod_document::text AS cod_document,
              d.whatsapp_number::text AS phone,
              COALESCE(d.signer_name, '') AS name,
              COALESCE(d.document_case, '') AS caso,
              COALESCE(d.resume_case, '') AS resume_case,
              s.id::bigint AS session_id
         FROM sing_document d
         LEFT JOIN sessions s ON s.whatsapp_number::text = d.whatsapp_number::text
        WHERE d.cod_agent::text = $1
          AND d.status_document = $2
          AND d.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY d.cod_document, d.created_at DESC`,
      [codAgent, status],
    );
    return (rows ?? []).map((r: any) => ({
      leadPhone: String(r.phone ?? ""),
      leadName: String(r.name ?? ""),
      caso: String(r.caso ?? ""),
      resumo: String(r.resume_case ?? ""),
      sessionId: r.session_id ? Number(r.session_id) : null,
      dedupeKey: `${r.cod_document}:${status}`,
    }));
  }

  if (triggerKey === "flow_error") {
    const rows = await sql.unsafe(
      `SELECT s.id::bigint AS session_id,
              s.whatsapp_number::text AS phone,
              COALESCE(c.contact_name, '') AS name,
              COALESCE(s.case_legal, '') AS caso,
              to_char(s.stoped_at, 'YYYYMMDDHH24MI') AS marker
         FROM sessions s
         JOIN agents a ON a.id = s.agent_id
         LEFT JOIN crm_atendimento_cards c
                ON c.whatsapp_number::text = s.whatsapp_number::text
               AND c.cod_agent::text = $1
        WHERE a.cod_agent::text = $1
          AND s.active = FALSE
          AND s.stoped_at >= NOW() - INTERVAL '1 day'
          AND (c.stage_id IS NULL)
        ORDER BY s.stoped_at DESC
        LIMIT 50`,
      [codAgent],
    );
    return (rows ?? []).map((r: any) => ({
      leadPhone: String(r.phone ?? ""),
      leadName: String(r.name ?? ""),
      caso: String(r.caso ?? ""),
      resumo: "",
      sessionId: r.session_id ? Number(r.session_id) : null,
      dedupeKey: `${phoneKey(r.phone)}:flow:${r.marker ?? ""}`,
    }));
  }

  return [];
}

/** Pausa a Julia no contato (modo Assumir). */
/**
 * Confere no ZapSign os contratos X-Julia enviados e ainda não assinados,
 * marcando `signed` + `signed_at` quando a assinatura foi concluída.
 * Substitui a necessidade de webhook do ZapSign.
 */
// deno-lint-ignore no-explicit-any
async function syncXJContractSignatures(supabase: any, clientId: string | null) {
  if (!clientId) return;
  try {
    const floor = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const { data: pending } = await supabase
      .from("xj_contracts")
      .select("id, external_id, provider, status, signed_at")
      .eq("client_id", String(clientId))
      .eq("provider", "zapsign")
      .eq("status", "sent")
      .is("signed_at", null)
      .gte("created_at", floor)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!pending || pending.length === 0) return;

    const token = await resolveZapsignToken(supabase, null, clientId);
    if (!token) return;

    for (const contract of pending) {
      const docToken = String(contract.external_id ?? "").trim();
      if (!docToken) continue;
      const status = await fetchZapSignDocStatus(token, docToken);
      if (!status?.signed) continue;
      await supabase
        .from("xj_contracts")
        .update({ status: "signed", signed_at: status.signed_at ?? new Date().toISOString() })
        .eq("id", contract.id);
    }
  } catch (err) {
    console.warn("[alerts] sync de assinaturas ZapSign falhou:", err);
  }
}

/**
 * Contratos do X-Julia (xj_contracts) como candidatos dos gatilhos de contrato.
 * Em curso  = enviado para assinatura e ainda não assinado.
 * Assinado  = status signed / signed_at preenchido.
 */
// deno-lint-ignore no-explicit-any
async function fetchXJContractCandidates(
  supabase: any,
  sql: any,
  codAgent: string,
  clientId: string | null,
  triggerKey: string,
): Promise<Candidate[]> {
  if (!clientId) return [];
  const floor = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

  let query = supabase
    .from("xj_contracts")
    .select("id, status, signed_at, signer_name, signer_phone, case_id, created_at")
    .eq("client_id", String(clientId))
    .gte("created_at", floor)
    .order("created_at", { ascending: false })
    .limit(100);

  if (triggerKey === "contract_signed") {
    query = query.or("status.eq.signed,signed_at.not.is.null");
  } else {
    query = query.eq("status", "sent").is("signed_at", null);
  }

  const { data: contracts, error } = await query;
  if (error) {
    console.warn("[alerts] contratos X-Julia não consultados:", error);
    return [];
  }
  if (!contracts || contracts.length === 0) return [];

  // Nome do caso jurídico (para {caso}).
  const caseIds = [...new Set(contracts.map((c: any) => c.case_id).filter(Boolean))];
  const caseNames = new Map<string, string>();
  if (caseIds.length > 0) {
    const { data: cases } = await supabase
      .from("xj_legal_cases")
      .select("id, name")
      .in("id", caseIds);
    for (const row of cases ?? []) caseNames.set(String(row.id), String(row.name ?? ""));
  }

  const statusTag = triggerKey === "contract_signed" ? "signed" : "sent";
  const out: Candidate[] = [];
  for (const contract of contracts) {
    const phone = String(contract.signer_phone ?? "").replace(/\D/g, "");
    if (!phone) continue;

    // Sessão legada equivalente (quando existir) para permitir o modo Assumir.
    let sessionId: number | null = null;
    try {
      const rows = await sql.unsafe(
        `SELECT s.id::bigint AS id
           FROM public.sessions s
           JOIN public.agents a ON a.id = s.agent_id
          WHERE a.cod_agent::text = $1
            AND right(regexp_replace(s.whatsapp_number::text, '\\D', '', 'g'), 8) = right($2, 8)
          ORDER BY s.id DESC
          LIMIT 1`,
        [codAgent, phone],
      );
      sessionId = rows?.[0]?.id ? Number(rows[0].id) : null;
    } catch {
      sessionId = null;
    }

    out.push({
      leadPhone: phone,
      leadName: String(contract.signer_name ?? ""),
      caso: caseNames.get(String(contract.case_id)) ?? "",
      resumo: "",
      sessionId,
      dedupeKey: `xj:${contract.id}:${statusTag}`,
    });
  }
  return out;
}

/** Pausa a Julia no contato (modo Assumir). */
async function takeover(sql: any, codAgent: string, sessionId: number | null, phone: string) {
  if (!sessionId) return;
  try {
    await sql.unsafe(`UPDATE public.sessions SET active = FALSE WHERE id = $1::bigint`, [sessionId]);
    await sql.unsafe(
      `UPDATE public.followup_queue SET state = 'stoped'
        WHERE session_id::bigint = $1::bigint AND cod_agent::text = $2 AND state <> 'stoped'`,
      [sessionId, codAgent],
    );
    await sql.unsafe(
      `DELETE FROM public.followup_queue_temp
        WHERE session_id::bigint = $1::bigint AND cod_agent::text = $2`,
      [sessionId, codAgent],
    );
  } catch (err) {
    console.warn(`[alerts] takeover falhou (${phone}):`, err);
  }
}

/**
 * CRM de Notificações: garante NO MÁXIMO UM card aberto por (agente, lead).
 * O telefone é normalizado (últimos 8 dígitos), então variações de DDI/DDD/9º
 * dígito não geram cards duplicados. Se o lead já tem card aberto, ele é
 * movido para a coluna do novo alerta em vez de criar um segundo card.
 * Cards resolvidos (recuperado/perdido) não bloqueiam a criação de um novo.
 */
async function upsertAlertCrmCard(
  supabase: any,
  card: {
    clientId: string | null;
    codAgent: string;
    triggerKey: string;
    leadPhone: string;
    leadName: string | null;
    businessName: string | null;
    crmStageLabel: string | null;
    logId: string | null;
  },
) {
  const key = phoneKey(card.leadPhone);
  if (!key) return;
  try {
    const { data: existing } = await supabase
      .from("alert_crm_cards")
      .select("id, trigger_key, crm_stage_label")
      .eq("cod_agent", card.codAgent)
      .eq("lead_phone_key", key)
      .eq("status", "open")
      .limit(1);

    if (existing && existing.length > 0) {
      const moved = existing[0].trigger_key !== card.triggerKey;
      await supabase
        .from("alert_crm_cards")
        .update({
          trigger_key: card.triggerKey,
          lead_name: card.leadName,
          lead_phone: card.leadPhone,
          business_name: card.businessName,
          crm_stage_label: card.crmStageLabel ?? existing[0].crm_stage_label ?? null,
          log_id: card.logId,
          ...(moved ? { stage_entered_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
      return;
    }

    await supabase.from("alert_crm_cards").insert({
      client_id: card.clientId,
      cod_agent: card.codAgent,
      trigger_key: card.triggerKey,
      lead_phone: card.leadPhone,
      lead_phone_key: key,
      lead_name: card.leadName,
      business_name: card.businessName,
      crm_stage_label: card.crmStageLabel,
      log_id: card.logId,
      status: "open",
      stage_entered_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[alerts] upsert card CRM falhou (${card.leadPhone}):`, err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const { data: configs, error } = await supabase
      .from("alert_notification_configs")
      .select("*")
      .eq("is_active", true);
    if (error) throw error;

    const active = (configs ?? []).filter(
      (c: any) => Array.isArray(c.recipients) && c.recipients.length > 0,
    );
    if (active.length === 0) {
      return new Response(JSON.stringify({ message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    sql = createConnection();
    const results: any[] = [];

    const byAgent = new Map<string, any[]>();
    for (const cfg of active) {
      const list = byAgent.get(cfg.cod_agent) ?? [];
      list.push(cfg);
      byAgent.set(cfg.cod_agent, list);
    }

    for (const [codAgent, cfgList] of byAgent) {
      const creds = await getAgentCredentials(sql, codAgent);
      if (!creds) {
        console.log(`[alerts] agente ${codAgent} sem credenciais — ignorado`);
        continue;
      }
      const adapter = createMessagingAdapter(creds);

      // client_id (escritório) do agente, para auditoria do histórico.
      let clientId: string | null = null;
      let businessName: string | null = null;
      try {
        const rows = await sql.unsafe(
          `SELECT client_id::text AS client_id FROM public.agents WHERE cod_agent::text = $1 LIMIT 1`,
          [codAgent],
        );
        clientId = rows?.[0]?.client_id ?? null;
      } catch (err) {
        console.warn(`[alerts] client_id não resolvido para ${codAgent}:`, err);
      }
      if (clientId) {
        try {
          const rows = await sql.unsafe(
            `SELECT business_name FROM public.clients WHERE id::text = $1 LIMIT 1`,
            [clientId],
          );
          businessName = rows?.[0]?.business_name ?? null;
        } catch (_err) {
          businessName = null;
        }
      }

      for (const cfg of cfgList) {
        const stageIds = Array.isArray(cfg.stage_ids) ? cfg.stage_ids.map(String) : [];
        let candidates: Candidate[] = [];
        try {
          if (cfg.trigger_key === "no_response") {
            const minutes = Math.max(1, Number(cfg.no_response_minutes ?? 30));
            candidates = await fetchNoResponseCandidates(supabase, sql, codAgent, minutes);
          } else if (
            cfg.trigger_key === "contract_in_progress" || cfg.trigger_key === "contract_signed"
          ) {
            // Antes de coletar: confere assinaturas pendentes no ZapSign.
            await syncXJContractSignatures(supabase, clientId);
            const legacy = await fetchCandidates(sql, codAgent, cfg.trigger_key, stageIds);
            const xJulia = await fetchXJContractCandidates(
              supabase, sql, codAgent, clientId, cfg.trigger_key,
            );
            const seenKeys = new Set<string>();
            candidates = [...legacy, ...xJulia].filter((cand) => {
              if (seenKeys.has(cand.dedupeKey)) return false;
              seenKeys.add(cand.dedupeKey);
              return true;
            });
          } else {
            candidates = await fetchCandidates(sql, codAgent, cfg.trigger_key, stageIds);
          }
        } catch (err) {
          console.error(`[alerts] consulta ${cfg.trigger_key} falhou:`, err);
          continue;
        }

        // Dedupe dentro da própria rodada: um disparo por lead/gatilho.
        const seenLeads = new Set<string>();
        for (const cand of candidates) {
          if (!cand.leadPhone) continue;
          const leadKey = phoneKey(cand.leadPhone);
          if (!leadKey || seenLeads.has(leadKey)) continue;
          seenLeads.add(leadKey);

          // Anti-duplicidade: um disparo por lead/gatilho/marcador.
          const { data: existing } = await supabase
            .from("alert_notification_logs")
            .select("id")
            .eq("cod_agent", codAgent)
            .eq("trigger_key", cfg.trigger_key)
            .eq("dedupe_key", cand.dedupeKey)
            .limit(1);
          if (existing && existing.length > 0) {
            // Alerta já foi enviado antes: não reenvia, mas garante que o card
            // exista no CRM de Notificações (sem isso o lead nunca ganha card).
            // Resolve a etapa do CRM também aqui — sem isso o card fica "Sem etapa".
            const etapaCrmExistente = await fetchCrmStage(supabase, sql, clientId, cand.leadPhone);
            await upsertAlertCrmCard(supabase, {
              clientId,
              codAgent,
              triggerKey: cfg.trigger_key,
              leadPhone: cand.leadPhone,
              leadName: cand.leadName ?? null,
              businessName: businessName,
              crmStageLabel: etapaCrmExistente || null,
              logId: existing[0].id ?? null,
            });
            continue;
          }

          const resumo = cand.resumo || (await buildResumo(supabase, cand.leadPhone));
          const etapaCrm = await fetchCrmStage(supabase, sql, clientId, cand.leadPhone);
          const message = renderTemplate(cfg.message_template ?? "", {
            lead_nome: cand.leadName || "Não informado",
            lead_whatsapp: cand.leadPhone,
            data_hora: nowBrt(),
            situacao: SITUACOES[cfg.trigger_key] ?? cfg.trigger_key,
            resumo_conversa: resumo,
            caso: cand.caso || "Não identificado",
            etapa_crm: etapaCrm || "Sem etapa no CRM",
            link_chat: "",
          });

          for (const recipient of cfg.recipients as string[]) {
            const phone = String(recipient).replace(/\D/g, "");
            if (!phone) continue;

            // Reserva o disparo ANTES de enviar: o índice único
            // (cod_agent, trigger_key, dedupe_key, recipient_phone) impede que
            // duas execuções simultâneas do cron enviem o mesmo alerta.
            const { data: logRow, error: reserveError } = await supabase
              .from("alert_notification_logs")
              .insert({
                config_id: cfg.id,
                client_id: clientId,
                cod_agent: codAgent,
                trigger_key: cfg.trigger_key,
                lead_phone: cand.leadPhone,
                lead_name: cand.leadName,
                dedupe_key: cand.dedupeKey,
                recipient_phone: phone,
                message_text: message,
                status: "pending",
              })
              .select("id")
              .maybeSingle();

            if (reserveError) {
              // Duplicidade (23505) ou falha de reserva: não envia.
              console.warn(
                `[alerts] disparo já registrado/ignorado (${cfg.trigger_key} ${cand.leadPhone} -> ${phone})`,
              );
              continue;
            }

            let status = "failed";
            let errorMessage: string | null = null;
            try {
              const res = await adapter.sendText(phone, message);
              status = res?.success ? "sent" : "failed";
              errorMessage = res?.error ?? null;
            } catch (err) {
              errorMessage = err instanceof Error ? err.message : String(err);
            }

            if (logRow?.id) {
              await supabase
                .from("alert_notification_logs")
                .update({
                  status,
                  error_message: errorMessage,
                  sent_at: status === "sent" ? new Date().toISOString() : null,
                })
                .eq("id", logRow.id);
            }

            // CRM de Notificações: cria/reabre o card do lead na coluna do gatilho.
            if (status === "sent") {
              await upsertAlertCrmCard(supabase, {
                clientId,
                codAgent,
                triggerKey: cfg.trigger_key,
                leadPhone: cand.leadPhone,
                leadName: cand.leadName ?? null,
                businessName: businessName,
                crmStageLabel: etapaCrm || null,
                logId: logRow?.id ?? null,
              });
            }

            results.push({ trigger: cfg.trigger_key, lead: cand.leadPhone, to: phone, status });
          }

          if (cfg.mode === "takeover") {
            await takeover(sql, codAgent, cand.sessionId ?? null, cand.leadPhone);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("alert-notifications-cron error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    if (sql) await sql.end();
  }
});
