/**
 * Processador da fila de recebimento do WhatsApp.
 *
 * O webhook `uazapi-chat-webhook` apenas grava o evento em `chat_inbound_queue`
 * e responde sucesso ao provedor. Este processador consome a fila em lotes
 * pequenos e reinvoca o webhook internamente (header `x-inbound-worker` +
 * service role) para executar o trabalho pesado — gravação da conversa,
 * transcrição, automações e envio ao n8n — fora da requisição do provedor.
 *
 * Chamado por pg_cron (a cada minuto) e imediatamente após cada inserção.
 * Autenticação: header `x-worker-secret` com CHAT_INBOUND_WORKER_SECRET.
 */
import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;
const LOCK_STALE_MS = 5 * 60_000;

async function runWorker(request: Request): Promise<Response> {
  const workerSecret = process.env['CHAT_INBOUND_WORKER_SECRET'];
  const provided = request.headers.get('x-worker-secret');
  if (!workerSecret || provided !== workerSecret) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabaseUrl = process.env['SUPABASE_URL']!;
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const result = { claimed: 0, done: 0, failed: 0, retry: 0 };

  try {
    // Libera itens presos (processo encerrado no meio do trabalho).
    await supabase
      .from('chat_inbound_queue')
      .update({ status: 'pending', locked_at: null })
      .eq('status', 'processing')
      .lt('locked_at', new Date(Date.now() - LOCK_STALE_MS).toISOString());

    const { data: candidates, error } = await supabase
      .from('chat_inbound_queue')
      .select('id, queue_id, payload, attempts')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    for (const item of candidates ?? []) {
      // Claim otimista: apenas uma execução consegue mover pending -> processing.
      const { data: claimed } = await supabase
        .from('chat_inbound_queue')
        .update({ status: 'processing', locked_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (!claimed) continue;
      result.claimed++;

      const attempts = Number(item.attempts ?? 0) + 1;
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/uazapi-chat-webhook?queue_id=${encodeURIComponent(String(item.queue_id))}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
              'x-inbound-worker': 'true',
            },
            body: JSON.stringify(item.payload),
          },
        );
        if (!res.ok) throw new Error(`webhook ${res.status}: ${(await res.text()).slice(0, 300)}`);

        await supabase
          .from('chat_inbound_queue')
          .update({
            status: 'done',
            attempts,
            locked_at: null,
            processed_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', item.id);
        result.done++;
      } catch (err) {
        const message = String((err as Error)?.message ?? 'erro desconhecido').slice(0, 500);
        const giveUp = attempts >= MAX_ATTEMPTS;
        // Backoff: 1, 2, 4, 8, 8 minutos.
        const delayMs = Math.min(8, 2 ** (attempts - 1)) * 60_000;
        await supabase
          .from('chat_inbound_queue')
          .update({
            status: giveUp ? 'failed' : 'pending',
            attempts,
            last_error: message,
            locked_at: null,
            next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
          })
          .eq('id', item.id);
        if (giveUp) result.failed++;
        else result.retry++;
        console.error('[chat-inbound-worker] item falhou', item.id, message);
      }
    }

    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error('[chat-inbound-worker] erro:', err);
    return Response.json({ error: String((err as Error)?.message ?? err), ...result }, { status: 500 });
  }
}

export const Route = createFileRoute('/api/public/chat-inbound-worker')({
  server: {
    handlers: {
      POST: async ({ request }) => runWorker(request),
      GET: async ({ request }) => runWorker(request),
    },
  },
});
