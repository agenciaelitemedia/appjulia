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

// Unidades de intervalo para o select
export const INTERVAL_UNITS = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
] as const;

// Limites de etapas e mensagens
export const STEP_LIMITS = {
  MAX_STEPS: 50,
  MIN_INTERVAL_MINUTES: 5,
  MIN_MESSAGE_WORDS: 3,
  MAX_MESSAGE_CHARS: 300,
} as const;

// Funções utilitárias para intervalo
export function parseInterval(interval: string): { value: number; unit: string } {
  const match = interval.match(/^(\d+)\s+(minutes|hours|days)$/);
  return match
    ? { value: parseInt(match[1], 10), unit: match[2] }
    : { value: 5, unit: 'minutes' };
}

export function formatInterval(value: number, unit: string): string {
  return `${value} ${unit}`;
}

// Calcular próxima data de envio baseada no intervalo da etapa atual
export function calculateNextSendDate(
  sendDate: string,
  stepNumber: number,
  stepCadence: Record<string, string>
): Date | null {
  const cadenceKey = `cadence_${stepNumber}`;
  const interval = stepCadence[cadenceKey];

  if (!interval) return null;

  const { value, unit } = parseInterval(interval);
  const date = new Date(sendDate);

  switch (unit) {
    case 'minutes':
      date.setMinutes(date.getMinutes() + value);
      break;
    case 'hours':
      date.setHours(date.getHours() + value);
      break;
    case 'days':
      date.setDate(date.getDate() + value);
      break;
  }

  return date;
}

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
  derived_status: 'sent' | 'waiting' | 'stopped' | 'finalized';
  is_infinite: boolean;
}

// Derived status configuration
export const DERIVED_STATUS_CONFIG = {
  sent: { label: 'Enviado', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  waiting: { label: 'Aguardando', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  stopped: { label: 'Parado', className: 'bg-muted text-muted-foreground' },
  finalized: { label: 'Finalizado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
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

// Stats do período anterior (para comparação)
export interface FollowupPreviousStats {
  total: number;
  totalSent: number;
  waiting: number;
  stopped: number;
  responseRate: number;
}

// Stats atualizadas com taxa de resposta
export interface FollowupStats {
  total: number;           // Leads únicos na fila
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads aguardando
  stopped: number;         // Leads que responderam (STOP)
  responseRate: number;    // Taxa de resposta %
  previous?: FollowupPreviousStats; // Dados do período anterior para comparação
}
