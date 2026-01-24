import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Send, ListTodo, MessageCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { FollowupStats } from '../../types';
import { cn } from '@/lib/utils';

interface FollowupSummaryProps {
  stats: FollowupStats;
  isLoading?: boolean;
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
}

export function FollowupSummary({ stats, isLoading }: FollowupSummaryProps) {
  const cards: CardData[] = [
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
      title: 'Aguardando',
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
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card, index) => (
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
                    <span className="text-muted-foreground hidden sm:inline">vs anterior</span>
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
  );
}
