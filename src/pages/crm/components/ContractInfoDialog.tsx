import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  User, 
  MapPin, 
  Briefcase, 
  MessageSquare, 
  Download, 
  Loader2,
  Scale
} from 'lucide-react';
import { useContractInfo } from '../hooks/useContractInfo';
import { formatDbDateTime } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';

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
        CREATED: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Criado' },
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

    const statusInfo = contractInfo ? getStatusBadge(contractInfo.status_document) : null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Detalhes do Contrato
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : contractInfo ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Contract Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações do Contrato
                  </h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Código do Documento</p>
                      <p className="font-mono text-sm">{contractInfo.cod_document || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant="secondary" className={statusInfo?.className}>
                        {statusInfo?.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Situação</p>
                      <p className="font-medium">{contractInfo.situacao || '-'}</p>
                    </div>
                    <div className="flex items-center justify-between col-span-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Data do Contrato</p>
                        <p className="font-medium">
                          {contractInfo.data_contrato ? formatDbDateTime(contractInfo.data_contrato) : '-'}
                        </p>
                      </div>
                      {contractInfo.status_document === 'SIGNED' && contractInfo.zapsing_doctoken && (
                        <Button
                          size="sm"
                          onClick={handleDownloadContract}
                          disabled={downloading}
                          className="gap-2"
                        >
                          {downloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Baixar Contrato
                        </Button>
                      )}
                    </div>
                    {contractInfo.data_assinatura && (
                      <div>
                        <p className="text-xs text-muted-foreground">Data da Assinatura</p>
                        <p className="font-medium">{formatDbDateTime(contractInfo.data_assinatura)}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Signer Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Signatário
                  </h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-medium">{contractInfo.signer_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <p className="font-mono">{contractInfo.signer_cpf || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      {contractInfo.whatsapp ? (
                        <a
                          href={`https://wa.me/${contractInfo.whatsapp?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {contractInfo.whatsapp}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">-</p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Address */}
                {(contractInfo.signer_cidade || contractInfo.signer_uf || contractInfo.signer_endereco) && (
                  <>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Endereço
                      </h3>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          {contractInfo.signer_endereco && (
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">Endereço</p>
                              <p className="font-medium">{contractInfo.signer_endereco}</p>
                            </div>
                          )}
                          {contractInfo.signer_bairro && (
                            <div>
                              <p className="text-xs text-muted-foreground">Bairro</p>
                              <p className="font-medium">{contractInfo.signer_bairro}</p>
                            </div>
                          )}
                          {contractInfo.signer_cidade && (
                            <div>
                              <p className="text-xs text-muted-foreground">Cidade</p>
                              <p className="font-medium">{contractInfo.signer_cidade}</p>
                            </div>
                          )}
                          {contractInfo.signer_uf && (
                            <div>
                              <p className="text-xs text-muted-foreground">UF</p>
                              <p className="font-medium">{contractInfo.signer_uf}</p>
                            </div>
                          )}
                          {contractInfo.signer_cep && (
                            <div>
                              <p className="text-xs text-muted-foreground">CEP</p>
                              <p className="font-mono">{contractInfo.signer_cep}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Case Info */}
                {(contractInfo.case_title || contractInfo.case_category_name) && (
                  <>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Vínculo com Processo
                      </h3>
                      <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                        {contractInfo.case_title && (
                          <div>
                            <p className="text-xs text-muted-foreground">Título do Caso</p>
                            <p className="font-medium">{contractInfo.case_title}</p>
                          </div>
                        )}
                        {contractInfo.case_category_name && (
                          <div>
                            <p className="text-xs text-muted-foreground">Categoria</p>
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: contractInfo.case_category_color
                                  ? `${contractInfo.case_category_color}20`
                                  : undefined,
                                color: contractInfo.case_category_color || undefined,
                              }}
                            >
                              {contractInfo.case_category_name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Case Summary */}
                {contractInfo.resumo_do_caso && (
                  <>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Resumo do Caso
                      </h3>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{contractInfo.resumo_do_caso}</p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Agent Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Agente Responsável</h3>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Código</p>
                        <p className="font-medium">{contractInfo.cod_agent || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nome</p>
                        <p className="font-medium">{contractInfo.agent_name || '-'}</p>
                      </div>
                      {contractInfo.business_name && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Escritório</p>
                          <p className="font-medium">{contractInfo.business_name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
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
