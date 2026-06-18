import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Clock, MessageSquare, Phone, CheckCircle2, RotateCcw, ArrowRightLeft, ListOrdered } from 'lucide-react';
import { type PerformancePeriod, type PerformanceUserRow } from '../hooks/useTeamPerformance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipProvider as UiTooltipProvider, TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { UserSessionsDialog } from './UserSessionsDialog';
import { UserConversationsDialog } from './UserConversationsDialog';
import { UserCallsDialog } from './UserCallsDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: PerformanceUserRow;
  period: PerformancePeriod;
}

function fmtDuration(s: number): string {
  if (!s || s < 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function fmtShortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '';
  try { return format(new Date(s), "dd/MM 'às' HH:mm", { locale: ptBR }); } catch { return ''; }
}

export function EquipePerformanceDrawer({ open, onOpenChange, user, period }: Props) {
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);

  // Time distribution donut
  const timeData = [
    { name: 'Talk time', value: user.talk_seconds, color: 'hsl(220 70% 55%)' },
    { name: 'Outro tempo logado', value: Math.max(0, user.worked_seconds - user.talk_seconds), color: 'hsl(var(--muted))' },
  ].filter((x) => x.value > 0);

  const initials = user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {user.photo && <AvatarImage src={user.photo} alt={user.name} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div>{user.name}</div>
              <div className="text-xs font-normal text-muted-foreground">
                Período: {period.startDate} → {period.endDate}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-2">
            <MiniKpi
              icon={Clock}
              label="Tempo online"
              value={fmtDuration(user.worked_seconds)}
              sub={`${user.sessions_count} sessões`}
              action={
                <UiTooltipProvider delayDuration={150}>
                  <UiTooltip>
                    <UiTooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSessionsOpen(true)}
                        aria-label="Ver sessões"
                      >
                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </UiTooltipTrigger>
                    <UiTooltipContent>Ver sessões reais e eventos de login/logout do período</UiTooltipContent>
                  </UiTooltip>
                </UiTooltipProvider>
              }
            />
            <MiniKpi
              icon={MessageSquare}
              label="Atendimentos"
              value={user.received}
              sub={`${user.resolution_rate}% resolvidos`}
              action={
                <UiTooltipProvider delayDuration={150}>
                  <UiTooltip>
                    <UiTooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setConvOpen(true)}
                        aria-label="Ver atendimentos"
                      >
                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </UiTooltipTrigger>
                    <UiTooltipContent>Ver atendimentos do período</UiTooltipContent>
                  </UiTooltip>
                </UiTooltipProvider>
              }
            />
            <MiniKpi
              icon={Phone}
              label="Ligações"
              value={user.calls_total}
              sub={`${user.calls_answered} atendidas`}
              action={
                <UiTooltipProvider delayDuration={150}>
                  <UiTooltip>
                    <UiTooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setCallsOpen(true)}
                        aria-label="Ver ligações"
                      >
                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </UiTooltipTrigger>
                    <UiTooltipContent>Ver ligações do período</UiTooltipContent>
                  </UiTooltip>
                </UiTooltipProvider>
              }
            />
            <MiniKpi icon={CheckCircle2} label="Talk time" value={fmtDuration(user.talk_seconds)} sub={`Ocupação ${user.occupancy_pct}%`} />
          </div>

          {/* Desfechos */}
          <Card className="p-3">
            <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Desfechos no período</div>
            <div className="grid grid-cols-3 gap-3">
              <OutcomeBox icon={CheckCircle2} label="Resolvidas" value={user.resolved} color="text-emerald-600" />
              <OutcomeBox icon={RotateCcw} label="Devolvidas" value={user.returned} color="text-amber-600" />
              <OutcomeBox icon={ArrowRightLeft} label="Transferidas" value={user.transferred} color="text-blue-600" />
            </div>
            {user.avg_handle_seconds !== null && (
              <div className="text-xs text-muted-foreground mt-2">
                Tempo médio de atendimento: <span className="font-medium text-foreground">{fmtDuration(user.avg_handle_seconds)}</span>
              </div>
            )}
          </Card>

          {/* Por dia */}
          <Card className="p-3">
            <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Por dia</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={user.byDay.map((d) => ({ ...d, day: fmtShortDate(d.day), hours: +(d.worked_seconds / 3600).toFixed(1) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="resolved" name="Resolv." stackId="a" fill="hsl(160 60% 45%)" />
                  <Bar dataKey="returned" name="Devol." stackId="a" fill="hsl(35 90% 55%)" />
                  <Bar dataKey="transferred" name="Transf." stackId="a" fill="hsl(220 70% 55%)" />
                  <Bar dataKey="calls_total" name="Ligações" fill="hsl(280 60% 55%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Distribuição de tempo */}
          {timeData.length > 0 && (
            <Card className="p-3">
              <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Distribuição do tempo logado</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={timeData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                      {timeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtDuration(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>

        <UserSessionsDialog
          open={sessionsOpen}
          onOpenChange={setSessionsOpen}
          userId={user.user_id}
          userName={user.name}
          period={period}
        />
        <UserConversationsDialog
          open={convOpen}
          onOpenChange={setConvOpen}
          userId={user.user_id}
          userName={user.name}
          period={period}
        />
        <UserCallsDialog
          open={callsOpen}
          onOpenChange={setCallsOpen}
          userId={user.user_id}
          userName={user.name}
          period={period}
        />
      </SheetContent>
    </Sheet>
  );
}

function MiniKpi({ icon: Icon, label, value, sub, action }: { icon: any; label: string; value: any; sub?: string; action?: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </Card>
  );
}

function OutcomeBox({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-2 rounded bg-muted/30">
      <Icon className={`h-4 w-4 mb-1 ${color}`} />
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}