// =============================================
// CRM BUILDER - TIPOS TYPESCRIPT
// =============================================

export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DealStatus = 'open' | 'won' | 'lost' | 'archived';
export type DealHistoryAction = 'created' | 'moved' | 'updated' | 'note_added' | 'won' | 'lost';

// Board - Quadro/Painel do CRM
export interface CRMBoard {
  id: string;
  cod_agent: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  position: number;
  is_archived: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CRMBoardFormData {
  name: string;
  description?: string;
  icon: string;
  color: string;
}

// Pipeline - Etapa dentro de um board
export interface CRMPipeline {
  id: string;
  board_id: string;
  cod_agent: string;
  name: string;
  color: string;
  position: number;
  is_active: boolean;
  win_probability: number;
  created_at: string;
  updated_at: string;
  // Computed
  deals_count?: number;
  deals_value?: number;
}

export interface CRMPipelineFormData {
  name: string;
  color: string;
  win_probability?: number;
}

// Deal - Card/Negócio dentro de um pipeline
export interface CRMDeal {
  id: string;
  pipeline_id: string;
  board_id: string;
  cod_agent: string;
  title: string;
  description?: string;
  value: number;
  currency: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  priority: DealPriority;
  status: DealStatus;
  position: number;
  expected_close_date?: string;
  custom_fields: Record<string, unknown>;
  tags: string[];
  assigned_to?: string;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CRMDealFormData {
  title: string;
  description?: string;
  value?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  priority?: DealPriority;
  expected_close_date?: string;
  tags?: string[];
  assigned_to?: string;
}

// Deal History - Histórico de movimentações
export interface CRMDealHistory {
  id: string;
  deal_id: string;
  action: DealHistoryAction;
  from_pipeline_id?: string;
  to_pipeline_id?: string;
  changed_by?: string;
  changed_at: string;
  changes: Record<string, unknown>;
  notes?: string;
  // Joined fields
  from_pipeline_name?: string;
  to_pipeline_name?: string;
  from_pipeline_color?: string;
  to_pipeline_color?: string;
}

// Drag and Drop Types
export interface DragItem {
  type: 'deal' | 'pipeline';
  id: string;
  pipelineId?: string;
}

export interface DropResult {
  dealId: string;
  fromPipelineId: string;
  toPipelineId: string;
  newPosition: number;
}

// Filter Types
export interface CRMFiltersState {
  search: string;
  pipelineIds: string[];
  priorities: DealPriority[];
  statuses: DealStatus[];
  tags: string[];
  assignedTo: string[];
  dateFrom?: string;
  dateTo?: string;
}

// Analytics Types
export interface CRMBoardStats {
  total_deals: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  total_value: number;
  won_value: number;
  conversion_rate: number;
  avg_time_in_pipeline: number;
}

export interface CRMPipelineStats {
  pipeline_id: string;
  pipeline_name: string;
  pipeline_color: string;
  deals_count: number;
  deals_value: number;
  avg_time_days: number;
}

// Icon options for boards
export const BOARD_ICONS = [
  'layout-dashboard',
  'kanban',
  'briefcase',
  'users',
  'target',
  'trophy',
  'shopping-cart',
  'heart',
  'star',
  'zap',
  'rocket',
  'building',
  'home',
  'phone',
  'mail',
  'calendar',
  'folder',
  'file-text',
  'clipboard',
  'check-square',
] as const;

// Color options for boards and pipelines
export const BOARD_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
] as const;

export const PIPELINE_COLORS = [
  '#6b7280', // gray
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#22c55e', // emerald
] as const;

// Priority config
export const PRIORITY_CONFIG: Record<DealPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Baixa', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  medium: { label: 'Média', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { label: 'Urgente', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// Status config
export const STATUS_CONFIG: Record<DealStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Aberto', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  won: { label: 'Ganho', color: 'text-green-600', bgColor: 'bg-green-100' },
  lost: { label: 'Perdido', color: 'text-red-600', bgColor: 'bg-red-100' },
  archived: { label: 'Arquivado', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};
