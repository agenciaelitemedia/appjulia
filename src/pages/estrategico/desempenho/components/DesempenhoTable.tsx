import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, Download, MessageCircle, ExternalLink, Bot, Loader2, Phone, Eye } from 'lucide-react';
import { JuliaSessao } from '../../types';
import { formatDbDateTime } from '@/lib/dateUtils';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { SessionStatusDialog } from '@/pages/crm/components/SessionStatusDialog';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;

type SortField = 'cod_agent' | 'whatsapp' | 'perfil_agent' | 'total_msg' | 'created_at' | 'max_created_at' | 'status_document';
type SortDirection = 'asc' | 'desc';

interface DesempenhoTableProps {
  sessoes: JuliaSessao[];
  isLoading?: boolean;
  searchTerm?: string;
  onExport?: (data: JuliaSessao[]) => void;
}

function AgentStatusIcon({ whatsapp, codAgent, onClick }: { whatsapp: string; codAgent: string; onClick: () => void }) {
  const { isActive, isLoading } = useAgentSessionStatus(whatsapp, codAgent);

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        "h-7 w-7 rounded-full",
        isLoading
          ? "text-muted-foreground border-muted"
          : isActive
            ? "text-green-500 border-green-500/30 hover:bg-green-100/50 dark:hover:bg-green-900/30"
            : "text-red-500 border-red-500/30 hover:bg-red-100/50 dark:hover:bg-red-900/30"
      )}
      disabled={!whatsapp}
      onClick={onClick}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bot className={cn("h-3.5 w-3.5", isActive && "animate-pulse")} />
      )}
    </Button>
  );
}

