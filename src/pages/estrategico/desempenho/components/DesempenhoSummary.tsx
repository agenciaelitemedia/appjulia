import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, MessageSquare, TrendingUp, Calendar } from 'lucide-react';
import { JuliaSessao } from '../../types';
import { getTodayInSaoPaulo, parseDbTimestamp } from '@/lib/dateUtils';

interface DesempenhoSummaryProps {
  sessoes: JuliaSessao[];
  isLoading?: boolean;
}

export function DesempenhoSummary({ sessoes, isLoading }: DesempenhoSummaryProps) {
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

  const cards = [
    {
      title: 'Total Sessões',
      value: summary.totalSessoes.toLocaleString('pt-BR'),
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Mensagens',
      value: summary.totalMensagens.toLocaleString('pt-BR'),
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Média/Sessão',
      value: summary.mediaMsg.toLocaleString('pt-BR'),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Sessões Hoje',
      value: summary.sessoesHoje.toLocaleString('pt-BR'),
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? '-' : card.value}</p>
                <p className="text-xs text-muted-foreground">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
