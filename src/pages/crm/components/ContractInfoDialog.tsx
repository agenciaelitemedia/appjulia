import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scale, Download, ExternalLink, Loader2, User, Calendar, FileText } from 'lucide-react';
import { useContractInfo } from '../hooks/useContractInfo';
import { formatDbDateTime } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface ContractInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  codAgent: string;
  contactName?: string;
}

const ContractInfoDialog = React.forwardRef<HTMLDivElement, ContractInfoDialogProps>(
  ({ open, onOpenChange, whatsappNumber, codAgent, contactName }, ref) => {
    const { toast } = useToast();
    const [downloading, setDownloading] = useState(false);
    
    const { data: contractInfo, isLoading } = useContractInfo(whatsappNumber, codAgent, open);

    const getStatusBadge = (status: string) => {
      const variants: Record<string, { className: string; label: string }> = {
        CREATED: { className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400', label: 'Em Curso' },
        SIGNED: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Assinado' },
        PENDING: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Pendente' },
        CANCELLED: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Cancelado' },
      };
      return variants[status] || { className: 'bg-muted text-muted-foreground', label: status };
    };

    const handleDownloadContract = async () => {
      if (!contractInfo?.zapsing_doctoken) {
        toast({
          title: 'Erro',
          description: 'Contrato sem token para download',
          variant: 'destructive',
        });
        return;
      }

      setDownloading(true);

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
          body: JSON.stringify({ doc_token: contractInfo.zapsing_doctoken, file: 'signed' }),
        });

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Erro ao obter documento');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const disposition = response.headers.get('Content-Disposition');
        let fileName = `${contractInfo.signer_name || contactName || 'contrato'}.pdf`;
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
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'destructive',
        });
      } finally {
        setDownloading(false);
      }
    };

    const handleOpenContract = () => {
      if (contractInfo?.cod_document) {
        // Open ZapSign verification/signing page
        window.open(`https://app.zapsign.com.br/verificar/${contractInfo.cod_document}`, '_blank');
      }
    };

    const isSigned = contractInfo?.status_document === 'SIGNED';
    const statusInfo = contractInfo ? getStatusBadge(contractInfo.status_document) : null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Informações do Contrato
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : contractInfo ? (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant="secondary" className={statusInfo?.className}>
                  {statusInfo?.label}
                </Badge>
              </div>

              {/* Contract Details */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                {contractInfo.signer_name && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Signatário</p>
                      <p className="font-medium">{contractInfo.signer_name}</p>
                    </div>
                  </div>
                )}

                {contractInfo.data_contrato && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data do Contrato</p>
                      <p className="font-medium">{formatDbDateTime(contractInfo.data_contrato)}</p>
                    </div>
                  </div>
                )}

                {contractInfo.data_assinatura && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data da Assinatura</p>
                      <p className="font-medium">{formatDbDateTime(contractInfo.data_assinatura)}</p>
                    </div>
                  </div>
                )}

                {contractInfo.cod_document && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Código do Documento</p>
                      <p className="font-mono text-sm">{contractInfo.cod_document}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {isSigned && contractInfo.zapsing_doctoken ? (
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleDownloadContract}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Baixar Contrato Assinado
                  </Button>
                ) : contractInfo.cod_document ? (
                  <Button
                    className="flex-1 gap-2"
                    variant="outline"
                    onClick={handleOpenContract}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Contrato
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Scale className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum contrato encontrado para este lead.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

ContractInfoDialog.displayName = 'ContractInfoDialog';

export { ContractInfoDialog };
