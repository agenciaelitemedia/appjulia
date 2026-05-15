import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Member { id: number; name: string; }
interface Props {
  members: Member[];
  onlineSecondsByUser: Record<number, number>;
  isLoading?: boolean;
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function TeamOnlineTimeChart({ members, onlineSecondsByUser, isLoading }: Props) {
  const data = useMemo(() => {
    return members
      .map((m) => ({
        name: m.name.replace(/\s*\(você\)\s*$/, ''),
        hours: +(((onlineSecondsByUser[m.id] ?? 0) / 3600).toFixed(2)),
        seconds: onlineSecondsByUser[m.id] ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 12);
  }, [members, onlineSecondsByUser]);

  const hasData = data.some((d) => d.hours > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Tempo online — últimos 7 dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Carregando…</p>
        ) : !hasData ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Sem registros de atividade nos últimos 7 dias.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28)}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(_v, _n, p: any) => [fmtDuration(p.payload.seconds), 'Online']}
              />
              <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--primary))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}