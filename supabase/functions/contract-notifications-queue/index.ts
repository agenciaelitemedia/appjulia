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
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const extPool = createExternalPool();
    const extClient = await extPool.connect();
    const queue: QueueItem[] = [];

    try {
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
        [cod_agent]
      );

      const contracts = contractsResult.rows;
      const now = Date.now();

      for (const cfg of configs) {
        const stepCadence = cfg.step_cadence || {};
        const msgCadence = cfg.msg_cadence || {};
        const titleCadence = cfg.title_cadence || {};

        if (cfg.type === 'LEAD_FOLLOWUP') {
          const totalSteps = Object.keys(stepCadence).length || cfg.stages_count || 3;
          const unsignedContracts = contracts.filter(c => c.status_document === 'Gerado');

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
              estimatedAt = now; // immediate
            }

            if (estimatedAt > now + TWENTY_FOUR_HOURS) continue;

            const zapSignLink = contract.zapsign_doctoken
              ? `\nhttps://app.zapsign.com.br/verificar/${contract.zapsign_doctoken}`
              : '';
            const template = msgCadence[cadenceKey] || cfg.message_template || '';
            const message = renderTemplate(template, {
              client_name: contract.name,
              case_title: contract.case_title,
              contract_date: contract.data_contrato,
            }) + zapSignLink;

            queue.push({
              type: 'LEAD_FOLLOWUP',
              contract_cod_document: contract.cod_document,
              client_name: contract.name,
              case_title: contract.case_title,
              recipient_phone: contract.whatsapp || '',
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
              if (stepTrigger === 'GENERATED' && contract.status_document !== 'Gerado') continue;
              if (stepTrigger === 'SIGNED' && contract.status_document !== 'Assinado') continue;
            }

            const delayMs = parseIntervalMs(stepCadence[cadenceKey] || '', 300000);
            let estimatedAt: number;
            if (lastSentAt && lastStep > 0) {
              estimatedAt = new Date(lastSentAt).getTime() + delayMs;
            } else {
              estimatedAt = now;
            }

            if (estimatedAt > now + TWENTY_FOUR_HOURS) continue;

            const triggerLabel = contract.status_document === 'Assinado' ? 'assinado' : 'gerado';
            const template = msgCadence[cadenceKey] || cfg.message_template || '';
            const message = renderTemplate(template, {
              client_name: contract.name,
              client_phone: contract.whatsapp,
              case_title: contract.case_title,
              case_summary: contract.resumo_do_caso || 'Sem resumo disponível',
              trigger_label: triggerLabel,
            });

            const matchingNumbers = numberEntries.filter(entry => {
              if (entry.trigger === 'BOTH') return true;
              if (entry.trigger === 'GENERATED' && contract.status_document === 'Gerado') return true;
              if (entry.trigger === 'SIGNED' && contract.status_document === 'Assinado') return true;
              return false;
            });

            for (const entry of matchingNumbers) {
              queue.push({
                type: 'OFFICE_ALERT',
                contract_cod_document: contract.cod_document,
                client_name: contract.name,
                case_title: contract.case_title,
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
    } finally {
      extClient.release();
      await extPool.end();
    }

    queue.sort((a, b) => new Date(a.estimated_at).getTime() - new Date(b.estimated_at).getTime());

    return new Response(JSON.stringify({ queue }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contract-notifications-queue error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
