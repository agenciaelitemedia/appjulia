import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOutgoing, Clock, TrendingUp } from 'lucide-react';
import { useCallHistoryQuery } from '../hooks/useCallHistoryQuery';
import { getTodayInSaoPaulo, get30DaysAgoInSaoPaulo } from '@/lib/dateUtils';

interface Props {
  codAgent: string;
}

export function RelatoriosTab({ codAgent }: Props) {
  const today = getTodayInSaoPaulo();
  const thirtyDaysAgo = get30DaysAgoInSaoPaulo();

  const { data: historyResult } = useCallHistoryQuery(codAgent, {
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    page: 0,
    pageSize: 1000,
  });

  const callHistory = historyResult?.data || [];

  const stats = useMemo(() => {
    const total = callHistory.length;
    const outbound = callHistory.filter((c) => c.direction === 'outbound').length;
    const totalDuration = callHistory.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    const totalCost = callHistory.reduce((sum, c) => sum + Number(c.cost || 0), 0);

    return { total, outbound, totalDuration, avgDuration, totalCost };
  }, [callHistory]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const cards = [
    { label: 'Total de Chamadas', value: stats.total, icon: Phone, color: 'text-blue-500' },
    { label: 'Chamadas Saídas', value: stats.outbound, icon: PhoneOutgoing, color: 'text-green-500' },
    { label: 'Tempo Total', value: formatDuration(stats.totalDuration), icon: Clock, color: 'text-amber-500' },
    { label: 'Duração Média', value: formatDuration(stats.avgDuration), icon: TrendingUp, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <card.icon className={`h-8 w-8 ${card.color}`} />
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custo Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">R$ {stats.totalCost.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Custo acumulado dos últimos 30 dias</p>
        </CardContent>
      </Card>
    </div>
  );
}
