import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { ContactRow } from '../hooks/useContactsList';

interface Props {
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteContactDialog({ contact, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (open) setConfirmText('');
  }, [open]);

  const expected = (contact?.phone ?? '').trim();
  const canConfirm = confirmText.trim() === expected && expected.length > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contact) throw new Error('Sem contato');
      // 1. Deleta mensagens
      const { error: msgErr } = await supabase
        .from('chat_messages')
        .delete()
        .eq('contact_id', contact.id);
      if (msgErr) throw msgErr;
      // 2. Deleta conversas
      const { error: convErr } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('contact_id', contact.id);
      if (convErr) throw convErr;
      // 3. Deleta contato
      const { error: contactErr } = await supabase
        .from('chat_contacts')
        .delete()
        .eq('id', contact.id);
      if (contactErr) throw contactErr;
    },
    onSuccess: () => {
      toast.success('Contato excluído');
      queryClient.invalidateQueries({ queryKey: ['contacts-list'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-counts'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error('Erro ao excluir', { description: e.message }),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir contato</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é irreversível. Todas as mensagens e conversas vinculadas a{' '}
            <strong>{contact?.name}</strong> serão excluídas permanentemente.
            <br />
            <br />
            Para confirmar, digite o telefone do contato:{' '}
            <code className="font-mono text-foreground">{expected}</code>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-phone">Telefone de confirmação</Label>
          <Input
            id="confirm-phone"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm || mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}