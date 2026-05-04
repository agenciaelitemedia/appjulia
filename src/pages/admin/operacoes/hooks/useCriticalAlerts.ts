import { useMemo } from 'react';
import {
  useWebhookQueueStats,
  useAutomationStats,
  useAIStats,
  useQueueStatuses,
  useExternalDbStats,
} from './useOperacoesData';
import { useInfraStats } from '@/pages/tv/hooks/useInfraStats';
import { useDispatcherHealth } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';
import { useAgentLoads, useAttendanceKpis } from '@/pages/tv/hooks/useTvAggregates';

export type AlertSeverity = 'critical' | 'warn';

export interface CriticalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
}

export function useCriticalAlerts(): CriticalAlert[] {
  const { data: wq } = useWebhookQueueStats();
  const { data: auto } = useAutomationStats();
  const { data: ai } = useAIStats();
  const { data: infra } = useInfraStats();
  const { data: disp } = useDispatcherHealth();
  const { data: kpis } = useAttendanceKpis();
  const { data: agents = [] } = useAgentLoads();
  const { statuses, disconnected } = useQueueStatuses();
  const { data: ext } = useExternalDbStats();

  return useMemo(() => {
    const out: CriticalAlert[] = [];

    if (disp?.is_offline) {
      out.push({
        id: 'disp-off',
        severity: 'critical',
        title: 'Dispatcher OFFLINE',
        detail: `há ${disp.seconds_since_heartbeat}s sem heartbeat`,
      });
    } else if (disp?.is_warning) {
      out.push({
        id: 'disp-warn',
        severity: 'warn',
        title: 'Dispatcher lento',
        detail: `${disp.seconds_since_heartbeat}s sem heartbeat`,
      });
    }

    if (ext && !ext.online) {
      out.push({
        id: 'ext-db-off',
        severity: 'critical',
        title: 'Banco Locacar OFFLINE',
        detail: ext.error ?? 'sem resposta',
      });
    } else if (ext && ext.latency_ms !== null && ext.latency_ms > 2000) {
      out.push({
        id: 'ext-db-slow',
        severity: 'warn',
        title: 'Banco Locacar lento',
        detail: `${ext.latency_ms}ms de latência`,
      });
    }
    if (ext?.online && ext.oldest_active_query_seconds > 60) {
      out.push({
        id: 'ext-db-query',
        severity: ext.oldest_active_query_seconds > 180 ? 'critical' : 'warn',
        title: 'Query lenta no Locacar',
        detail: `${Math.round(ext.oldest_active_query_seconds)}s sem finalizar`,
      });
    }

    if (disconnected > 0) {
      const off = statuses.filter(s => s.status === 'disconnected');
      out.push({
        id: 'queues-off',
        severity: 'critical',
        title: `${disconnected} fila${disconnected > 1 ? 's' : ''} desconectada${disconnected > 1 ? 's' : ''}`,
        detail: off.map(o => o.queue.name).slice(0, 3).join(' · '),
      });
    }

    if (wq && wq.failed > 0) {
      out.push({
        id: 'wq-fail',
        severity: 'critical',
        title: `${wq.failed} webhook${wq.failed > 1 ? 's' : ''} falhando`,
        detail: wq.max_retries > 3 ? `máx ${wq.max_retries} tentativas` : undefined,
      });
    }
    if (wq && wq.pending > 50) {
      out.push({
        id: 'wq-pend',
        severity: 'warn',
        title: `Fila webhook acumulada`,
        detail: `${wq.pending} pendentes`,
      });
    }

    if (auto && auto.total > 0 && auto.failure_rate_pct > 5) {
      out.push({
        id: 'auto-fail',
        severity: auto.failure_rate_pct > 15 ? 'critical' : 'warn',
        title: `Automações com ${auto.failure_rate_pct}% de falha`,
        detail: `${auto.failed}/${auto.total} nas últimas 24h`,
      });
    }

    if (ai && ai.avg_confidence !== null && ai.avg_confidence < 70) {
      out.push({
        id: 'ai-low',
        severity: 'warn',
        title: `Confiança IA baixa`,
        detail: `${ai.avg_confidence}% nas últimas 24h`,
      });
    }

    if (kpis && kpis.pending > 20) {
      out.push({
        id: 'pending',
        severity: kpis.pending > 50 ? 'critical' : 'warn',
        title: `${kpis.pending} conversas pendentes`,
      });
    }
    if (kpis && kpis.total_24h > 0 && kpis.sla_pct < 80) {
      out.push({
        id: 'sla',
        severity: kpis.sla_pct < 60 ? 'critical' : 'warn',
        title: `SLA em ${kpis.sla_pct}%`,
      });
    }

    if (infra && infra.connections_active > 80) {
      out.push({
        id: 'db-conn',
        severity: 'warn',
        title: `${infra.connections_active} conexões ativas no DB`,
      });
    }
    if (infra && infra.oldest_active_query_seconds > 30) {
      out.push({
        id: 'db-slow',
        severity: infra.oldest_active_query_seconds > 120 ? 'critical' : 'warn',
        title: `Query lenta no DB`,
        detail: `${Math.round(infra.oldest_active_query_seconds)}s sem finalizar`,
      });
    }

    for (const a of agents) {
      if (a.max_concurrent <= 0) continue;
      const pct = a.current_load / a.max_concurrent;
      if (pct >= 0.9) {
        out.push({
          id: `agent-${a.agent_identifier}`,
          severity: 'warn',
          title: `${a.agent_name || a.agent_identifier} sobrecarregado`,
          detail: `${a.current_load}/${a.max_concurrent}`,
        });
      }
    }

    out.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
    return out;
  }, [wq, auto, ai, infra, disp, kpis, agents, statuses, disconnected, ext]);
}