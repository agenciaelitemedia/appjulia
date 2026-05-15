import { useMemo } from 'react';
import { useTeamMembers } from '../hooks/useEquipeData';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useTeamLastActivity } from '@/hooks/useTeamLastActivity';
import { useTeamDashboardMetrics } from '@/hooks/useTeamDashboardMetrics';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, MessageSquare, KanbanSquare, ListChecks, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function fmt(date: string | null | undefined) {
  if (!date) return null;
  try { return format(new Date(date), "dd/MM 'às' HH:mm", { locale: ptBR }); } catch { return null; }
}
function fmtFull(date: string | null | undefined) {
  if (!date) return '';
  try { return format(new Date(date), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR }); } catch { return ''; }
}

export function EquipeDashboardTab() {
  const { user } = useAuth();
  const { data: members = [], isLoading } = useTeamMembers();

  // Inclui o próprio usuário logado no dashboard
  const allRows = useMemo(() => {
    const list = members.map((m) => ({
      id: Number(m.id),
      name: m.name,
      email: m.email,
      photo: m.photo,
    }));
    if (user?.id) {
      list.unshift({
        id: Number(user.id),
        name: user.name + ' (você)',
        email: user.email,
        photo: user.avatar || null,
      });
    }
    return list;
  }, [members, user]);

  const userIds = useMemo(() => allRows.map((r) => r.id), [allRows]);
  const memberRefs = useMemo(
    () => allRows.map((r) => ({ id: r.id, name: (r.name || '').replace(/\s*\(você\)\s*$/, '') })),
    [allRows],
  );
  const { onlineIds } = useTeamPresence();
  const { data: activity = {} } = useTeamLastActivity(userIds);
  const { data: metrics = {} } = useTeamDashboardMetrics(memberRefs);

  const sorted = useMemo(() => {
    return [...allRows].sort((a, b) => {
      const aOn = onlineIds.has(a.id) ? 0 : 1;
      const bOn = onlineIds.has(b.id) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [allRows, onlineIds]);

  const totals = useMemo(() => {
    let chats = 0, deals = 0, tasks = 0;
    for (const row of sorted) {
      const m = metrics[String(row.id)];
      if (!m) continue;
      chats += m.open_chats; deals += m.open_crm_deals; tasks += m.open_tasks;
    }
    return { chats, deals, tasks, online: sorted.filter((r) => onlineIds.has(r.id)).length, total: sorted.length };
  }, [sorted, metrics, onlineIds]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Totais agregados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={Users} label="Online" value={`${totals.online} / ${totals.total}`} accent="text-emerald-600" />
          <SummaryCard icon={MessageSquare} label="Chats abertos" value={totals.chats} accent="text-blue-600" />
          <SummaryCard icon={KanbanSquare} label="Cards CRM" value={totals.deals} accent="text-violet-600" />
          <SummaryCard icon={ListChecks} label="Tarefas abertas" value={totals.tasks} accent="text-amber-600" />
        </div>

        {/* Tabela */}
        <Card>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead>Último logout</TableHead>
                  <TableHead className="text-center">Chats</TableHead>
                  <TableHead className="text-center">CRM</TableHead>
                  <TableHead className="text-center">Tarefas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum membro encontrado
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((row) => {
                  const online = onlineIds.has(row.id);
                  const act = activity[row.id];
                  const m = metrics[String(row.id)] || { open_chats: 0, open_crm_deals: 0, open_tasks: 0 };
                  const initials = (row.name || '?')
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-9 w-9">
                              {row.photo && <AvatarImage src={row.photo} alt={row.name} />}
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                                online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{row.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{row.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'gap-1.5',
                            online
                              ? 'border-emerald-500/40 text-emerald-700 bg-emerald-500/5'
                              : 'text-muted-foreground',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                          {online ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {act?.last_login_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm">{fmt(act.last_login_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{fmtFull(act.last_login_at)}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {online ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : act?.last_logout_at ? (
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm">{fmt(act.last_logout_at)}</span>
                              </TooltipTrigger>
                              <TooltipContent>{fmtFull(act.last_logout_at)}</TooltipContent>
                            </Tooltip>
                            {act.last_logout_type === 'logout_inactivity' ? (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 bg-amber-500/5">
                                Inatividade
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Manual</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">{m.open_chats}</TableCell>
                      <TableCell className="text-center font-medium">{m.open_crm_deals}</TableCell>
                      <TableCell className="text-center font-medium">{m.open_tasks}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn('h-10 w-10 rounded-lg bg-muted flex items-center justify-center', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
      </div>
    </Card>
  );
}