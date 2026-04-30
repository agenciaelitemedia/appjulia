import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import type { PhoneExtension } from '../types';

interface RamalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extension: PhoneExtension | null;
  onSave: (ext: Partial<PhoneExtension> & { email?: string; memberName?: string }) => void;
  isCreating?: boolean;
  codAgent: string;
  existingExtensions?: PhoneExtension[];
}

interface TeamMemberOption {
  id: number;
  name: string;
  email: string;
  isSelf?: boolean;
}

export function RamalDialog({ open, onOpenChange, extension, onSave, isCreating, codAgent, existingExtensions = [] }: RamalDialogProps) {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  // Carrega membros da equipe do mesmo client_id (mesmo padrão do TransferDialog/CRM)
  const { data: team = [] } = useTeamByClient();

  // IDs já atribuídos a outros ramais (exclui o ramal em edição)
  const assignedMemberIds = useMemo(() => new Set(
    existingExtensions
      .filter(e => e.assigned_member_id != null && (!extension || e.id !== extension.id))
      .map(e => Number(e.assigned_member_id))
  ), [existingExtensions, extension]);

  // Monta opções: garante que o próprio usuário esteja presente, remove já atribuídos
  const memberOptions: TeamMemberOption[] = useMemo(() => {
    const map = new Map<number, TeamMemberOption>();
    // Próprio usuário primeiro
    if (user?.id != null) {
      map.set(Number(user.id), {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        photo: (user as any).photo ?? null,
      });
    }
    for (const m of team) {
      const idNum = Number(m.id);
      if (!map.has(idNum)) {
        map.set(idNum, {
          id: idNum,
          name: m.name,
          email: m.email,
          role: m.role,
          photo: m.photo,
        });
      }
    }
    // Ao editar, manter o membro vinculado mesmo se "já atribuído"
    const editingId = extension?.assigned_member_id != null ? Number(extension.assigned_member_id) : null;
    return Array.from(map.values()).filter(m => {
      const idNum = Number(m.id);
      if (editingId != null && idNum === editingId) return true;
      return !assignedMemberIds.has(idNum);
    });
  }, [team, user, assignedMemberIds, extension]);

  useEffect(() => {
    if (extension) {
      setLabel(extension.label || '');
      setSelectedMemberId(extension.assigned_member_id ? String(extension.assigned_member_id) : null);
      setIsActive(extension.is_active);
    } else {
      setLabel('');
      setSelectedMemberId(user ? String(user.id) : null);
      setIsActive(true);
    }
  }, [extension, open, user]);

  const isEditing = !!extension;

  const selectedMember = memberOptions.find(m => String(m.id) === selectedMemberId);

  // Auto-fill label when selecting a member (only on create)
  const handleMemberChange = (value: string | null) => {
    setSelectedMemberId(value);
    if (!isEditing && value) {
      const member = memberOptions.find(m => String(m.id) === value);
      if (member) setLabel(member.name);
    }
  };

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
                  <Label className="text-muted-foreground text-xs">Ramal Provedor</Label>
                  <p className="font-mono text-sm">{extension.api4com_ramal}</p>
                </div>
              )}
            </div>
          )}
          {!isEditing && (
            <p className="text-sm text-muted-foreground">
              O número do ramal será atribuído automaticamente pelo provedor.
            </p>
          )}

          <div className="space-y-2">
            <Label>Vincular a</Label>
            <TeamMemberSelect
              members={memberOptions}
              value={selectedMemberId}
              onValueChange={handleMemberChange}
              valueKey="id"
              allowUnassigned={false}
              placeholder="Selecione um membro da equipe…"
              className="w-full"
            />
          </div>

          <div>
            <Label>Nome/Apelido</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Recepção" />
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
              assigned_member_id: selectedMemberId ? Number(selectedMemberId) : null,
              is_active: isActive,
              email: selectedMember?.email || undefined,
              memberName: selectedMember?.name || undefined,
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