export function DesempenhoTable({ sessoes, isLoading, searchTerm = '', onExport }: DesempenhoTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [selectedSessao, setSelectedSessao] = useState<JuliaSessao | null>(null);
  const [sessionDialog, setSessionDialog] = useState<{
    open: boolean;
    whatsapp: string;
    codAgent: string;
  }>({ open: false, whatsapp: '', codAgent: '' });
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const [phoneCallSessao, setPhoneCallSessao] = useState<JuliaSessao | null>(null);

  const handleOpenMessages = (sessao: JuliaSessao) => {
    setSelectedSessao(sessao);
    setMessagesOpen(true);
  };

  const handleGoToCRM = (whatsapp: string) => {
    if (!whatsapp) return;
    navigate(`/crm/leads?whatsapp=${encodeURIComponent(whatsapp)}`);
  };

  const filteredSessoes = useMemo(() => {
    if (!searchTerm) return sessoes;
    
    const term = searchTerm.toLowerCase();
    return sessoes.filter((s) =>
      s.name?.toLowerCase().includes(term) ||
      s.business_name?.toLowerCase().includes(term) ||
      s.whatsapp?.includes(term) ||
      s.cod_agent?.includes(term)
    );
  }, [sessoes, searchTerm]);

  const sortedSessoes = useMemo(() => {
    if (!sortField) return filteredSessoes;

    return [...filteredSessoes].sort((a, b) => {
      let aValue: string | number | null = null;
      let bValue: string | number | null = null;

      switch (sortField) {
        case 'cod_agent':
          aValue = a.cod_agent || '';
          bValue = b.cod_agent || '';
          break;
        case 'whatsapp':
          aValue = a.whatsapp || '';
          bValue = b.whatsapp || '';
          break;
        case 'perfil_agent':
          aValue = a.perfil_agent || '';
          bValue = b.perfil_agent || '';
          break;
        case 'total_msg':
          aValue = a.total_msg || 0;
          bValue = b.total_msg || 0;
          break;
        case 'created_at':
          aValue = a.created_at || '';
          bValue = b.created_at || '';
          break;
        case 'max_created_at':
          aValue = a.max_created_at || '';
          bValue = b.max_created_at || '';
          break;
        case 'status_document':
          aValue = a.status_document || '';
          bValue = b.status_document || '';
          break;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredSessoes, sortField, sortDirection]);

  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(sortedSessoes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSessoes = sortedSessoes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const handleExportCSV = () => {
    const headers = ['Agente', 'Nome', 'WhatsApp', 'Perfil', 'Mensagens', 'Início', 'Última Msg', 'Status'];
    const rows = sortedSessoes.map((s) => [
      s.cod_agent,
      s.name,
      s.whatsapp,
      s.perfil_agent,
      s.total_msg,
      formatDbDateTime(s.created_at),
      s.max_created_at ? formatDbDateTime(s.max_created_at) : '-',
      s.status_document || '-',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `desempenho-julia-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (filteredSessoes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma sessão encontrada</p>
      </div>
    );
  }

  const getPerfilBadge = (perfil: string) => {
    const variants: Record<string, { className: string }> = {
      SDR: { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
      CLOSER: { className: 'bg-purple-100 text-purple-800 hover:bg-purple-100' },
    };
    return variants[perfil] || { className: 'bg-gray-100 text-gray-800' };
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return { className: 'bg-gray-100 text-gray-800' };
    
    const variants: Record<string, { className: string }> = {
      CREATED: { className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
      SIGNED: { className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      PENDING: { className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
    };
    return variants[status] || { className: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('cod_agent')}>
                  Agente
                  {getSortIcon('cod_agent')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleSort('whatsapp')}>
                  WhatsApp
                  {getSortIcon('whatsapp')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleSort('perfil_agent')}>
                  Perfil
                  {getSortIcon('perfil_agent')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleSort('created_at')}>
                  Início
                  {getSortIcon('created_at')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleSort('max_created_at')}>
                  Última Msg
                  {getSortIcon('max_created_at')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleSort('status_document')}>
                  Status
                  {getSortIcon('status_document')}
                </Button>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessoes.map((sessao) => (
              <TableRow key={`${sessao.session_id}-${sessao.created_at}`}>
                <TableCell>
                  <div>
                    <p className="font-medium">[{sessao.cod_agent}]</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {sessao.name}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <a
                    href={`https://wa.me/${sessao.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {sessao.whatsapp}
                  </a>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPerfilBadge(sessao.perfil_agent).className}>
                    {sessao.perfil_agent}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-sm">
                  {formatDbDateTime(sessao.created_at)}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {sessao.max_created_at ? formatDbDateTime(sessao.max_created_at) : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {sessao.status_document ? (
                    <Badge variant="secondary" className={getStatusBadge(sessao.status_document).className}>
                      {sessao.status_document}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <AgentStatusIcon
                      whatsapp={sessao.whatsapp}
                      codAgent={sessao.cod_agent}
                      onClick={() => {
                        if (!sessao.whatsapp) return;
                        setSessionDialog({
                          open: true,
                          whatsapp: sessao.whatsapp,
                          codAgent: sessao.cod_agent,
                        });
                      }}
                    />

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!sessao.whatsapp}
                            onClick={() => handleOpenMessages(sessao)}
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
                            disabled={!sessao.whatsapp}
                            onClick={() => handleGoToCRM(sessao.whatsapp)}
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
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Exibindo {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sortedSessoes.length)} de {sortedSessoes.length} atendimentos
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, index, arr) => {
                  const showEllipsisBefore = index > 0 && page - arr[index - 1] > 1;
                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsisBefore && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </span>
                  );
                })}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {selectedSessao && (
        <WhatsAppMessagesDialog
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
          whatsappNumber={selectedSessao.whatsapp}
          leadName={selectedSessao.name || ''}
          codAgent={selectedSessao.cod_agent}
        />
      )}

      <SessionStatusDialog
        open={sessionDialog.open}
        onOpenChange={(open) => setSessionDialog(prev => ({ ...prev, open }))}
        whatsappNumber={sessionDialog.whatsapp}
        codAgent={sessionDialog.codAgent}
      />
    </div>
  );
}
