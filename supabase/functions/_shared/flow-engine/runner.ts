// ============================================
// Interpretador do grafo de nós de um fluxo
// ============================================
import { buildRunContext, compare, resolveField } from "./context.ts";
import { actionEnd, actionHandoff, actionSendText, actionTag } from "./actions.ts";
import { actionJuliaToggle, actionFollowupStop, ensureJuliaActive } from "./julia-actions.ts";
import {
  actionCrmCreateCard,
  actionCrmLinkConversation,
  actionCrmMoveCard,
  actionCrmUpdateCard,
} from "./crm-actions.ts";
import { actionHttpRequest, actionNotify, actionSetVariables, actionWebhook } from "./data-actions.ts";
import { actionSendMedia } from "./media-actions.ts";
import type { FlowEdge, FlowNode, FlowRow, FlowRunContext, NodeLogEntry } from "./types.ts";

const MAX_STEPS = 60;
/** Atrasos curtos são aguardados dentro da própria execução. */
const INLINE_DELAY_LIMIT_MS = 15_000;

function toMs(amount: number, unit: string): number {
  const n = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  switch (unit) {
    case "hours":
      return n * 3_600_000;
    case "days":
      return n * 86_400_000;
    case "minutes":
      return n * 60_000;
    default:
      return n * 1000;
  }
}

function unitLabel(amount: number, unit: string): string {
  const map: Record<string, string> = { seconds: "segundo", minutes: "minuto", hours: "hora", days: "dia" };
  const base = map[unit] ?? "segundo";
  return `${amount} ${base}${amount === 1 ? "" : "s"}`;
}

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

  // Disparos por tempo/inatividade são avaliados pelo agendador (chat-flow-scheduler)
  if (kind === "trigger_lead_inactive" || kind === "trigger_agent_inactive") {
    const expected = kind === "trigger_lead_inactive" ? "lead_inactive" : "agent_inactive";
    if (ctx.event !== expected) return false;
    // Fila selecionada: roda somente nessa fila (sem fila resolvida = não dispara).
    if (config.queue_id && String(config.queue_id) !== String(ctx.queueId ?? "")) return false;
    return true;
  }

  if (kind !== "trigger_message_received") return false;
  if (ctx.event !== "message_received") return false;

  if (config.queue_id && String(config.queue_id) !== String(ctx.queueId ?? "")) return false;

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
  status: "completed" | "failed" | "waiting";
  logs: NodeLogEntry[];
  error?: string;
  lastNodeId: string | null;
  wait?: {
    node_id: string;
    resume_at: string;
    resume_on: "timer" | "lead_reply";
    /** Handle usado quando o tempo estoura sem resposta. */
    timeout_handle: string;
  };
}

export interface RunFlowOptions {
  /** Retomada: continua a partir da saída deste nó. */
  resumeFromNodeId?: string | null;
  resumeHandle?: string | null;
  /** Logs já registrados na execução original. */
  previousLogs?: NodeLogEntry[];
}

