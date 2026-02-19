import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  User,
  Percent,
  Activity,
  Filter,
  Handshake,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { formatDbDateTime } from '@/lib/dateUtils';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { getInitialDates, getSavedAgentCodes } from '@/hooks/usePersistedPeriod';
import { cn } from '@/lib/utils';
import {
  useDashboardAgents,
  useDashboardStats,
  useDashboardStatsPrevious,
  useRecentLeads,
  useDashboardEvolution,
  useDashboardActivity,
  useDashboardStages,
  useDashboardCardDetails,
  useDashboardFunnel,
  calculateChange,
  getComparisonTooltip,
} from './dashboard/hooks/useDashboardData';
import { DashboardEvolutionChart } from './dashboard/components/DashboardEvolutionChart';
import { DashboardActivityTimeline } from './dashboard/components/DashboardActivityTimeline';
import { DashboardSparkline } from './dashboard/components/DashboardSparkline';
import { DashboardFunnelChart } from './dashboard/components/DashboardFunnelChart';
import { DashboardTripleFunnel } from './dashboard/components/DashboardTripleFunnel';
import { useDashboardJuliaFunnel, useDashboardCampaignFunnel } from './dashboard/hooks/useDashboardFunnels';
import { CRMLeadDetailsDialog } from './crm/components/CRMLeadDetailsDialog';

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedFilters = useRef(false);

  // Modal state for lead details
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const initialDates = getInitialDates();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
  });

  const { data: agents = [], isLoading: agentsLoading } = useDashboardAgents();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(filters);
  const { data: statsPrevious } = useDashboardStatsPrevious(filters);
  const { data: recentLeads = [], isLoading: leadsLoading } = useRecentLeads(filters);
  const { data: evolutionData = [], isLoading: evolutionLoading } = useDashboardEvolution(filters);
  const { data: activityData = [], isLoading: activityLoading } = useDashboardActivity(filters);
  const { data: funnelData = [], isLoading: funnelLoading } = useDashboardFunnel(filters);
  const { data: stages = [] } = useDashboardStages();
  const { data: juliaFunnel = [], isLoading: juliaFunnelLoading } = useDashboardJuliaFunnel(filters);
  const { data: campaignFunnel = [], isLoading: campaignFunnelLoading } = useDashboardCampaignFunnel(filters);
  const { data: selectedCard } = useDashboardCardDetails(selectedLeadId);

  // Initialize agent codes when agents load
  useEffect(() => {
    if (agents.length > 0 && !hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      const saved = getSavedAgentCodes();
      const agentCodes = saved !== null
        ? saved.filter(code => agents.some(a => a.cod_agent === code))
        : agents.map((a) => a.cod_agent);
      setFilters((prev) => ({ ...prev, agentCodes }));
    }
  }, [agents]);

  // Compute sparkline data from evolution
  const sparklineData = useMemo(() => {
    return {
      leads: evolutionData.map(d => d.leads),
      qualified: evolutionData.map(d => d.qualified),
      contractsGenerated: evolutionData.map(d => d.contractsGenerated),
    };
  }, [evolutionData]);

  // Compute comparison tooltip
  const comparisonTooltip = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return '';
    return getComparisonTooltip(filters.dateFrom, filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  // Calculate changes
  const changes = useMemo(() => {
    if (!statsPrevious) return null;
    return {
      leads: calculateChange(stats?.totalLeads ?? 0, statsPrevious.totalLeads),
      conversions: calculateChange(stats?.conversions ?? 0, statsPrevious.conversions),
      sessions: calculateChange(stats?.totalSessions ?? 0, statsPrevious.totalSessions),
      mql: calculateChange(stats?.mqlCount ?? 0, statsPrevious.mqlCount),
    };
  }, [stats, statsPrevious]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats-previous'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leads'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-evolution'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-funnel'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-julia-funnel'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-campaign-funnel'] }),
    ]);
    setIsRefreshing(false);
  };

  const handleLeadClick = (leadId: number) => {
    setSelectedLeadId(leadId);
    setDetailsOpen(true);
  };

  const handleDetailsClose = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setSelectedLeadId(null);
    }
  };

  // Calculate MQL rate (% of sessions)
  const mqlRate = useMemo(() => {
    const totalSessions = stats?.totalSessions ?? 0;
    const mql = stats?.mqlCount ?? 0;
    if (totalSessions === 0) return 0;
    return (mql / totalSessions) * 100;
  }, [stats?.totalSessions, stats?.mqlCount]);

  // Calculate SQL rate (% of MQL/qualificados)
  const sqlOfMqlRate = useMemo(() => {
    const mql = stats?.mqlCount ?? 0;
    const sql = stats?.conversions ?? 0;
    if (mql === 0) return 0;
    return (sql / mql) * 100;
  }, [stats?.mqlCount, stats?.conversions]);

  // Calculate conversion rate based on Julia sessions
  const conversionRate = useMemo(() => {
    const totalSessions = stats?.totalSessions ?? 0;
    const conversions = stats?.conversions ?? 0;
    if (totalSessions === 0) return 0;
    return (conversions / totalSessions) * 100;
  }, [stats?.totalSessions, stats?.conversions]);

  // Calculate previous conversion rate for comparison (based on sessions)
  const conversionRateChange = useMemo(() => {
    if (!statsPrevious) return null;
    const prevSessions = statsPrevious.totalSessions;
    const prevConversions = statsPrevious.conversions;
    const prevRate = prevSessions > 0 ? (prevConversions / prevSessions) * 100 : 0;
    return calculateChange(conversionRate, prevRate);
  }, [conversionRate, statsPrevious]);

  // MQL rate change
  const mqlRateChange = useMemo(() => {
    if (!statsPrevious) return null;
    const prevSessions = statsPrevious.totalSessions;
    const prevMql = statsPrevious.mqlCount;
    const prevRate = prevSessions > 0 ? (prevMql / prevSessions) * 100 : 0;
    return calculateChange(mqlRate, prevRate);
  }, [mqlRate, statsPrevious]);

  // SQL of MQL rate change
  const sqlOfMqlRateChange = useMemo(() => {
    if (!statsPrevious) return null;
    const prevMql = statsPrevious.mqlCount;
    const prevSql = statsPrevious.conversions;
    const prevRate = prevMql > 0 ? (prevSql / prevMql) * 100 : 0;
    return calculateChange(sqlOfMqlRate, prevRate);
  }, [sqlOfMqlRate, statsPrevious]);

  const statCards = [
    {
      title: 'Total de Whatsapp',
      value: stats?.totalLeads ?? 0,
      displayValue: (stats?.totalLeads ?? 0).toLocaleString('pt-BR'),
      icon: Users,
      change: changes?.leads,
      sparklineData: sparklineData.leads,
      sparklineColor: 'hsl(var(--chart-1))',
    },
    {
      title: 'Atendimentos',
      value: stats?.totalSessions ?? 0,
      displayValue: (stats?.totalSessions ?? 0).toLocaleString('pt-BR'),
      icon: Activity,
      change: changes?.sessions,
      sparklineData: null,
      sparklineColor: '',
      description: 'Atendimentos de IA',
    },
    {
      title: 'MQL',
      value: mqlRate,
      displayValue: `${mqlRate.toFixed(1)}%`,
      icon: Filter,
      change: mqlRateChange,
      sparklineData: null,
      sparklineColor: '',
      description: `${stats?.mqlCount ?? 0} de ${stats?.totalSessions ?? 0} atendimentos`,
    },
    {
      title: 'SQL',
      value: sqlOfMqlRate,
      displayValue: `${sqlOfMqlRate.toFixed(1)}%`,
      icon: Handshake,
      change: sqlOfMqlRateChange,
      sparklineData: null,
      sparklineColor: '',
      description: `${stats?.conversions ?? 0} de ${stats?.mqlCount ?? 0} qualificados`,
    },
    {
      title: 'Contratos Gerados/Assinados',
      value: stats?.conversions ?? 0,
      displayValue: (stats?.conversions ?? 0).toLocaleString('pt-BR'),
      icon: TrendingUp,
      change: changes?.conversions,
      sparklineData: sparklineData.contractsGenerated,
      sparklineColor: 'hsl(var(--chart-2))',
    },
    {
      title: 'Atendimentos x Contratos',
      value: conversionRate,
      displayValue: `${conversionRate.toFixed(1)}%`,
      icon: Percent,
      change: conversionRateChange,
      sparklineData: null,
      sparklineColor: '',
      description: `${stats?.conversions ?? 0} de ${stats?.totalSessions ?? 0} Atendimentos`,
    },
  ];

  const isLoading = agentsLoading || statsLoading;

  if (agentsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Main value */}
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse bg-muted rounded" />
                  ) : (
                    stat.displayValue
                  )}
                </div>


                {/* Change indicator */}
                {stat.change && (
                  <div className="flex items-center gap-1 text-xs">
                    {stat.change.isNeutral ? (
                      <Minus className="h-3 w-3 text-muted-foreground" />
                    ) : stat.change.isPositive ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                    )}
                    <span
                      className={cn(
                        'font-medium',
                        stat.change.isNeutral
                          ? 'text-muted-foreground'
                          : stat.change.isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {stat.change.label}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">
                          vs anterior
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{comparisonTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Description for conversion rate */}
                {'description' in stat && stat.description && (
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                )}

                {/* Static description for agents */}
                {!stat.change && stat.title === 'Agentes Selecionados' && (
                  <p className="text-xs text-muted-foreground">Filtrados atualmente</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Triple Funnel */}
        <DashboardTripleFunnel
          juliaData={juliaFunnel}
          campaignData={campaignFunnel}
          juliaLoading={juliaFunnelLoading}
          campaignLoading={campaignFunnelLoading}
        />

        {/* Evolution Chart */}
        <DashboardEvolutionChart
          data={evolutionData}
          isLoading={evolutionLoading}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
        />

        {/* Funnel Chart */}
        <DashboardFunnelChart data={funnelData} isLoading={funnelLoading} />

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
                    <div
                      key={lead.id}
                      className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                      onClick={() => handleLeadClick(lead.id)}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.contact_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.owner_name} • {formatDbDateTime(lead.stage_entered_at || lead.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: lead.stage_color,
                          color: lead.stage_color,
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
              <CardDescription>Últimas movimentações de leads</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardActivityTimeline
                activities={activityData}
                isLoading={activityLoading}
              />
            </CardContent>
          </Card>
        </div>

        {/* Lead Details Modal */}
        <CRMLeadDetailsDialog
          card={selectedCard || null}
          stages={stages}
          open={detailsOpen}
          onOpenChange={handleDetailsClose}
        />
      </div>
    </TooltipProvider>
  );
}
