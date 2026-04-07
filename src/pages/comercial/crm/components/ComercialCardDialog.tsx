import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { useCreateComercialCard, useUpdateComercialCard, useMoveComercialCard, useDeleteComercialCard } from '../hooks/useCrmComercialData';
import type { ComercialCard, ComercialStage } from '../types';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: ComercialStage[];
  card?: ComercialCard | null;
}

export function ComercialCardDialog({ open, onOpenChange, stages, card }: Props) {
  const isEditing = !!card;
  const createMutation = useCreateComercialCard();
  const updateMutation = useUpdateComercialCard();
  const moveMutation = useMoveComercialCard();
  const deleteMutation = useDeleteComercialCard();

  const [form, setForm] = useState({
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    company_name: '',
    notes: '',
    value: '',
    stage_id: stages[0]?.id?.toString() || '',
  });

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmPhone, setDeleteConfirmPhone] = useState('');
  const [deleteConfirmSwitch, setDeleteConfirmSwitch] = useState(false);

  useEffect(() => {
    if (open) {
      if (card) {
        setForm({
          contact_name: card.contact_name || '',
          contact_phone: card.contact_phone || '',
          contact_email: card.contact_email || '',
          company_name: card.company_name || '',
          notes: card.notes || '',
          value: card.value ? String(card.value) : '',
          stage_id: String(card.stage_id),
        });
      } else {
        setForm({
          contact_name: '',
          contact_phone: '',
          contact_email: '',
          company_name: '',
          notes: '',
          value: '',
          stage_id: stages[0]?.id?.toString() || '',
        });
      }
      // Reset delete state
      setDeleteDialogOpen(false);
      setDeleteConfirmPhone('');
      setDeleteConfirmSwitch(false);
    }
  }, [open, card, stages]);

  const handleSave = async () => {
    if (!form.contact_name.trim()) {
      toast.error('Nome do contato é obrigatório');
      return;
    }

    const stageId = Number(form.stage_id);
    const value = form.value ? Number(form.value) : 0;

    try {
      if (isEditing && card) {
        await updateMutation.mutateAsync({
          id: card.id,
          contact_name: form.contact_name,
          contact_phone: form.contact_phone || undefined,
          contact_email: form.contact_email || undefined,
          company_name: form.company_name || undefined,
          notes: form.notes || undefined,
          value,
        });

        if (stageId !== card.stage_id) {
          await moveMutation.mutateAsync({
            cardId: card.id,
            fromStageId: card.stage_id,
            toStageId: stageId,
          });
        }

        toast.success('Card atualizado com sucesso');
      } else {
        await createMutation.mutateAsync({
          stage_id: stageId,
          contact_name: form.contact_name,
          contact_phone: form.contact_phone || undefined,
          contact_email: form.contact_email || undefined,
          company_name: form.company_name || undefined,
          notes: form.notes || undefined,
          value,
        });
        toast.success('Card criado com sucesso');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    try {
      await deleteMutation.mutateAsync(card.id);
      toast.success('Card excluído com sucesso');
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const expectedPhone = card?.contact_phone || card?.contact_name || '';
  const canDelete = deleteConfirmPhone === expectedPhone && deleteConfirmSwitch;

  const isLoading = createMutation.isPending || updateMutation.isPending || moveMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Card' : 'Novo Card'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome do Contato *</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Nome completo" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="email@example.com" type="email" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Empresa</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Nome da empresa" />
              </div>
              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0.00" type="number" step="0.01" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Etapa</Label>
              <Select value={form.stage_id} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas sobre este lead..." rows={3} />
            </div>
          </div>

          <DialogFooter className="flex !justify-between">
            {isEditing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="mr-auto gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Card</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Esta ação é irreversível. Para confirmar, digite o número/nome abaixo:</p>
              <p className="font-mono font-semibold text-foreground bg-muted px-3 py-1.5 rounded text-center">
                {expectedPhone}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Digite para confirmar</Label>
              <Input
                value={deleteConfirmPhone}
                onChange={(e) => setDeleteConfirmPhone(e.target.value)}
                placeholder={expectedPhone}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="delete-confirm-switch" className="text-sm cursor-pointer">
                Confirmo que desejo excluir este card permanentemente
              </Label>
              <Switch
                id="delete-confirm-switch"
                checked={deleteConfirmSwitch}
                onCheckedChange={setDeleteConfirmSwitch}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmPhone('');
              setDeleteConfirmSwitch(false);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