export async function runFlow(
  supabase: any,
  flow: FlowRow,
  ctx: FlowRunContext,
  options: RunFlowOptions = {},
): Promise<RunOutcome> {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const logs: NodeLogEntry[] = Array.isArray(options.previousLogs) ? [...options.previousLogs] : [];

  let currentId: string | null;
  let lastNodeId: string | null;

  if (options.resumeFromNodeId) {
    const resumeNode = byId.get(options.resumeFromNodeId);
    if (!resumeNode) {
      return { status: "failed", logs, error: "nó de retomada não existe mais no fluxo", lastNodeId: null };
    }
    logs.push({
      node_id: resumeNode.id,
      kind: String(resumeNode.data?.kind),
      label: resumeNode.data?.label ?? "Espera",
      status: "ok",
      detail: options.resumeHandle === "timeout" ? "Tempo esgotado sem resposta" : "Espera concluída",
      branch: options.resumeHandle ?? undefined,
      at: new Date().toISOString(),
    });
    lastNodeId = resumeNode.id;
    currentId = nextNodeId(edges, resumeNode.id, options.resumeHandle ?? "out");
  } else {
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

    currentId = nextNodeId(edges, trigger.id, "out");
    lastNodeId = trigger.id;
  }

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
    const nodeStartedAt = Date.now();
    const snapshot = () => ({ ...(ctx.variables ?? {}) });

    try {
      let handle: string | null = "out";
      let detail = "";

      switch (kind) {
        case "logic_condition": {
          const field = String(config.field ?? "");
          if (field === "julia_active") await ensureJuliaActive(supabase, ctx);
          const left = resolveField(field, ctx);
          const result = compare(left, String(config.operator ?? "contains"), String(config.value ?? ""));
          handle = result ? "true" : "false";
          const shown = left === undefined || left === null ? "(vazio)" : String(left).slice(0, 60);
          detail = `Condição ${result ? "verdadeira" : "falsa"} — ${field}="${shown}" ${String(
            config.operator ?? "contains",
          )} "${String(config.value ?? "")}"`;
          break;
        }
        case "chat_send_text":
          detail = await actionSendText(supabase, config, ctx);
          break;
        case "logic_delay": {
          const amount = Number(config.amount ?? 0);
          const unit = String(config.unit ?? "seconds");
          const ms = toMs(amount, unit);
          if (ctx.simulate) {
            detail = `Aguardaria ${unitLabel(amount, unit)} (ignorado na simulação)`;
            break;
          }
          if (ms <= INLINE_DELAY_LIMIT_MS) {
            await new Promise((r) => setTimeout(r, ms));
            detail = `Aguardou ${unitLabel(amount, unit)}`;
            break;
          }
          logs.push({
            node_id: node.id,
            kind,
            label,
            status: "ok",
            detail: `Aguardando ${unitLabel(amount, unit)}`,
            at: new Date().toISOString(),
            duration_ms: Date.now() - nodeStartedAt,
            variables: snapshot(),
          });
          return {
            status: "waiting",
            logs,
            lastNodeId: node.id,
            wait: {
              node_id: node.id,
              resume_at: new Date(Date.now() + ms).toISOString(),
              resume_on: "timer",
              timeout_handle: "out",
            },
          };
        }
        case "logic_wait_reply": {
          const amount = Number(config.amount ?? 10);
          const unit = String(config.unit ?? "minutes");
          const ms = toMs(amount, unit) || 60_000;
          if (ctx.simulate) {
            detail = `Aguardaria resposta do lead por até ${unitLabel(amount, unit)} (simulação segue por "Respondeu")`;
            handle = "replied";
            break;
          }
          logs.push({
            node_id: node.id,
            kind,
            label,
            status: "ok",
            detail: `Aguardando resposta do lead por até ${unitLabel(amount, unit)}`,
            at: new Date().toISOString(),
            duration_ms: Date.now() - nodeStartedAt,
            variables: snapshot(),
          });
          return {
            status: "waiting",
            logs,
            lastNodeId: node.id,
            wait: {
              node_id: node.id,
              resume_at: new Date(Date.now() + ms).toISOString(),
              resume_on: "lead_reply",
              timeout_handle: "timeout",
            },
          };
        }
        case "chat_tag":
          detail = await actionTag(supabase, config, ctx);
          break;
        case "chat_send_media":
          detail = await actionSendMedia(supabase, config, ctx);
          break;
        case "chat_handoff":
          detail = await actionHandoff(supabase, config, ctx);
          break;
        case "julia_toggle":
          detail = await actionJuliaToggle(supabase, config, ctx);
          break;
        case "julia_followup_stop":
          detail = await actionFollowupStop(supabase, config, ctx);
          break;
        case "crm_create_card":
          detail = await actionCrmCreateCard(supabase, config, ctx);
          break;
        case "crm_move_card":
          detail = await actionCrmMoveCard(supabase, config, ctx);
          break;
        case "crm_update_card":
          detail = await actionCrmUpdateCard(supabase, config, ctx);
          break;
        case "crm_link_conversation":
          detail = await actionCrmLinkConversation(supabase, config, ctx);
          break;
        case "data_webhook":
          detail = await actionWebhook(supabase, config, ctx);
          break;
        case "data_http_request": {
          const result = await actionHttpRequest(config, ctx);
          detail = result.detail;
          handle = result.handle;
          break;
        }
        case "data_set_variables":
          detail = await actionSetVariables(config, ctx);
          break;
        case "data_notify":
          detail = await actionNotify(supabase, config, ctx);
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
            duration_ms: Date.now() - nodeStartedAt,
            variables: snapshot(),
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
        duration_ms: Date.now() - nodeStartedAt,
        variables: snapshot(),
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
        duration_ms: Date.now() - nodeStartedAt,
        variables: snapshot(),
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