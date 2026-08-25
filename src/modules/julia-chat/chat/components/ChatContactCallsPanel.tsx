import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Play, CircleX, PhoneIncoming, PhoneOutgoing, User, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { RecordingPlayer } from '@/pages/wavoip/components/RecordingPlayer';
import {
  useContactVoipCalls,
  useContactZapCalls,
  useExtensionOwners,
  type ContactVoipCall,
  type ContactZapCall,
} from '@/hooks/useContactCallHistory';

function durationLabel(seconds?: number | null) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s === 0) return '0min 00s';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}min ${String(r).padStart(2, '0')}s`;
}

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy HH:mm');
}

function DirectionIcon({ direction }: { direction?: string | null }) {
  const inbound = direction === 'inbound' || direction === 'in';
  return inbound ? (
    <PhoneIncoming className="h-3 w-3 text-blue-600" />
  ) : (
    <PhoneOutgoing className="h-3 w-3 text-emerald-600" />
  );
}

const VOIP_STATUS_LABELS: Record<string, string> = {
  NORMAL_CLEARING: 'Atendida',
  ANSWER: 'Atendida',
  ANSWERED: 'Atendida',
  BUSY: 'Ocupado',
  USER_BUSY: 'Ocupado',
  NO_ANSWER: 'Não atendeu',
  CANCEL: 'Cancelada',
  CANCELLED: 'Cancelada',
  NUMBER_CHANGED: 'Número alterado',
  UNALLOCATED_NUMBER: 'Número inexistente',
  NO_ROUTE_DESTINATION: 'Sem rota',
  CALL_REJECTED: 'Rejeitada',
  INVALID_NUMBER_FORMAT: 'Número inválido',
  DESTINATION_OUT_OF_ORDER: 'Destino indisponível',
  ORIGINATOR_CANCEL: 'Cancelada pelo originador',
  LOSE_RACE: 'Conflito de rota',
  PROGRESS_TIMEOUT: 'Tempo esgotado',
};

function friendlyStatus(status?: string | null) {
  if (!status) return 'Concluída';
  return VOIP_STATUS_LABELS[status.toUpperCase()] || status.replace(/_/g, ' ');
}

function VoipRecording({ url, durationSeconds = 0 }: { url: string | null; durationSeconds?: number }) {
  const [open, setOpen] = useState(false);
  const hasAudio = !!url && durationSeconds > 0;

  if (!hasAudio) {
    const reason = !url
      ? 'Não há gravação disponível para esta ligação.'
      : 'Ligação não foi atendida ou durou 0 segundos, por isso não há áudio.';
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon" disabled className="h-7 w-7 text-muted-foreground">
                <CircleX className="h-3.5 w-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="max-w-[200px] text-xs">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Ouvir gravação">
          <Play className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Gravação VoIP</div>
          <audio src={url} controls className="w-full" />
          <a href={url} download className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Download className="h-3 w-3" /> Baixar
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  direction,
  when,
  who,
  status,
  duration,
  action,
}: {
  direction?: string | null;
  when: string;
  who: string;
  status: string;
  duration: string;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <DirectionIcon direction={direction} />
          <span>{when}</span>
        </div>
        <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
          <User className="h-3 w-3" />
          {who}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {status}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{duration}</span>
        </div>
        {action}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-xs text-muted-foreground">{label}</div>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

/**
 * Aba "Telefonia" da right-bar do chat: histórico de ligações do contato,
 * separado em VoIP (SIP) e ZAP Call (Wavoip).
 */
export function ChatContactCallsPanel({ phone, contactId }: { phone: string | null; contactId?: string | null }) {
  const { user } = useAuth();
  const clientId = user?.client_id ? Number(user.client_id) : null;

  const { data: voip = [], isLoading: voipLoading } = useContactVoipCalls(clientId, phone, contactId);
  const { data: zap = [], isLoading: zapLoading } = useContactZapCalls(clientId, phone, contactId);

  const { data: extOwners = {} } = useExtensionOwners(clientId);
  const { data: team = [] } = useTeamByClient();

  const teamNames = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of team as any[]) map[Number(m.id)] = m.name;
    return map;
  }, [team]);

  const voipWho = (c: ContactVoipCall) => {
    const memberId = c.extension_number ? extOwners[String(c.extension_number)] : null;
    if (memberId != null && teamNames[Number(memberId)]) return teamNames[Number(memberId)];
    return c.extension_number ? `Ramal ${c.extension_number}` : '—';
  };

  const zapWho = (c: ContactZapCall) =>
    c.app_user_id != null ? teamNames[Number(c.app_user_id)] ?? `#${c.app_user_id}` : '—';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pt-3">
        <p className="text-xs text-muted-foreground">
          Veja todo o histórico de ligações feitas para este contato.
        </p>
      </div>

      <div className="mt-4 flex-1 min-h-0 px-3 pb-3">
        <Tabs defaultValue="voip" className="flex h-full min-h-0 flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="voip" className="text-xs">
              Voip Call
            </TabsTrigger>
            <TabsTrigger value="zap" className="text-xs">
              ZAP Call
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voip" className="mt-2 flex-1 min-h-0">
            <ScrollArea className="h-full pr-2">
              {voipLoading ? (
                <Loading />
              ) : voip.length === 0 ? (
                <Empty label="Nenhuma ligação VoIP registrada para este contato." />
              ) : (
                <div className="space-y-1.5">
                  {voip.map((c) => (
                    <Row
                      key={c.id}
                      direction={c.direction}
                      when={dateLabel(c.started_at ?? c.created_at)}
                      who={voipWho(c)}
                      status={friendlyStatus(c.hangup_cause)}
                      duration={durationLabel(c.duration_seconds)}
                      action={<VoipRecording url={c.record_url} durationSeconds={c.duration_seconds} />}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="zap" className="mt-2 flex-1 min-h-0">
            <ScrollArea className="h-full pr-2">
              {zapLoading ? (
                <Loading />
              ) : zap.length === 0 ? (
                <Empty label="Nenhuma ligação ZAP Call registrada para este contato." />
              ) : (
                <div className="space-y-1.5">
                  {zap.map((c) => (
                    <Row
                      key={c.id}
                      direction={c.direction}
                      when={dateLabel(c.started_at ?? c.created_at)}
                      who={zapWho(c)}
                      status={c.status || c.end_reason || '—'}
                      duration={durationLabel(c.duration_seconds)}
                      action={
                        <RecordingPlayer
                          callId={c.id}
                          whatsappCallId={c.whatsapp_call_id}
                          recordingPath={c.recording_url}
                          status={c.recording_status}
                          durationSeconds={c.duration_seconds}
                        />
                      }
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
