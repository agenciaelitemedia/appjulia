// FollowUp Configuration Types
export interface FollowupConfig {
  id: number;
  cod_agent: string;
  step_cadence: Record<string, string>;   // { cadence_1: "5 minutes", cadence_2: "1 days", ... }
  msg_cadence: Record<string, string | null>;
  title_cadence: Record<string, string>;
  start_hours: number;
  end_hours: number;
  auto_message: boolean;
  followup_from: number | null;
  followup_to: number | null;
  created_at: string;
  updated_at: string;
}

export interface FollowupQueueItem {
  id: number;
  cod_agent: string;
  session_id: string;
  step_number: number;
  send_date: string;
  state: 'SEND' | 'QUEUE' | 'STOP';
  history: string | null;
  name_client: string;
  created_at: string;
  hub: string;
  chat_memory: string;
}

// Cadence step for editing
export interface CadenceStep {
  key: string;           // cadence_1, cadence_2, etc.
  interval: string;      // "5 minutes", "1 days", etc.
  title: string;         // User-friendly title
  message: string | null; // Custom message or null for auto
}

// Interval options for cadence configuration
export const INTERVAL_OPTIONS = [
  { value: '5 minutes', label: '5 minutos' },
  { value: '10 minutes', label: '10 minutos' },
  { value: '15 minutes', label: '15 minutos' },
  { value: '30 minutes', label: '30 minutos' },
  { value: '1 hours', label: '1 hora' },
  { value: '2 hours', label: '2 horas' },
  { value: '4 hours', label: '4 horas' },
  { value: '8 hours', label: '8 horas' },
  { value: '1 days', label: '1 dia' },
  { value: '2 days', label: '2 dias' },
  { value: '3 days', label: '3 dias' },
  { value: '7 days', label: '7 dias' },
] as const;

// Hour options for start/end hours
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`,
}));

// Queue state configuration
export const QUEUE_STATES = {
  QUEUE: { label: 'Aguardando', color: 'bg-yellow-500' },
  SEND: { label: 'Enviado', color: 'bg-green-500' },
  STOP: { label: 'Pausado', color: 'bg-muted' },
} as const;

// Filters for followup queue
export interface FollowupFiltersState {
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
  state?: string;
  searchTerm?: string;
}

// Enriched queue item with derived status
export interface FollowupQueueItemEnriched extends FollowupQueueItem {
  total_steps: number;
  derived_status: 'sent' | 'waiting' | 'stopped';
  is_infinite: boolean;
}

// Derived status configuration
export const DERIVED_STATUS_CONFIG = {
  sent: { label: 'Enviado', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  waiting: { label: 'Aguardando', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  stopped: { label: 'Parado', className: 'bg-muted text-muted-foreground' },
} as const;

// Métricas diárias para gráficos (registros desagrupados)
export interface FollowupDailyMetrics {
  date: string;
  label: string;
  totalRecords: number;      // Total de registros no dia
  messagesSent: number;      // SUM das mensagens enviadas
  stopped: number;           // Registros com state='STOP'
  uniqueLeads: number;       // Leads únicos (DISTINCT session_id)
  responseRate: number;      // (stopped / totalRecords) * 100
}

// Stats atualizadas com taxa de resposta
export interface FollowupStats {
  total: number;           // Leads únicos na fila
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads aguardando
  stopped: number;         // Leads que responderam (STOP)
  responseRate: number;    // Taxa de resposta %
}
