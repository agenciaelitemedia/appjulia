import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { TvCard } from '../widgets/TvCard';
import { BigKpiCard } from '../widgets/BigKpiCard';
import { BarRanking } from '../widgets/BarRanking';
import { useTopClientsByVolume, useCsatStats, useChannelHealth } from '../../hooks/useTvAggregates';
import { useChurnSignals } from '../../hooks/useChurnSignals';
import { Star, AlertTriangle, TrendingUp } from 'lucide-react';

const REASON_LABELS: Record<string, { label: string; icon: string }> = {
  sentiment_negative: { label: 'Sentimento negativo', icon: '😟' },
  keyword_cancel: { label: 'Palavra-chave cancelar', icon: '🚨' },
  low_csat: { label: 'CSAT baixo', icon: '⭐' },
};

export function SceneClientesCanais() {
  const { data: topClients } = useTopClientsByVolume();
  const { data: csat } = useCsatStats();
  const { data: channels } = useChannelHealth();
  const { data: churn } = useChurnSignals();

  const csatTone = csat?.avg == null ? 'neutral' : csat.avg >= 4 ? 'good' : csat.avg >= 3 ? 'warn' : 'bad';
  const trendData = (csat?.trend7d ?? []).map((v, i) => ({ d: i, v }));

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* Top clientes */}
      <TvCard title="Top clientes (volume 24h)" className="col-span-7" rightSlot={<TrendingUp className="h-5 w-5 text-zinc-500" />}>
        <BarRanking
          items={(topClients ?? []).map((c) => ({
            id: c.client_id,
            label: c.client_name,
            value: c.conv_24h,
            secondaryLabel: `${c.resolved_pct}% resolvidas`,
          }))}
          barColor="bg-violet-500"
        />
      </TvCard>

      {/* CSAT card */}
      <div className="col-span-5 flex flex-col gap-6">
        <BigKpiCard
          label="CSAT global (7d)"
          value={csat?.avg != null ? csat.avg.toFixed(1) : '—'}
          unit={csat?.avg != null ? '/5' : ''}
          tone={csatTone}
        />
        <TvCard title="Tendência CSAT (7 dias)" className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <Star className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-zinc-400">{csat?.total ?? 0} respostas</span>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={trendData}>
              <Line type="monotone" dataKey="v" stroke="#fbbf24" strokeWidth={3} dot={{ fill: '#fbbf24', r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </TvCard>
      </div>

      {/* Saúde de canais */}
      <TvCard title="Volume por canal (24h)" className="col-span-5">
        <div className="space-y-2">
          {(channels ?? []).map((ch) => (
            <div key={ch.channel} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-b-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ch.error_pct > 5 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                <span className="text-zinc-200">{ch.label}</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-zinc-100">
                {ch.message_count_24h.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </TvCard>

      {/* Sinais de churn */}
      <TvCard
        title="Alertas de Churn (4h)"
        className="col-span-7"
        rightSlot={<AlertTriangle className="h-5 w-5 text-rose-500" />}
      >
        {!churn || churn.signals.length === 0 ? (
          <div className="text-center text-zinc-500 py-8 text-lg">
            ✓ Nenhum sinal de risco detectado
          </div>
        ) : (
          <div className="space-y-2 max-h-full overflow-hidden">
            {churn.signals.slice(0, 5).map((s) => {
              const reason = REASON_LABELS[s.reason] || { label: s.reason, icon: '⚠️' };
              return (
                <div key={s.conversation_id + s.reason} className="flex items-start gap-3 p-3 bg-rose-500/5 border border-rose-500/30 rounded-lg">
                  <div className="text-2xl">{reason.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-rose-300">{reason.label}</span>
                      <span className="text-xs text-zinc-500">Cliente {s.client_id}</span>
                    </div>
                    <p className="text-sm text-zinc-300 truncate italic">"{s.snippet}"</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TvCard>
    </div>
  );
}
