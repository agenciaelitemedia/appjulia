import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Bot, CheckCircle2, Clock, Cpu,
  MessageSquare, Server, Wifi, WifiOff, Zap, X, AlertCircle,
  Maximize2, TrendingUp,
} from 'lucide-react';
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
import { useCriticalAlerts, type CriticalAlert } from './hooks/useCriticalAlerts';

/* ───────────────────────────── helpers ───────────────────────────── */

type Tone = 'ok' | 'warn' | 'crit' | 'mute';

const toneBg: Record<Tone, string> = {
  ok:   'bg-emerald-500/10 border-emerald-500/30',
  warn: 'bg-amber-500/10 border-amber-500/40',
  crit: 'bg-red-600/15 border-red-500/50',
  mute: 'bg-zinc-900/60 border-zinc-800',
};
const toneText: Record<Tone, string> = {
  ok:   'text-emerald-400',
  warn: 'text-amber-400',
  crit: 'text-red-400',
  mute: 'text-zinc-300',
};
const toneDot: Record<Tone, string> = {
  ok:   'bg-emerald-500',
  warn: 'bg-amber-500',
  crit: 'bg-red-500',
  mute: 'bg-zinc-600',
};

function fmtTime(s: number | null) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

/* ───────────────────────────── primitives ────────────────────────── */

