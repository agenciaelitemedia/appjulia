import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageSquare, Phone, Globe, Instagram, MoreVertical, Pencil, Trash2, RotateCcw, WifiOff, ShieldCheck, Brain, Copy, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Queue } from '../hooks/useQueues';
import { useQueueMutations } from '../hooks/useQueues';
import { useClientAutomationFlags } from '@/hooks/useClientAutomationFlags';
import { UazapiInstanceStatus } from './UazapiInstanceStatus';
import { DisconnectWabaDialog } from './DisconnectWabaDialog';
import { QueueAccessDialog } from './QueueAccessDialog';
import { useAuth } from '@/contexts/AuthContext';

const DELETE_ALLOWED_ROLES = ['admin', 'colaborador', 'user'] as const;

const channelIcons: Record<string, React.ReactNode> = {
  uazapi: <Phone className="w-4 h-4" />,
  waba: <MessageSquare className="w-4 h-4" />,
  webchat: <Globe className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
};

const channelLabels: Record<string, string> = {
  uazapi: 'UaZapi',
  waba: 'API Oficial (WABA)',
  webchat: 'WebChat',
  instagram: 'Instagram',
};

const channelBadgeLabels: Record<string, string> = {
  uazapi: 'UaZapi',
  waba: 'API Oficial',
  webchat: 'WebChat',
  instagram: 'Instagram',
};

interface QueueCardProps {
  queue: Queue;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
  onRestore: (queue: Queue) => void;
}

export function QueueCard({ queue, onEdit, onDelete, onRestore }: QueueCardProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const { user } = useAuth();
  const canDelete = !!user?.role && (DELETE_ALLOWED_ROLES as readonly string[]).includes(user.role);
  const hasWabaCreds = queue.channel_type === 'waba' && !!queue.waba_token;
  const { flags: clientFlags } = useClientAutomationFlags();
  const { updateQueue } = useQueueMutations();
  const qs = (queue.settings ?? {}) as Record<string, unknown>;
  const qAutoTranscribe = qs.auto_transcribe_audio === true;
  const qAutoResolve = qs.auto_summary_on_resolve === true;
  const qAutoClose = qs.auto_summary_on_close === true;
  const anyMasterOn =
    clientFlags.autoTranscribeAudio ||
    clientFlags.autoSummaryOnResolve ||
    clientFlags.autoSummaryOnClose;

  const toggleQueueFlag = (key: string, value: boolean) => {
    const nextSettings = { ...qs, [key]: value };
    updateQueue.mutate({ queue_id: queue.id, settings: nextSettings } as never);
  };

  const channelBadgeClass =
    queue.channel_type === 'waba'
      ? 'border-blue-500/40 text-blue-700 dark:text-blue-300'
      : queue.channel_type === 'uazapi'
        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
        : '';

  const identifierLabel =
    queue.channel_type === 'uazapi'
      ? queue.evo_instance
      : queue.channel_type === 'waba'
        ? queue.waba_number_id
        : null;
  const identifierPrefix = queue.channel_type === 'uazapi' ? 'Instância' : 'ID';

  return (
    <Card className={`hover:shadow-md transition-shadow ${queue.is_deleted ? 'opacity-60 border-dashed' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{queue.name}</h3>
              <Badge variant={queue.is_active && !queue.is_deleted ? 'default' : 'secondary'}>
                {queue.is_deleted ? 'Excluída' : queue.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">ID: {queue.id}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!queue.is_deleted && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(queue)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAccessOpen(true)}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Acessos
                  </DropdownMenuItem>
                  {canDelete && (
                    <DropdownMenuItem onClick={() => onDelete(queue)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {queue.is_deleted && (
                <DropdownMenuItem onClick={() => onRestore(queue)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${channelBadgeClass}`}>
            {channelIcons[queue.channel_type] || <MessageSquare className="w-3 h-3" />}
            {channelBadgeLabels[queue.channel_type] || channelLabels[queue.channel_type] || queue.channel_type}
          </Badge>
          {queue.phone_number ? (
            <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
              <Phone className="w-3 h-3" />
              +{queue.phone_number}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Número não resolvido</p>
          )}
        </div>

        {identifierLabel && (
          <p className="text-[10px] text-muted-foreground truncate mb-1">
            {identifierPrefix}: {identifierLabel}
          </p>
        )}

        {queue.channel_type === 'uazapi' && queue.evo_instance && !queue.is_deleted && (
          <UazapiInstanceStatus
            queueId={queue.id}
            queueName={queue.name}
          />
        )}

        {hasWabaCreds && !queue.is_deleted && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => setDisconnectOpen(true)}
            >
              <WifiOff className="w-3 h-3 mr-1" />
              Desconectar
            </Button>
          </div>
        )}

        {anyMasterOn && !queue.is_deleted && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Brain className="h-3.5 w-3.5 text-primary" />
              Inteligência de Atendimento
            </div>
            {clientFlags.autoTranscribeAudio && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal text-muted-foreground">
                  Transcrição automática de áudios
                </Label>
                <Switch
                  checked={qAutoTranscribe}
                  disabled={updateQueue.isPending}
                  onCheckedChange={(v) => toggleQueueFlag('auto_transcribe_audio', v)}
                />
              </div>
            )}
            {clientFlags.autoSummaryOnResolve && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal text-muted-foreground">
                  Auto-resumo ao resolver
                </Label>
                <Switch
                  checked={qAutoResolve}
                  disabled={updateQueue.isPending}
                  onCheckedChange={(v) => toggleQueueFlag('auto_summary_on_resolve', v)}
                />
              </div>
            )}
            {clientFlags.autoSummaryOnClose && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal text-muted-foreground">
                  Auto-resumo ao fechar
                </Label>
                <Switch
                  checked={qAutoClose}
                  disabled={updateQueue.isPending}
                  onCheckedChange={(v) => toggleQueueFlag('auto_summary_on_close', v)}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>

      {hasWabaCreds && (
        <DisconnectWabaDialog
          queue={queue}
          open={disconnectOpen}
          onOpenChange={setDisconnectOpen}
        />
      )}

      <QueueAccessDialog
        queueId={queue.id}
        queueName={queue.name}
        open={accessOpen}
        onOpenChange={setAccessOpen}
      />
    </Card>
  );
}
