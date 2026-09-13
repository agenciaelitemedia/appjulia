/**
 * Processador da fila de recebimento do WhatsApp.
 *
 * O webhook `uazapi-chat-webhook` apenas grava o evento em `chat_inbound_queue`
 * e responde sucesso ao provedor. Este processador consome a fila em lotes
 * e reinvoca o webhook internamente (header `x-inbound-worker` + service role)
 * para executar o trabalho pesado — gravação da conversa, transcrição,
 * automações e envio ao n8n — fora da requisição do provedor.
 *
 * Eventos puramente cosméticos (sincronização de lista de conversas, presença,
 * metadados de grupo) são descartados aqui mesmo: eles não geram mensagem e
 * antes consumiam toda a capacidade da fila (avatar refresh + varreduras),
 * estourando o limite de 150s do webhook.
 *
 * Chamado por pg_cron (a cada minuto) e imediatamente após cada inserção.
 * Autenticação: header `x-worker-secret` com CHAT_INBOUND_WORKER_SECRET.
 */
import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 30;
const CONCURRENCY = 5;
const MAX_ATTEMPTS = 5;
const LOCK_STALE_MS = 5 * 60_000;
/** Tempo máximo por item: um evento lento não pode travar o lote. */
const ITEM_TIMEOUT_MS = 20_000;
/** Orçamento total da rodada (o cron chama de novo a cada minuto). */
const RUN_BUDGET_MS = 50_000;

/** Eventos sem efeito em mensagens — concluídos sem reprocessar o webhook. */
const SKIPPABLE_EVENTS = new Set([
  'chats',
  'chats_update',
  'chats.update',
  'presence',
  'presence_update',
  'presence.update',
  'groups',
  'groups_update',
  'groups.update',
  'groups.upsert',
]);

type QueueItem = { id: string; queue_id: string; payload: unknown; attempts: number | null; event_name: string | null };

async function runWorker(request: Request): Promise<Response> {
  const provided = request.headers.get('x-worker-secret');
  if (!provided) return new Response('unauthorized', { status: 401 });

  const supabaseUrl = process.env['SUPABASE_URL']!;
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const envSecret = process.env['CHAT_INBOUND_WORKER_SECRET'];
  let authorized = Boolean(envSecret) && provided === envSecret;
  if (!authorized) {
    // Token alternativo guardado no banco (usado pelo agendador pg_cron).
    const { data: tokenRow } = await supabase
      .from('internal_worker_tokens')
      .select('token')
      .eq('name', 'chat-inbound-worker')
      .maybeSingle();
    authorized = Boolean(tokenRow?.token) && provided === tokenRow!.token;
  }
  if (!authorized) return new Response('unauthorized', { status: 401 });


  const startedAt = Date.now();
  const result = { claimed: 0, done: 0, skipped: 0, failed: 0, retry: 0 };

  const processItem = async (item: QueueItem) => {
    // Claim otimista: apenas uma execução consegue mover pending -> processing.
    const { data: claimed } = await supabase
      .from('chat_inbound_queue')
      .update({ status: 'processing', locked_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) return;
    result.claimed++;

    const attempts = Number(item.attempts ?? 0) + 1;
    const eventName = String(item.event_name ?? '').toLowerCase();

    // Evento cosmético: encerra sem reprocessar o webhook.
    if (SKIPPABLE_EVENTS.has(eventName)) {
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
      result.skipped++;
      result.done++;
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ITEM_TIMEOUT_MS);
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
          signal: controller.signal,
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
      const aborted = (err as Error)?.name === 'AbortError';
      const message = (aborted ? `tempo esgotado (${ITEM_TIMEOUT_MS}ms)` : String((err as Error)?.message ?? 'erro desconhecido')).slice(0, 500);
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
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // Libera itens presos (processo encerrado no meio do trabalho).
    await supabase
      .from('chat_inbound_queue')
      .update({ status: 'pending', locked_at: null })
      .eq('status', 'processing')
      .lt('locked_at', new Date(Date.now() - LOCK_STALE_MS).toISOString());

    while (Date.now() - startedAt < RUN_BUDGET_MS) {
      const { data: candidates, error } = await supabase
        .from('chat_inbound_queue')
        .select('id, queue_id, payload, attempts, event_name')
        .eq('status', 'pending')
        .lte('next_attempt_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE);
      if (error) throw new Error(error.message);
      if (!candidates?.length) break;

      const items = candidates as QueueItem[];
      for (let i = 0; i < items.length; i += CONCURRENCY) {
        if (Date.now() - startedAt >= RUN_BUDGET_MS) break;
        await Promise.all(items.slice(i, i + CONCURRENCY).map(processItem));
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
