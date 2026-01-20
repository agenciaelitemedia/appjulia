import { Users, UserPlus, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CRMCard, CRMStage } from '../types';

interface CRMTotalizersProps {
  cards: CRMCard[];
  stages: CRMStage[];
}

export function CRMTotalizers({ cards, stages }: CRMTotalizersProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalLeads = cards.length;
  
  const leadsToday = cards.filter((card) => {
    const createdAt = new Date(card.created_at);
    createdAt.setHours(0, 0, 0, 0);
    return createdAt.getTime() === today.getTime();
  }).length;

  const convertedStage = stages.find((s) => s.name.toLowerCase().includes('assinado'));
  const convertedLeads = convertedStage
    ? cards.filter((card) => card.stage_id === convertedStage.id).length
    : 0;

  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

  const humanStage = stages.find((s) => s.name.toLowerCase().includes('humano'));
  const humanAttention = humanStage
    ? cards.filter((card) => card.stage_id === humanStage.id).length
    : 0;

  const metrics = [
    {
      label: 'Total de Leads',
      value: totalLeads,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Novos Hoje',
      value: leadsToday,
      icon: UserPlus,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Taxa de Conversão',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Atend. Humano',
      value: humanAttention,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
