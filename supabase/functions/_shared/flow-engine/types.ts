// ============================================
// Tipos compartilhados do motor de fluxos (Automações / Flow Builder)
// ============================================

export interface FlowNode {
  id: string;
  type?: string;
  data: {
    kind: string;
    label?: string;
    config?: Record<string, unknown>;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FlowRow {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  start_node_id: string | null;
  execution_count: number;
  variables: Record<string, unknown>;
}

export interface FlowEventInput {
  event: string;
  client_id?: string;
  conversation_id?: string | null;
  contact_id?: string | null;
  message_text?: string | null;
  message_type?: string | null;
  tag?: string | null;
  flow_id?: string | null;
  simulate?: boolean;
  payload?: Record<string, unknown>;
}

export interface FlowRunContext {
  event: string;
  simulate: boolean;
  clientId: string;
  conversation: Record<string, any> | null;
  contact: Record<string, any> | null;
  queue: Record<string, any> | null;
  messageText: string;
  messageType: string;
  tag: string | null;
  variables: Record<string, unknown>;
  /** Última mensagem enviada pelo atendente/automação (ISO) — base para inatividade. */
  lastAgentMessageAt: string | null;
}

export interface NodeLogEntry {
  node_id: string;
  kind: string;
  label: string;
  status: 'ok' | 'skipped' | 'error';
  detail?: string;
  branch?: string;
  at: string;
}

export interface NodeResult {
  /** Handle de saída a seguir. `null` encerra o fluxo. */
  next: string | null;
  status: NodeLogEntry['status'];
  detail?: string;
}