import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PhoneExtension } from '../types';

interface RamalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extension: PhoneExtension | null;
  onSave: (ext: Partial<PhoneExtension>) => void;
  isCreating?: boolean;
}

export function RamalDialog({ open, onOpenChange, extension, onSave, isCreating }: RamalDialogProps) {
  const [label, setLabel] = useState('');
  const [memberId, setMemberId] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (extension) {
      setLabel(extension.label || '');
      setMemberId(extension.assigned_member_id ? String(extension.assigned_member_id) : '');
      setIsActive(extension.is_active);
    } else {
      setLabel('');
      setMemberId('');
      setIsActive(true);
    }
  }, [extension, open]);

  const isEditing = !!extension;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Ramal' : 'Novo Ramal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isEditing && (
            <div className="space-y-2">
              <div>
                <Label className="text-muted-foreground text-xs">Ramal Local</Label>
                <p className="font-mono font-bold">{extension.extension_number}</p>
              </div>
              {extension.api4com_ramal && (
                <div>
                  <Label className="text-muted-foreground text-xs">Ramal Api4Com</Label>
                  <p className="font-mono text-sm">{extension.api4com_ramal}</p>
                </div>
              )}
            </div>
          )}
          {!isEditing && (
            <p className="text-sm text-muted-foreground">
              O número do ramal será atribuído automaticamente pela Api4Com.
            </p>
          )}
          <div>
            <Label>Nome/Apelido</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Recepção" />
          </div>
          <div>
            <Label>ID do Membro (equipe)</Label>
            <Input value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Opcional" type="number" />
          </div>
          {isEditing && (
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              label: label || null,
              assigned_member_id: memberId ? Number(memberId) : null,
              is_active: isActive,
            })}
            disabled={isCreating}
          >
            {isCreating ? 'Criando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
