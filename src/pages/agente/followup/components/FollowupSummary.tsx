import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Send, Pause, ListTodo, MessageCircle, TrendingUp } from 'lucide-react';
import { FollowupStats } from '../../types';

interface FollowupSummaryProps {
  stats: FollowupStats;
  isLoading?: boolean;
}

export function FollowupSummary({ stats, isLoading }: FollowupSummaryProps) {
  const cards = [
    {
      title: 'Leads na Fila',
      value: stats.total.toLocaleString('pt-BR'),
      icon: ListTodo,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Aguardando',
      value: stats.waiting.toLocaleString('pt-BR'),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Mensagens Enviadas',
      value: stats.totalSent.toLocaleString('pt-BR'),
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Respostas',
      value: stats.stopped.toLocaleString('pt-BR'),
      icon: MessageCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Taxa de Resposta',
      value: `${stats.responseRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
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
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
