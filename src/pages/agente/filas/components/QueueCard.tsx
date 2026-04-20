import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageSquare, Phone, Globe, Instagram, MoreVertical, Pencil, Trash2, RotateCcw, Webhook, Loader2, Unplug } from 'lucide-react';
import { Queue } from '../hooks/useQueues';
import { UazapiInstanceStatus } from './UazapiInstanceStatus';
import { DisconnectWabaDialog } from './DisconnectWabaDialog';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface QueueCardProps {
  queue: Queue;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
  onRestore: (queue: Queue) => void;
}

export function QueueCard({ queue, onEdit, onDelete, onRestore }: QueueCardProps) {
  const [reconfiguring, setReconfiguring] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const hasWabaCreds = queue.channel_type === 'waba' && !!queue.waba_token;

  const handleReconfigureWebhook = async () => {
    setReconfiguring(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'reconfigure_webhook', queue_id: queue.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao reconfigurar');
      toast.success('Webhook reconfigurado com todos os eventos');
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setReconfiguring(false);
    }
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${queue.is_deleted ? 'opacity-60 border-dashed' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {channelIcons[queue.channel_type] || <MessageSquare className="w-4 h-4" />}
            <Badge variant={queue.is_active && !queue.is_deleted ? 'default' : 'secondary'}>
              {queue.is_deleted ? 'Excluída' : queue.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!queue.is_deleted && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(queue)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  {queue.channel_type === 'uazapi' && queue.evo_instance && (
                    <DropdownMenuItem onClick={handleReconfigureWebhook} disabled={reconfiguring}>
                      {reconfiguring ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Webhook className="mr-2 h-4 w-4" />
                      )}
                      Reconfigurar webhook
                    </DropdownMenuItem>
                  )}
                  {hasWabaCreds && (
                    <DropdownMenuItem
                      onClick={() => setDisconnectOpen(true)}
                      className="text-destructive"
                    >
                      <Unplug className="mr-2 h-4 w-4" /> Desconectar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDelete(queue)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
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

        <h3 className="font-semibold text-foreground truncate mb-1">{queue.name}</h3>
        <p className="text-xs text-muted-foreground mb-1">
          {channelLabels[queue.channel_type] || queue.channel_type}
        </p>

        {queue.channel_type === 'uazapi' && queue.evo_instance && (
          <p className="text-xs text-muted-foreground truncate mb-1">
            Instância: {queue.evo_instance}
          </p>
        )}
        {queue.channel_type === 'waba' && queue.waba_number_id && (
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-700 dark:text-blue-300">
              API Oficial
            </Badge>
            <p className="text-xs text-muted-foreground truncate">ID: {queue.waba_number_id}</p>
          </div>
        )}

        {queue.channel_type === 'uazapi' && queue.evo_instance && !queue.is_deleted && (
          <UazapiInstanceStatus
            queueId={queue.id}
            queueName={queue.name}
          />
        )}
      </CardContent>

      {hasWabaCreds && (
        <DisconnectWabaDialog
          queue={queue}
          open={disconnectOpen}
          onOpenChange={setDisconnectOpen}
        />
      )}
    </Card>
  );
}
