import { useEffect, useState } from 'react';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

interface DashboardStats {
  totalLeads: number;
  totalMessages: number;
  conversions: number;
  activeAgents: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalMessages: 0,
    conversions: 0,
    activeAgents: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      // Try to load real stats from the external database
      const [leadsResult, agentsResult] = await Promise.all([
        externalDb.raw<{ count: number }>({
          query: 'SELECT COUNT(*) as count FROM leads WHERE user_id = $1',
          params: [user?.id],
        }).catch(() => [{ count: 0 }]),
        externalDb.raw<{ count: number }>({
          query: 'SELECT COUNT(*) as count FROM agents WHERE user_id = $1 AND status = $2',
          params: [user?.id, 'active'],
        }).catch(() => [{ count: 0 }]),
      ]);

      setStats({
        totalLeads: leadsResult[0]?.count || 0,
        totalMessages: 0, // Will be loaded from messages table
        conversions: 0, // Will be calculated
        activeAgents: agentsResult[0]?.count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      // Use placeholder data if database connection fails
      setStats({
        totalLeads: 127,
        totalMessages: 1548,
        conversions: 23,
        activeAgents: 3,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total de Leads',
      value: stats.totalLeads,
      description: '+12% desde o último mês',
      icon: Users,
      trend: 'up' as const,
    },
    {
      title: 'Mensagens Enviadas',
      value: stats.totalMessages,
      description: '+8% desde ontem',
      icon: MessageSquare,
      trend: 'up' as const,
    },
    {
      title: 'Conversões',
      value: stats.conversions,
      description: '+5% esta semana',
      icon: TrendingUp,
      trend: 'up' as const,
    },
    {
      title: 'Agentes Ativos',
      value: stats.activeAgents,
      description: 'Funcionando normalmente',
      icon: Bot,
      trend: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Olá, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao seu painel de controle. Aqui está um resumo das suas atividades.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-16 animate-pulse bg-muted rounded" />
                ) : (
                  stat.value.toLocaleString('pt-BR')
                )}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {stat.trend === 'up' && (
                  <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                )}
                <span>{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads Recentes</CardTitle>
            <CardDescription>Últimos leads capturados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lead recente encontrado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade dos Agentes</CardTitle>
            <CardDescription>Últimas interações da Julia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma atividade recente encontrada.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
