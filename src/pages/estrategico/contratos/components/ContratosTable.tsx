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
import { FileText, Eye, MessageCircle, Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Bot } from 'lucide-react';
import { JuliaContrato } from '../../types';
import { formatDbDateTime, formatTimeDifference } from '@/lib/dateUtils';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { SessionStatusDialog } from '@/pages/crm/components/SessionStatusDialog';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;

type SortField = 'cod_agent' | 'signer_name' | 'whatsapp' | 'status_document' | 'data_contrato';
type SortDirection = 'asc' | 'desc';

interface ContratosTableProps {
  contratos: JuliaContrato[];
  isLoading?: boolean;
  searchTerm?: string;
  onViewDetails: (contrato: JuliaContrato) => void;
}

/**
 * Formata número de WhatsApp para exibição
 * Formato: +55 (34) 99999-9999
 */
function formatWhatsAppNumber(number: string): string {
  if (!number) return '-';
  
  const cleaned = number.replace(/\D/g, '');
  
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  } else if (cleaned.length === 11) {
    return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return number;
}

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

export function ContratosTable({
  contratos,
  isLoading,
  searchTerm = '',
  onViewDetails,
}: ContratosTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sessionDialog, setSessionDialog] = useState<{
    open: boolean;
    whatsapp: string;
    codAgent: string;
  }>({ open: false, whatsapp: '', codAgent: '' });

  const filteredContratos = useMemo(() => {
    if (!searchTerm) return contratos;
    
    const term = searchTerm.toLowerCase();
    return contratos.filter((c) =>
      c.name?.toLowerCase().includes(term) ||
      c.business_name?.toLowerCase().includes(term) ||
      c.whatsapp?.includes(term) ||
      c.signer_name?.toLowerCase().includes(term) ||
      c.cod_agent?.includes(term)
    );
  }, [contratos, searchTerm]);

  // Sort data
  const sortedContratos = useMemo(() => {
    if (!sortField) return filteredContratos;

    return [...filteredContratos].sort((a, b) => {
      let aValue: string | null = null;
      let bValue: string | null = null;

      switch (sortField) {
        case 'cod_agent':
          aValue = a.cod_agent || '';
          bValue = b.cod_agent || '';
          break;
        case 'signer_name':
          aValue = a.signer_name || '';
          bValue = b.signer_name || '';
          break;
        case 'whatsapp':
          aValue = a.whatsapp || '';
          bValue = b.whatsapp || '';
          break;
        case 'status_document':
          aValue = a.status_document || '';
          bValue = b.status_document || '';
          break;
        case 'data_contrato':
          aValue = a.data_contrato || '';
          bValue = b.data_contrato || '';
          break;
      }

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredContratos, sortField, sortDirection]);

  // Reset page when search term changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(sortedContratos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedContratos = sortedContratos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

  const handleOpenMessages = (contrato: JuliaContrato) => {
    setSelectedContrato(contrato);
    setMessagesOpen(true);
  };

  const handleDownloadContract = async (contrato: JuliaContrato) => {
    const docToken = contrato.zapsing_doctoken;

    if (!docToken) {
      toast({
        title: 'Erro',
        description: 'Contrato sem token do ZapSign (zapsing_doctoken) para download',
        variant: 'destructive',
      });
      return;
    }

    setDownloadingId(docToken);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/zapsign-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ doc_token: docToken, file: 'signed' }),
      });

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao obter documento');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const disposition = response.headers.get('Content-Disposition');
      let fileName = `${contrato.signer_name || 'contrato'}.pdf`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) {
          fileName = match[1];
        }
      }
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      toast({
        title: 'Download concluído',
        description: 'O contrato foi baixado com sucesso',
      });

    } catch (error) {
      console.error('Erro ao baixar contrato:', error);
      toast({
        title: 'Erro ao baixar',
        description: error instanceof Error ? error.message : 'Erro desconhecido. Tente desativar extensões de bloqueio (adblock).',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Agente', 'Nome Agente', 'Cliente', 'WhatsApp', 'Status', 'Data Contrato', 'Data Assinatura', 'Categoria'];
    const rows = sortedContratos.map((c) => [
      c.cod_agent,
      c.name,
      c.signer_name || '-',
      c.whatsapp,
      c.status_document,
      formatDbDateTime(c.data_contrato),
      c.data_assinatura ? formatDbDateTime(c.data_assinatura) : '-',
      c.case_category_name || '-',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contratos-julia-${new Date().toISOString().split('T')[0]}.csv`;
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

  if (filteredContratos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum contrato encontrado</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      CREATED: { className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100', label: 'Criado' },
      SIGNED: { className: 'bg-green-100 text-green-800 hover:bg-green-100', label: 'Assinado' },
      PENDING: { className: 'bg-orange-100 text-orange-800 hover:bg-orange-100', label: 'Pendente' },
      CANCELLED: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Cancelado' },
    };
    return variants[status] || { className: 'bg-gray-100 text-gray-800', label: status };
  };

  return (
    <>
      {/* Export Button */}
      <div className="flex justify-end mb-4">
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('cod_agent')}
                >
                  Agente
                  {getSortIcon('cod_agent')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('signer_name')}
                >
                  Cliente
                  {getSortIcon('signer_name')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => handleSort('whatsapp')}
                >
                  WhatsApp
                  {getSortIcon('whatsapp')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => handleSort('status_document')}
                >
                  Status
                  {getSortIcon('status_document')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => handleSort('data_contrato')}
                >
                  Data Contrato
                  {getSortIcon('data_contrato')}
                </Button>
              </TableHead>
              <TableHead className="w-[120px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedContratos.map((contrato) => {
              const statusInfo = getStatusBadge(contrato.status_document);
              
              return (
                <TableRow key={`${contrato.cod_document}-${contrato.session_id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">[{contrato.cod_agent}]</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {contrato.name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium truncate max-w-[150px]">
                      {contrato.signer_name || '-'}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <a
                      href={`https://wa.me/${contrato.whatsapp?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-sm"
                    >
                      {formatWhatsAppNumber(contrato.whatsapp)}
                    </a>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="secondary" className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {contrato.status_document === 'SIGNED' 
                          ? formatTimeDifference(contrato.data_contrato, contrato.data_assinatura)
                          : formatTimeDifference(contrato.data_contrato)
                        }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {formatDbDateTime(contrato.data_contrato)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100/50"
                              onClick={() => handleOpenMessages(contrato)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ver mensagens do WhatsApp</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                       {contrato.status_document === 'SIGNED' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50"
                                onClick={() => handleDownloadContract(contrato)}
                                 disabled={!contrato.zapsing_doctoken || downloadingId === contrato.zapsing_doctoken}
                              >
                                 {downloadingId === contrato.zapsing_doctoken ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Baixar contrato assinado</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onViewDetails(contrato)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ver detalhes</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Exibindo {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sortedContratos.length)} de {sortedContratos.length} contratos
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

      {selectedContrato && (
        <WhatsAppMessagesDialog
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
          whatsappNumber={selectedContrato.whatsapp}
          leadName={selectedContrato.signer_name || ''}
          codAgent={selectedContrato.cod_agent}
        />
      )}
    </>
  );
}
