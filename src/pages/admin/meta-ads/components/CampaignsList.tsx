import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Megaphone, Loader2, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Campaign, CampaignInsights } from '../types';

interface CampaignsListProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onViewInsights: (campaignId: string) => Promise<CampaignInsights | null>;
}

const STATUS_STYLES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Ativa', variant: 'default' },
  PAUSED: { label: 'Pausada', variant: 'secondary' },
  DELETED: { label: 'Deletada', variant: 'destructive' },
  ARCHIVED: { label: 'Arquivada', variant: 'outline' },
};

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_APP_PROMOTION: 'Promoção de App',
  LINK_CLICKS: 'Cliques no Link',
  CONVERSIONS: 'Conversões',
  MESSAGES: 'Mensagens',
  LEAD_GENERATION: 'Geração de Leads',
  POST_ENGAGEMENT: 'Engajamento na Publicação',
  VIDEO_VIEWS: 'Visualizações de Vídeo',
  BRAND_AWARENESS: 'Conhecimento da Marca',
  REACH: 'Alcance',
};

export function CampaignsList({ campaigns, isLoading, onViewInsights }: CampaignsListProps) {
  const [loadingInsights, setLoadingInsights] = useState<string | null>(null);
  const [selectedInsights, setSelectedInsights] = useState<{ campaignId: string; data: CampaignInsights } | null>(null);

  const handleViewInsights = async (campaignId: string) => {
    setLoadingInsights(campaignId);
    const insights = await onViewInsights(campaignId);
    if (insights) {
      setSelectedInsights({ campaignId, data: insights });
    }
    setLoadingInsights(null);
  };

  const formatBudget = (value?: string) => {
    if (!value) return '-';
    // Meta returns budget in cents
    const amount = parseInt(value) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStatusInfo = (status: string) => {
    return STATUS_STYLES[status] || { label: status, variant: 'outline' as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Campanhas ({campaigns.length})
        </CardTitle>
        <CardDescription>
          Lista de campanhas da conta selecionada
        </CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Buscando campanhas...</span>
              </div>
            ) : (
              <p>Selecione uma conta para ver as campanhas</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const statusInfo = getStatusInfo(campaign.status);
                  const isShowingInsights = selectedInsights?.campaignId === campaign.id;
                  
                  return (
                    <>
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground">ID: {campaign.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {OBJECTIVE_LABELS[campaign.objective] || campaign.objective}
                        </TableCell>
                        <TableCell>
                          {campaign.daily_budget ? (
                            <div>
                              <p>{formatBudget(campaign.daily_budget)}/dia</p>
                            </div>
                          ) : campaign.lifetime_budget ? (
                            <div>
                              <p>{formatBudget(campaign.lifetime_budget)} total</p>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDate(campaign.start_time)}</p>
                            {campaign.stop_time && (
                              <p className="text-muted-foreground">até {formatDate(campaign.stop_time)}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInsights(campaign.id)}
                            disabled={loadingInsights === campaign.id}
                          >
                            {loadingInsights === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            <span className="ml-1">Insights</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isShowingInsights && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="grid grid-cols-4 gap-4 py-2">
                              <InsightMetric label="Impressões" value={selectedInsights.data.impressions} />
                              <InsightMetric label="Cliques" value={selectedInsights.data.clicks} />
                              <InsightMetric label="CTR" value={`${parseFloat(selectedInsights.data.ctr || '0').toFixed(2)}%`} />
                              <InsightMetric label="Gasto" value={formatBudget(String(parseFloat(selectedInsights.data.spend || '0') * 100))} />
                              <InsightMetric label="Alcance" value={selectedInsights.data.reach} />
                              <InsightMetric label="Frequência" value={parseFloat(selectedInsights.data.frequency || '0').toFixed(2)} />
                              <InsightMetric label="CPM" value={`R$ ${parseFloat(selectedInsights.data.cpm || '0').toFixed(2)}`} />
                              <InsightMetric label="CPC" value={`R$ ${parseFloat(selectedInsights.data.cpc || '0').toFixed(2)}`} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value || '-'}</p>
    </div>
  );
}
