import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Undo2 } from 'lucide-react';

interface ReturnToQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note?: string) => Promise<void>;
  currentAssignee?: string | null;
}

export function ReturnToQueueDialog({ open, onOpenChange, onConfirm, currentAssignee }: ReturnToQueueDialogProps) {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm(note.trim() || undefined);
      onOpenChange(false);
      setNote('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-amber-600" />
            Devolver para fila de atendimento
          </DialogTitle>
          <DialogDescription>
            {currentAssignee
              ? `A atribuição de ${currentAssignee} será removida e a conversa voltará para Aguardando atendimento.`
              : 'A conversa voltará para Aguardando atendimento.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Nota de atenção (opcional)</Label>
          <Textarea
            placeholder="Motivo do retorno à fila..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Devolver para fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}