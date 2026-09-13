import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Saúde da fila de recebimento do WhatsApp + idade do último lote de histórico. */
function useInboundQueueHealth() {
  return useQuery({
    queryKey: ['inbound-queue-health'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [pending, processing, lastDone, lastRun] = await Promise.all([
        (supabase as any).from('chat_inbound_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        (supabase as any).from('chat_inbound_queue').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
        (supabase as any).from('chat_inbound_queue').select('processed_at').eq('status', 'done').order('processed_at', { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from('uazapi_history_runs').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        lastProcessedAt: (lastDone.data?.processed_at as string | undefined) ?? null,
        lastRunAt: (lastRun.data?.created_at as string | undefined) ?? null,
      };
    },
  });
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function InboundQueueHealthNotice() {
  const { data } = useInboundQueueHealth();
  if (!data) return null;

  const idleHours = hoursSince(data.lastProcessedAt);
  const runHours = hoursSince(data.lastRunAt);
  const queueStuck = data.pending > 500 && (idleHours === null || idleHours > 0.5);
  const noRuns = runHours !== null && runHours > 24;

  if (!queueStuck && !noRuns) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          Recebimento em dia — {data.pending} evento(s) aguardando, {data.processing} em processamento.
          {runHours !== null && ` Último lote de histórico há ${Math.round(runHours)}h.`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-300">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" /> Atenção no recebimento
      </div>
      {queueStuck && (
        <p>
          {data.pending} evento(s) aguardando na fila de recebimento
          {idleHours !== null ? ` e nada foi processado nas últimas ${idleHours.toFixed(1)}h` : ' e nenhum processamento registrado'}.
        </p>
      )}
      {noRuns && (
        <p>Nenhum lote de histórico novo há {Math.round(runHours!)}h — use “Forçar resync de histórico” se precisar reimportar.</p>
      )}
    </div>
  );
}
