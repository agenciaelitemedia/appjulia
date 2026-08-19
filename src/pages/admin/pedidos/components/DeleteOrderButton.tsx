import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteOrder, type JuliaOrder } from '../hooks/useOrders';

interface Props {
  order: JuliaOrder;
  onDeleted: () => void;
}

export const DeleteOrderButton = ({ order, onDeleted }: Props) => {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOrder(order.id);
      toast.success('Pedido excluído');
      setOpen(false);
      onDeleted();
    } catch (e: any) {
      toast.error('Falha ao excluir: ' + (e?.message ?? 'erro'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmed(false); }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Excluir pedido" className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pedido não pago</AlertDialogTitle>
          <AlertDialogDescription>
            O pedido de <strong>{order.customer_name}</strong> ({order.plan_name || 'sem plano'}) será
            removido permanentemente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Switch checked={confirmed} onCheckedChange={setConfirmed} />
          <span className="text-sm">Confirmo a exclusão definitiva deste pedido</span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={!confirmed || deleting} onClick={handleDelete}>
            {deleting ? 'Excluindo...' : 'Excluir pedido'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};