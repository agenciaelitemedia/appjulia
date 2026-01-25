import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Bot,
  ArrowUpRight,
  RefreshCw,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayInSaoPaulo, formatDbDateTime } from '@/lib/dateUtils';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { useDashboardAgents, useDashboardStats, useRecentLeads } from './dashboard/hooks/useDashboardData';

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedFilters = useRef(false);

  const today = getTodayInSaoPaulo();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: today,
    dateTo: today,
  });

  const { data: agents = [], isLoading: agentsLoading } = useDashboardAgents();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(filters);
  const { data: recentLeads = [], isLoading: leadsLoading } = useRecentLeads(filters);

  // Initialize agent codes when agents load
  useEffect(() => {
    if (agents.length > 0 && !hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      setFilters((prev) => ({
        ...prev,
        agentCodes: agents.map((a) => a.cod_agent),
      }));
    }
  }, [agents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leads'] });
    setIsRefreshing(false);
  };

  const statCards = [
    {
      title: 'Total de Leads',
      value: stats?.totalLeads ?? 0,
      description: 'No período selecionado',
      icon: Users,
      trend: 'up' as const,
    },
    {
      title: 'Mensagens Enviadas',
      value: stats?.totalMessages ?? 0,
      description: 'No período selecionado',
      icon: MessageSquare,
      trend: 'up' as const,
    },
    {
      title: 'Conversões',
      value: stats?.conversions ?? 0,
      description: 'Contratos assinados',
      icon: TrendingUp,
      trend: 'up' as const,
    },
    {
      title: 'Agentes Selecionados',
      value: stats?.activeAgents ?? 0,
      description: 'Filtrados atualmente',
      icon: Bot,
      trend: 'neutral' as const,
    },
  ];

  const isLoading = agentsLoading || statsLoading;

  if (agentsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao seu painel de controle. Aqui está um resumo das suas atividades.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <UnifiedFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        showSearch={false}
      />

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
                  <ArrowUpRight className="h-3 w-3 text-chart-2 mr-1" />
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
            <CardDescription>Últimos leads capturados no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leadsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))
              ) : recentLeads.length > 0 ? (
                recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lead.contact_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.owner_name} • {formatDbDateTime(lead.created_at)}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      style={{ 
                        borderColor: lead.stage_color,
                        color: lead.stage_color 
                      }}
                    >
                      {lead.stage_name}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lead encontrado no período selecionado.
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
