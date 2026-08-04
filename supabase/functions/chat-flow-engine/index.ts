// ============================================
// chat-flow-engine
// Executa fluxos visuais (Automações / Flow Builder).
// Ações: run (evento real) | simulate (teste no editor)
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildRunContext, runFlow, findTriggerNode, triggerMatches } from "../_shared/flow-engine/runner.ts";
import type { FlowEventInput, FlowRow } from "../_shared/flow-engine/types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadFlows(clientId: string, flowId?: string | null): Promise<FlowRow[]> {
  let query = supabase
    .from("chat_bot_flows")
    .select("id, client_id, name, is_active, nodes, edges, start_node_id, execution_count, variables");

  if (flowId) query = query.eq("id", flowId);
  else query = query.eq("client_id", clientId).eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`falha ao carregar fluxos: ${error.message}`);
  return (data ?? []) as unknown as FlowRow[];
}

async function executeOne(flow: FlowRow, input: FlowEventInput, simulate: boolean) {
  const clientId = String(input.client_id ?? flow.client_id);
  const ctx = await buildRunContext(supabase, {
    event: input.event,
    simulate,
    client_id: clientId,
    conversation_id: input.conversation_id,
    contact_id: input.contact_id,
    message_text: input.message_text,
    message_type: input.message_type,
    tag: input.tag,
    variables: { ...(flow.variables ?? {}), ...(input.payload ?? {}) },
  });

  let runId: string | null = null;
  if (!simulate) {
    const { data } = await supabase
      .from("chat_bot_flow_runs")
      .insert({
        flow_id: flow.id,
        client_id: clientId,
        conversation_id: ctx.conversation?.id ?? null,
        contact_id: ctx.contact?.id ?? null,
        status: "running",
        trigger_event: input.event,
        is_simulation: false,
        context: { message_text: ctx.messageText, message_type: ctx.messageType },
      })
      .select("id")
      .maybeSingle();
    runId = data?.id ?? null;
  }

  const outcome = await runFlow(supabase, flow, ctx);

  if (!simulate && runId) {
    await supabase
      .from("chat_bot_flow_runs")
      .update({
        status: outcome.status,
        node_logs: outcome.logs,
        error_message: outcome.error ?? null,
        current_node_id: outcome.lastNodeId,
        finished_at: new Date().toISOString(),
        last_step_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (outcome.status === "completed") {
      await supabase
        .from("chat_bot_flows")
        .update({ execution_count: (flow.execution_count ?? 0) + 1, last_executed_at: new Date().toISOString() })
        .eq("id", flow.id);
    }
  }

  return { flow_id: flow.id, flow_name: flow.name, run_id: runId, ...outcome };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "run";
    const input: FlowEventInput = body.data ?? body;

    if (!input?.event) return json({ error: "campo 'event' é obrigatório" }, 400);

    const simulate = action === "simulate" || input.simulate === true;

    if (simulate && !input.flow_id) {
      return json({ error: "simulação exige 'flow_id'" }, 400);
    }

    let clientId = input.client_id ?? null;
    if (!clientId && input.conversation_id) {
      const { data } = await supabase
        .from("chat_conversations")
        .select("client_id")
        .eq("id", input.conversation_id)
        .maybeSingle();
      clientId = data?.client_id ?? null;
    }
    if (!clientId && !input.flow_id) {
      return json({ error: "não foi possível resolver o client_id" }, 400);
    }

    const flows = await loadFlows(String(clientId ?? ""), input.flow_id ?? null);
    if (flows.length === 0) return json({ executed: 0, results: [] });

    let queueId: string | null = null;
    if (input.conversation_id) {
      const { data } = await supabase
        .from("chat_conversations")
        .select("queue_id")
        .eq("id", input.conversation_id)
        .maybeSingle();
      queueId = data?.queue_id ?? null;
    }

    const eligible = flows.filter((flow) => {
      if (simulate) return true;
      if (!flow.is_active) return false;
      const trigger = findTriggerNode(flow);
      if (!trigger) return false;
      return triggerMatches(trigger, {
        event: input.event,
        messageText: input.message_text ?? "",
        messageType: input.message_type ?? "text",
        queueId,
      });
    });

    const results = [];
    for (const flow of eligible) {
      try {
        results.push(await executeOne(flow, input, simulate));
      } catch (err) {
        results.push({
          flow_id: flow.id,
          flow_name: flow.name,
          status: "failed",
          logs: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return json({ executed: results.length, simulate, results });
  } catch (err) {
    console.error("[chat-flow-engine]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});