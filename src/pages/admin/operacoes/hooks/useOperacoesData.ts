import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useQueues, type Queue } from '@/pages/agente/filas/hooks/useQueues';

// ─── Webhook Queue ────────────────────────────────────────────────────────────

export interface WebhookQueueStats {
  pending: number;
  failed: number;
  sent: number;
  max_retries: number;
  recent_failures: { id: string; from_number: string | null; error_message: string | null; created_at: string; retries: number }[];
}

export function useWebhookQueueStats() {
  return useQuery<WebhookQueueStats>({
    queryKey: ['ops-webhook-queue'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('webhook_queue' as never)
        .select('id, status, error_message, from_number, created_at, retries')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(500) as any;
      const list = (data ?? []) as any[];
      return {
        pending: list.filter(r => r.status === 'pending').length,
        failed: list.filter(r => r.status === 'failed').length,
        sent: list.filter(r => r.status === 'sent').length,
        max_retries: list.reduce((m, r) => Math.max(m, r.retries ?? 0), 0),
        recent_failures: list
          .filter(r => r.status === 'failed')
          .slice(0, 5)
          .map(r => ({ id: r.id, from_number: r.from_number, error_message: r.error_message, created_at: r.created_at, retries: r.retries })),
      };
    },
    refetchInterval: 10 * 1000,
  });
}

// ─── Automation Logs ─────────────────────────────────────────────────────────

export interface AutomationStats {
  total: number;
  success: number;
  failed: number;
  failure_rate_pct: number;
  recent_failures: { id: string; rule_id: string; action_type: string; error_message: string | null; executed_at: string }[];
}

export function useAutomationStats() {
  return useQuery<AutomationStats>({
    queryKey: ['ops-automation-stats'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('chat_automation_logs')
        .select('id, success, error_message, rule_id, action_type, executed_at')
        .gte('executed_at', since24h)
        .order('executed_at', { ascending: false })
        .limit(1000);
      const list = data ?? [];
      const total = list.length;
      const success = list.filter(r => r.success).length;
      const failed = total - success;
      return {
        total,
        success,
        failed,
        failure_rate_pct: total > 0 ? Math.round((failed / total) * 100) : 0,
        recent_failures: list
          .filter(r => !r.success)
          .slice(0, 5)
          .map(r => ({ id: r.id, rule_id: r.rule_id, action_type: r.action_type, error_message: r.error_message, executed_at: r.executed_at })),
      };
    },
    refetchInterval: 30 * 1000,
  });
}

// ─── AI Classifications ───────────────────────────────────────────────────────

export interface AIStats {
  total_24h: number;
  avg_confidence: number | null;
  sentiment_positive: number;
  sentiment_negative: number;
  sentiment_neutral: number;
  sentiment_frustrated: number;
  urgency_high: number;
  models_used: { model: string; count: number }[];
}

export function useAIStats() {
  return useQuery<AIStats>({
    queryKey: ['ops-ai-stats'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('chat_ai_classifications')
        .select('sentiment, urgency, confidence, model, created_at')
        .gte('created_at', since24h)
        .limit(5000);
      const list = data ?? [];
      const confidences = list.map(r => r.confidence).filter((c): c is number => c != null);
      const avgConf = confidences.length > 0
        ? Math.round((confidences.reduce((s, c) => s + c, 0) / confidences.length) * 100)
        : null;
      const modelMap = new Map<string, number>();
      for (const r of list) {
        const m = r.model ?? 'desconhecido';
        modelMap.set(m, (modelMap.get(m) ?? 0) + 1);
      }
      return {
        total_24h: list.length,
        avg_confidence: avgConf,
        sentiment_positive: list.filter(r => r.sentiment === 'positive' || r.sentiment === 'positivo').length,
        sentiment_negative: list.filter(r => r.sentiment === 'negative' || r.sentiment === 'negativo').length,
        sentiment_neutral: list.filter(r => r.sentiment === 'neutral' || r.sentiment === 'neutro').length,
        sentiment_frustrated: list.filter(r => r.sentiment === 'frustrado').length,
        urgency_high: list.filter(r => r.urgency === 'high' || r.urgency === 'urgente').length,
        models_used: Array.from(modelMap.entries())
          .map(([model, count]) => ({ model, count }))
          .sort((a, b) => b.count - a.count),
      };
    },
    refetchInterval: 30 * 1000,
  });
}

// ─── Chatbot Flow Runs ────────────────────────────────────────────────────────

export interface BotFlowStats {
  total_24h: number;
  completed: number;
  failed: number;
  running: number;
  completion_rate_pct: number;
}

