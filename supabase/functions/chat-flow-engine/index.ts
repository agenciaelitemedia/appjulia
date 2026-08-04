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

/**
 * Escolhe o desenho a executar: execuções reais usam a versão publicada,
 * simulações usam o rascunho atual do editor.
 */
function resolveGraph(row: any, simulate: boolean): FlowRow {
  const publishedNodes = Array.isArray(row.published_nodes) ? row.published_nodes : [];
  const usePublished = !simulate && publishedNodes.length > 0;
  return {
    ...row,
    nodes: usePublished ? publishedNodes : row.nodes,
    edges: usePublished ? (Array.isArray(row.published_edges) ? row.published_edges : []) : row.edges,
    start_node_id: usePublished ? (row.published_start_node_id ?? null) : row.start_node_id,
  } as FlowRow;
}

async function loadFlows(clientId: string, flowId?: string | null, simulate = false): Promise<FlowRow[]> {
  let query = supabase
    .from("chat_bot_flows")
    .select(
      "id, client_id, name, is_active, status, nodes, edges, start_node_id, published_nodes, published_edges, published_start_node_id, execution_count, variables",
    );

  if (flowId) query = query.eq("id", flowId);
  else query = query.eq("client_id", clientId).eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`falha ao carregar fluxos: ${error.message}`);
  return (data ?? []).map((row: any) => resolveGraph(row, simulate)) as FlowRow[];
}

async function persistOutcome(runId: string, flow: FlowRow, outcome: any, contextPatch: Record<string, unknown> = {}) {
  const waiting = outcome.status === "waiting" && outcome.wait;
  const { data: existing } = await supabase
    .from("chat_bot_flow_runs")
    .select("context")
    .eq("id", runId)
    .maybeSingle();
  const context = { ...(existing?.context ?? {}), ...contextPatch };

  if (waiting) {
    context.resume_at = outcome.wait.resume_at;
    context.resume_on = outcome.wait.resume_on;
    context.resume_node_id = outcome.wait.node_id;
    context.timeout_handle = outcome.wait.timeout_handle;
  } else {
    delete context.resume_at;
    delete context.resume_on;
    delete context.resume_node_id;
    delete context.timeout_handle;
  }

  await supabase
    .from("chat_bot_flow_runs")
    .update({
      status: waiting ? "waiting" : outcome.status,
      node_logs: outcome.logs,
      error_message: outcome.error ?? null,
      current_node_id: outcome.lastNodeId,
      context,
      finished_at: waiting ? null : new Date().toISOString(),
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

/** Retoma uma execução pausada (timer estourado ou lead respondeu). */
async function resumeRun(runId: string, handle: string) {
  const { data: run } = await supabase
    .from("chat_bot_flow_runs")
    .select("id, flow_id, client_id, conversation_id, contact_id, context, node_logs, trigger_event, status")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { run_id: runId, status: "failed", error: "execução não encontrada" };
  if (run.status !== "waiting") return { run_id: runId, status: run.status, skipped: true };

  const flows = await loadFlows(String(run.client_id), run.flow_id);
  const flow = flows[0];
  if (!flow) return { run_id: runId, status: "failed", error: "fluxo não encontrado" };

  const ctxRaw = (run.context ?? {}) as Record<string, any>;
  const ctx = await buildRunContext(supabase, {
    event: String(run.trigger_event ?? "resume"),
    simulate: false,
    client_id: String(run.client_id),
    conversation_id: run.conversation_id,
    contact_id: run.contact_id,
    message_text: ctxRaw.message_text ?? "",
    message_type: ctxRaw.message_type ?? "text",
    variables: { ...(flow.variables ?? {}), ...(ctxRaw.variables ?? {}) },
  });

  const outcome = await runFlow(supabase, flow, ctx, {
    resumeFromNodeId: ctxRaw.resume_node_id ?? run.current_node_id ?? null,
    resumeHandle: handle,
    previousLogs: Array.isArray(run.node_logs) ? run.node_logs : [],
  });

  await persistOutcome(run.id, flow, outcome);
  return { run_id: run.id, flow_id: flow.id, ...outcome };
}

/** Quando o lead responde, retoma execuções paradas em "aguardar resposta". */
async function resumeOnLeadReply(conversationId: string) {
  const { data: runs } = await supabase
    .from("chat_bot_flow_runs")
    .select("id, context")
    .eq("conversation_id", conversationId)
    .eq("status", "waiting");
  const pending = (runs ?? []).filter((r: any) => (r.context ?? {}).resume_on === "lead_reply");
  const results = [];
  for (const run of pending) results.push(await resumeRun(run.id, "replied"));
  return results;
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
    await persistOutcome(runId, flow, outcome, {
      message_text: ctx.messageText,
      message_type: ctx.messageType,
      variables: ctx.variables,
    });
  }

  return { flow_id: flow.id, flow_name: flow.name, run_id: runId, ...outcome };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "run";
    const input: FlowEventInput = body.data ?? body;

    if (action === "resume") {
      const runId = (body.data ?? body).run_id;
      if (!runId) return json({ error: "campo 'run_id' é obrigatório" }, 400);
      const handle = (body.data ?? body).handle ?? "out";
      return json({ resumed: await resumeRun(String(runId), String(handle)) });
    }

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

    const flows = await loadFlows(String(clientId ?? ""), input.flow_id ?? null, simulate);
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
      // Só a versão publicada roda de verdade.
      if (String((flow as any).status ?? "published") === "archived") return false;
      if (String((flow as any).status ?? "published") === "draft") return false;
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

    // Lead respondeu: retoma execuções paradas em "aguardar resposta"
    if (!simulate && input.event === "message_received" && input.conversation_id) {
      try {
        const resumed = await resumeOnLeadReply(String(input.conversation_id));
        for (const r of resumed) results.push({ ...r, resumed: true });
      } catch (err) {
        console.error("[chat-flow-engine] resumeOnLeadReply", err);
      }
    }

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