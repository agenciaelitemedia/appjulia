import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Megaphone, 
  Users, 
  Target, 
  TrendingUp, 
  Star,
  CheckCircle2,
  Info
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

function getConversionVariation(currentRate: number, previousRate: number): { value: number; isPositive: boolean } {
  const diff = currentRate - previousRate;
  return { value: Math.abs(diff), isPositive: diff >= 0 };
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
  const leadsPerCampaignVar = getVariation(summary.leadsPerCampaign, summary.previousLeadsPerCampaign || 0);
  const qualifiedVar = getVariation(summary.qualifiedLeads, summary.previousQualifiedLeads || 0);
  const topPlatformVar = getVariation(summary.topPlatformLeads, summary.previousTopPlatformLeads || 0);
  
  // Calcular taxa de conversão do período anterior para comparação
  const previousConversionRate = summary.previousTotalLeads && summary.previousTotalLeads > 0 && summary.previousQualifiedLeads
    ? (summary.previousQualifiedLeads / summary.previousTotalLeads) * 100
    : 0;
  const conversionVar = getConversionVariation(summary.conversionRate, previousConversionRate);

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
      variation: leadsPerCampaignVar,
    },
    {
      title: 'Taxa de Conversão',
      value: `${summary.conversionRate.toFixed(1)}%`,
      subtitle: `${summary.qualifiedLeads} qualificados`,
      icon: TrendingUp,
      color: 'chart-4',
      variation: previousConversionRate > 0 ? conversionVar : undefined,
      variationSuffix: 'pp',
      tooltip: 'Leads que chegaram aos estágios: Negociação, Contrato em Curso ou Contrato Assinado',
    },
    {
      title: 'Plataforma Top',
      value: summary.topPlatform,
      subtitle: `${summary.topPlatformLeads} leads`,
      icon: Star,
      color: 'chart-5',
      variation: topPlatformVar,
    },
    {
      title: 'Qualificados',
      value: summary.qualifiedLeads,
      subtitle: 'em negociação+',
      icon: CheckCircle2,
      color: 'primary',
      tooltip: 'Leads nos estágios: Negociação, Contrato em Curso ou Contrato Assinado',
      variation: qualifiedVar,
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, index) => (
          <Card key={index} className={`border-l-4 border-l-${card.color}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground font-medium truncate">
                      {card.title}
                    </p>
                    {card.tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">{card.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-xl font-bold text-foreground truncate">
                    {card.value}
                  </p>
                  {card.subtitle && (
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  )}
                  {card.variation && card.variation.value > 0 && (
                    <p className={`text-xs ${card.variation.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {card.variation.isPositive ? '+' : '-'}{card.variation.value.toFixed(1)}{card.variationSuffix || '%'} vs anterior
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
    </TooltipProvider>
  );
}