export function useBotFlowStats() {
  return useQuery<BotFlowStats>({
    queryKey: ['ops-bot-flow-stats'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('chat_bot_flow_runs' as never)
        .select('status')
        .gte('started_at', since24h)
        .limit(2000) as any;
      const list = (data ?? []) as { status: string }[];
      const total = list.length;
      const completed = list.filter(r => r.status === 'completed').length;
      const failed = list.filter(r => r.status === 'failed').length;
      const running = list.filter(r => r.status === 'running').length;
      return {
        total_24h: total,
        completed,
        failed,
        running,
        completion_rate_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    },
    refetchInterval: 60 * 1000,
  });
}

// ─── Queue Connection Status ──────────────────────────────────────────────────

export type QueueConnStatus = 'connected' | 'disconnected' | 'unknown' | 'checking';

export interface QueueStatus {
  queue: Queue;
  status: QueueConnStatus;
}

async function checkQueueConnected(queue: Queue): Promise<QueueConnStatus> {
  try {
    if (queue.channel_type === 'uazapi' && queue.evo_instance) {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'status', queue_id: queue.id },
      });
      if (error || !data?.data) return 'disconnected';
      const inst = data.data.instance || data.data;
      const st = data.data.status || data.data;
      return (st?.connected === true || inst?.status === 'open') ? 'connected' : 'disconnected';
    }
    if (queue.channel_type === 'waba' && queue.waba_token && queue.waba_number_id) {
      return 'connected'; // WABA: se tem credenciais considera conectada
    }
    return 'unknown';
  } catch {
    return 'disconnected';
  }
}

export function useQueueStatuses() {
  const { data: queues = [] } = useQueues(false);
  const checkable = queues.filter(
    q => q.is_active && !q.is_deleted
  );

  const results = useQueries({
    queries: checkable.map(queue => ({
      queryKey: ['ops-queue-status', queue.id],
      queryFn: async (): Promise<QueueStatus> => ({
        queue,
        status: await checkQueueConnected(queue),
      }),
      staleTime: 60 * 1000,
      refetchInterval: 60 * 1000,
      retry: 0,
    })),
  });

  return {
    statuses: results.map(r => r.data).filter((d): d is QueueStatus => !!d),
    isLoading: results.some(r => r.isLoading),
    totalQueues: checkable.length,
    disconnected: results.filter(r => r.data?.status === 'disconnected').length,
    connected: results.filter(r => r.data?.status === 'connected').length,
  };
}

// ─── Banco Externo (Locacar) ─────────────────────────────────────────────────

export interface ExternalDbStats {
  online: boolean;
  db_size_bytes: number;
  db_size_pretty: string;
  connections_active: number;
  connections_idle: number;
  connections_total: number;
  uptime_seconds: number;
  uptime_pretty: string;
  oldest_active_query_seconds: number;
  latency_ms: number | null;
  error: string | null;
}

function formatBytes(b: number): string {
  if (!b || b < 1024) return `${b ?? 0} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(s: number): string {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function useExternalDbStats() {
  return useQuery<ExternalDbStats>({
    queryKey: ['ops-external-db-stats'],
    queryFn: async () => {
      const t0 = Date.now();
      const { data, error } = await supabase.functions.invoke('db-query', {
        body: { action: 'get_external_infra_stats' },
      });
      const latency = Date.now() - t0;
      const empty: ExternalDbStats = {
        online: false,
        db_size_bytes: 0, db_size_pretty: '—',
        connections_active: 0, connections_idle: 0, connections_total: 0,
        uptime_seconds: 0, uptime_pretty: '—',
        oldest_active_query_seconds: 0,
        latency_ms: null,
        error: null,
      };
      if (error) return { ...empty, error: error.message };
      const payload = data as { data?: any[]; error?: string | null } | null;
      if (!payload || payload.error) return { ...empty, error: payload?.error ?? 'sem resposta', latency_ms: latency };
      const row = (payload.data ?? [])[0];
      if (!row) return { ...empty, error: 'sem dados', latency_ms: latency };
      const bytes = Number(row.db_size_bytes ?? 0);
      const uptime = Number(row.uptime_seconds ?? 0);
      return {
        online: true,
        db_size_bytes: bytes,
        db_size_pretty: formatBytes(bytes),
        connections_active: Number(row.connections_active ?? 0),
        connections_idle: Number(row.connections_idle ?? 0),
        connections_total: Number(row.connections_total ?? 0),
        uptime_seconds: uptime,
        uptime_pretty: formatUptime(uptime),
        oldest_active_query_seconds: Number(row.oldest_active_query_seconds ?? 0),
        latency_ms: latency,
        error: null,
      };
    },
    refetchInterval: 30 * 1000,
    retry: 1,
  });
}
