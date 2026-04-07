import { useState } from 'react';
import { Phone, MessageCircle, Eye, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContratoDetailsDialog } from '@/pages/estrategico/contratos/components/ContratoDetailsDialog';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
import { JuliaContrato } from '@/pages/estrategico/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdvContratosCardsProps {
  contratos: JuliaContrato[];
  isLoading: boolean;
  agentCode: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  CREATED: { label: 'Em Curso', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
  PENDING: { label: 'Pendente', className: 'bg-orange-500/15 text-orange-700 border-orange-500/30' },
  SIGNED: { label: 'Assinado', className: 'bg-green-500/15 text-green-700 border-green-500/30' },
  CANCELLED: { label: 'Cancelado', className: 'bg-red-500/15 text-red-700 border-red-500/30' },
};

function ContratoCard({
  contrato,
  agentCode,
  onDetails,
  onCall,
}: {
  contrato: JuliaContrato;
  agentCode: string;
  onDetails: (c: JuliaContrato) => void;
  onCall: (c: JuliaContrato) => void;
}) {
  const cfg = statusConfig[contrato.status_document] || statusConfig.CREATED;
  const dateStr = contrato.data_contrato
    ? format(new Date(contrato.data_contrato), "dd/MM/yyyy", { locale: ptBR })
    : '—';

  const waLink = contrato.whatsapp
    ? `https://wa.me/${contrato.whatsapp.replace(/\D/g, '')}`
    : null;

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground truncate">
            {contrato.signer_name || contrato.name || 'Sem nome'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dateStr}
            {contrato.case_category_name && ` · ${contrato.case_category_name}`}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] h-5 ${cfg.className}`}>
          {cfg.label}
        </Badge>
      </div>

      {contrato.resumo_do_caso && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {contrato.resumo_do_caso}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onCall(contrato)}
          className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center hover:bg-orange-500/20 transition-colors"
          title="Ligar"
        >
          <Phone className="h-3.5 w-3.5" />
        </button>

        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center hover:bg-green-500/20 transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center opacity-40">
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
        )}

        <button
          onClick={() => onDetails(contrato)}
          className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center hover:bg-blue-500/20 transition-colors"
          title="Detalhes"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
    </div>
  );
}

export function AdvContratosCards({ contratos, isLoading, agentCode }: AdvContratosCardsProps) {
  const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);
  const [callContrato, setCallContrato] = useState<JuliaContrato | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const emCurso = contratos.filter(c => ['CREATED', 'PENDING'].includes(c.status_document));
  const assinados = contratos.filter(c => c.status_document === 'SIGNED');
  const cancelados = contratos.filter(c => c.status_document === 'CANCELLED');

  if (contratos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum contrato encontrado no período.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {emCurso.length > 0 && (
        <section>
          <SectionHeader title="Em Curso" count={emCurso.length} color="bg-yellow-500" />
          <div className="space-y-2">
            {emCurso.map(c => (
              <ContratoCard
                key={c.cod_document || c.session_id}
                contrato={c}
                agentCode={agentCode}
                onDetails={setSelectedContrato}
                onCall={setCallContrato}
              />
            ))}
          </div>
        </section>
      )}

      {assinados.length > 0 && (
        <section>
          <SectionHeader title="Assinados" count={assinados.length} color="bg-green-500" />
          <div className="space-y-2">
            {assinados.map(c => (
              <ContratoCard
                key={c.cod_document || c.session_id}
                contrato={c}
                agentCode={agentCode}
                onDetails={setSelectedContrato}
                onCall={setCallContrato}
              />
            ))}
          </div>
        </section>
      )}

      {cancelados.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4" />
            Cancelados ({cancelados.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2">
              {cancelados.map(c => (
                <ContratoCard
                  key={c.cod_document || c.session_id}
                  contrato={c}
                  agentCode={agentCode}
                  onDetails={setSelectedContrato}
                  onCall={setCallContrato}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <ContratoDetailsDialog
        contrato={selectedContrato}
        open={!!selectedContrato}
        onOpenChange={(open) => !open && setSelectedContrato(null)}
      />

      {callContrato && (
        <PhoneCallDialog
          open={!!callContrato}
          onOpenChange={(open) => !open && setCallContrato(null)}
          whatsappNumber={callContrato.whatsapp || ''}
          contactName={callContrato.signer_name || callContrato.name || 'Contato'}
          codAgent={agentCode}
        />
      )}
    </div>
  );
}
