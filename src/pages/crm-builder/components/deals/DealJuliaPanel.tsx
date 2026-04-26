import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, FileText, Bot, Scale, Phone as PhoneIcon, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CRMDeal } from '../../types';
import { useDealJuliaContext } from '../../hooks/useDealJuliaContext';
import { CRMLeadDetailsDialog } from '@/pages/crm/components/CRMLeadDetailsDialog';
import { ContractInfoDialog } from '@/pages/crm/components/ContractInfoDialog';
import { useCRMStages } from '@/pages/crm/hooks/useCRMData';
import type { CRMCard } from '@/pages/crm/types';

interface Props {
  deal: CRMDeal;
}

const formatPhone = (raw: string | null | undefined) => {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length >= 12) {
    // 55 11 99999-9999
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, d.length - 4)}-${d.slice(-4)}`;
  }
  return d;
};

/**
 * Painel roxo de "Vínculo com a Jul.IA" exibido no DealDetailsSheet quando o
 * deal está vinculado a uma fila atrelada a um agente Júlia. Centraliza os
 * acessos ao card Júlia, contrato e status do agente, sem duplicar a seção
 * já renderizada por DealLinksSection (links explícitos).
 */
export function DealJuliaPanel({ deal }: Props) {
  const navigate = useNavigate();
  const ctx = useDealJuliaContext(deal);
  const { data: stages = [] } = useCRMStages();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

  if (!ctx.isJulia) return null;

  const phoneDigits = (deal.contact_phone || '').replace(/\D/g, '');
  const hasContract = ctx.contract.status !== 'none' && !!ctx.contract.cod_document;
  const contractColor =
    ctx.contract.status === 'signed'
      ? 'text-emerald-600 hover:text-emerald-700'
      : ctx.contract.status === 'generated'
        ? 'text-blue-600 hover:text-blue-700'
        : 'text-muted-foreground/50';

  const agentColor = ctx.agentActive
    ? 'text-emerald-600 hover:text-emerald-700'
    : 'text-red-500 hover:text-red-600';

  const juliaCardShape: CRMCard | null = ctx.juliaCard
    ? {
        id: ctx.juliaCard.id,
        cod_agent: ctx.codAgent || '',
        contact_name: deal.contact_name || '',
        whatsapp_number: phoneDigits,
        business_name: ctx.juliaCard.business_name || undefined,
        stage_id: ctx.juliaCard.stage_id ?? undefined,
        stage_name: ctx.juliaCard.stage_name || undefined,
        stage_color: ctx.juliaCard.stage_color || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stage_entered_at: new Date().toISOString(),
      }
    : null;

  const goToJuliaCRM = () => {
    if (!phoneDigits) return;
    navigate(`/crm/leads?whatsapp=${phoneDigits}`);
  };

  return (
    <>
      <Separator />
      <div className="rounded-lg border bg-purple-500/5 border-purple-500/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-purple-500/10 flex items-center justify-center">
            <Scale className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">
              Vínculo com a Jul.IA
            </div>
            <div className="text-[11px] text-muted-foreground">
              Card detectado pela fila vinculada ao agente
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium truncate">{deal.contact_name || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PhoneIcon className="h-3 w-3" />
            <span className="font-mono">{formatPhone(deal.contact_phone)}</span>
          </div>
        </div>

        {/* Badge cod_agent + alias */}
        {ctx.codAgent && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 gap-1 bg-purple-500/10 text-purple-700 border-purple-500/30 max-w-full"
            title={`#${ctx.codAgent}${ctx.agentAlias ? ' - ' + ctx.agentAlias : ''}`}
          >
            <Scale className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">
              #{ctx.codAgent}
              {ctx.agentAlias ? ` - ${ctx.agentAlias}` : ''}
            </span>
          </Badge>
        )}

        {/* Barra de ações */}
        <div className="flex items-center gap-2 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full text-blue-600 border-blue-500/40 hover:bg-blue-500/10"
                disabled={!juliaCardShape}
                onClick={() => setDetailsOpen(true)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Detalhes do lead na Jul.IA</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn('h-8 w-8 rounded-full border-purple-500/40 hover:bg-purple-500/10', contractColor)}
                disabled={!hasContract}
                onClick={() => hasContract && setContractOpen(true)}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {ctx.contract.status === 'signed'
                ? 'Contrato assinado'
                : ctx.contract.status === 'generated'
                  ? 'Contrato gerado'
                  : 'Sem contrato'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center justify-center h-8 w-8 rounded-full border border-purple-500/40',
                  agentColor
                )}
              >
                <Bot className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{ctx.agentActive ? 'Agente ativo' : 'Agente parado'}</TooltipContent>
          </Tooltip>
        </div>

        {/* Etapa atual no CRM Júlia */}
        {ctx.juliaCard?.stage_name && (
          <Badge
            variant="outline"
            className="text-[11px] px-2 py-0.5 gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: `${ctx.juliaCard.stage_color || '#a855f7'}15`,
              color: ctx.juliaCard.stage_color || '#7c3aed',
              borderColor: `${ctx.juliaCard.stage_color || '#a855f7'}40`,
            }}
            onClick={goToJuliaCRM}
            title="Filtrar este lead no CRM da Jul.IA"
          >
            Etapa atual: {ctx.juliaCard.stage_name}
          </Badge>
        )}
      </div>

      {juliaCardShape && (
        <CRMLeadDetailsDialog
          card={juliaCardShape}
          stages={stages}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}

      {hasContract && (
        <ContractInfoDialog
          open={contractOpen}
          onOpenChange={setContractOpen}
          whatsappNumber={phoneDigits}
          codAgent={ctx.codAgent || ''}
          contactName={deal.contact_name || undefined}
        />
      )}
    </>
  );
}