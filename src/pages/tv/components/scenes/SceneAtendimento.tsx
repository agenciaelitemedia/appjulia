import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart, Legend } from 'recharts';
import { TvCard } from '../widgets/TvCard';
import { BigKpiCard } from '../widgets/BigKpiCard';
import { BarRanking } from '../widgets/BarRanking';
import { useAttendanceKpis, useVolumeLast24h, useAgentLoads } from '../../hooks/useTvAggregates';
import { formatDuration } from '../../utils';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  open: '#3b82f6',
  resolved: '#10b981',
  closed: '#6b7280',
};

export function SceneAtendimento() {
  const { data: kpis } = useAttendanceKpis();
  const { data: volume } = useVolumeLast24h();
  const { data: agents } = useAgentLoads();

  const tmePct = kpis?.sla_pct ?? 0;
  const tmeTone = tmePct >= 90 ? 'good' : tmePct >= 70 ? 'warn' : 'bad';

  const statusData = kpis ? [
    { name: 'Pendente', value: kpis.pending, color: STATUS_COLORS.pending },
    { name: 'Aberta', value: kpis.open, color: STATUS_COLORS.open },
    { name: 'Resolvida hoje', value: kpis.resolved_today, color: STATUS_COLORS.resolved },
  ] : [];

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* KPIs principais — 4 cards */}
      <BigKpiCard label="TME — 1ª resposta" value={formatDuration(kpis?.tme_seconds ?? null)} tone={tmeTone} className="col-span-3" />
      <BigKpiCard label="TMA — resolução" value={formatDuration(kpis?.tma_seconds ?? null)} tone="neutral" className="col-span-3" />
      <BigKpiCard label="SLA % no prazo" value={tmePct} unit="%" tone={tmeTone} className="col-span-3" />
      <BigKpiCard label="Conversas 24h" value={(kpis?.total_24h ?? 0).toLocaleString('pt-BR')} tone="neutral" className="col-span-3" />

      {/* Gráfico de volume */}
      <TvCard title="Volume últimas 24h (conversas/h)" className="col-span-7 row-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={volume ?? []}>
            <defs>
              <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" stroke="#71717a" fontSize={14} />
            <YAxis stroke="#71717a" fontSize={14} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 14 }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Area type="monotone" dataKey="count" stroke="#a78bfa" strokeWidth={3} fill="url(#volGradient)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </TvCard>

      {/* Distribuição de status */}
      <TvCard title="Distribuição por Status" className="col-span-5">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="85%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 14 }} />
            <Legend wrapperStyle={{ fontSize: 14, color: '#d4d4d8' }} />
          </PieChart>
        </ResponsiveContainer>
      </TvCard>

      {/* Agentes */}
      <TvCard title="Top agentes (carga)" className="col-span-5">
        <BarRanking
          items={(agents ?? []).map((a) => ({
            id: a.agent_identifier,
            label: a.agent_name || a.agent_identifier,
            value: a.current_load,
            secondaryLabel: a.status === 'online' ? '🟢' : a.status === 'busy' ? '🟡' : '⚫',
            trail: ` /${a.max_concurrent}`,
          }))}
          maxValue={Math.max(1, ...(agents ?? []).map(a => a.max_concurrent || 1))}
          barColor="bg-violet-500"
        />
      </TvCard>
    </div>
  );
}
