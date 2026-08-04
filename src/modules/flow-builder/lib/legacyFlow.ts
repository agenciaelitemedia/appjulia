/**
 * Conversão dos fluxos do construtor antigo (listas com nós `type: message|question|...`)
 * para o formato do editor visual (`data.kind`).
 */
import { NODE_DEFINITIONS } from '../registry/nodeRegistry';
import type { FlowCanvasEdge, FlowCanvasNode, FlowNodeKind } from '../types';

const LEGACY_KIND_MAP: Record<string, FlowNodeKind> = {
  message: 'chat_send_text',
  question: 'chat_send_text',
  condition: 'logic_condition',
  handoff: 'chat_handoff',
  tag: 'chat_tag',
  end: 'flow_end',
};

interface LegacyNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

export function isLegacyFlow(nodes: unknown[]): boolean {
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  return nodes.some((n) => {
    const node = n as LegacyNode;
    return !node?.data?.kind && !!node?.type && !!LEGACY_KIND_MAP[String(node.type)];
  });
}

function defaults(kind: FlowNodeKind): Record<string, unknown> {
  return { ...(NODE_DEFINITIONS[kind]?.defaultConfig ?? {}) };
}

export function convertLegacyFlow(
  rawNodes: unknown[],
  rawEdges: unknown[],
  legacyTrigger?: { keywords?: string[]; match_mode?: string; only_business_hours?: boolean },
): { nodes: FlowCanvasNode[]; edges: FlowCanvasEdge[] } {
  const legacyNodes = (Array.isArray(rawNodes) ? rawNodes : []) as LegacyNode[];
  const legacyEdges = (Array.isArray(rawEdges) ? rawEdges : []) as Array<Record<string, any>>;

  const nodes: FlowCanvasNode[] = legacyNodes.map((node, index) => {
    const kind = LEGACY_KIND_MAP[String(node.type)] ?? 'chat_send_text';
    const data = node.data ?? {};
    const config = defaults(kind);

    if (kind === 'chat_send_text') config.text = String(data.text ?? data.label ?? '');
    if (kind === 'logic_condition') {
      config.field = String(data.field ?? '');
      config.operator = String(data.operator ?? 'contains');
      config.value = String(data.value ?? '');
    }
    if (kind === 'chat_tag') {
      config.action = 'add';
      config.tag_name = String(data.tag ?? '');
      config.tag_id = String(data.tag ?? '');
    }

    return {
      id: node.id,
      type: 'flowNode',
      position: node.position ?? { x: 320 + index * 40, y: 120 + index * 120 },
      data: { kind, label: String(data.label ?? NODE_DEFINITIONS[kind]?.label ?? ''), config },
    };
  });

  // Todo fluxo novo precisa de um disparo — criado a partir das palavras-chave antigas.
  const triggerConfig = defaults('trigger_message_received');
  triggerConfig.keywords = (legacyTrigger?.keywords ?? []).join(', ');
  triggerConfig.match_mode = legacyTrigger?.match_mode ?? 'contains';
  triggerConfig.only_business_hours = Boolean(legacyTrigger?.only_business_hours);

  const triggerNode: FlowCanvasNode = {
    id: `trigger_legacy_${Date.now().toString(36)}`,
    type: 'flowNode',
    position: { x: 40, y: 120 },
    data: {
      kind: 'trigger_message_received',
      label: NODE_DEFINITIONS.trigger_message_received.label,
      config: triggerConfig,
    },
  };

  const edges: FlowCanvasEdge[] = legacyEdges.map((edge, index) => ({
    id: String(edge.id ?? `edge_legacy_${index}`),
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.condition === 'false' ? 'false' : edge.condition === 'true' ? 'true' : 'out',
  }));

  const firstNode = nodes[0];
  if (firstNode) {
    edges.unshift({
      id: `edge_legacy_trigger_${Date.now().toString(36)}`,
      source: triggerNode.id,
      target: firstNode.id,
      sourceHandle: 'out',
    });
  }

  return { nodes: [triggerNode, ...nodes], edges };
}
