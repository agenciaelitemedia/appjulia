import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ExternalLink, Search, Users, Filter, Bot, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { SessionStatusDialog } from '@/pages/crm/components/SessionStatusDialog';
import { PlatformBadges } from './PlatformBadges';
import { useCampanhasLeadsList } from '../hooks/useCampanhasLeadsList';
import { useCampanhasOptions } from '../hooks/useCampanhasOptions';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { UnifiedFiltersState } from '@/components/filters/types';
import { formatDateShortSaoPaulo } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface CampanhasLeadsTabProps {
  filters: UnifiedFiltersState;
}

const ITEMS_PER_PAGE = 20;

// Small inline component to show agent status per row
function AgentStatusIcon({ whatsapp, codAgent, onClick }: { whatsapp: string; codAgent: string; onClick: () => void }) {
  const { isActive, isLoading } = useAgentSessionStatus(whatsapp, codAgent);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!whatsapp}
            onClick={onClick}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Bot className={cn('h-4 w-4', isActive ? 'text-emerald-500' : 'text-red-500')} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading ? 'Verificando...' : isActive ? 'Julia ativa' : 'Julia inativa'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CampanhasLeadsTab({ filters }: CampanhasLeadsTabProps) {
  const navigate = useNavigate();
  
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [messagesDialog, setMessagesDialog] = useState<{
    open: boolean;
    whatsapp: string;
    name: string;
    codAgent: string;
  }>({ open: false, whatsapp: '', name: '', codAgent: '' });
  const [sessionDialog, setSessionDialog] = useState<{
    open: boolean;
    whatsapp: string;
    codAgent: string;
  }>({ open: false, whatsapp: '', codAgent: '' });

  // Hook para listar campanhas disponíveis
  const { data: campaignOptions = [], isLoading: isLoadingOptions } = useCampanhasOptions(filters);
  
  // Hook para listar leads com filtro de campanha
  const { data: leads = [], isLoading } = useCampanhasLeadsList({
    ...filters,
    campaignId: selectedCampaign === 'all' ? undefined : selectedCampaign,
  });

  // Filtrar leads localmente
  const filteredLeads = useMemo(() => {
    if (!localSearch.trim()) return leads;
    
    const searchLower = localSearch.toLowerCase();
    return leads.filter(lead => 
      lead.whatsapp?.toLowerCase().includes(searchLower) ||
      lead.contact_name?.toLowerCase().includes(searchLower) ||
      lead.campaign_title?.toLowerCase().includes(searchLower) ||
      lead.platform?.toLowerCase().includes(searchLower)
    );
  }, [leads, localSearch]);

  // Paginação
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Reset página quando mudar busca ou campanha
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    setCurrentPage(1);
  };

  const handleCampaignChange = (value: string) => {
    setSelectedCampaign(value);
    setCurrentPage(1);
  };

  const handleOpenMessages = (lead: typeof leads[0]) => {
    if (!lead.whatsapp) return;
    setMessagesDialog({
      open: true,
      whatsapp: lead.whatsapp,
      name: lead.contact_name || 'Lead',
      codAgent: lead.cod_agent,
    });
  };

  const handleGoToCRM = (whatsapp: string) => {
    if (!whatsapp) return;
    navigate(`/crm/leads?search=${encodeURIComponent(whatsapp)}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Leads de Campanhas
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros: Busca local + Select de Campanha */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, WhatsApp..."
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="w-full sm:w-[280px]">
              <Select value={selectedCampaign} onValueChange={handleCampaignChange}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {campaignOptions.map((option) => (
                    <SelectItem key={option.campaign_id} value={option.campaign_id}>
                      <span className="truncate">{option.campaign_title || 'Sem título'}</span>
                      <span className="ml-2 text-muted-foreground">({option.lead_count})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="hidden lg:table-cell">Frase</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {localSearch ? 'Nenhum lead encontrado para a busca' : 'Nenhum lead de campanha no período'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-mono text-sm">
                        {lead.whatsapp || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{lead.contact_name || '-'}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{lead.office_name}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2 text-sm">
                                {lead.campaign_title || '-'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{lead.campaign_title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <PlatformBadges platforms={[lead.platform]} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2 text-xs text-muted-foreground">
                                {lead.greeting_message || '-'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{lead.greeting_message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateShortSaoPaulo(lead.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={!lead.whatsapp}
                                  onClick={() => handleOpenMessages(lead)}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver conversa</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={!lead.whatsapp}
                                  onClick={() => handleGoToCRM(lead.whatsapp)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ir para CRM</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {/* Dialog de mensagens */}
      <WhatsAppMessagesDialog
        open={messagesDialog.open}
        onOpenChange={(open) => setMessagesDialog(prev => ({ ...prev, open }))}
        whatsappNumber={messagesDialog.whatsapp}
        leadName={messagesDialog.name}
        codAgent={messagesDialog.codAgent}
      />
    </>
  );
}
