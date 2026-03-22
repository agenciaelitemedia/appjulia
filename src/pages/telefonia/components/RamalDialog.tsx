import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';
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
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-for-ramal', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return externalDb.getTeamMembers(user.id, user.role === 'admin');
    },
    enabled: !!user?.id && open,
  });

  // IDs of members already assigned to an extension (exclude current extension when editing)
  const assignedMemberIds = new Set(
    existingExtensions
      .filter(e => e.assigned_member_id != null && (!extension || e.id !== extension.id))
      .map(e => Number(e.assigned_member_id))
  );

  // Build options: self first, then team members — filter out already assigned (Number() normalization)
  const memberOptions: TeamMemberOption[] = [
    ...(user && !assignedMemberIds.has(Number(user.id)) ? [{ id: Number(user.id), name: user.name, email: user.email, isSelf: true }] : []),
    ...teamMembers
      .filter((m: any) => Number(m.id) !== Number(user?.id) && !assignedMemberIds.has(Number(m.id)))
      .map((m: any) => ({ id: Number(m.id), name: m.name, email: m.email, isSelf: false })),
  ];

  useEffect(() => {
    if (extension) {
      setLabel(extension.label || '');
      setSelectedMemberId(extension.assigned_member_id ? String(extension.assigned_member_id) : '');
      setIsActive(extension.is_active);
    } else {
      setLabel('');
      setSelectedMemberId(user ? String(user.id) : '');
      setIsActive(true);
    }
  }, [extension, open, user]);

  const isEditing = !!extension;

  const selectedMember = memberOptions.find(m => String(m.id) === selectedMemberId);

  // Auto-fill label when selecting a member (only on create)
  const handleMemberChange = (value: string) => {
    setSelectedMemberId(value);
    if (!isEditing) {
      const member = memberOptions.find(m => String(m.id) === value);
      if (member) {
        setLabel(member.name);
      }
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
            <Label>Vincular a</Label>
            <Select value={selectedMemberId} onValueChange={handleMemberChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {memberOptions.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      {m.isSelf && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Você</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
