import { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  TeamMemberSelect, useTeamByClient, useChatAssignedCountsByMember,
} from '../extend/ui';
import { useAuth } from '../extend/auth';
import { isOwnerUser } from '../extend/queues';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (assignedTo: string, assignedUserId: number | null) => Promise<void>;
}

/**
 * "Definir Responsável" — mesma lista/busca de equipe do chat principal.
 * Owner do escritório pode escolher qualquer membro; os demais perfis só
 * podem definir a si mesmos.
 */
export function JuliaAssignDialog({ open, onOpenChange, onConfirm }: Props) {
  const { user, isAdmin } = useAuth();
  const { data: team } = useTeamByClient();
  const { data: assignedCounts } = useChatAssignedCountsByMember();
  const canPickAnyone = isAdmin || isOwnerUser(user);
  const currentName = (user as any)?.name ? String((user as any).name) : '';

  const members = useMemo(() => {
    const all = (team || []).map((m: any) => ({
      id: m.id, name: m.name, email: m.email, role: m.role, photo: m.photo,
    }));
    if (canPickAnyone) return all;
    const self = all.filter((m) => m.name === currentName);
    return self.length
      ? self
      : (currentName ? [{ id: String(user?.id ?? ''), name: currentName, email: (user as any)?.email, role: (user as any)?.role, photo: undefined }] : []);
  }, [team, canPickAnyone, currentName, user]);

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const member = members.find((m) => m.name === selected);
      const id = member ? Number(member.id) : NaN;
      await onConfirm(selected, Number.isFinite(id) ? id : null);
      onOpenChange(false);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Definir responsável</DialogTitle>
          <DialogDescription>
            {canPickAnyone
              ? 'Selecione o atendente que ficará responsável por esta conversa.'
              : 'Seu perfil permite definir apenas você como responsável.'}
          </DialogDescription>
        </DialogHeader>

        <TeamMemberSelect
          members={members as any}
          value={selected}
          onValueChange={setSelected}
          valueKey="name"
          allowUnassigned={false}
          showCurrentUserShortcut
          placeholder="Selecione um membro da equipe…"
          className="w-full"
          memberCounts={assignedCounts}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Definir responsável
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
