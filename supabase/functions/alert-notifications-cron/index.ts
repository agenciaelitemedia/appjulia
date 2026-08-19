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
  const cutoff = new Date(now - minutes * 60_000).toISOString();
  const floor = new Date(now - 2 * 24 * 60 * 60_000).toISOString();

  // chat_conversations.cod_agent não é preenchido; o vínculo com o agente vive
  // em chat_contacts.cod_agent. Fallback: contatos do mesmo escritório sem agente.
  const { data: agentContacts } = await supabase
    .from("chat_contacts")
    .select("id, phone, name")
    .eq("cod_agent", codAgent)
    .limit(500);
  let contactRows: any[] = agentContacts ?? [];

  if (contactRows.length === 0) {
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
    if (clientId) {
      const { data: officeContacts } = await supabase
        .from("chat_contacts")
        .select("id, phone, name")
        .eq("client_id", clientId)
        .is("cod_agent", null)
        .order("last_message_at", { ascending: false })
        .limit(500);
      contactRows = officeContacts ?? [];
    }
  }
  if (contactRows.length === 0) return [];
  const byId = new Map(contactRows.map((c: any) => [c.id, c]));

  const { data: convs, error } = await supabase
    .from("chat_conversations")
    .select("id, contact_id, last_customer_message_at, last_message_from_me, status")
    .in("contact_id", contactRows.map((c: any) => c.id))
    .eq("last_message_from_me", true)
    .not("last_customer_message_at", "is", null)
    .lte("last_customer_message_at", cutoff)
    .gte("last_customer_message_at", floor)
    .neq("status", "closed")
    .order("last_customer_message_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!convs || convs.length === 0) return [];

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const conv of convs) {
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

    const marker = String(conv.last_customer_message_at ?? "").slice(0, 16).replace(/\D/g, "");
    out.push({
      leadPhone: phone,
      leadName: String(contact?.name ?? ""),
      caso,
      resumo: "",
      sessionId,
      dedupeKey: `${phone}:nores:${minutes}:${marker}`,
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
      dedupeKey: `${r.phone}:${r.stage_id}:${r.marker ?? ""}`,
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
      dedupeKey: `${r.phone}:${r.marker ?? ""}`,
    }));
  }

  return [];
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
      try {
        const rows = await sql.unsafe(
          `SELECT client_id::text AS client_id FROM public.agents WHERE cod_agent::text = $1 LIMIT 1`,
          [codAgent],
        );
        clientId = rows?.[0]?.client_id ?? null;
      } catch (err) {
        console.warn(`[alerts] client_id não resolvido para ${codAgent}:`, err);
      }

      for (const cfg of cfgList) {
        const stageIds = Array.isArray(cfg.stage_ids) ? cfg.stage_ids.map(String) : [];
        let candidates: Candidate[] = [];
        try {
          if (cfg.trigger_key === "no_response") {
            const minutes = Math.max(1, Number(cfg.no_response_minutes ?? 30));
            candidates = await fetchNoResponseCandidates(supabase, sql, codAgent, minutes);
          } else {
            candidates = await fetchCandidates(sql, codAgent, cfg.trigger_key, stageIds);
          }
        } catch (err) {
          console.error(`[alerts] consulta ${cfg.trigger_key} falhou:`, err);
          continue;
        }

        for (const cand of candidates) {
          if (!cand.leadPhone) continue;

          // Anti-duplicidade: um disparo por lead/gatilho/marcador.
          const { data: existing } = await supabase
            .from("alert_notification_logs")
            .select("id")
            .eq("cod_agent", codAgent)
            .eq("trigger_key", cfg.trigger_key)
            .eq("dedupe_key", cand.dedupeKey)
            .limit(1);
          if (existing && existing.length > 0) continue;

          const resumo = cand.resumo || (await buildResumo(supabase, cand.leadPhone));
          const message = renderTemplate(cfg.message_template ?? "", {
            lead_nome: cand.leadName || "Não informado",
            lead_whatsapp: cand.leadPhone,
            data_hora: nowBrt(),
            situacao: SITUACOES[cfg.trigger_key] ?? cfg.trigger_key,
            resumo_conversa: resumo,
            caso: cand.caso || "Não identificado",
            link_chat: "",
          });

          for (const recipient of cfg.recipients as string[]) {
            const phone = String(recipient).replace(/\D/g, "");
            if (!phone) continue;
            let status = "failed";
            let errorMessage: string | null = null;
            try {
              const res = await adapter.sendText(phone, message);
              status = res?.success ? "sent" : "failed";
              errorMessage = res?.error ?? null;
            } catch (err) {
              errorMessage = err instanceof Error ? err.message : String(err);
            }

            await supabase.from("alert_notification_logs").insert({
              config_id: cfg.id,
              client_id: clientId,
              cod_agent: codAgent,
              trigger_key: cfg.trigger_key,
              lead_phone: cand.leadPhone,
              lead_name: cand.leadName,
              dedupe_key: cand.dedupeKey,
              recipient_phone: phone,
              message_text: message,
              status,
              error_message: errorMessage,
              sent_at: status === "sent" ? new Date().toISOString() : null,
            });

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
