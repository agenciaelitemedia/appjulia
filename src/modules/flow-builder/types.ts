import type { Node, Edge } from '@xyflow/react';

export type FlowNodeCategory = 'trigger' | 'logic' | 'chat' | 'julia' | 'crm' | 'data';

export type FlowNodeKind =
  // Disparo
  | 'trigger_message_received'
  // Lógica
  | 'logic_condition'
  // Chat
  | 'chat_send_text'
  | 'chat_tag'
  | 'chat_handoff'
  // Controle
  | 'flow_end';

export type FlowNodeConfig = Record<string, unknown>;

export interface FlowNodeData extends Record<string, unknown> {
  kind: FlowNodeKind;
  label?: string;
  config: FlowNodeConfig;
}

export type FlowCanvasNode = Node<FlowNodeData>;
export type FlowCanvasEdge = Edge;

export interface FlowRecord {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  variables: Record<string, unknown>;
  version: number;
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  start_node_id: string | null;
  execution_count: number;
  last_executed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FlowPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}