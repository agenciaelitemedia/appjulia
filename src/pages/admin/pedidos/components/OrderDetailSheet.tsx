import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalLink, ChevronDown, Copy } from 'lucide-react';
import type { JuliaOrder } from '../hooks/useOrders';
import { toast } from 'sonner';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const fmt = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const Row = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
};

interface Props {
  order: JuliaOrder | null;
  open: boolean;
  onClose: () => void;
}

export const OrderDetailSheet = ({ order, open, onClose }: Props) => {
  if (!order) return null;

  const st = statusMap[order.status] || { label: order.status, variant: 'outline' as const };

  const copyId = () => {
    navigator.clipboard.writeText(order.id);
    toast.success('ID copiado');
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Pedido
            <Badge variant={st.variant}>{st.label}</Badge>
          </SheetTitle>
          <button onClick={copyId} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Copy className="w-3 h-3" /> {order.id.slice(0, 8)}...
          </button>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Cliente */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cliente</h3>
            <div className="rounded-lg border p-3 space-y-0.5">
              <Row label="Nome" value={order.customer_name} />
              <Row label="Documento" value={order.customer_document} mono />
              <Row label="E-mail" value={order.customer_email} />
              <Row label="WhatsApp" value={order.customer_whatsapp} />
              <Row label="Endereço" value={order.customer_address} />
            </div>
          </section>

          {/* Pedido */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pedido</h3>
            <div className="rounded-lg border p-3 space-y-0.5">
              <Row label="Plano" value={order.plan_name} />
              <Row label="Valor" value={order.plan_price ? fmt(order.plan_price) : undefined} />
              <Row label="Período" value={order.billing_period} />
              <Row label="NSU" value={order.order_nsu} mono />
              <Row label="Criado em" value={new Date(order.created_at).toLocaleString('pt-BR')} />
              <Row label="Atualizado em" value={new Date(order.updated_at).toLocaleString('pt-BR')} />
            </div>
          </section>

          {/* Pagamento */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pagamento</h3>
            <div className="rounded-lg border p-3 space-y-0.5">
              <Row label="Valor pago" value={order.paid_amount ? fmt(order.paid_amount) : 'Não pago'} />
              <Row label="Parcelas" value={order.installments ? `${order.installments}x` : undefined} />
              <Row label="Pago em" value={order.paid_at ? new Date(order.paid_at).toLocaleString('pt-BR') : undefined} />
              <Row label="NSU Transação" value={order.infinitypay_transaction_nsu} mono />
              <Row label="Agente" value={order.cod_agent} mono />
            </div>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-2">
            {order.checkout_url && (
              <a href={order.checkout_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3 h-3 mr-1" /> Checkout
                </Button>
              </a>
            )}
            {order.receipt_url && (
              <a href={order.receipt_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3 h-3 mr-1" /> Comprovante
                </Button>
              </a>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notas</h3>
              <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{order.notes}</p>
            </section>
          )}

          {/* Webhook payload */}
          {order.webhook_payload && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown className="w-4 h-4" /> Payload do Webhook
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-60">
                  {JSON.stringify(order.webhook_payload, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
