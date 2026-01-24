import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, MessageSquare, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { JuliaSessao } from '../../types';
import { getTodayInSaoPaulo, parseDbTimestamp, getPreviousPeriod } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface DesempenhoSummaryProps {
  sessoes: JuliaSessao[];
  previousSessoes?: Pick<JuliaSessao, 'cod_agent' | 'total_msg'>[];
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

interface CardChange {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
}

interface CardData {
  title: string;
  value: string;
  icon: typeof BarChart3;
  color: string;
  bgColor: string;
  change: CardChange | null;
}

export function DesempenhoSummary({ sessoes, previousSessoes, isLoading, dateFrom, dateTo }: DesempenhoSummaryProps) {
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

  const summary = useMemo(() => {
    if (!sessoes.length) {
      return {
        totalSessoes: 0,
        totalMensagens: 0,
        mediaMsg: 0,
        sessoesHoje: 0,
      };
    }

    const today = getTodayInSaoPaulo();
    const totalMensagens = sessoes.reduce((acc, s) => acc + (s.total_msg || 0), 0);
    
    const sessoesHoje = sessoes.filter((s) => {
      const date = parseDbTimestamp(s.created_at);
      const dateStr = date.toISOString().split('T')[0];
      return dateStr === today;
    }).length;

    return {
      totalSessoes: sessoes.length,
      totalMensagens,
      mediaMsg: sessoes.length > 0 ? Math.round((totalMensagens / sessoes.length) * 10) / 10 : 0,
      sessoesHoje,
    };
  }, [sessoes]);

  const previousSummary = useMemo(() => {
    if (!previousSessoes?.length) {
      return null;
    }

    const totalMensagens = previousSessoes.reduce((acc, s) => acc + (s.total_msg || 0), 0);

    return {
      totalSessoes: previousSessoes.length,
      totalMensagens,
      mediaMsg: previousSessoes.length > 0 ? Math.round((totalMensagens / previousSessoes.length) * 10) / 10 : 0,
    };
  }, [previousSessoes]);

  const cards: CardData[] = [
    {
      title: 'Total Sessões',
      value: summary.totalSessoes.toLocaleString('pt-BR'),
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: previousSummary 
        ? calculateChange(summary.totalSessoes, previousSummary.totalSessoes) 
        : null,
    },
    {
      title: 'Total Mensagens',
      value: summary.totalMensagens.toLocaleString('pt-BR'),
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: previousSummary 
        ? calculateChange(summary.totalMensagens, previousSummary.totalMensagens) 
        : null,
    },
    {
      title: 'Média/Sessão',
      value: summary.mediaMsg.toLocaleString('pt-BR'),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: previousSummary 
        ? calculateChange(summary.mediaMsg, previousSummary.mediaMsg) 
        : null,
    },
    {
      title: 'Sessões Hoje',
      value: summary.sessoesHoje.toLocaleString('pt-BR'),
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: null, // No comparison for "today" metric
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="flex-1">
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
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
                      ) : card.change.isPositive ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      )}
                      <span className={cn(
                        "font-medium",
                        card.change.isNeutral ? "text-muted-foreground" :
                        card.change.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
        ))}
      </div>
    </TooltipProvider>
  );
}
