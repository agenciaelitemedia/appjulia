import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { markOrderPaidManually, type JuliaOrder } from '../hooks/useOrders';

interface Props {
  order: JuliaOrder;
  onDone: () => void;
}

const toCents = (v: string) => Math.round((parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0) * 100);
const fmt = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const localDateTime = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const ManualPaymentDialog = ({ order, onDone }: Props) => {
  const [open, setOpen] = useState(false);
  const [paid, setPaid] = useState(((order.plan_price || 0) / 100).toFixed(2).replace('.', ','));
  const [fee, setFee] = useState('0,00');
  const [paidAt, setPaidAt] = useState(localDateTime());
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const paidCents = useMemo(() => toCents(paid), [paid]);
  const feeCents = useMemo(() => toCents(fee), [fee]);
  const net = Math.max(0, paidCents - feeCents);

  const handleSave = async () => {
    if (paidCents <= 0) {
      toast.error('Informe o valor pago');
      return;
    }
    setSaving(true);
    try {
      await markOrderPaidManually(order, {
        paidAmountCents: paidCents,
        feeAmountCents: feeCents,
        paidAt: new Date(paidAt).toISOString(),
        notes: notes.trim() || undefined,
      });
      toast.success('Baixa manual registrada');
      setOpen(false);
      setConfirmed(false);
      onDone();
    } catch (e: any) {
      toast.error('Falha na baixa manual: ' + (e?.message ?? 'erro'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmed(false); }}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <BadgeCheck className="w-3 h-3 mr-1" /> Baixa manual
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixa manual do pedido</DialogTitle>
          <DialogDescription>
            Marque o pedido de <strong>{order.customer_name}</strong> como pago informando os valores recebidos fora do gateway.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mp-paid">Valor pago (R$)</Label>
              <Input id="mp-paid" value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-fee">Taxas (R$)</Label>
              <Input id="mp-fee" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-date">Data do pagamento</Label>
            <Input id="mp-date" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-notes">Observação (opcional)</Label>
            <Textarea
              id="mp-notes"
              rows={2}
              placeholder="Ex.: PIX recebido na conta do escritório"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="text-muted-foreground">Valor líquido</span>
            <span className="font-semibold">{fmt(net)}</span>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch checked={confirmed} onCheckedChange={setConfirmed} />
            <span className="text-sm">Confirmo que o pagamento foi recebido</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!confirmed || saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Confirmar baixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
