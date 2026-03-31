import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_HUB_SEND_URL = Deno.env.get("N8N_HUB_SEND_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeCaCert(input: string): string[] {
  let text = input.trim();
  text = text.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  if (!text.includes("BEGIN CERTIFICATE")) {
    try {
      const decoded = atob(text);
      if (decoded.includes("BEGIN CERTIFICATE")) text = decoded;
    } catch { /* ignore */ }
  }

  text = text
    .replace(/-----BEGIN CERTIFICATE-----\s+/g, "-----BEGIN CERTIFICATE-----\n")
    .replace(/\s+-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----")
    .replace(/-----END CERTIFICATE-----\s+/g, "-----END CERTIFICATE-----\n");

  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || blocks.length === 0) return [];

  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;

  return blocks.map((block) => {
    const b64 = block
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "")
      .trim();
    return `-----BEGIN CERTIFICATE-----\n${wrap64(b64)}\n-----END CERTIFICATE-----\n`;
  });
}

function createConnection() {
  const externalDbUrl = (Deno.env.get("EXTERNAL_DB_URL") ?? "").trim();
  const rawCert = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
  const caCerts = rawCert ? normalizeCaCert(rawCert) : [];

  const ssl = caCerts.length > 0
    ? { caCerts, rejectUnauthorized: true }
    : "require" as const;

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
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value || '');
  }
  return result;
}

function parseIntervalMs(interval: string, fallbackMs: number): number {
  const match = interval.match(/^(\d+)\s+(minutes|hours|days)$/);
  if (!match) return fallbackMs;
  const val = parseInt(match[1]);
  const unit = match[2];
  return unit === 'days' ? val * 86400000 : unit === 'hours' ? val * 3600000 : val * 60000;
}

interface Contract {
  cod_document: string;
  whatsapp_number: string;
  signer_name: string;
  document_case: string;
  zapsign_doctoken: string | null;
  resume_case: string | null;
  created_at: string;
  status_document: string;
}

