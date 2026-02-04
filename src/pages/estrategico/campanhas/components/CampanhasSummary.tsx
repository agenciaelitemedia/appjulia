import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Megaphone, 
  Users, 
  Target, 
  TrendingUp, 
  Star,
  BarChart3 
} from 'lucide-react';
import { CampaignSummary } from '../types';

interface CampanhasSummaryProps {
  summary: CampaignSummary;
  isLoading: boolean;
}

function getVariation(current: number, previous: number): { value: number; isPositive: boolean } {
  if (previous === 0) return { value: 0, isPositive: true };
  const variation = ((current - previous) / previous) * 100;
  return { value: Math.abs(variation), isPositive: variation >= 0 };
}

export function CampanhasSummary({ summary, isLoading }: CampanhasSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const campaignsVar = getVariation(summary.totalCampaigns, summary.previousTotalCampaigns || 0);
  const leadsVar = getVariation(summary.totalLeads, summary.previousTotalLeads || 0);

  const cards = [
    {
      title: 'Campanhas Ativas',
      value: summary.totalCampaigns,
      icon: Megaphone,
      color: 'chart-1',
      variation: campaignsVar,
    },
    {
      title: 'Total de Leads',
      value: summary.totalLeads,
      icon: Users,
      color: 'chart-2',
      variation: leadsVar,
    },
    {
      title: 'Leads/Campanha',
      value: summary.leadsPerCampaign,
      icon: Target,
      color: 'chart-3',
    },
    {
      title: 'Taxa de Conversão',
      value: `${summary.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'chart-4',
    },
    {
      title: 'Plataforma Top',
      value: summary.topPlatform,
      subtitle: `${summary.topPlatformLeads} leads`,
      icon: Star,
      color: 'chart-5',
    },
    {
      title: 'Engajamento',
      value: summary.totalLeads > 0 ? 'Ativo' : '-',
      icon: BarChart3,
      color: 'primary',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className={`border-l-4 border-l-${card.color}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  {card.title}
                </p>
                <p className="text-xl font-bold text-foreground truncate">
                  {card.value}
                </p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                )}
                {card.variation && card.variation.value > 0 && (
                  <p className={`text-xs ${card.variation.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {card.variation.isPositive ? '+' : '-'}{card.variation.value.toFixed(1)}% vs anterior
                  </p>
                )}
              </div>
              <div className={`p-2 rounded-lg bg-${card.color}/10`}>
                <card.icon className={`h-5 w-5 text-${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
