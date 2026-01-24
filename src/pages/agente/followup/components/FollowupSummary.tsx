import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Send, ListTodo, MessageCircle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, Users, Hand } from 'lucide-react';
import { FollowupStats } from '../../types';
import { getPreviousPeriod } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface FollowupSummaryProps {
  stats: FollowupStats;
  isLoading?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

// Calculate percentage change between current and previous values
function calculateChange(current: number, previous: number): {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
} {
  if (previous === 0) {
    return { 
      value: 0, 
      isPositive: true, 
      isNeutral: current === 0, 
      label: current === 0 ? '—' : 'Novo' 
    };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    isPositive: change >= 0,
    isNeutral: Math.abs(change) < 0.1,
    label: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
  };
}

// Calculate percentage point change (for rate metrics)
function calculatePpChange(current: number, previous: number): {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
} {
  const diff = current - previous;
  return {
    value: Math.abs(diff),
    isPositive: diff >= 0,
    isNeutral: Math.abs(diff) < 0.1,
    label: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp`,
  };
}

interface CardChange {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
}

interface CardData {
  title: string;
  value: string;
  icon: typeof ListTodo;
  color: string;
  bgColor: string;
  change: CardChange | null;
  invertChange?: boolean; // For loss rate: decrease is positive
}

export function FollowupSummary({ stats, isLoading, dateFrom, dateTo }: FollowupSummaryProps) {
  // Calculate comparison period tooltip text
  const comparisonTooltip = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    
    const { previousDateFrom, previousDateTo } = getPreviousPeriod(dateFrom, dateTo);
    
    const currentFromFormatted = format(parseISO(dateFrom), 'dd/MM', { locale: ptBR });
    const currentToFormatted = format(parseISO(dateTo), 'dd/MM', { locale: ptBR });
    const previousFromFormatted = format(parseISO(previousDateFrom), 'dd/MM', { locale: ptBR });
    const previousToFormatted = format(parseISO(previousDateTo), 'dd/MM', { locale: ptBR });
    
    return `Comparando ${currentFromFormatted} - ${currentToFormatted} com ${previousFromFormatted} - ${previousToFormatted}`;
  }, [dateFrom, dateTo]);

  // Cards da primeira linha (contadores absolutos)
  const absoluteCards: CardData[] = [
    {
      title: 'Leads na Fila',
      value: stats.total.toLocaleString('pt-BR'),
      icon: ListTodo,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: stats.previous 
        ? calculateChange(stats.total, stats.previous.total) 
        : null,
    },
    {
      title: 'Leads em FollowUp',
      value: stats.waiting.toLocaleString('pt-BR'),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
      change: stats.previous 
        ? calculateChange(stats.waiting, stats.previous.waiting) 
        : null,
    },
    {
      title: 'Mensagens Enviadas',
      value: stats.totalSent.toLocaleString('pt-BR'),
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
      change: stats.previous 
        ? calculateChange(stats.totalSent, stats.previous.totalSent) 
        : null,
    },
    {
      title: 'Respostas',
      value: stats.stopped.toLocaleString('pt-BR'),
      icon: MessageCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      change: stats.previous 
        ? calculateChange(stats.stopped, stats.previous.stopped) 
        : null,
    },
  ];

  // Cards da segunda linha (taxas percentuais) - 4 cards mutuamente exclusivos (soma = 100%)
  const rateCards: CardData[] = [
    {
      title: 'Taxa em FollowUp',
      value: `${stats.followupRate.toFixed(1)}%`,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      change: stats.previous 
        ? calculatePpChange(stats.followupRate, stats.previous.followupRate) 
        : null,
    },
    {
      title: 'Taxa de Retorno',
      value: `${stats.responseRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
      change: stats.previous 
        ? calculatePpChange(stats.responseRate, stats.previous.responseRate) 
        : null,
    },
    {
      title: 'Taxa de Intervenção',
      value: `${(stats.interventionRate ?? 0).toFixed(1)}%`,
      icon: Hand,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      change: stats.previous 
        ? calculatePpChange(stats.interventionRate ?? 0, stats.previous.interventionRate ?? 0) 
        : null,
    },
    {
      title: 'Taxa de Perda',
      value: `${stats.lossRate.toFixed(1)}%`,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
      change: stats.previous 
        ? calculatePpChange(stats.lossRate, stats.previous.lossRate) 
        : null,
      invertChange: true, // Decrease in loss rate is positive
    },
  ];

  const renderCard = (card: CardData, index: number) => {
    // For inverted change cards (like loss rate), swap the positive/negative logic
    const effectiveIsPositive = card.invertChange 
      ? !card.change?.isPositive 
      : card.change?.isPositive;
    
    return (
      <Card key={index}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="text-2xl font-bold">{card.value}</p>
              
              {/* Change indicator */}
              {card.change && (
                <div className="flex items-center gap-1 text-xs mt-1">
                  {card.change.isNeutral ? (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  ) : effectiveIsPositive ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(
                    "font-medium",
                    card.change.isNeutral ? "text-muted-foreground" :
                    effectiveIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {card.change.label}
                  </span>
                  {comparisonTooltip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground hidden sm:inline cursor-help underline decoration-dotted underline-offset-2">
                          vs anterior
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{comparisonTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground hidden sm:inline">vs anterior</span>
                  )}
                </div>
              )}
            </div>
            <div className={`p-2 rounded-lg ${card.bgColor} shrink-0`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Linha 1: Contadores Absolutos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {absoluteCards.map((_, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Linha 2: Taxas Percentuais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {rateCards.map((_, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Linha 1: Contadores Absolutos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {absoluteCards.map((card, index) => renderCard(card, index))}
        </div>
        
        {/* Linha 2: Taxas Percentuais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {rateCards.map((card, index) => renderCard(card, index))}
        </div>
      </div>
    </TooltipProvider>
  );
}
