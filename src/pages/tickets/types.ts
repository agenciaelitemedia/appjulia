export type TicketStatus = 'open' | 'pending' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  number: number | null;
  protocol: string | null;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  department_id: string | null;
  category_id: string | null;
  requester_user_id: string | null;
  requester_client_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  tags: string[];
  conversation_id: string | null;
  contact_id: string | null;
  opened_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  sla_first_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  resolution_note: string | null;
  csat_score: number | null;
  csat_comment: string | null;
  csat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  author_name: string | null;
  author_role: 'requester' | 'agent' | 'system' | null;
  kind: 'public' | 'internal' | 'event';
  event_type: string | null;
  body: string | null;
  attachments: TicketAttachment[] | null | unknown;
  created_at: string;
}

export interface TicketAttachment {
  type: 'image' | string;
  url: string;
  mimetype?: string;
  file_name?: string;
}

export interface SupportDepartment { id: string; name: string; is_active: boolean; sort_order: number; }
export interface SupportCategory { id: string; department_id: string | null; name: string; is_active: boolean; sort_order: number; }

export interface SlaTarget { firstResponseMins: number; resolutionMins: number; }
export interface SupportSettings {
  id: string;
  sla: Record<TicketPriority, SlaTarget>;
  csat_enabled: boolean;
  protocol_mask: string;
  protocol_auto_send: boolean;
  protocol_send_template: string;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Aberto',
  pending: 'Pendente',
  in_progress: 'Em andamento',
  waiting_customer: 'Aguardando cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export const STATUS_ORDER: TicketStatus[] = ['open', 'pending', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

// Kanban columns (closed agrupado com resolved para enxugar)
export const KANBAN_STATUSES: TicketStatus[] = ['open', 'pending', 'in_progress', 'waiting_customer', 'resolved'];

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
};

export const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  waiting_customer: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground',
};

export const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

// Papel do usuário no helpdesk
export type TicketRole = 'requester' | 'manager' | 'agent';
