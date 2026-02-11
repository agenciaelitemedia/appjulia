import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowDown, ArrowUp, ArrowDownRight, Filter, Database, Bot, ClipboardCheck, Handshake, UserCheck, Minus } from 'lucide-react';
import { CampaignFunnelStage } from '../types';

// Descrições detalhadas de cada etapa do funil
const stageDescriptions: Record<string, { description: string; icon: React.ReactNode }> = {
  'Entrada': {
    description: 'Total de leads captados através de campanhas de anúncios',
    icon: <Database className="h-3.5 w-3.5" />,
  },
  'Atendidos por JulIA': {
    description: 'Leads que receberam primeira mensagem automatizada pela JulIA',
    icon: <Bot className="h-3.5 w-3.5" />,
  },
  'Em Qualificação': {
    description: 'Leads que passaram pela etapa de Análise de Caso no CRM',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  'Qualificado': {
    description: 'Leads em fase avançada: Negociação, Contrato em Curso ou Contrato Assinado',
    icon: <Handshake className="h-3.5 w-3.5" />,
  },
  'Cliente': {
    description: 'Leads que assinaram contrato e se tornaram clientes',
    icon: <UserCheck className="h-3.5 w-3.5" />,
  },
};

interface PreviousFunnelData {
  stage_name: string;
  position: number;
  count: number;
}

interface CampanhasFunnelChartProps {
  data: CampaignFunnelStage[];
  previousData?: PreviousFunnelData[];
  isLoading: boolean;
}

const defaultStages: CampaignFunnelStage[] = [
  { stage_name: 'Entrada', stage_color: '#3b82f6', position: 0, count: 0, percentage: 100, conversionRate: 100 },
  { stage_name: 'Atendidos por JulIA', stage_color: '#22c55e', position: 1, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Em Qualificação', stage_color: '#eab308', position: 2, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Qualificado', stage_color: '#f97316', position: 3, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Cliente', stage_color: '#8b5cf6', position: 4, count: 0, percentage: 0, conversionRate: 0 },
];

// Calcular variação percentual
function calculateTrend(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    if (current === 0) return { value: 0, direction: 'neutral' };
    return { value: 100, direction: 'up' };
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return { value: 0, direction: 'neutral' };
  return { value: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
}

export function CampanhasFunnelChart({ data, previousData = [], isLoading }: CampanhasFunnelChartProps) {
  const stages = data.length > 0 ? data : defaultStages;
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  
  // Criar mapa de dados anteriores por posição
  const previousMap = new Map(previousData.map(p => [p.position, p.count]));
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Funil de Conversão de Campanhas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
           Funil de Conversão de Campanhas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center space-y-2">
          {stages.map((stage, index) => {
            const widthPercent = Math.max(30, (stage.count / maxCount) * 100);
            const isLast = index === stages.length - 1;
            
            // Calcular tendência comparativa
            const previousCount = previousMap.get(stage.position) ?? 0;
            const trend = calculateTrend(stage.count, previousCount);
            const hasPreviousData = previousData.length > 0;
            
            return (
              <div key={stage.position} className="w-full flex flex-col items-center">
                {/* Funnel Stage */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                      style={{ width: `${widthPercent}%` }}
                    >
                      {/* Main bar */}
                      <div
                        className="relative py-4 px-4 rounded-lg flex items-center justify-between min-h-[60px] transition-all duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${stage.stage_color}dd, ${stage.stage_color}99)`,
                          boxShadow: `0 4px 15px ${stage.stage_color}40`,
                        }}
                      >
                        {/* Left content */}
                        <div className="flex flex-col">
                          <span className="text-white font-semibold text-sm md:text-base">
                            {stage.stage_name}
                          </span>
                          <span className="text-white/80 text-xs">
                            {stage.percentage.toFixed(0)}% do total
                          </span>
                        </div>
                        
                        {/* Right content - Count + Trend */}
                        <div className="flex items-center gap-3">
                          {/* Trend indicator */}
                          {hasPreviousData && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              trend.direction === 'up' 
                                ? 'bg-emerald-500/30 text-emerald-100' 
                                : trend.direction === 'down'
                                  ? 'bg-red-500/30 text-red-100'
                                  : 'bg-white/20 text-white/80'
                            }`}>
                              {trend.direction === 'up' && <ArrowUp className="h-3 w-3" />}
                              {trend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
                              {trend.direction === 'neutral' && <Minus className="h-3 w-3" />}
                              <span>{trend.value.toFixed(0)}%</span>
                            </div>
                          )}
                          
                          {/* Count */}
                          <div className="flex flex-col items-end">
                            <span className="text-white text-2xl md:text-3xl font-bold">
                              {stage.count}
                            </span>
                            <span className="text-white/70 text-xs">
                              leads
                            </span>
                          </div>
                        </div>
                        
                        {/* Progress bar inside */}
                        <div 
                          className="absolute bottom-0 left-0 h-1 rounded-b-lg bg-white/30"
                          style={{ width: `${stage.percentage}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        {stageDescriptions[stage.stage_name]?.icon}
                        <p className="font-semibold">{stage.stage_name}</p>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {stageDescriptions[stage.stage_name]?.description}
                      </p>
                      <div className="pt-1 border-t border-border/50">
                        <p className="font-medium">{stage.count} leads ({stage.percentage.toFixed(1)}%)</p>
                        {index > 0 && (
                          <p className="text-muted-foreground text-xs">
                            Taxa de conversão: {stage.conversionRate?.toFixed(1)}%
                          </p>
                        )}
                      </div>
                      {hasPreviousData && (
                        <div className="pt-1 border-t border-border/50">
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            vs período anterior: 
                            <span className={
                              trend.direction === 'up' 
                                ? 'text-emerald-500' 
                                : trend.direction === 'down'
                                  ? 'text-red-500'
                                  : ''
                            }>
                              {trend.direction === 'up' && '+'}
                              {trend.direction === 'down' && '-'}
                              {trend.value.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground/70">
                              ({previousCount} leads)
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                
                {/* Connector arrow and conversion rate */}
                {!isLast && (
                  <div className="flex flex-col items-center py-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ArrowDown className="h-4 w-4" />
                      <span className="bg-muted/50 px-2 py-0.5 rounded-full">
                        {stages[index + 1]?.conversionRate?.toFixed(0) || 0}% conversão
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Empty state */}
        {stages.every(s => s.count === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhum dado de funil disponível para o período selecionado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}