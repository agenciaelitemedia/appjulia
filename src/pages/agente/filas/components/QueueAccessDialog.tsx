import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X, Plus, ShieldCheck, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { useQueueMembers, useSetQueueMembers } from '@/hooks/useQueueMembers';
import { toast } from 'sonner';

interface Props {
  queueId: string;
  queueName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MemberDraft {
  user_id: number;
  name: string;
  email: string;
  user_role: string;
  role: string; // viewer/agent/manager
}

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Visualizador' },
  { value: 'agent', label: 'Atendente' },
  { value: 'manager', label: 'Supervisor' },
];

export function QueueAccessDialog({ queueId, queueName, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const { data: members = [], isLoading } = useQueueMembers(open ? queueId : null);
  const setMembers = useSetQueueMembers();

  const { data: assignable = [] } = useQuery({
    queryKey: ['assignable-users', clientId],
    queryFn: () => externalDb.listAssignableUsers(clientId),
    enabled: open && !!clientId,
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState<MemberDraft[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(members.map((m) => ({
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        user_role: m.user_role,
        role: m.role,
      })));
    }
  }, [members, open]);

  const candidates = useMemo(() => {
    const inDraft = new Set(draft.map((d) => d.user_id));
    return assignable
      .filter((u) => !inDraft.has(u.id))
      .filter((u) => u.queue_access === 'specific') // só usuários com restrição precisam ser adicionados
      .filter((u) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      });
  }, [assignable, draft, search]);

  const allUsersAccessAll = useMemo(() => {
    const inDraft = new Set(draft.map((d) => d.user_id));
    return assignable.filter((u) => !inDraft.has(u.id) && u.queue_access === 'all');
  }, [assignable, draft]);

  function addMember(u: typeof assignable[0]) {
    setDraft((prev) => [...prev, {
      user_id: u.id, name: u.name, email: u.email, user_role: u.role, role: 'agent',
    }]);
    setSearch('');
  }

  function removeMember(userId: number) {
    setDraft((prev) => prev.filter((d) => d.user_id !== userId));
  }

  function updateRole(userId: number, role: string) {
    setDraft((prev) => prev.map((d) => d.user_id === userId ? { ...d, role } : d));
  }

  async function handleSave() {
    try {
      await setMembers.mutateAsync({
        queueId,
        members: draft.map((d) => ({ user_id: d.user_id, role: d.role })),
      });
      toast.success('Acessos atualizados');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message || 'erro'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Acessos — {queueName}
          </DialogTitle>
          <DialogDescription>
            Defina quais membros operacionais podem ver e atender esta fila.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Buscar usuário pelo nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && candidates.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {candidates.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addMember(u)}
                      className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">{u.role}</Badge>
                        <Plus className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {search && candidates.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">Nenhum resultado</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Membros com acesso ({draft.length})</div>
              {draft.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded">
                  Nenhum membro restrito tem acesso a esta fila.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {draft.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">{m.user_role}</Badge>
                      <Select value={m.role} onValueChange={(v) => updateRole(m.user_id, v)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => removeMember(m.user_id)}
                        className="text-destructive h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {allUsersAccessAll.length > 0 && (
              <div className="text-xs text-muted-foreground rounded border bg-muted/30 p-2 flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {allUsersAccessAll.length} usuário(s) com acesso "todas as filas" enxergam esta automaticamente
                  e não aparecem aqui.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={setMembers.isPending}>
            {setMembers.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
