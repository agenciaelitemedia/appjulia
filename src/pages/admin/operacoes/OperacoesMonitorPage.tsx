import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity, AlertTriangle, Bot, CheckCircle2, CircleDot,
  Clock, Database, Cpu, MessageSquare, RefreshCw, Server,
  Wifi, WifiOff, XCircle, Zap, Shield, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  useWebhookQueueStats,
  useAutomationStats,
  useAIStats,
  useBotFlowStats,
  useQueueStatuses,
} from './hooks/useOperacoesData';
import { useInfraStats } from '@/pages/tv/hooks/useInfraStats';
import { useDispatcherHealth } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';
import { useAgentLoads, useAttendanceKpis } from '@/pages/tv/hooks/useTvAggregates';

// ─── helpers ──────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xl font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } }) {
  return (
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
        {badge && <Badge variant={badge.variant} className="ml-auto text-xs">{badge.label}</Badge>}
      </CardTitle>
    </CardHeader>
  );
}

// ─── Seção 1: Canais & Conexões ───────────────────────────────────────────────

function CanaisSection() {
  const { statuses, isLoading, totalQueues, disconnected, connected } = useQueueStatuses();

  const channelLabel: Record<string, string> = {
    uazapi: 'WhatsApp UaZapi',
    waba: 'WhatsApp WABA',
    webchat: 'WebChat',
    instagram: 'Instagram',
  };

  return (
    <Card>
      <SectionHeader
        icon={Wifi}
        title="Canais & Conexões"
        badge={disconnected > 0 ? { label: `${disconnected} desconectado${disconnected > 1 ? 's' : ''}`, variant: 'destructive' } : connected === totalQueues && totalQueues > 0 ? { label: 'Todos conectados', variant: 'default' } : undefined}
      />
      <CardContent>
        {isLoading && totalQueues === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila configurada</p>
        ) : (
          <div className="space-y-2">
            {statuses.map(({ queue, status }) => (
              <div key={queue.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                {status === 'connected' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : status === 'disconnected' ? (
                  <WifiOff className="h-4 w-4 text-red-500 flex-shrink-0" />
                ) : status === 'checking' ? (
                  <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin flex-shrink-0" />
                ) : (
                  <CircleDot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{queue.name}</span>
                  <span className="text-xs text-muted-foreground">{channelLabel[queue.channel_type] ?? queue.channel_type}</span>
                </div>
                <Badge
                  variant={status === 'connected' ? 'default' : status === 'disconnected' ? 'destructive' : 'secondary'}
                  className="flex-shrink-0 text-xs"
                >
                  {status === 'connected' ? 'Conectado' : status === 'disconnected' ? 'Desconectado' : 'Desconhecido'}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {!isLoading && statuses.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">Atualização automática a cada 60s</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 2: Atendimento Humano ──────────────────────────────────────────────

function AtendimentoHumanoSection() {
  const { data: kpis, isLoading } = useAttendanceKpis();

  const fmtTime = (s: number | null) => {
    if (s == null) return '—';
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <Card>
      <SectionHeader icon={MessageSquare} title="Atendimento Humano (24h)" />
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Total conversas" value={kpis?.total_24h ?? 0} />
            <StatTile label="Pendentes" value={kpis?.pending ?? 0} color={kpis && kpis.pending > 20 ? 'text-red-500' : undefined} />
            <StatTile label="Em aberto" value={kpis?.open ?? 0} />
            <StatTile label="Resolvidas hoje" value={kpis?.resolved_today ?? 0} color="text-green-600" />
            <StatTile label="TME (1ª resposta)" value={fmtTime(kpis?.tme_seconds ?? null)} />
            <StatTile label="SLA no prazo" value={`${kpis?.sla_pct ?? 0}%`} color={kpis && kpis.sla_pct < 80 ? 'text-red-500' : 'text-green-600'} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 3: IA & Classificações ────────────────────────────────────────────

function AISection() {
  const { data: ai, isLoading } = useAIStats();

  const sentimentTotal = (ai?.sentiment_positive ?? 0) + (ai?.sentiment_negative ?? 0) + (ai?.sentiment_neutral ?? 0) + (ai?.sentiment_frustrated ?? 0);

  return (
    <Card>
      <SectionHeader
        icon={Bot}
        title="IA & Classificações (24h)"
        badge={ai && ai.avg_confidence !== null && ai.avg_confidence < 70 ? { label: `Confiança baixa: ${ai.avg_confidence}%`, variant: 'destructive' } : undefined}
      />
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatTile label="Classificações" value={ai?.total_24h ?? 0} />
              <StatTile
                label="Confiança média"
                value={ai?.avg_confidence != null ? `${ai.avg_confidence}%` : '—'}
                color={ai?.avg_confidence != null && ai.avg_confidence < 70 ? 'text-red-500' : ai?.avg_confidence != null && ai.avg_confidence < 85 ? 'text-yellow-500' : 'text-green-600'}
              />
              <StatTile label="Urgentes" value={ai?.urgency_high ?? 0} color={ai && ai.urgency_high > 0 ? 'text-orange-500' : undefined} />
            </div>

            {sentimentTotal > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Sentimento das conversas</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">Positivo</span>
                    <span className="font-medium">{ai?.sentiment_positive ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Neutro</span>
                    <span className="font-medium">{ai?.sentiment_neutral ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-500">Negativo</span>
                    <span className="font-medium">{ai?.sentiment_negative ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-500">Frustrado</span>
                    <span className="font-medium">{ai?.sentiment_frustrated ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {ai && ai.models_used.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Modelos utilizados</span>
                {ai.models_used.map(m => (
                  <div key={m.model} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground max-w-[160px]">{m.model}</span>
                    <span className="font-medium">{m.count}</span>
                  </div>
                ))}
              </div>
            )}

            {ai?.total_24h === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhuma classificação nas últimas 24h</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 4: Automações ─────────────────────────────────────────────────────

function AutomacoesSection() {
  const { data: auto, isLoading } = useAutomationStats();
  const { data: bots, isLoading: botsLoading } = useBotFlowStats();

  return (
    <Card>
      <SectionHeader
        icon={Zap}
        title="Automações & Chatbots (24h)"
        badge={auto && auto.failure_rate_pct > 5 ? { label: `${auto.failure_rate_pct}% falhas`, variant: 'destructive' } : undefined}
      />
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (
          <>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Regras de automação</span>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <StatTile label="Total" value={auto?.total ?? 0} />
                <StatTile label="Sucesso" value={auto?.success ?? 0} color="text-green-600" />
                <StatTile label="Falhas" value={auto?.failed ?? 0} color={auto && auto.failed > 0 ? 'text-red-500' : undefined} />
              </div>
              {auto && auto.total > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Taxa de sucesso</span>
                    <span>{100 - (auto.failure_rate_pct)}%</span>
                  </div>
                  <Progress value={100 - auto.failure_rate_pct} className="h-1.5" />
                </div>
              )}
            </div>

            {auto && auto.recent_failures.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Últimas falhas</span>
                <div className="mt-1 space-y-1">
                  {auto.recent_failures.map(f => (
                    <div key={f.id} className="text-xs p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                      <span className="font-medium text-red-700 dark:text-red-400">{f.action_type}</span>
                      {f.error_message && <span className="text-muted-foreground ml-1">— {f.error_message.slice(0, 60)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!botsLoading && bots && bots.total_24h > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chatbots</span>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <StatTile label="Execuções" value={bots.total_24h} />
                  <StatTile label="Concluídos" value={bots.completed} color="text-green-600" />
                  <StatTile label="Abandonados" value={bots.failed} color={bots.failed > 0 ? 'text-red-500' : undefined} />
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Taxa de conclusão</span>
                    <span>{bots.completion_rate_pct}%</span>
                  </div>
                  <Progress value={bots.completion_rate_pct} className="h-1.5" />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 5: Webhook Queue ───────────────────────────────────────────────────

function WebhookQueueSection() {
  const { data: wq, isLoading } = useWebhookQueueStats();

  return (
    <Card>
      <SectionHeader
        icon={Activity}
        title="Fila de Webhooks (24h)"
        badge={wq && wq.failed > 0 ? { label: `${wq.failed} falho${wq.failed > 1 ? 's' : ''}`, variant: 'destructive' } : wq && wq.pending > 50 ? { label: `${wq.pending} pendentes`, variant: 'secondary' } : undefined}
      />
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Pendentes" value={wq?.pending ?? 0} color={wq && wq.pending > 50 ? 'text-yellow-500' : undefined} />
              <StatTile label="Enviados" value={wq?.sent ?? 0} color="text-green-600" />
              <StatTile label="Falhos" value={wq?.failed ?? 0} color={wq && wq.failed > 0 ? 'text-red-500' : undefined} />
            </div>
            {wq && wq.max_retries > 3 && (
              <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-200 dark:border-orange-900">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Máximo de retentativas atingido: {wq.max_retries}x</span>
              </div>
            )}
            {wq && wq.recent_failures.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Falhas recentes</span>
                <div className="mt-1 space-y-1">
                  {wq.recent_failures.map(f => (
                    <div key={f.id} className="text-xs p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-red-700 dark:text-red-400">{f.from_number ?? 'desconhecido'}</span>
                        <span className="text-muted-foreground">{f.retries} tent.</span>
                      </div>
                      {f.error_message && <span className="text-muted-foreground">{f.error_message.slice(0, 70)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 6: Capacidade dos Agentes ─────────────────────────────────────────

function AgentCapacitySection() {
  const { data: agents = [], isLoading } = useAgentLoads();

  return (
    <Card>
      <SectionHeader
        icon={TrendingUp}
        title="Capacidade dos Agentes"
        badge={agents.some(a => a.max_concurrent > 0 && a.current_load / a.max_concurrent >= 0.9)
          ? { label: 'Agente(s) sobrecarregado(s)', variant: 'destructive' }
          : undefined}
      />
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum agente ativo</p>
        ) : (
          <div className="space-y-3">
            {agents.map(agent => {
              const pct = agent.max_concurrent > 0 ? Math.round((agent.current_load / agent.max_concurrent) * 100) : 0;
              const isOver = pct >= 90;
              return (
                <div key={agent.agent_identifier} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[160px] font-medium">{agent.agent_name || agent.agent_identifier}</span>
                    <span className={cn('text-xs tabular-nums', isOver ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                      {agent.current_load}/{agent.max_concurrent} ({pct}%)
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className={cn('h-1.5', isOver && '[&>div]:bg-red-500')}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 7: Infraestrutura ──────────────────────────────────────────────────

function InfraSection() {
  const { data: infra, isLoading } = useInfraStats();
  const { data: dispatcher } = useDispatcherHealth();

  return (
    <Card>
      <SectionHeader
        icon={Server}
        title="Infraestrutura"
        badge={dispatcher?.is_offline ? { label: 'Dispatcher offline', variant: 'destructive' }
          : dispatcher?.is_warning ? { label: 'Dispatcher lento', variant: 'secondary' }
          : undefined}
      />
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : (
          <>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Banco Supabase</span>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <StatTile label="Tamanho" value={infra?.db_size_pretty ?? '—'} />
                <StatTile label="Uptime" value={infra?.uptime_pretty ?? '—'} color="text-green-600" />
                <StatTile label="Conexões ativas" value={infra?.connections_active ?? 0} color={infra && infra.connections_active > 80 ? 'text-red-500' : undefined} />
                <StatTile label="Conexões idle" value={infra?.connections_idle ?? 0} />
              </div>
              {infra && infra.oldest_active_query_seconds > 30 && (
                <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-200 dark:border-orange-900 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Query lenta detectada: {infra.oldest_active_query_seconds}s sem finalizar</span>
                </div>
              )}
            </div>

            {dispatcher && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Julia Dispatcher</span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <StatTile
                    label="Status"
                    value={dispatcher.is_offline ? 'Offline' : dispatcher.is_warning ? 'Lento' : 'Online'}
                    color={dispatcher.is_offline ? 'text-red-500' : dispatcher.is_warning ? 'text-yellow-500' : 'text-green-600'}
                  />
                  <StatTile label="Workers" value={`${dispatcher.workers_active}/${dispatcher.workers_max}`} />
                  <StatTile label="Items/min" value={dispatcher.items_per_min ?? 0} />
                  <StatTile label="Último heartbeat" value={`${dispatcher.seconds_since_heartbeat}s`} color={dispatcher.is_offline ? 'text-red-500' : undefined} />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function OperacoesMonitorPage() {
  const [lastUpdate] = useState(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Monitoramento Operacional
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visibilidade em tempo real sobre canais, IA, automações e infraestrutura
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3.5 w-3.5" />
          Atualizado {formatDistanceToNow(lastUpdate, { locale: ptBR, addSuffix: true })}
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <CanaisSection />
        <AtendimentoHumanoSection />
        <AISection />
        <AutomacoesSection />
        <WebhookQueueSection />
        <AgentCapacitySection />
      </div>

      {/* Infraestrutura — row completa */}
      <InfraSection />
    </div>
  );
}
