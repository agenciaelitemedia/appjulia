import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { useChatAssignedCountsByMember } from '@/hooks/useChatAssignedCountsByMember';
import { Loader2 } from 'lucide-react';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (assignedTo: string, note?: string) => Promise<void>;
}

export function TransferDialog({ open, onOpenChange, onTransfer }: TransferDialogProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: team } = useTeamByClient();
  const { data: assignedCounts } = useChatAssignedCountsByMember();
  const members: TeamMemberOption[] = useMemo(
    () =>
      (team || []).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        photo: m.photo,
      })),
    [team],
  );

  const handleTransfer = async () => {
    if (!selectedMember) return;
    setIsTransferring(true);
    try {
      await onTransfer(selectedMember, note || undefined);
      onOpenChange(false);
      setSelectedMember(null);
      setNote('');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <DialogDescription>
            Selecione o agente/atendente para transferir esta conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Transferir para</Label>
            <TeamMemberSelect
              members={members}
              value={selectedMember}
              onValueChange={setSelectedMember}
              valueKey="name"
              allowUnassigned={false}
              showCurrentUserShortcut
              placeholder="Selecione um membro da equipe…"
              className="w-full"
              memberCounts={assignedCounts}
            />
          </div>

          <div className="space-y-2">
            <Label>Nota de transferência (opcional)</Label>
            <Textarea
              placeholder="Motivo ou contexto da transferência..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedMember || isTransferring}>
            {isTransferring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
