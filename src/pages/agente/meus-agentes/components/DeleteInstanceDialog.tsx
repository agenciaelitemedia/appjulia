import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Copy, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { UserAgent } from '../types';
import { useDeleteInstance } from '../hooks/useDeleteInstance';

interface DeleteInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onSuccess?: () => void;
}

export function DeleteInstanceDialog({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: DeleteInstanceDialogProps) {
  const [typedName, setTypedName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const { deleteInstanceAsync, isDeleting, reset } = useDeleteInstance();

  const instanceName = agent.evo_instancia || '';
  const isNameMatch = typedName === instanceName;
  const canDelete = isNameMatch && confirmed && !isDeleting;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTypedName('');
      setConfirmed(false);
      reset();
    }
  }, [open, reset]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(instanceName);
      toast.success('Nome da instância copiado!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInstanceAsync({ agent });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error already handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Excluir Instância
          </DialogTitle>
          <DialogDescription>
            <strong className="text-destructive">ATENÇÃO:</strong> Esta ação é irreversível! 
            A instância será removida permanentemente do servidor e as credenciais serão apagadas do banco de dados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instance name to copy */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Instância a ser excluída:</Label>
            <div className="flex items-center gap-2">
              <Input
                value={instanceName}
                readOnly
                className="flex-1 bg-muted font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copiar nome"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Type instance name */}
          <div className="space-y-2">
            <Label htmlFor="confirm-name" className="text-sm font-medium">
              Digite o nome da instância para confirmar:
            </Label>
            <Input
              id="confirm-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Digite o nome exato..."
              className={typedName && !isNameMatch ? 'border-destructive' : ''}
              disabled={isDeleting}
            />
            {typedName && !isNameMatch && (
              <p className="text-xs text-destructive">O nome não corresponde</p>
            )}
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={isDeleting}
            />
            <Label
              htmlFor="confirm-delete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Confirmo que desejo excluir esta instância permanentemente
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir Instância'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
