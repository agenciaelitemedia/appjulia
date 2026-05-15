import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  /** matriz 7×24 — minutos totais de presença na hora */
  matrix: number[][];
  /** matriz 7×24 — usuários distintos presentes */
  users: number[][];
  isLoading?: boolean;
}

export function TeamPresenceHeatmap({ matrix, users, isLoading }: Props) {
  let max = 0;
  for (const row of matrix) for (const v of row) if (v > max) max = v;

  const cellColor = (n: number) => {
    if (n === 0 || max === 0) return 'hsl(var(--muted) / 0.4)';
    const i = Math.min(1, n / max);
    return `hsl(var(--primary) / ${0.15 + i * 0.85})`;
  };

  let peak = { d: 0, h: 0, v: 0 };
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (matrix[d][h] > peak.v) peak = { d, h, v: matrix[d][h] };
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Heatmap de presença — últimos 7 dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Carregando…</p>
        ) : max === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Sem dados de presença na semana.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="flex items-center gap-1 ml-10 mb-1">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="w-5 text-[9px] text-muted-foreground text-center font-mono">
                      {h % 3 === 0 ? h : ''}
                    </div>
                  ))}
                </div>
                {matrix.map((row, d) => (
                  <div key={d} className="flex items-center gap-1 mb-1">
                    <div className="w-9 text-[10px] text-muted-foreground text-right pr-1 font-medium">
                      {DAYS[d]}
                    </div>
                    {row.map((mins, h) => (
                      <div
                        key={h}
                        className="w-5 h-5 rounded-sm border border-border/30 transition-all hover:scale-125 hover:border-primary cursor-default"
                        style={{ backgroundColor: cellColor(mins) }}
                        title={`${DAYS[d]} ${String(h).padStart(2, '0')}h — ${mins} min · ${users[d][h]} usuário${users[d][h] === 1 ? '' : 's'}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span>Menos</span>
                {[0.15, 0.4, 0.65, 0.9].map((i) => (
                  <div key={i} className="w-3 h-3 rounded-sm border border-border/30"
                    style={{ backgroundColor: `hsl(var(--primary) / ${i})` }} />
                ))}
                <span>Mais</span>
              </div>
              {peak.v > 0 && (
                <span>
                  Pico: <span className="font-semibold text-foreground">
                    {DAYS[peak.d]} {String(peak.h).padStart(2, '0')}h
                  </span> ({peak.v} min)
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}