import { Card, CardContent } from '@/components/ui/card';
import { Layers, DollarSign, TrendingUp, Clock } from 'lucide-react';
import type { BoardAnalytics } from '../../hooks/useCRMBoardAnalytics';

interface BoardSummaryCardsProps {
  analytics: BoardAnalytics;
}

export function BoardSummaryCards({ analytics }: BoardSummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const cards = [
    {
      title: 'Total de Cards',
      value: analytics.totalDeals.toString(),
      subtitle: `${analytics.openDeals} abertos • ${analytics.wonDeals} ganhos • ${analytics.lostDeals} perdidos`,
      icon: Layers,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      title: 'Valor Total (Abertos)',
      value: formatCurrency(analytics.openValue),
      subtitle: `${formatCurrency(analytics.wonValue)} ganhos`,
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100',
    },
    {
      title: 'Taxa de Conversão',
      value: `${analytics.conversionRate}%`,
      subtitle: `${analytics.wonDeals} de ${analytics.wonDeals + analytics.lostDeals} finalizados`,
      icon: TrendingUp,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'Tempo Médio na Etapa',
      value: `${analytics.avgTimeInPipeline} dias`,
      subtitle: 'Média de permanência atual',
      icon: Clock,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className="text-lg font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
