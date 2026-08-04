// ============================================
// Interpretador do grafo de nós de um fluxo
// ============================================
import { buildRunContext, compare, resolveField } from "./context.ts";
import { actionEnd, actionHandoff, actionSendText, actionTag } from "./actions.ts";
import type { FlowEdge, FlowNode, FlowRow, FlowRunContext, NodeLogEntry } from "./types.ts";

const MAX_STEPS = 60;

export function findTriggerNode(flow: FlowRow): FlowNode | null {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  if (flow.start_node_id) {
    const byId = nodes.find((n) => n.id === flow.start_node_id);
    if (byId) return byId;
  }
  return nodes.find((n) => String(n.data?.kind ?? "").startsWith("trigger_")) ?? null;
}

function nextNodeId(edges: FlowEdge[], nodeId: string, handle: string | null): string | null {
  if (!handle) return null;
  const list = Array.isArray(edges) ? edges : [];
  const exact = list.find((e) => e.source === nodeId && (e.sourceHandle ?? "out") === handle);
  if (exact) return exact.target;
  const any = list.find((e) => e.source === nodeId);
  return handle === "out" && any ? any.target : null;
}

/** Confere se o trigger do fluxo aceita o evento recebido. */
export function triggerMatches(
  trigger: FlowNode,
  ctx: { event: string; messageText: string; messageType: string; queueId: string | null },
): boolean {
  const kind = String(trigger.data?.kind ?? "");
  const config = (trigger.data?.config ?? {}) as Record<string, any>;

  if (kind !== "trigger_message_received") return false;
  if (ctx.event !== "message_received") return false;

  if (config.queue_id && ctx.queueId && String(config.queue_id) !== String(ctx.queueId)) return false;

  const mediaType = String(config.media_type ?? "any");
  if (mediaType !== "any" && mediaType !== ctx.messageType) return false;

  const keywords = String(config.keywords ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return true;

  const text = (ctx.messageText ?? "").toLowerCase();
  const mode = String(config.match_mode ?? "contains");
  return keywords.some((k) =>
    mode === "exact" ? text.trim() === k : mode === "starts" ? text.trimStart().startsWith(k) : text.includes(k)
  );
}

export interface RunOutcome {
  status: "completed" | "failed";
  logs: NodeLogEntry[];
  error?: string;
  lastNodeId: string | null;
}

export async function runFlow(
  supabase: any,
  flow: FlowRow,
  ctx: FlowRunContext,
): Promise<RunOutcome> {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const logs: NodeLogEntry[] = [];

  const trigger = findTriggerNode(flow);
  if (!trigger) {
    return { status: "failed", logs, error: "fluxo sem nó de disparo", lastNodeId: null };
  }

  logs.push({
    node_id: trigger.id,
    kind: String(trigger.data?.kind),
    label: trigger.data?.label ?? "Disparo",
    status: "ok",
    detail: "Fluxo iniciado",
    at: new Date().toISOString(),
  });

  let currentId: string | null = nextNodeId(edges, trigger.id, "out");
  let lastNodeId: string | null = trigger.id;
  let steps = 0;

  while (currentId && steps < MAX_STEPS) {
    steps++;
    const node = byId.get(currentId);
    if (!node) {
      return { status: "failed", logs, error: `nó ${currentId} não encontrado`, lastNodeId };
    }
    lastNodeId = node.id;
    const kind = String(node.data?.kind ?? "");
    const config = (node.data?.config ?? {}) as Record<string, any>;
    const label = node.data?.label || kind;

    try {
      let handle: string | null = "out";
      let detail = "";

      switch (kind) {
        case "logic_condition": {
          const left = resolveField(String(config.field ?? ""), ctx);
          const result = compare(left, String(config.operator ?? "contains"), String(config.value ?? ""));
          handle = result ? "true" : "false";
          detail = `Condição ${result ? "verdadeira" : "falsa"}`;
          break;
        }
        case "chat_send_text":
          detail = await actionSendText(supabase, config, ctx);
          break;
        case "chat_tag":
          detail = await actionTag(supabase, config, ctx);
          break;
        case "chat_handoff":
          detail = await actionHandoff(supabase, config, ctx);
          break;
        case "flow_end":
          detail = await actionEnd(supabase, config, ctx);
          handle = null;
          break;
        default:
          detail = "Tipo de nó ainda não suportado pelo motor";
          logs.push({
            node_id: node.id,
            kind,
            label,
            status: "skipped",
            detail,
            at: new Date().toISOString(),
          });
          currentId = nextNodeId(edges, node.id, "out");
          continue;
      }

      logs.push({
        node_id: node.id,
        kind,
        label,
        status: "ok",
        detail,
        branch: handle ?? undefined,
        at: new Date().toISOString(),
      });

      currentId = handle ? nextNodeId(edges, node.id, handle) : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logs.push({
        node_id: node.id,
        kind,
        label,
        status: "error",
        detail: message,
        at: new Date().toISOString(),
      });
      return { status: "failed", logs, error: message, lastNodeId };
    }
  }

  if (steps >= MAX_STEPS) {
    return { status: "failed", logs, error: "limite de passos atingido (possível laço)", lastNodeId };
  }

  return { status: "completed", logs, lastNodeId };
}

export { buildRunContext };