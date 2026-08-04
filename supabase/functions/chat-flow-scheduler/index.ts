// ============================================
// chat-flow-scheduler
// Roda periodicamente (pg_cron) e cuida da parte temporal das Automações:
//  1) retoma execuções pausadas em "Aguardar" (timer vencido)
//  2) fecha "Aguardar resposta" que estourou o prazo (saída "Sem resposta")
//  3) dispara automações de inatividade do lead / do atendente
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { findTriggerNode } from "../_shared/flow-engine/runner.ts";
import type { FlowRow } from "../_shared/flow-engine/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callEngine(payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-flow-engine`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`chat-flow-engine [${res.status}]: ${text}`);
  return text;
}

function thresholdMinutes(config: Record<string, any>, fallback = 30): number {
  const amount = Number(config.amount ?? fallback);
  const unit = String(config.unit ?? "minutes");
  const value = Number.isFinite(amount) && amount > 0 ? amount : fallback;
  if (unit === "hours") return value * 60;
  if (unit === "days") return value * 1440;
  return value;
}

/** 1 + 2: retoma esperas vencidas. */
async function processWaitingRuns() {
  const nowIso = new Date().toISOString();
  const { data: runs, error } = await supabase
    .from("chat_bot_flow_runs")
    .select("id, context")
    .eq("status", "waiting")
    .limit(200);
  if (error) throw new Error(`falha ao ler execuções pausadas: ${error.message}`);

  let resumed = 0;
  for (const run of runs ?? []) {
    const ctx = (run.context ?? {}) as Record<string, any>;
    const resumeAt = ctx.resume_at as string | undefined;
    if (!resumeAt || resumeAt > nowIso) continue;
    const handle = ctx.resume_on === "lead_reply" ? String(ctx.timeout_handle ?? "timeout") : "out";
    try {
      await callEngine({ action: "resume", data: { run_id: run.id, handle } });
      resumed++;
    } catch (err) {
      console.error("[chat-flow-scheduler] resume", run.id, err);
    }
  }
  return resumed;
}

/** 3: dispara fluxos com trigger de inatividade. */
async function processInactivityTriggers() {
  const { data: flows, error } = await supabase
    .from("chat_bot_flows")
    .select("id, client_id, name, is_active, nodes, edges, start_node_id, execution_count, variables")
    .eq("is_active", true)
    .limit(500);
  if (error) throw new Error(`falha ao ler fluxos: ${error.message}`);

  let fired = 0;

  for (const flow of (flows ?? []) as unknown as FlowRow[]) {
    const trigger = findTriggerNode(flow);
    const kind = String(trigger?.data?.kind ?? "");
    if (kind !== "trigger_lead_inactive" && kind !== "trigger_agent_inactive") continue;

    const config = (trigger?.data?.config ?? {}) as Record<string, any>;
    const minutes = thresholdMinutes(config);
    const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
    const cooldownMinutes = Number(config.cooldown_minutes ?? 720);
    const cooldownSince = new Date(Date.now() - Math.max(5, cooldownMinutes) * 60_000).toISOString();
    const leadSide = kind === "trigger_lead_inactive";

    let query = supabase
      .from("chat_conversations")
      .select("id, queue_id, contact_id, status, last_customer_message_at, last_message_at, last_message_from_me")
      .eq("client_id", flow.client_id)
      .in("status", ["open", "pending"])
      .limit(100);

    if (config.queue_id) query = query.eq("queue_id", String(config.queue_id));

    // Lead inativo: o último a falar fomos nós. Atendente inativo: o lead falou por último.
    query = query.eq("last_message_from_me", leadSide);
    query = leadSide
      ? query.lte("last_message_at", cutoff)
      : query.lte("last_customer_message_at", cutoff);

    const { data: conversations, error: convError } = await query;
    if (convError) {
      console.error("[chat-flow-scheduler] conversations", flow.id, convError.message);
      continue;
    }

    for (const conv of conversations ?? []) {
      // Anti-repetição: já rodou este fluxo nesta conversa dentro da janela?
      const { data: recent } = await supabase
        .from("chat_bot_flow_runs")
        .select("id")
        .eq("flow_id", flow.id)
        .eq("conversation_id", conv.id)
        .gte("started_at", cooldownSince)
        .limit(1);
      if ((recent ?? []).length > 0) continue;

      try {
        await callEngine({
          action: "run",
          data: {
            event: leadSide ? "lead_inactive" : "agent_inactive",
            flow_id: flow.id,
            client_id: flow.client_id,
            conversation_id: conv.id,
            contact_id: conv.contact_id,
            payload: { inactive_minutes: minutes },
          },
        });
        fired++;
      } catch (err) {
        console.error("[chat-flow-scheduler] fire", flow.id, conv.id, err);
      }
    }
  }

  return fired;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resumed = await processWaitingRuns();
    const fired = await processInactivityTriggers();
    return json({ ok: true, resumed, fired, at: new Date().toISOString() });
  } catch (err) {
    console.error("[chat-flow-scheduler]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
