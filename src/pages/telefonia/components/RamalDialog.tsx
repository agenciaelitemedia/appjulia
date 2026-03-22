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
}

export function RamalDialog({ open, onOpenChange, extension, onSave }: RamalDialogProps) {
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [memberId, setMemberId] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (extension) {
      setNumber(extension.extension_number);
      setLabel(extension.label || '');
      setMemberId(extension.assigned_member_id ? String(extension.assigned_member_id) : '');
      setIsActive(extension.is_active);
    } else {
      setNumber('');
      setLabel('');
      setMemberId('');
      setIsActive(true);
    }
  }, [extension, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{extension ? 'Editar Ramal' : 'Novo Ramal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Número do Ramal</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex: 1001" />
          </div>
          <div>
            <Label>Nome/Apelido</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Recepção" />
          </div>
          <div>
            <Label>ID do Membro (equipe)</Label>
            <Input value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Opcional" type="number" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              extension_number: number,
              label: label || null,
              assigned_member_id: memberId ? Number(memberId) : null,
              is_active: isActive,
            })}
            disabled={!number}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
