import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface Props {
  label: string;
  value: number | string;
  unit?: string;
  data: number[];
  color: string; // ex: '#22d3ee'
  gradientId: string;
}

export function TvSparklineCard({ label, value, unit, data, color, gradientId }: Props) {
  const chartData = useMemo(() => data.map((v, i) => ({ v, i })), [data]);
  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 0;
  const empty = data.length < 2;

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-2 min-h-[140px]">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-400">{label}</span>
        <span className="text-[10px] tabular-nums text-zinc-500">
          min {min} · max {max}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
        {unit && <span className="text-xs text-zinc-500">{unit}</span>}
      </div>
      <div className="flex-1 min-h-[50px]">
        {empty ? (
          <div className="h-full flex items-center justify-center text-[10px] text-zinc-600 uppercase tracking-wider">
            coletando…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}