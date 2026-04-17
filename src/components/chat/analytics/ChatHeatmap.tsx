import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';
import { parseISO, getDay, getHours } from 'date-fns';

interface ConversationLike {
  created_at: string;
}

interface ChatHeatmapProps<T extends ConversationLike> {
  conversations: T[];
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ChatHeatmap<T extends ConversationLike>({ conversations }: ChatHeatmapProps<T>) {
  // Build 7x24 matrix
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  conversations.forEach((c) => {
    try {
      const d = parseISO(c.created_at);
      const day = getDay(d);
      const hour = getHours(d);
      matrix[day][hour]++;
      if (matrix[day][hour] > max) max = matrix[day][hour];
    } catch {
      /* ignore */
    }
  });

  const intensity = (n: number) => {
    if (n === 0) return 0;
    if (max === 0) return 0;
    return Math.min(1, n / max);
  };

  const cellColor = (n: number) => {
    const i = intensity(n);
    if (i === 0) return 'hsl(var(--muted) / 0.4)';
    // Gradiente do primary
    return `hsl(var(--primary) / ${0.15 + i * 0.85})`;
  };

  const total = conversations.length;
  const peakHour = matrix
    .flatMap((row, day) => row.map((count, hour) => ({ day, hour, count })))
    .reduce((best, cur) => (cur.count > best.count ? cur : best), { day: 0, hour: 0, count: 0 });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Mapa de Calor — Volume por Dia × Hora
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Sem dados suficientes para exibir o mapa de calor.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Header de horas */}
                <div className="flex items-center gap-1 ml-10 mb-1">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div
                      key={h}
                      className="w-5 text-[9px] text-muted-foreground text-center font-mono"
                    >
                      {h % 3 === 0 ? h : ''}
                    </div>
                  ))}
                </div>

                {matrix.map((row, day) => (
                  <div key={day} className="flex items-center gap-1 mb-1">
                    <div className="w-9 text-[10px] text-muted-foreground text-right pr-1 font-medium">
                      {DAYS[day]}
                    </div>
                    {row.map((count, hour) => (
                      <div
                        key={hour}
                        className="w-5 h-5 rounded-sm border border-border/30 transition-all hover:scale-125 hover:border-primary cursor-default"
                        style={{ backgroundColor: cellColor(count) }}
                        title={`${DAYS[day]} ${String(hour).padStart(2, '0')}h — ${count} conversa${count === 1 ? '' : 's'}`}
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
                  <div
                    key={i}
                    className="w-3 h-3 rounded-sm border border-border/30"
                    style={{ backgroundColor: `hsl(var(--primary) / ${i})` }}
                  />
                ))}
                <span>Mais</span>
              </div>
              {peakHour.count > 0 && (
                <span>
                  Pico: <span className="font-semibold text-foreground">{DAYS[peakHour.day]} {String(peakHour.hour).padStart(2, '0')}h</span> ({peakHour.count} conversas)
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
