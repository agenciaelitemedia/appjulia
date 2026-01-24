import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, User, MapPin, Briefcase, MessageSquare } from 'lucide-react';
import { JuliaContrato } from '../../types';
import { formatDbDateTime } from '@/lib/dateUtils';

interface ContratoDetailsDialogProps {
  contrato: JuliaContrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContratoDetailsDialog({
  contrato,
  open,
  onOpenChange,
}: ContratoDetailsDialogProps) {
  if (!contrato) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      CREATED: { className: 'bg-yellow-100 text-yellow-800', label: 'Criado' },
      SIGNED: { className: 'bg-green-100 text-green-800', label: 'Assinado' },
      PENDING: { className: 'bg-orange-100 text-orange-800', label: 'Pendente' },
      CANCELLED: { className: 'bg-red-100 text-red-800', label: 'Cancelado' },
    };
    return variants[status] || { className: 'bg-gray-100 text-gray-800', label: status };
  };

  const statusInfo = getStatusBadge(contrato.status_document);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Contrato
          </DialogTitle>
        </DialogHeader>

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
                  <p className="font-mono text-sm">{contrato.cod_document}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="secondary" className={statusInfo.className}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Situação</p>
                  <p className="font-medium">{contrato.situacao}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data do Contrato</p>
                  <p className="font-medium">{formatDbDateTime(contrato.data_contrato)}</p>
                </div>
                {contrato.data_assinatura && (
                  <div>
                    <p className="text-xs text-muted-foreground">Data da Assinatura</p>
                    <p className="font-medium">{formatDbDateTime(contrato.data_assinatura)}</p>
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
                  <p className="font-medium">{contrato.signer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-mono">{contrato.signer_cpf || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <a
                    href={`https://wa.me/${contrato.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {contrato.whatsapp}
                  </a>
                </div>
              </div>
            </div>

            <Separator />

            {/* Address */}
            {(contrato.signer_cidade || contrato.signer_uf || contrato.signer_endereco) && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </h3>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      {contrato.signer_endereco && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Endereço</p>
                          <p className="font-medium">{contrato.signer_endereco}</p>
                        </div>
                      )}
                      {contrato.signer_bairro && (
                        <div>
                          <p className="text-xs text-muted-foreground">Bairro</p>
                          <p className="font-medium">{contrato.signer_bairro}</p>
                        </div>
                      )}
                      {contrato.signer_cidade && (
                        <div>
                          <p className="text-xs text-muted-foreground">Cidade</p>
                          <p className="font-medium">{contrato.signer_cidade}</p>
                        </div>
                      )}
                      {contrato.signer_uf && (
                        <div>
                          <p className="text-xs text-muted-foreground">UF</p>
                          <p className="font-medium">{contrato.signer_uf}</p>
                        </div>
                      )}
                      {contrato.signer_cep && (
                        <div>
                          <p className="text-xs text-muted-foreground">CEP</p>
                          <p className="font-mono">{contrato.signer_cep}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Case Info */}
            {(contrato.case_title || contrato.case_category_name) && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Vínculo com Processo
                  </h3>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    {contrato.case_title && (
                      <div>
                        <p className="text-xs text-muted-foreground">Título do Caso</p>
                        <p className="font-medium">{contrato.case_title}</p>
                      </div>
                    )}
                    {contrato.case_category_name && (
                      <div>
                        <p className="text-xs text-muted-foreground">Categoria</p>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: contrato.case_category_color
                              ? `${contrato.case_category_color}20`
                              : undefined,
                            color: contrato.case_category_color || undefined,
                          }}
                        >
                          {contrato.case_category_name}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Case Summary */}
            {contrato.resumo_do_caso && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Resumo do Caso
                </h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{contrato.resumo_do_caso}</p>
                </div>
              </div>
            )}

            {/* Agent Info */}
            <div className="space-y-3">
              <h3 className="font-semibold">Agente Responsável</h3>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Código</p>
                    <p className="font-medium">{contrato.cod_agent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="font-medium">{contrato.name}</p>
                  </div>
                  {contrato.business_name && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Escritório</p>
                      <p className="font-medium">{contrato.business_name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
