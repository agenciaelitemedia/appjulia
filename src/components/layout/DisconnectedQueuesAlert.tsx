import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useQueues, type Queue } from '@/pages/agente/filas/hooks/useQueues';
import { supabase } from '@/integrations/supabase/client';

const LOGIN_FLAG = 'julia_just_logged_in';

async function checkQueueConnected(queue: Queue): Promise<boolean | null> {
  try {
    if (queue.channel_type === 'uazapi' && queue.evo_instance) {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'status', queue_id: queue.id },
      });
      if (error || !data?.data) return false;
      const inst = data.data.instance || data.data;
      const status = data.data.status || data.data;
      return status?.connected === true || inst?.status === 'open';
    }
    if (queue.channel_type === 'waba' && queue.waba_token && queue.waba_number_id) {
      // Se tem credenciais salvas, considera conectada
      return true;
    }
    return null;
  } catch {
    return false;
  }
}

export function DisconnectedQueuesAlert() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { data: queues } = useQueues(false);
  const [open, setOpen] = useState(false);
  const [disconnected, setDisconnected] = useState<Queue[]>([]);

  // Apenas filas ativas, não excluídas, com canal verificável
  const checkable: Queue[] = (queues || []).filter(
    q => q.is_active && !q.is_deleted && (
      (q.channel_type === 'uazapi' && !!q.evo_instance) ||
      (q.channel_type === 'waba' && !!q.waba_token && !!q.waba_number_id)
    )
  );

  const queries = useQueries({
    queries: checkable.map(queue => ({
      queryKey: ['login-queue-conn-check', queue.id, queue.channel_type, queue.evo_instance, queue.waba_number_id],
      queryFn: async () => ({ queue, connected: await checkQueueConnected(queue) }),
      staleTime: 60_000,
      retry: 0,
      enabled: isAuthenticated && checkable.length > 0,
    })),
  });

  const allDone = queries.length > 0 && queries.every(q => !q.isLoading);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !allDone || handledRef.current) return;
    if (sessionStorage.getItem(LOGIN_FLAG) !== '1') return;

    const off = queries
      .map(q => q.data)
      .filter((d): d is { queue: Queue; connected: boolean | null } => !!d && d.connected === false)
      .map(d => d.queue);

    handledRef.current = true;
    // Não removemos LOGIN_FLAG aqui — DisconnectedAgentsAlert é responsável por isso

    if (off.length > 0) {
      setDisconnected(off);
      setOpen(true);
    }
  }, [allDone, isAuthenticated, user?.id, queries]);

  if (disconnected.length === 0) return null;

  const channelLabel = (t: string) => t === 'uazapi' ? 'WhatsApp' : t === 'waba' ? 'API Oficial' : t;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            {disconnected.length === 1 ? 'Fila desconectada' : 'Filas desconectadas'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {disconnected.length === 1
              ? 'Uma das suas filas está desconectada e não está recebendo mensagens no momento:'
              : `${disconnected.length} filas estão desconectadas e não estão recebendo mensagens no momento:`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2 max-h-48 overflow-auto rounded-md border p-3 bg-muted/30">
          {disconnected.map(q => (
            <li key={q.id} className="text-sm">
              <span className="font-medium">{q.name}</span>
              <span className="text-muted-foreground"> — {channelLabel(q.channel_type)}</span>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              if (isAdmin) navigate('/agente/filas');
            }}
          >
            {isAdmin ? 'Ver minhas filas' : 'Entendi'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}