function Panel({
  title,
  icon: Icon,
  tone = 'mute',
  badge,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  tone?: Tone;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border-2 p-6 flex flex-col gap-4 min-h-0', toneBg[tone], className)}>
      <div className="flex items-center gap-3">
        <Icon className={cn('h-7 w-7', toneText[tone])} />
        <h2 className="text-2xl font-bold tracking-tight text-zinc-100 uppercase">{title}</h2>
        {badge && (
          <span className={cn(
            'ml-auto px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide',
            tone === 'crit' && 'bg-red-500 text-white animate-pulse',
            tone === 'warn' && 'bg-amber-500 text-zinc-900',
            tone === 'ok'   && 'bg-emerald-500 text-zinc-900',
            tone === 'mute' && 'bg-zinc-800 text-zinc-300',
          )}>{badge}</span>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Big({ value, label, tone = 'mute' }: { value: React.ReactNode; label: string; tone?: Tone }) {
  return (
    <div className="flex flex-col">
      <span className={cn('text-7xl font-black tabular-nums leading-none', toneText[tone])}>{value}</span>
      <span className="text-sm uppercase tracking-widest text-zinc-400 mt-2">{label}</span>
    </div>
  );
}

function Mid({ value, label, tone = 'mute' }: { value: React.ReactNode; label: string; tone?: Tone }) {
  return (
    <div className="flex flex-col">
      <span className={cn('text-4xl font-bold tabular-nums leading-none', toneText[tone])}>{value}</span>
      <span className="text-xs uppercase tracking-wider text-zinc-500 mt-1.5">{label}</span>
    </div>
  );
}

/* ───────────────────────────── header ────────────────────────────── */

function WarRoomHeader({ alerts, onExit }: { alerts: CriticalAlert[]; onExit: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const crit = alerts.filter(a => a.severity === 'critical').length;
  const warn = alerts.filter(a => a.severity === 'warn').length;
  const overall: Tone = crit > 0 ? 'crit' : warn > 0 ? 'warn' : 'ok';

  return (
    <header className="flex items-center gap-6 px-8 h-20 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className={cn('h-4 w-4 rounded-full', toneDot[overall], 'animate-pulse')} />
        <span className="text-2xl font-black tracking-tight text-zinc-100">JULIA · OPS</span>
      </div>
      <span className={cn(
        'px-4 py-1.5 rounded-full text-base font-bold uppercase tracking-wider',
        overall === 'crit' && 'bg-red-500 text-white animate-pulse',
        overall === 'warn' && 'bg-amber-500 text-zinc-900',
        overall === 'ok' && 'bg-emerald-500 text-zinc-900',
      )}>
        {overall === 'crit' ? `${crit} críticos` : overall === 'warn' ? `${warn} avisos` : 'tudo ok'}
      </span>
      <div className="ml-auto flex items-center gap-6">
        <div className="flex items-center gap-2 text-zinc-400 text-base">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          LIVE
        </div>
        <div className="text-3xl font-bold tabular-nums text-zinc-100">
          {now.toLocaleTimeString('pt-BR')}
        </div>
        <button
          onClick={onExit}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
          title="Sair do modo TV (ESC)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

/* ───────────────────────────── alerts strip ──────────────────────── */

function AlertsStrip({ alerts }: { alerts: CriticalAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 h-20 px-8 bg-emerald-500/5 border-y border-emerald-500/20">
        <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        <span className="text-2xl font-bold text-emerald-300 uppercase tracking-wide">
          Nenhum alerta ativo — operação saudável
        </span>
      </div>
    );
  }
  return (
    <div className="h-20 bg-zinc-950 border-y border-zinc-800 overflow-hidden flex items-center">
      <div className="flex gap-4 px-8 animate-marquee whitespace-nowrap">
        {[...alerts, ...alerts].map((a, i) => (
          <div
            key={`${a.id}-${i}`}
            className={cn(
              'flex items-center gap-3 px-6 h-12 rounded-xl border-2 flex-shrink-0',
              a.severity === 'critical'
                ? 'bg-red-600/20 border-red-500 animate-pulse'
                : 'bg-amber-500/15 border-amber-500/60',
            )}
          >
            <AlertCircle className={cn('h-5 w-5', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')} />
            <span className="text-lg font-bold text-zinc-100">{a.title}</span>
            {a.detail && <span className="text-base text-zinc-400">· {a.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── panels ────────────────────────────── */

function CanaisPanel() {
  const { statuses, totalQueues, disconnected, connected } = useQueueStatuses();
  const tone: Tone = totalQueues === 0 ? 'mute' : disconnected > 0 ? 'crit' : 'ok';
  const off = statuses.filter(s => s.status === 'disconnected');

  return (
    <Panel
      title="Canais"
      icon={Wifi}
      tone={tone}
      badge={tone === 'crit' ? `${disconnected} OFF` : tone === 'ok' ? 'ONLINE' : undefined}
    >
      <div className="flex flex-col h-full justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className={cn('text-8xl font-black tabular-nums leading-none', toneText[tone])}>{connected}</span>
            <span className="text-3xl font-bold text-zinc-500">/ {totalQueues}</span>
          </div>
          <span className="text-sm uppercase tracking-widest text-zinc-400 mt-2 block">conectadas</span>
        </div>
        {off.length > 0 && (
          <div className="space-y-1.5">
            {off.slice(0, 4).map(({ queue }) => (
              <div key={queue.id} className="flex items-center gap-2 text-base">
                <WifiOff className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span className="font-semibold text-zinc-100 truncate">{queue.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function AtendimentoPanel() {
  const { data: k } = useAttendanceKpis();
  const pending = k?.pending ?? 0;
  const sla = k?.sla_pct ?? 0;
  const tme = k?.tme_seconds ?? null;

  const pendTone: Tone = pending > 50 ? 'crit' : pending > 20 ? 'warn' : 'ok';
  const slaTone: Tone = !k || k.total_24h === 0 ? 'mute' : sla < 60 ? 'crit' : sla < 80 ? 'warn' : 'ok';
  const tmeTone: Tone = tme == null ? 'mute' : tme > 600 ? 'crit' : tme > 300 ? 'warn' : 'ok';
  const overall: Tone = [pendTone, slaTone, tmeTone].includes('crit') ? 'crit'
    : [pendTone, slaTone, tmeTone].includes('warn') ? 'warn' : 'ok';

  return (
    <Panel title="Atendimento" icon={MessageSquare} tone={overall}>
      <div className="grid grid-cols-3 gap-6 h-full items-center">
        <Big value={pending} label="pendentes" tone={pendTone} />
        <Big value={fmtTime(tme)} label="TME 1ª resp" tone={tmeTone} />
        <Big value={`${sla}%`} label="SLA" tone={slaTone} />
      </div>
    </Panel>
  );
}

function IAPanel() {
  const { data: ai } = useAIStats();
  const conf = ai?.avg_confidence ?? null;
  const confTone: Tone = conf == null ? 'mute' : conf < 70 ? 'crit' : conf < 85 ? 'warn' : 'ok';
  const urgTone: Tone = ai && ai.urgency_high > 5 ? 'crit' : ai && ai.urgency_high > 0 ? 'warn' : 'mute';
  const total = (ai?.sentiment_positive ?? 0) + (ai?.sentiment_negative ?? 0) + (ai?.sentiment_neutral ?? 0) + (ai?.sentiment_frustrated ?? 0);

  return (
    <Panel title="IA / Classif" icon={Bot} tone={confTone === 'crit' ? 'crit' : urgTone}>
      <div className="flex flex-col h-full justify-between gap-4">
        <div className="grid grid-cols-2 gap-6">
          <Big value={conf != null ? `${conf}%` : '—'} label="confiança" tone={confTone} />
          <Big value={ai?.urgency_high ?? 0} label="urgentes 24h" tone={urgTone} />
        </div>
        {total > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Sentimento</div>
            <div className="flex h-3 rounded-full overflow-hidden bg-zinc-900">
              <div className="bg-emerald-500" style={{ width: `${((ai!.sentiment_positive) / total) * 100}%` }} />
              <div className="bg-zinc-500"    style={{ width: `${((ai!.sentiment_neutral)  / total) * 100}%` }} />
              <div className="bg-red-500"     style={{ width: `${((ai!.sentiment_negative) / total) * 100}%` }} />
              <div className="bg-orange-500"  style={{ width: `${((ai!.sentiment_frustrated)/ total) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span className="text-emerald-400">+{ai!.sentiment_positive}</span>
              <span>={ai!.sentiment_neutral}</span>
              <span className="text-red-400">−{ai!.sentiment_negative}</span>
              <span className="text-orange-400">!{ai!.sentiment_frustrated}</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function InfraPanel() {
  const { data: infra } = useInfraStats();
  const { data: disp } = useDispatcherHealth();

  const dispTone: Tone = !disp ? 'mute' : disp.is_offline ? 'crit' : disp.is_warning ? 'warn' : 'ok';
  const connTone: Tone = !infra ? 'mute' : infra.connections_active > 80 ? 'crit' : infra.connections_active > 50 ? 'warn' : 'ok';
  const slowTone: Tone = !infra ? 'mute' : infra.oldest_active_query_seconds > 120 ? 'crit' : infra.oldest_active_query_seconds > 30 ? 'warn' : 'ok';
  const overall: Tone = [dispTone, connTone, slowTone].includes('crit') ? 'crit'
    : [dispTone, connTone, slowTone].includes('warn') ? 'warn' : 'ok';

  const dispLabel = !disp ? '—' : disp.is_offline ? 'OFF' : disp.is_warning ? 'LENTO' : 'OK';

  return (
    <Panel title="Infraestrutura" icon={Server} tone={overall}>
      <div className="flex flex-col h-full justify-between gap-4">
        <div className="grid grid-cols-2 gap-6">
          <Big value={dispLabel} label="dispatcher" tone={dispTone} />
          <Big value={infra?.connections_active ?? '—'} label="conexões DB" tone={connTone} />
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-800/60">
          <Mid value={disp ? `${disp.workers_active}/${disp.workers_max}` : '—'} label="workers" />
          <Mid value={disp?.items_per_min ?? 0} label="itens/min" />
          <Mid
            value={infra ? `${Math.round(infra.oldest_active_query_seconds)}s` : '—'}
            label="query + lenta"
            tone={slowTone}
          />
        </div>
      </div>
    </Panel>
  );
}

function WebhookPanel() {
  const { data: wq } = useWebhookQueueStats();
  const failTone: Tone = !wq ? 'mute' : wq.failed > 5 ? 'crit' : wq.failed > 0 ? 'warn' : 'ok';
  const pendTone: Tone = !wq ? 'mute' : wq.pending > 100 ? 'crit' : wq.pending > 50 ? 'warn' : 'ok';
  const tone: Tone = [failTone, pendTone].includes('crit') ? 'crit' : [failTone, pendTone].includes('warn') ? 'warn' : 'ok';
  return (
    <Panel title="Fila Webhooks" icon={Activity} tone={tone}>
      <div className="grid grid-cols-3 gap-6 h-full items-center">
        <Big value={wq?.failed ?? 0} label="falhas" tone={failTone} />
        <Big value={wq?.pending ?? 0} label="pendentes" tone={pendTone} />
        <Big value={wq?.sent ?? 0} label="enviados 24h" tone="ok" />
      </div>
    </Panel>
  );
}

function AutomacoesPanel() {
  const { data: auto } = useAutomationStats();
  const { data: bots } = useBotFlowStats();
  const failPct = auto?.failure_rate_pct ?? 0;
  const failTone: Tone = !auto || auto.total === 0 ? 'mute' : failPct > 15 ? 'crit' : failPct > 5 ? 'warn' : 'ok';
  const botTone: Tone = !bots || bots.total_24h === 0 ? 'mute' : bots.completion_rate_pct < 60 ? 'warn' : 'ok';

  return (
    <Panel title="Automações & Bots" icon={Zap} tone={failTone === 'crit' ? 'crit' : botTone}>
      <div className="grid grid-cols-2 gap-6 h-full">
        <div className="flex flex-col justify-center gap-2">
          <Big value={`${failPct}%`} label="falhas automação" tone={failTone} />
          <span className="text-sm text-zinc-500">{auto?.failed ?? 0} de {auto?.total ?? 0} (24h)</span>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <Big value={`${bots?.completion_rate_pct ?? 0}%`} label="bots concluídos" tone={botTone} />
          <span className="text-sm text-zinc-500">{bots?.completed ?? 0} de {bots?.total_24h ?? 0} (24h)</span>
        </div>
      </div>
    </Panel>
  );
}

function CapacidadePanel() {
  const { data: agents = [] } = useAgentLoads();
  // mostra apenas quem está em risco (>=70%); se ninguém em risco, mostra top 5
  const sized = agents.filter(a => a.max_concurrent > 0);
  const risky = sized.filter(a => a.current_load / a.max_concurrent >= 0.7);
  const list = (risky.length > 0 ? risky : sized).slice(0, 6);
  const overloaded = sized.some(a => a.current_load / a.max_concurrent >= 0.9);

  return (
    <Panel
      title="Capacidade"
      icon={TrendingUp}
      tone={overloaded ? 'crit' : risky.length > 0 ? 'warn' : 'ok'}
      badge={overloaded ? 'sobrecarga' : undefined}
    >
      {list.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <span className="text-2xl text-zinc-500 uppercase tracking-wide">sem agentes ativos</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {list.map(a => {
            const pct = Math.round((a.current_load / a.max_concurrent) * 100);
            const t: Tone = pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : 'ok';
            return (
              <div key={a.agent_identifier} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-zinc-100 truncate">
                    {a.agent_name || a.agent_identifier}
                  </span>
                  <span className={cn('text-lg font-bold tabular-nums', toneText[t])}>
                    {a.current_load}/{a.max_concurrent}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className={cn('h-full transition-all', toneDot[t], pct >= 90 && 'animate-pulse')}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ───────────────────────────── ticker ────────────────────────────── */

function Ticker() {
  const { data: wq } = useWebhookQueueStats();
  const { data: auto } = useAutomationStats();

  const items = [
    ...(wq?.recent_failures ?? []).map(f => ({
      ts: new Date(f.created_at),
      label: `Webhook · ${f.from_number ?? 'desc'} · ${f.error_message?.slice(0, 50) ?? 'erro'} (${f.retries}t)`,
    })),
    ...(auto?.recent_failures ?? []).map(f => ({
      ts: new Date(f.executed_at),
      label: `Automação · ${f.action_type} · ${f.error_message?.slice(0, 60) ?? 'erro'}`,
    })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime()).slice(0, 12);

  if (items.length === 0) {
    return (
      <div className="h-14 flex items-center px-8 border-t border-zinc-800 bg-zinc-950 text-base text-zinc-500">
        <Cpu className="h-4 w-4 mr-3 text-zinc-600" /> Sem falhas recentes nas últimas 24h
      </div>
    );
  }
  return (
    <div className="h-14 flex items-center border-t border-zinc-800 bg-zinc-950 overflow-hidden">
      <span className="flex-shrink-0 px-6 h-full flex items-center bg-red-600/20 border-r border-red-500/40 text-red-300 font-bold uppercase tracking-wider text-sm">
        <AlertTriangle className="h-4 w-4 mr-2" /> Falhas recentes
      </span>
      <div className="flex gap-10 px-8 animate-marquee whitespace-nowrap text-base text-zinc-300">
        {[...items, ...items].map((it, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="text-zinc-500 tabular-nums">
              {it.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>{it.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── page ──────────────────────────────── */

export default function OperacoesMonitorPage() {
  const alerts = useCriticalAlerts();
  const [fullscreen, setFullscreen] = useState(true);

  // ESC sai do modo fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'f' || e.key === 'F') setFullscreen(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const root = (
    <div className={cn(
      'flex flex-col bg-zinc-950 text-zinc-100',
      fullscreen ? 'fixed inset-0 z-[60] h-screen w-screen' : 'h-[calc(100vh-4rem)] rounded-xl overflow-hidden border border-zinc-800',
    )}>
      <WarRoomHeader alerts={alerts} onExit={() => setFullscreen(false)} />
      <AlertsStrip alerts={alerts} />

      <main className="flex-1 grid grid-cols-12 grid-rows-2 gap-4 p-4 min-h-0">
        {/* Top row */}
        <div className="col-span-3 row-span-1 min-h-0"><CanaisPanel /></div>
        <div className="col-span-5 row-span-1 min-h-0"><AtendimentoPanel /></div>
        <div className="col-span-4 row-span-1 min-h-0"><IAPanel /></div>

        {/* Bottom row */}
        <div className="col-span-4 row-span-1 min-h-0"><InfraPanel /></div>
        <div className="col-span-4 row-span-1 min-h-0"><WebhookPanel /></div>
        <div className="col-span-4 row-span-1 min-h-0"><AutomacoesPanel /></div>
      </main>

      {/* Capacity strip + ticker */}
      <div className="grid grid-cols-12 gap-4 px-4 pb-4">
        <div className="col-span-12"><CapacidadePanel /></div>
      </div>
      <Ticker />
    </div>
  );

  if (fullscreen) return root;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Modo TV desativado · pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">F</kbd> ou clique abaixo para voltar</span>
        </div>
        <button
          onClick={() => setFullscreen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          <Maximize2 className="h-4 w-4" /> Abrir modo TV (fullscreen)
        </button>
      </div>
      {root}
    </div>
  );
}