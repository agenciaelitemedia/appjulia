import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Send, Pause, ListTodo } from 'lucide-react';

interface FollowupSummaryProps {
  stats: {
    total: number;        // Leads únicos na fila
    totalSent: number;    // Total de mensagens enviadas (soma das etapas)
    waiting: number;      // Leads aguardando
    stopped: number;      // Leads pausados
  };
  isLoading?: boolean;
}

export function FollowupSummary({ stats, isLoading }: FollowupSummaryProps) {
  const cards = [
    {
      title: 'Leads na Fila',
      value: stats.total,
      icon: ListTodo,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Aguardando',
      value: stats.waiting,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Mensagens Enviadas',
      value: stats.totalSent,
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Pausados',
      value: stats.stopped,
      icon: Pause,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value.toLocaleString('pt-BR')}</p>
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
