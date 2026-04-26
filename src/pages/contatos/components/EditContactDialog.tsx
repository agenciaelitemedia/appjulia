import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { normalizeBrPhone } from '@/lib/phoneNormalize';
import type { ContactRow } from '../hooks/useContactsList';

interface Props {
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditContactDialog({ contact, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    if (contact) {
      setName(contact.name ?? '');
      setPhone(contact.phone ?? '');
      setAvatar(contact.avatar ?? '');
    }
  }, [contact]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contact) throw new Error('Sem contato');
      const { error } = await supabase
        .from('chat_contacts')
        .update({
          name: name.trim() || contact.phone,
          phone: normalizeBrPhone(phone.trim()) || phone.trim(),
          avatar: avatar.trim() || null,
        })
        .eq('id', contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contato atualizado');
      queryClient.invalidateQueries({ queryKey: ['contacts-list'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error('Erro ao atualizar', { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>Atualize as informações do contato.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefone</Label>
            <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-avatar">URL do Avatar</Label>
            <Input id="edit-avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}