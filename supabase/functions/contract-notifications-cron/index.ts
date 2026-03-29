import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_DB_HOST = Deno.env.get("EXTERNAL_DB_HOST");
const EXTERNAL_DB_PORT = Deno.env.get("EXTERNAL_DB_PORT");
const EXTERNAL_DB_USERNAME = Deno.env.get("EXTERNAL_DB_USERNAME");
const EXTERNAL_DB_PASSWORD = Deno.env.get("EXTERNAL_DB_PASSWORD");
const EXTERNAL_DB_DATABASE = Deno.env.get("EXTERNAL_DB_DATABASE");
const EXTERNAL_DB_CA_CERT = Deno.env.get("EXTERNAL_DB_CA_CERT");
const N8N_HUB_SEND_URL = Deno.env.get("N8N_HUB_SEND_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function createExternalPool(): Pool {
  const connUrl = Deno.env.get("EXTERNAL_DB_URL") || "";
  const isSocket = connUrl.includes("/.s.PGSQL.") || connUrl.includes("%2F");
  const caCert = EXTERNAL_DB_CA_CERT ? EXTERNAL_DB_CA_CERT.replace(/\\n/g, "\n") : undefined;

  return new Pool(
    {
      hostname: EXTERNAL_DB_HOST,
      port: parseInt(EXTERNAL_DB_PORT || "5432"),
      user: EXTERNAL_DB_USERNAME,
      password: EXTERNAL_DB_PASSWORD,
      database: EXTERNAL_DB_DATABASE,
      tls: isSocket ? { enabled: false } : caCert ? { enabled: true, caCertificates: [caCert] } : { enabled: true },
    },
    1,
    true
  );
}

interface Contract {
  cod_document: string;
  whatsapp: string;
  name: string;
  case_title: string;
  zapsign_doctoken: string | null;
  resumo_do_caso: string | null;
  data_contrato: string;
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
  const unsignedContracts = contracts.filter(c => c.status_document === 'Gerado');
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
      client_name: contract.name,
      case_title: contract.case_title,
      contract_date: contract.data_contrato,
    }) + zapSignLink;

    const sendResult = contract.whatsapp
      ? await sendWhatsApp(contract.whatsapp, message, codAgent, "contract_followup")
      : { status: 'failed', error: 'whatsapp not configured' };

    await supabase.from("contract_notification_logs").insert({
      config_id: cfg.id,
      cod_agent: codAgent,
      contract_cod_document: contract.cod_document,
      type: 'LEAD_FOLLOWUP',
      step_number: nextStep,
      recipient_phone: contract.whatsapp,
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

  // Build per-number config with individual triggers
  interface NumberEntry { phone: string; trigger: string }
  let numberEntries: NumberEntry[] = [];

  const tnc = cfg.target_numbers_config;
  if (tnc && Array.isArray(tnc) && tnc.length > 0) {
    numberEntries = tnc;
  } else {
    // Fallback to old target_numbers + global trigger_event
    const targetNumbers = cfg.target_numbers || [];
    const globalTrigger = cfg.trigger_event || 'BOTH';
    numberEntries = targetNumbers.map((phone: string) => ({ phone, trigger: globalTrigger }));
  }

  if (numberEntries.length === 0) return results;

  const stepCadence = cfg.step_cadence || {};
  const msgCadence = cfg.msg_cadence || {};
  const totalSteps = Object.keys(stepCadence).length || cfg.office_repeat_count || 1;

  for (const contract of contracts) {
    // Check existing logs for this contract
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

    if (lastSentAt && lastStep > 0) {
      const elapsed = Date.now() - new Date(lastSentAt).getTime();
      const delayMs = parseIntervalMs(stepCadence[cadenceKey] || '', 300000);
      if (elapsed < delayMs) continue;
    }

    const triggerLabel = contract.status_document === 'Assinado' ? 'assinado' : 'gerado';
    const template = msgCadence[cadenceKey] || cfg.message_template || '';
    const message = renderTemplate(template, {
      client_name: contract.name,
      client_phone: contract.whatsapp,
      case_title: contract.case_title,
      case_summary: contract.resumo_do_caso || 'Sem resumo disponível',
      trigger_label: triggerLabel,
    });

    // Filter numbers by individual trigger matching the contract status
    const matchingNumbers = numberEntries.filter(entry => {
      if (entry.trigger === 'BOTH') return true;
      if (entry.trigger === 'GENERATED' && contract.status_document === 'Gerado') return true;
      if (entry.trigger === 'SIGNED' && contract.status_document === 'Assinado') return true;
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
  let extPool: Pool | null = null;

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

    extPool = createExternalPool();
    const extClient = await extPool.connect();
    const results: any[] = [];

    try {
      const agentConfigs = new Map<string, any[]>();
      for (const cfg of configs) {
        const list = agentConfigs.get(cfg.cod_agent) || [];
        list.push(cfg);
        agentConfigs.set(cfg.cod_agent, list);
      }

      for (const [codAgent, cfgList] of agentConfigs) {
        const contractsResult = await extClient.queryObject<Contract>(
          `SELECT DISTINCT ON (s.cod_document)
            s.cod_document,
            s.whatsapp,
            s.name,
            COALESCE(cc.name, '') as case_title,
            s.zapsing_doctoken as zapsign_doctoken,
            s.resumo_do_caso,
            s.data_contrato,
            s.status_document
          FROM julia_sessions_contracts s
          LEFT JOIN case_categories cc ON cc.id = s.case_category_id
          WHERE s.cod_agent = $1
            AND s.status_document IN ('Gerado', 'Assinado')
            AND s.data_contrato >= NOW() - INTERVAL '30 days'
          ORDER BY s.cod_document, s.data_contrato DESC`,
          [codAgent]
        );

        const contracts = contractsResult.rows;

        for (const cfg of cfgList) {
          if (cfg.type === 'LEAD_FOLLOWUP') {
            results.push(...await processLeadFollowup(supabase, cfg, contracts, codAgent));
          } else if (cfg.type === 'OFFICE_ALERT') {
            results.push(...await processOfficeAlert(supabase, cfg, contracts, codAgent));
          }
        }
      }
    } finally {
      extClient.release();
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
    if (extPool) await extPool.end();
  }
});
