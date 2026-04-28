import { useMemo, useRef } from 'react';
import { useGlobalSlaStats } from '../hooks/useGlobalSlaStats';
import { useChurnSignals } from '../hooks/useChurnSignals';
import { useDispatcherHealth } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';
import { useWebhookActivity, useInfraStats } from '../hooks/useInfraStats';

interface Tick {
  id: string;
  code: string;             // SLA, DISP, CHURN, WHK, DB
  value: string;            // "12 ATRASOS", "ONLINE", "42"
  delta?: number;           // numeric delta vs prev snapshot
  /** good = positive direction, bad = negative, neutral = informational */
  trend: 'good' | 'bad' | 'neutral';
}

/**
 * Ticker estilo bolsa de valores — códigos curtos, setas, deltas e cores
 * binárias. Visual inspirado em fitas de cotação.
 */
export function TvTicker() {
  const { data: sla } = useGlobalSlaStats();
  const { data: churn } = useChurnSignals();
  const { data: heartbeat } = useDispatcherHealth();
  const { data: webhooks } = useWebhookActivity();
  const { data: infra } = useInfraStats();

  // snapshot anterior para calcular delta
  const prevRef = useRef<Record<string, number>>({});

  const ticks: Tick[] = useMemo(() => {
    const list: Tick[] = [];
    const prev = prevRef.current;
    const next: Record<string, number> = {};

    const pushNumeric = (
      code: string,
      label: string,
      value: number,
      opts: { invert?: boolean } = {}
    ) => {
      const before = prev[code];
      const delta = before === undefined ? 0 : value - before;
      next[code] = value;
      let trend: Tick['trend'] = 'neutral';
      if (delta !== 0) {
        const positive = delta > 0;
        // se invert=true (ex: SLA atrasos), subir = ruim
        trend = (opts.invert ? !positive : positive) ? 'good' : 'bad';
      }
      list.push({
        id: code,
        code,
        value: `${value.toLocaleString('pt-BR')} ${label}`,
        delta,
        trend,
      });
    };

    if (sla) {
      pushNumeric('SLA', 'ATRASOS', sla.breached ?? 0, { invert: true });
      pushNumeric('RISCO', 'EM RISCO', sla.at_risk ?? 0, { invert: true });
    }
    if (churn) {
      pushNumeric('CHURN', 'SINAIS', churn.signals?.length ?? 0, { invert: true });
    }
    if (webhooks) {
      pushNumeric('WHK1H', 'WEBHOOKS/H', webhooks.total_1h ?? 0);
      pushNumeric('WHK24', 'WEBHOOKS/24H', webhooks.total_24h ?? 0);
    }
    if (infra) {
      pushNumeric('DBCONN', 'CONEXÕES', infra.connections_active ?? 0, { invert: true });
    }
    if (heartbeat) {
      const offline = heartbeat.is_offline;
      const warn = heartbeat.is_warning;
      list.push({
        id: 'DISP',
        code: 'DISP',
        value: offline ? 'OFFLINE' : warn ? `ATRASO ${heartbeat.seconds_since_heartbeat}s` : `ONLINE ${heartbeat.seconds_since_heartbeat}s`,
        trend: offline ? 'bad' : warn ? 'bad' : 'good',
      });
    }

    prevRef.current = next;

    if (list.length === 0) {
      list.push({ id: 'idle', code: 'STATUS', value: 'OPERANDO NORMAL', trend: 'good' });
    }
    return list;
  }, [sla, churn, heartbeat, webhooks, infra]);

  // duplicado para marquee contínuo
  const items = ticks.length > 0 ? [...ticks, ...ticks] : [];

  const arrow = (t: Tick) => {
    if (t.trend === 'neutral' || t.delta === undefined || t.delta === 0) return '●';
    return t.delta > 0 ? '▲' : '▼';
  };

  const colorClass = (t: Tick) =>
    t.trend === 'bad' ? 'text-rose-400' : t.trend === 'good' ? 'text-emerald-400' : 'text-amber-300';

  return (
    <div className="overflow-hidden bg-black border-y-2 border-amber-500/50 py-2 relative shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
      <div
        className="flex items-center gap-0 whitespace-nowrap animate-[marquee_80s_linear_infinite] hover:[animation-play-state:paused] font-mono"
        style={{ width: 'max-content' }}
      >
        {items.map((t, i) => (
          <span key={`${t.id}-${i}`} className="inline-flex items-center gap-3 px-6 text-base tracking-wider uppercase">
            <span className="text-amber-200/90 font-bold">{t.code}</span>
            <span className={`text-lg ${colorClass(t)}`}>{arrow(t)}</span>
            <span className="text-zinc-100 tabular-nums">{t.value}</span>
            {t.delta !== undefined && t.delta !== 0 && (
              <span className={`text-xs tabular-nums ${colorClass(t)}`}>
                {t.delta > 0 ? '+' : ''}{t.delta}
              </span>
            )}
            <span className="text-amber-500/30 ml-3">│</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
