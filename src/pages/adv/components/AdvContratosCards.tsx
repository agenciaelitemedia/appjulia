import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Phone, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContratoDetailsDialog } from '@/pages/estrategico/contratos/components/ContratoDetailsDialog';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
import { usePhone } from '@/contexts/PhoneContext';
import { JuliaContrato } from '@/pages/estrategico/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 10;

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

function formatPhoneDisplay(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function ContratoCard({
  contrato,
  onDetails,
  onCall,
  phoneAvailable,
}: {
  contrato: JuliaContrato;
  onDetails: (c: JuliaContrato) => void;
  onCall: (c: JuliaContrato) => void;
  phoneAvailable: boolean;
}) {
  const cfg = statusConfig[contrato.status_document] || statusConfig.CREATED;
  const dateStr = contrato.data_contrato
    ? format(new Date(contrato.data_contrato), "dd/MM/yyyy", { locale: ptBR })
    : '—';

  const phoneDisplay = contrato.whatsapp ? formatPhoneDisplay(contrato.whatsapp) : null;

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
        <div className="text-xs text-muted-foreground line-clamp-2 prose prose-xs prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown>{contrato.resumo_do_caso}</ReactMarkdown>
        </div>
      )}

      {phoneDisplay && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Ligue Agora:</span>{' '}
          {phoneAvailable ? (
            <button
              onClick={() => onCall(contrato)}
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium"
            >
              {phoneDisplay}
            </button>
          ) : (
            <a
              href={`tel:${contrato.whatsapp?.replace(/\D/g, '')}`}
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium"
            >
              {phoneDisplay}
            </a>
          )}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {phoneAvailable && (
          <button
            onClick={() => onCall(contrato)}
            className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center hover:bg-orange-500/20 transition-colors"
            title="Ligar"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
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

function PaginatedSection({
  title,
  color,
  items,
  agentCode,
  onDetails,
  onCall,
  phoneAvailable,
}: {
  title: string;
  color: string;
  items: JuliaContrato[];
  agentCode: string;
  onDetails: (c: JuliaContrato) => void;
  onCall: (c: JuliaContrato) => void;
  phoneAvailable: boolean;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const showing = items.slice(0, visible);
  const hasMore = visible < items.length;

  return (
    <section>
      <SectionHeader title={title} count={items.length} color={color} />
      <div className="space-y-2">
        {showing.map(c => (
          <ContratoCard
            key={c.cod_document || c.session_id}
            contrato={c}
            onDetails={onDetails}
            onCall={onCall}
            phoneAvailable={phoneAvailable}
          />
        ))}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible(v => v + PAGE_SIZE)}
          className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5 mr-1" />
          Carregar mais ({items.length - visible} restantes)
        </Button>
      )}
    </section>
  );
}

export function AdvContratosCards({ contratos, isLoading, agentCode }: AdvContratosCardsProps) {
  const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);
  const [callContrato, setCallContrato] = useState<JuliaContrato | null>(null);
  const { isAvailable } = usePhone();

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
        <PaginatedSection
          title="Em Curso"
          color="bg-yellow-500"
          items={emCurso}
          agentCode={agentCode}
          onDetails={setSelectedContrato}
          onCall={setCallContrato}
          phoneAvailable={isAvailable}
        />
      )}

      {assinados.length > 0 && (
        <PaginatedSection
          title="Assinados"
          color="bg-green-500"
          items={assinados}
          agentCode={agentCode}
          onDetails={setSelectedContrato}
          onCall={setCallContrato}
          phoneAvailable={isAvailable}
        />
      )}

      {cancelados.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-4 w-4" />
            Cancelados ({cancelados.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PaginatedSection
              title="Cancelados"
              color="bg-red-500"
              items={cancelados}
              agentCode={agentCode}
              onDetails={setSelectedContrato}
              onCall={setCallContrato}
              phoneAvailable={isAvailable}
            />
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
