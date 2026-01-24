import { useMemo, useState } from 'react';
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
import { FileText, Eye, MessageCircle, Download, Loader2 } from 'lucide-react';
import { JuliaContrato } from '../../types';
import { formatDbDateTime, formatTimeDifference } from '@/lib/dateUtils';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    // Com código do país (55) + DDD (2) + número (9)
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 12) {
    // Com código do país (55) + DDD (2) + número (8)
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  } else if (cleaned.length === 11) {
    // Apenas DDD (2) + número (9)
    return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // Apenas DDD (2) + número (8)
    return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return number;
}

export function ContratosTable({
  contratos,
  isLoading,
  searchTerm = '',
  onViewDetails,
}: ContratosTableProps) {
  const { toast } = useToast();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      const { data, error } = await supabase.functions.invoke('zapsign-download', {
        body: { doc_token: docToken },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao obter documento');
      }

      // Prioriza documento assinado, senão usa original
      const fileUrl = data.signed_file || data.original_file;
      
      if (!fileUrl) {
        toast({
          title: 'Documento indisponível',
          description: 'O documento ainda não está disponível para download',
          variant: 'destructive',
        });
        return;
      }

      // Abrir em nova aba (o link já é do S3 e faz download automático)
      window.open(fileUrl, '_blank');
      
      toast({
        title: 'Download iniciado',
        description: 'O documento será baixado em instantes',
      });

    } catch (error) {
      console.error('Erro ao baixar contrato:', error);
      toast({
        title: 'Erro ao baixar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
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
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Contrato</TableHead>
              <TableHead className="w-[120px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContratos.map((contrato) => {
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
                  <TableCell>
                    <a
                      href={`https://wa.me/${contrato.whatsapp?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-sm"
                    >
                      {formatWhatsAppNumber(contrato.whatsapp)}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
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
                  <TableCell className="text-sm">
                    {formatDbDateTime(contrato.data_contrato)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
