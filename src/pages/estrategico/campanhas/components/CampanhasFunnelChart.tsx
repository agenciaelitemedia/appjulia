import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowDown, Filter, Database, Bot, ClipboardCheck, Handshake, UserCheck } from 'lucide-react';
import { CampaignFunnelStage } from '../types';

// Descrições detalhadas de cada etapa do funil
const stageDescriptions: Record<string, { description: string; source: string; icon: React.ReactNode }> = {
  'Entrada': {
    description: 'Total de leads captados através de campanhas de anúncios',
    source: 'Tabela: campaing_ads',
    icon: <Database className="h-3.5 w-3.5" />,
  },
  'Atendidos por JulIA': {
    description: 'Leads que receberam primeira mensagem automatizada pela JulIA',
    source: 'Tabela: log_first_messages',
    icon: <Bot className="h-3.5 w-3.5" />,
  },
  'Em Qualificação': {
    description: 'Leads que passaram pela etapa de Análise de Caso no CRM',
    source: 'Tabela: crm_atendimento_history (etapa: Análise de Caso)',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  'Qualificado': {
    description: 'Leads em fase avançada: Negociação, Contrato em Curso ou Contrato Assinado',
    source: 'Tabela: crm_atendimento_cards (stage_id)',
    icon: <Handshake className="h-3.5 w-3.5" />,
  },
  'Cliente': {
    description: 'Leads que assinaram contrato e se tornaram clientes',
    source: 'Tabela: crm_atendimento_cards (Contrato Assinado)',
    icon: <UserCheck className="h-3.5 w-3.5" />,
  },
};

interface CampanhasFunnelChartProps {
  data: CampaignFunnelStage[];
  isLoading: boolean;
}

const defaultStages: CampaignFunnelStage[] = [
  { stage_name: 'Entrada', stage_color: '#3b82f6', position: 0, count: 0, percentage: 100, conversionRate: 100 },
  { stage_name: 'Atendidos por JulIA', stage_color: '#22c55e', position: 1, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Em Qualificação', stage_color: '#eab308', position: 2, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Qualificado', stage_color: '#f97316', position: 3, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Cliente', stage_color: '#8b5cf6', position: 4, count: 0, percentage: 0, conversionRate: 0 },
];

export function CampanhasFunnelChart({ data, isLoading }: CampanhasFunnelChartProps) {
  const stages = data.length > 0 ? data : defaultStages;
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Funil de Conversão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center space-y-2">
          {stages.map((stage, index) => {
            const widthPercent = Math.max(30, (stage.count / maxCount) * 100);
            const isLast = index === stages.length - 1;
            
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
                        
                        {/* Right content - Count */}
                        <div className="flex flex-col items-end">
                          <span className="text-white text-2xl md:text-3xl font-bold">
                            {stage.count}
                          </span>
                          <span className="text-white/70 text-xs">
                            leads
                          </span>
                        </div>
                        
                        {/* Progress bar inside */}
                        <div 
                          className="absolute bottom-0 left-0 h-1 rounded-b-lg bg-white/30"
                          style={{ width: `${stage.percentage}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{stage.stage_name}</p>
                      <p>{stage.count} leads ({stage.percentage.toFixed(1)}%)</p>
                      {index > 0 && (
                        <p className="text-muted-foreground">
                          Taxa de conversão: {stage.conversionRate?.toFixed(1)}%
                        </p>
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
