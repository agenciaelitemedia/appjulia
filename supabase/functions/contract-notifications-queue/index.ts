import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { getAgentCredentials } from "../_shared/get-agent-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function parseIntervalMs(interval: string, fallbackMs: number): number {
  const match = interval.match(/^(\d+)\s+(minutes|hours|days)$/);
  if (!match) return fallbackMs;
  const val = parseInt(match[1]);
  const unit = match[2];
  return unit === 'days' ? val * 86400000 : unit === 'hours' ? val * 3600000 : val * 60000;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value || '');
  }
  return result;
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

interface QueueItem {
  type: string;
  contract_cod_document: string;
  client_name: string;
  case_title: string;
  recipient_phone: string;
  step_number: number;
  step_title: string;
  estimated_at: string;
  message_preview: string;
  status_document: string;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const { cod_agent } = await req.json();
    if (!cod_agent) {
      return new Response(JSON.stringify({ error: "cod_agent required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: configs, error: cfgErr } = await supabase
      .from("contract_notification_configs")
      .select("*")
      .eq("cod_agent", cod_agent)
      .eq("is_active", true);

    if (cfgErr) throw cfgErr;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ queue: [] }), {
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
      [cod_agent]
    ) as Contract[];

    const now = Date.now();
    const queue: QueueItem[] = [];

    for (const cfg of configs) {
      const stepCadence = cfg.step_cadence || {};
      const msgCadence = cfg.msg_cadence || {};
      const titleCadence = cfg.title_cadence || {};

      if (cfg.type === 'LEAD_FOLLOWUP') {
        const totalSteps = Object.keys(stepCadence).length || cfg.stages_count || 3;
        const unsignedContracts = contracts.filter((c: Contract) => c.status_document === 'CREATED');

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
          const delayMs = parseIntervalMs(stepCadence[cadenceKey] || '', (cfg.delay_interval_minutes || 1440) * 60000);

          let estimatedAt: number;
          if (lastSentAt) {
            estimatedAt = new Date(lastSentAt).getTime() + delayMs;
          } else {
            estimatedAt = now;
          }

          if (estimatedAt > now + TWENTY_FOUR_HOURS) continue;

          const zapSignLink = contract.zapsign_doctoken
            ? `\nhttps://app.zapsign.com.br/verificar/${contract.zapsign_doctoken}`
            : '';
          const template = msgCadence[cadenceKey] || cfg.message_template || '';
          const message = renderTemplate(template, {
            client_name: contract.signer_name,
            case_title: contract.document_case,
            contract_date: contract.created_at,
          }) + zapSignLink;

          queue.push({
            type: 'LEAD_FOLLOWUP',
            contract_cod_document: contract.cod_document,
            client_name: contract.signer_name,
            case_title: contract.document_case,
            recipient_phone: contract.whatsapp_number || '',
            step_number: nextStep,
            step_title: titleCadence[cadenceKey] || `Etapa ${nextStep}`,
            estimated_at: new Date(estimatedAt).toISOString(),
            message_preview: message.substring(0, 120),
            status_document: contract.status_document,
          });
        }
      } else if (cfg.type === 'OFFICE_ALERT') {
        const triggerCadence = cfg.trigger_cadence || {};
        const totalSteps = Object.keys(stepCadence).length || cfg.office_repeat_count || 1;

        const tnc = cfg.target_numbers_config;
        let numberEntries: Array<{ phone: string; trigger: string }> = [];
        if (tnc && Array.isArray(tnc) && tnc.length > 0) {
          numberEntries = tnc;
        } else {
          const targetNumbers = cfg.target_numbers || [];
          const globalTrigger = cfg.trigger_event || 'BOTH';
          numberEntries = targetNumbers.map((phone: string) => ({ phone, trigger: globalTrigger }));
        }

        if (numberEntries.length === 0) continue;

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

          const delayMs = parseIntervalMs(stepCadence[cadenceKey] || '', 300000);
          let estimatedAt: number;
          if (lastSentAt && lastStep > 0) {
            estimatedAt = new Date(lastSentAt).getTime() + delayMs;
          } else {
            estimatedAt = now;
          }

          if (estimatedAt > now + TWENTY_FOUR_HOURS) continue;

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
            queue.push({
              type: 'OFFICE_ALERT',
              contract_cod_document: contract.cod_document,
              client_name: contract.signer_name,
              case_title: contract.document_case,
              recipient_phone: entry.phone,
              step_number: nextStep,
              step_title: titleCadence[cadenceKey] || `Etapa ${nextStep}`,
              estimated_at: new Date(estimatedAt).toISOString(),
              message_preview: message.substring(0, 120),
              status_document: contract.status_document,
            });
          }
        }
      }
    }

    queue.sort((a, b) => new Date(a.estimated_at).getTime() - new Date(b.estimated_at).getTime());

    // Check agent connection status
    const creds = await getAgentCredentials(sql, cod_agent);
    const connectionStatus = creds ? 'connected' : 'no_credentials';
    const providerHub = creds?.hub || null;

    return new Response(JSON.stringify({ queue, connectionStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contract-notifications-queue error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (sql) await sql.end();
  }
});