async function sendWhatsApp(phone: string, message: string, codAgent: string, source: string) {
  if (!N8N_HUB_SEND_URL) return { status: 'failed', error: 'N8N_HUB_SEND_URL not configured' };
  try {
    const resp = await fetch(N8N_HUB_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, cod_agent: codAgent, source }),
    });
    const result = await resp.json();
    if (resp.ok && result.success) {
      return { status: 'sent', error: null };
    }
    return { status: 'failed', error: result.error || 'Send failed' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function processLeadFollowup(supabase: any, cfg: any, contracts: Contract[], codAgent: string) {
  const results: any[] = [];
  const unsignedContracts = contracts.filter(c => c.status_document === 'CREATED');
  const stepCadence = cfg.step_cadence || {};
  const msgCadence = cfg.msg_cadence || {};
  const totalSteps = Object.keys(stepCadence).length || cfg.stages_count || 3;

  for (const contract of unsignedContracts) {
    const { data: logs } = await supabase
      .from("contract_notification_logs")
      .select("*")
      .eq("config_id", cfg.id)
      .eq("contract_cod_document", contract.cod_document)
      .eq("type", "LEAD_FOLLOWUP")
      .order("step_number", { ascending: false })
      .limit(1);

    const lastLog = logs?.[0];
    const lastStep = lastLog?.step_number || 0;
    const lastSentAt = lastLog?.sent_at || lastLog?.created_at;
    if (lastStep >= totalSteps) continue;

    const nextStep = lastStep + 1;
    const cadenceKey = `cadence_${nextStep}`;

    if (lastSentAt) {
      const elapsed = Date.now() - new Date(lastSentAt).getTime();
      const delayMs = parseIntervalMs(stepCadence[cadenceKey] || '', (cfg.delay_interval_minutes || 1440) * 60000);
      if (elapsed < delayMs) continue;
    }

    const zapSignLink = contract.zapsign_doctoken
      ? `\nhttps://app.zapsign.com.br/verificar/${contract.zapsign_doctoken}`
      : '';

    const template = msgCadence[cadenceKey] || cfg.message_template || '';
    const message = renderTemplate(template, {
      client_name: contract.signer_name,
      case_title: contract.document_case,
      contract_date: contract.created_at,
    }) + zapSignLink;

    const sendResult = contract.whatsapp_number
      ? await sendWhatsApp(contract.whatsapp_number, message, codAgent, "contract_followup")
      : { status: 'failed', error: 'whatsapp not configured' };

    await supabase.from("contract_notification_logs").insert({
      config_id: cfg.id,
      cod_agent: codAgent,
      contract_cod_document: contract.cod_document,
      type: 'LEAD_FOLLOWUP',
      step_number: nextStep,
      recipient_phone: contract.whatsapp_number,
      message_text: message,
      status: sendResult.status,
      sent_at: sendResult.status === 'sent' ? new Date().toISOString() : null,
      error_message: sendResult.error,
    });

    results.push({ type: 'LEAD_FOLLOWUP', contract: contract.cod_document, status: sendResult.status });
  }
  return results;
}

async function processOfficeAlert(supabase: any, cfg: any, contracts: Contract[], codAgent: string) {
  const results: any[] = [];

  interface NumberEntry { phone: string; trigger: string }
  let numberEntries: NumberEntry[] = [];

  const tnc = cfg.target_numbers_config;
  if (tnc && Array.isArray(tnc) && tnc.length > 0) {
    numberEntries = tnc;
  } else {
    const targetNumbers = cfg.target_numbers || [];
    const globalTrigger = cfg.trigger_event || 'BOTH';
    numberEntries = targetNumbers.map((phone: string) => ({ phone, trigger: globalTrigger }));
  }

  if (numberEntries.length === 0) return results;

  const stepCadence = cfg.step_cadence || {};
  const msgCadence = cfg.msg_cadence || {};
  const triggerCadence = cfg.trigger_cadence || {};
  const totalSteps = Object.keys(stepCadence).length || cfg.office_repeat_count || 1;

  for (const contract of contracts) {
    const { data: existingLogs } = await supabase
      .from("contract_notification_logs")
      .select("*")
      .eq("config_id", cfg.id)
      .eq("contract_cod_document", contract.cod_document)
      .eq("type", "OFFICE_ALERT")
      .order("step_number", { ascending: false })
      .limit(1);

    const lastLog = existingLogs?.[0];
    const lastStep = lastLog?.step_number || 0;
    const lastSentAt = lastLog?.sent_at || lastLog?.created_at;
    if (lastStep >= totalSteps) continue;

    const nextStep = lastStep + 1;
    const cadenceKey = `cadence_${nextStep}`;

    const stepTrigger = triggerCadence[cadenceKey] || 'BOTH';
    if (stepTrigger !== 'BOTH') {
      if (stepTrigger === 'GENERATED' && contract.status_document !== 'CREATED') continue;
      if (stepTrigger === 'SIGNED' && contract.status_document !== 'SIGNED') continue;
    }

    if (lastSentAt && lastStep > 0) {
      const elapsed = Date.now() - new Date(lastSentAt).getTime();
      const delayMs = parseIntervalMs(stepCadence[cadenceKey] || '', 300000);
      if (elapsed < delayMs) continue;
    }

    const triggerLabel = contract.status_document === 'SIGNED' ? 'assinado' : 'gerado';
    const template = msgCadence[cadenceKey] || cfg.message_template || '';
    const message = renderTemplate(template, {
      client_name: contract.signer_name,
      client_phone: contract.whatsapp_number,
      case_title: contract.document_case,
      case_summary: contract.resume_case || 'Sem resumo disponível',
      trigger_label: triggerLabel,
    });

    const matchingNumbers = numberEntries.filter(entry => {
      if (entry.trigger === 'BOTH') return true;
      if (entry.trigger === 'GENERATED' && contract.status_document === 'CREATED') return true;
      if (entry.trigger === 'SIGNED' && contract.status_document === 'SIGNED') return true;
      return false;
    });

    for (const entry of matchingNumbers) {
      const sendResult = await sendWhatsApp(entry.phone, message, codAgent, "contract_office_alert");

      await supabase.from("contract_notification_logs").insert({
        config_id: cfg.id,
        cod_agent: codAgent,
        contract_cod_document: contract.cod_document,
        type: 'OFFICE_ALERT',
        step_number: nextStep,
        recipient_phone: entry.phone,
        message_text: message,
        status: sendResult.status,
        sent_at: sendResult.status === 'sent' ? new Date().toISOString() : null,
        error_message: sendResult.error,
      });

      results.push({ type: 'OFFICE_ALERT', contract: contract.cod_document, phone: entry.phone, status: sendResult.status });
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const { data: configs, error: cfgErr } = await supabase
      .from("contract_notification_configs")
      .select("*")
      .eq("is_active", true);

    if (cfgErr) throw cfgErr;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate dynamic time window
    let maxWindowMs = 30 * 86400000;
    for (const cfg of configs) {
      const sc = cfg.step_cadence || {};
      let totalMs = 0;
      for (const key of Object.keys(sc)) {
        totalMs += parseIntervalMs(sc[key] || '', 86400000);
      }
      if (totalMs > maxWindowMs) maxWindowMs = totalMs;
    }
    const windowDays = Math.ceil(maxWindowMs / 86400000) + 2;

    sql = createConnection();
    const results: any[] = [];

    const agentConfigs = new Map<string, any[]>();
    for (const cfg of configs) {
      const list = agentConfigs.get(cfg.cod_agent) || [];
      list.push(cfg);
      agentConfigs.set(cfg.cod_agent, list);
    }

    for (const [codAgent, cfgList] of agentConfigs) {
      const contracts = await sql.unsafe(
        `SELECT DISTINCT ON (s.cod_document)
          s.cod_document,
          s.whatsapp_number,
          s.signer_name,
          COALESCE(s.document_case, '') as document_case,
          s.zapsing_doctoken as zapsign_doctoken,
          s.resume_case,
          s.created_at,
          s.status_document
        FROM sing_document s
        WHERE s.cod_agent = $1
          AND s.status_document IN ('CREATED', 'SIGNED')
          AND s.created_at >= NOW() - INTERVAL '${windowDays} days'
        ORDER BY s.cod_document, s.created_at DESC`,
        [codAgent]
      ) as Contract[];

      for (const cfg of cfgList) {
        if (cfg.type === 'LEAD_FOLLOWUP') {
          results.push(...await processLeadFollowup(supabase, cfg, contracts, codAgent));
        } else if (cfg.type === 'OFFICE_ALERT') {
          results.push(...await processOfficeAlert(supabase, cfg, contracts, codAgent));
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contract-notifications-cron error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (sql) await sql.end();
  }
});
