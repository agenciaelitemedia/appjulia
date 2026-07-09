import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users2 } from 'lucide-react';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { useWavoipDeviceMembers, useToggleWavoipDeviceMember } from '../hooks/useWavoipDeviceMembers';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deviceId: string | null;
  deviceName: string;
  ownerUserId: number | null;
  currentUserId: number | null;
}

export function ShareDeviceDialog({ open, onOpenChange, deviceId, deviceName, ownerUserId, currentUserId }: Props) {
  const { data: team = [], isLoading: loadingTeam } = useTeamByClient();
  const { data: members = [], isLoading: loadingMembers } = useWavoipDeviceMembers(deviceId);
  const toggle = useToggleWavoipDeviceMember(deviceId ?? '');

  const memberIds = useMemo(() => new Set(members.map((m) => m.app_user_id)), [members]);

  const eligible = useMemo(
    () => team.filter((m) => Number(m.id) !== ownerUserId && Number(m.id) !== currentUserId),
    [team, ownerUserId, currentUserId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" /> Liberar acesso ao dispositivo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deviceName}</span> — selecione quais membros da sua equipe poderão usar este dispositivo Wavoip.
          </div>
          <div className="text-xs text-muted-foreground">
            {memberIds.size} membro(s) com acesso além de você.
          </div>

          <div className="max-h-[360px] overflow-y-auto border rounded-md divide-y">
            {(loadingTeam || loadingMembers) && (
              <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando equipe…
              </div>
            )}
            {!loadingTeam && eligible.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nenhum outro membro na sua equipe.
              </div>
            )}
            {eligible.map((m) => {
              const memberId = Number(m.id);
              const enabled = memberIds.has(memberId);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      {m.photo && <AvatarImage src={m.photo} alt={m.name} />}
                      <AvatarFallback className="text-xs">
                        {m.name?.slice(0, 2).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={toggle.isPending}
                    onCheckedChange={(v) => toggle.mutate({ userId: memberId, grant: v })}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}