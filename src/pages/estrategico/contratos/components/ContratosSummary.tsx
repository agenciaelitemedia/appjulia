import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, CheckCircle, Clock, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { JuliaContrato } from '../../types';
import { getPreviousPeriod } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface ContratosSummaryProps {
  contratos: JuliaContrato[];
  previousContratos?: Pick<JuliaContrato, 'cod_agent' | 'status_document' | 'situacao'>[];
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
  icon: typeof FileText;
  color: string;
  bgColor: string;
  change: CardChange | null;
}

export function ContratosSummary({ contratos, previousContratos, isLoading, dateFrom, dateTo }: ContratosSummaryProps) {
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
    if (!contratos.length) {
      return {
        totalContratos: 0,
        contratosAssinados: 0,
        contratosEmCurso: 0,
        taxaAssinatura: 0,
      };
    }

    const assinados = contratos.filter((c) => c.status_document === 'SIGNED').length;
    const emCurso = contratos.filter((c) => c.situacao === 'EM CURSO').length;

    return {
      totalContratos: contratos.length,
      contratosAssinados: assinados,
      contratosEmCurso: emCurso,
      taxaAssinatura: contratos.length > 0 ? Math.round((assinados / contratos.length) * 100) : 0,
    };
  }, [contratos]);

  const previousSummary = useMemo(() => {
    if (!previousContratos?.length) {
      return null;
    }

    const assinados = previousContratos.filter((c) => c.status_document === 'SIGNED').length;
    const emCurso = previousContratos.filter((c) => c.situacao === 'EM CURSO').length;

    return {
      totalContratos: previousContratos.length,
      contratosAssinados: assinados,
      contratosEmCurso: emCurso,
      taxaAssinatura: previousContratos.length > 0 ? Math.round((assinados / previousContratos.length) * 100) : 0,
    };
  }, [previousContratos]);

  const cards: CardData[] = [
    {
      title: 'Total Contratos',
      value: summary.totalContratos.toLocaleString('pt-BR'),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: previousSummary 
        ? calculateChange(summary.totalContratos, previousSummary.totalContratos) 
        : null,
    },
    {
      title: 'Assinados',
      value: summary.contratosAssinados.toLocaleString('pt-BR'),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: previousSummary 
        ? calculateChange(summary.contratosAssinados, previousSummary.contratosAssinados) 
        : null,
    },
    {
      title: 'Em Curso',
      value: summary.contratosEmCurso.toLocaleString('pt-BR'),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: previousSummary 
        ? calculateChange(summary.contratosEmCurso, previousSummary.contratosEmCurso) 
        : null,
    },
    {
      title: 'Contratos Gerados x Assinados',
      value: `${summary.taxaAssinatura}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: previousSummary 
        ? calculatePpChange(summary.taxaAssinatura, previousSummary.taxaAssinatura) 
        : null,
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
