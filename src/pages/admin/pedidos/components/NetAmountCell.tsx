import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { updateOrderNetAmount, type JuliaOrder } from '../hooks/useOrders';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

interface Props {
  order: JuliaOrder;
  onSaved: () => void;
}

export const NetAmountCell = ({ order, onSaved }: Props) => {
  const current =
    order.net_amount != null
      ? order.net_amount
      : order.status === 'paid' && order.fee_amount != null
        ? (order.paid_amount || order.plan_price) - order.fee_amount
        : null;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setValue(current != null ? (current / 100).toFixed(2).replace('.', ',') : '');
    setEditing(true);
  };

  const parsed = Math.round(parseFloat(value.replace(/\./g, '').replace(',', '.')) * 100);

  const requestSave = () => {
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Valor inválido');
      return;
    }
    setConfirmed(false);
    setConfirmOpen(true);
  };

  const doSave = async () => {
    setSaving(true);
    try {
      await updateOrderNetAmount(order.id, parsed);
      toast.success('Valor líquido atualizado');
      setConfirmOpen(false);
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message ?? 'erro'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => !confirmOpen && setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') requestSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 w-24 text-xs"
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          title="Clique duas vezes para editar"
          className="cursor-pointer border-b border-dashed border-muted-foreground/40"
        >
          {current != null ? formatCurrency(current) : '-'}
        </span>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmed(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração do valor líquido</AlertDialogTitle>
            <AlertDialogDescription>
              Pedido de <strong>{order.customer_name}</strong>: valor líquido passará de{' '}
              <strong>{current != null ? formatCurrency(current) : '—'}</strong> para{' '}
              <strong>{Number.isFinite(parsed) ? formatCurrency(parsed) : '—'}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch checked={confirmed} onCheckedChange={setConfirmed} />
            <span className="text-sm">Confirmo que desejo alterar este valor</span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button disabled={!confirmed || saving} onClick={doSave}>
              {saving ? 'Salvando...' : 'Salvar alteração'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};