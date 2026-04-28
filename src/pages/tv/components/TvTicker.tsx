import { useMemo } from 'react';
import { useGlobalSlaStats } from '../hooks/useGlobalSlaStats';
import { useChurnSignals } from '../hooks/useChurnSignals';
import { useDispatcherHealth } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';

interface TickerEvent {
  id: string;
  ts: Date;
  emoji: string;
  text: string;
  tone: 'good' | 'warn' | 'bad';
}

/**
 * Ticker rolante (marquee horizontal) com eventos críticos das últimas
 * horas. Combina sinais de SLA, churn e dispatcher.
 */
export function TvTicker() {
  const { data: sla } = useGlobalSlaStats();
  const { data: churn } = useChurnSignals();
  const { data: heartbeat } = useDispatcherHealth();

  const events: TickerEvent[] = useMemo(() => {
    const list: TickerEvent[] = [];

    if (sla?.oldest_breached) {
      list.push({
        id: `sla:${sla.oldest_breached.conversation_id}`,
        ts: new Date(),
        emoji: '🔴',
        text: `SLA: conv. ${sla.oldest_breached.conversation_id.slice(0, 8)} atrasada ${sla.oldest_breached.minutes_overdue}min (cliente ${sla.oldest_breached.client_id})`,
        tone: 'bad',
      });
    }
    if ((sla?.breached ?? 0) > 0) {
      list.push({
        id: `sla:summary`,
        ts: new Date(),
        emoji: '⚠️',
        text: `${sla!.breached} conversas com SLA violado, ${sla!.at_risk} em risco`,
        tone: 'bad',
      });
    }

    for (const s of (churn?.signals ?? []).slice(0, 8)) {
      list.push({
        id: `churn:${s.conversation_id}:${s.reason}`,
        ts: new Date(s.detected_at),
        emoji: s.reason === 'sentiment_negative' ? '😟' : s.reason === 'keyword_cancel' ? '🚨' : '⭐',
        text: `Churn (${s.reason}) cliente ${s.client_id}: "${s.snippet}"`,
        tone: 'bad',
      });
    }

    if (heartbeat?.is_offline) {
      list.push({
        id: `dispatcher:offline`,
        ts: new Date(),
        emoji: '🔥',
        text: `Dispatcher OFFLINE há ${heartbeat.seconds_since_heartbeat}s — webhooks em fila`,
        tone: 'bad',
      });
    } else if (heartbeat?.is_warning) {
      list.push({
        id: `dispatcher:warn`,
        ts: new Date(),
        emoji: '⚠️',
        text: `Dispatcher com ping atrasado (${heartbeat.seconds_since_heartbeat}s)`,
        tone: 'warn',
      });
    }

    if (list.length === 0) {
      list.push({ id: 'idle', ts: new Date(), emoji: '✅', text: 'Tudo operando normalmente — sem alertas críticos', tone: 'good' });
    }

    return list;
  }, [sla, churn, heartbeat]);

  // Para rolar continuamente, duplicamos a lista de eventos
  const items = events.length > 0 ? [...events, ...events] : [];

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-rose-600/70 bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-rose-950/80 py-5 relative shadow-[0_0_30px_rgba(244,63,94,0.35)]">
      <div
        className="flex gap-12 whitespace-nowrap animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused]"
        style={{ width: 'max-content' }}
      >
        {items.map((e, i) => (
          <span key={`${e.id}-${i}`} className={`text-2xl font-bold inline-flex items-center gap-3 ${
            e.tone === 'bad' ? 'text-rose-200 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]' : e.tone === 'warn' ? 'text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]' : 'text-emerald-200 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]'
          }`}>
            <span className="text-3xl">{e.emoji}</span>
            <span>
              <span className="text-rose-300/70 mr-2 tabular-nums font-mono text-lg">
                {e.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {e.text}
            </span>
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
