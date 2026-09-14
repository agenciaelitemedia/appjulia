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
 * `messages.update` (status, edição, conteúdo tardio) é processado localmente
 * sem chamar a edge function, já que representa a grande maioria dos eventos
 * e só faz atualizações em `chat_messages`.
 *
 * Chamado por pg_cron (a cada minuto) e imediatamente após cada inserção.
 * Autenticação: header `x-worker-secret` com CHAT_INBOUND_WORKER_SECRET.
 */
import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 250;
const CONCURRENCY = 50;
const MAX_ATTEMPTS = 5;
const LOCK_STALE_MS = 5 * 60_000;
/** Tempo máximo por item: um evento lento não pode travar o lote. */
const ITEM_TIMEOUT_MS = 30_000;
/** Orçamento total da rodada (o cron chama de novo a cada minuto). */
const RUN_BUDGET_MS = 55_000;

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

/**
 * O `payload` NÃO vem na busca de candidatos: ele é jsonb grande e trazê-lo para
 * 250 linhas por rodada tornava a busca de pendentes a consulta mais cara do
 * sistema. Ele é lido no momento em que o item é reservado (claim).
 */
type QueueItem = { id: string; queue_id: string; attempts: number | null; event_name: string | null };

// ── Status helpers (copiados de uazapi-chat-webhook para fast-path) ──
const STATUS_MAP: Record<string, string> = {
  '0': 'failed', '1': 'pending', '2': 'sent', '3': 'delivered', '4': 'read', '5': 'read',
  'error': 'failed', 'failed': 'failed', 'canceled': 'failed', 'cancelled': 'failed',
  'pending': 'pending', 'queued': 'pending',
  'server_ack': 'sent', 'sent': 'sent',
  'delivery_ack': 'delivered', 'delivered': 'delivered',
  'read': 'read', 'read_ack': 'read', 'played': 'read',
};
const STATUS_RANK: Record<string, number> = {
  pending: 0, sending: 0, received: 0,
  sent: 1, delivered: 2, read: 3,
};
function mapStatus(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const key = String(raw).toLowerCase();
  return STATUS_MAP[key] || key;
}
function lowerStatusesThan(target: string): string[] {
  const rank = STATUS_RANK[target];
  if (rank == null || rank < 0) return [];
  return Object.entries(STATUS_RANK)
    .filter(([, v]) => v < rank)
    .map(([k]) => k);
}
function toSafeString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const o = v as any;
  const candidate = o.body ?? o.text ?? o.caption ?? o.message ?? o.conversation;
  if (typeof candidate === 'string') return candidate;
  return '';
}
function looksLikeJsonBlob(s: string): boolean {
  if (!s.startsWith('{') && !s.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(s);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}
const UNDECRYPTABLE_TEXT = '🕐 Aguardando esta mensagem. Isso pode demorar um pouco.';
function isUndecryptable(msg: any, text?: string | null): boolean {
  const t = (text || '').trim().toLowerCase();
  const mt = String(msg?.messageType || msg?.type || '').toLowerCase();
  return t.startsWith('[undecryptable]') || t.includes('não foi possível descriptografar') ||
    (mt === 'error' && !!t);
}
function extractMessageText(msg: any): string | undefined {
  const candidates = [
    msg.content?.caption,
    msg.text,
    msg.body,
    msg.caption,
    msg.message?.conversation,
    msg.message?.extendedTextMessage?.text,
    msg.message?.imageMessage?.caption,
    msg.message?.videoMessage?.caption,
    msg.message?.documentMessage?.caption,
  ];
  for (const c of candidates) {
    const s = toSafeString(c).trim();
    if (s && !looksLikeJsonBlob(s) && s !== '[object Object]') {
      return isUndecryptable(msg, s) ? UNDECRYPTABLE_TEXT : s;
    }
  }
  return undefined;
}
function collectMessageIds(src: any): string[] {
  const candidates = [
    src?.messageid,
    src?.id,
    src?.message_id,
    src?.wa_messageid,
    src?.key?.id,
    src?.update?.key?.id,
    src?.MessageIDs,
    src?.messageIds,
    src?.message_ids,
    src?.event?.MessageIDs,
    src?.event?.messageIds,
    src?.event?.message_ids,
  ];
  return Array.from(new Set(
    candidates
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((x) => typeof x === 'string' && x.length > 0),
  )) as string[];
}

async function resolveChatMessageRowIds(supabase: any, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const safeIds = Array.from(new Set(
    ids.filter((v) => typeof v === 'string' && v.length > 0).slice(0, 50),
  ));
  if (!safeIds.length) return [];
  const { data, error } = await supabase.rpc('chat_resolve_message_ids', { p_ids: safeIds });
  if (error) {
    console.warn('[resolveChatMessageRowIds] rpc failed', error.message);
    return [];
  }
  const resolved = new Set<string>();
  for (const row of (data ?? []) as Array<{ id?: string }>) {
    if (row?.id) resolved.add(row.id);
  }
  return Array.from(resolved);
}

async function processMessagesUpdateLocal(
  supabase: any,
  payload: any,
): Promise<{ count: number; edits: number; statuses: number; late: number }> {
  const updates = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.event)
      ? payload.event
      : [payload.data || payload.event || payload];

  let edits = 0;
  let statuses = 0;
  let late = 0;

  // Resolve todos os IDs de uma só vez para evitar N RPCs.
  const allIdCandidates: string[] = [];
  const updateMeta: { ids: string[]; editedText?: string; lateText?: string; lateMedia?: string | null; status?: string | null }[] = [];
  for (const upd of updates) {
    const idCandidates = collectMessageIds(upd);
    if (idCandidates.length === 0) continue;
    allIdCandidates.push(...idCandidates);

    const editedText: string | undefined =
      (typeof upd.edited === 'string' && upd.edited.trim()) ? upd.edited
        : (upd.update?.message?.editedMessage?.message?.conversation
          ?? upd.message?.editedMessage?.message?.conversation
          ?? upd.editedText);

    const lateText = extractMessageText(upd) ?? extractMessageText(upd.message ?? {});
    const lateMedia = upd.mediaUrl || upd.media?.url || upd.fileURL || null;

    const mapped = mapStatus(
      upd.status
      ?? upd.update?.status
      ?? upd.ack
      ?? upd.Type
      ?? upd.type
      ?? upd.event?.status
      ?? upd.event?.update?.status,
    );

    updateMeta.push({
      ids: idCandidates,
      editedText: editedText && String(editedText).trim() ? String(editedText) : undefined,
      lateText,
      lateMedia,
      status: mapped,
    });
  }

  if (updateMeta.length === 0) return { count: updates.length, edits: 0, statuses: 0, late: 0 };

  const rowIdMap = new Map<string, string[]>();
  const allRowIds = await resolveChatMessageRowIds(supabase, allIdCandidates);
  // Cada candidate pode mapear para um rowId; a RPC retorna ids únicos. Para
  // manter compatibilidade, aplicamos as operações em todos os rowIds encontrados
  // para o grupo de candidates de cada update.
  const candidateToRows = new Map<string, string[]>();
  // A RPC chat_resolve_message_ids mapeia cada id para row id; infelizmente
  // perdemos a correspondência. Reaproveitamos o conjunto total e aplicamos
  // operações por update em todos os seus candidates resolvidos.

  for (const meta of updateMeta) {
    const resolvedGroup: string[] = [];
    for (const c of meta.ids) {
      const rowsForCandidate = allRowIds.filter((rowId) => {
        // correspondência aproximada: message_id exato ou external_id termina com candidate
        const cLower = c.toLowerCase();
        const rLower = rowId.toLowerCase();
        return rLower === cLower || rLower.endsWith(':' + cLower) || cLower.endsWith(':' + rLower);
      });
      // Como não sabemos o mapeamento exato, aplicamos em todos os rowIds
      // resolvidos do grupo. O conjunto total é pequeno (<=50).
      resolvedGroup.push(...rowsForCandidate);
    }
    const groupRowIds = Array.from(new Set(resolvedGroup));
    if (groupRowIds.length === 0) continue;

    // Inbound EDIT
    if (meta.editedText) {
      const { data: updRows } = await supabase
        .from('chat_messages')
        .update({ text: meta.editedText, edited_at: new Date().toISOString() })
        .in('id', groupRowIds)
        .select('id');
      if (updRows?.length) edits += updRows.length;
    }

    // Late content arriving for undecryptable placeholder
    if ((meta.lateText && meta.lateText !== UNDECRYPTABLE_TEXT) || meta.lateMedia) {
      const { data: pendingRows } = await supabase
        .from('chat_messages')
        .select('id, text, metadata')
        .in('id', groupRowIds);
      for (const r of pendingRows || []) {
        const cur = String((r as any).text ?? '').trim();
        if (cur && !cur.startsWith('🕐')) continue;
        const metaObj = ((r as any).metadata && typeof (r as any).metadata === 'object')
          ? (r as any).metadata as Record<string, unknown> : {};
        const patch: Record<string, unknown> = {
          metadata: {
            ...metaObj,
            undecryptable: {
              ...(metaObj as any).undecryptable,
              resolved: true,
              resolved_at: new Date().toISOString(),
              source: 'messages.update',
            },
          },
        };
        if (meta.lateText && meta.lateText !== UNDECRYPTABLE_TEXT) patch.text = meta.lateText;
        if (meta.lateMedia) patch.media_url = meta.lateMedia;
        await supabase.from('chat_messages').update(patch).eq('id', (r as any).id);
        late++;
      }
    }

    // Status update
    if (meta.status) {
      const lower = lowerStatusesThan(meta.status);
      let q = supabase
        .from('chat_messages')
        .update({ status: meta.status })
        .in('id', groupRowIds);
      if (lower.length > 0) q = q.in('status', lower);
      const { data: stRows } = await q.select('id');
      if (stRows?.length) statuses += stRows.length;
    }
  }

  return { count: updates.length, edits, statuses, late };
}

async function runWorker(request: Request): Promise<Response> {
  const provided = request.headers.get('x-worker-secret');
  if (!provided) return new Response('unauthorized', { status: 401 });

  const supabaseUrl = process.env['SUPABASE_URL']!;
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const envSecret = process.env['CHAT_INBOUND_WORKER_SECRET'];
  let authorized = Boolean(envSecret) && provided === envSecret;
  if (!authorized) {
    const { data: tokenRow } = await supabase
      .from('internal_worker_tokens')
      .select('token')
      .eq('name', 'chat-inbound-worker')
      .maybeSingle();
    authorized = Boolean(tokenRow?.token) && provided === tokenRow!.token;
  }
  if (!authorized) return new Response('unauthorized', { status: 401 });

  const startedAt = Date.now();
  const result = { claimed: 0, done: 0, skipped: 0, failed: 0, retry: 0, localUpdates: 0 };

  const processItem = async (item: QueueItem) => {
    const eventName = String(item.event_name ?? '').toLowerCase();
    const needsPayload = !SKIPPABLE_EVENTS.has(eventName);
    // O payload só é lido aqui (e só quando será usado), no mesmo comando que
    // reserva o item — evita carregar jsonb grande na busca de candidatos.
    const { data: claimed } = await supabase
      .from('chat_inbound_queue')
      .update({ status: 'processing', locked_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select(needsPayload ? 'id, payload' : 'id')
      .maybeSingle();
    if (!claimed) return;
    result.claimed++;

    const payload = (claimed as { payload?: unknown }).payload;
    const attempts = Number(item.attempts ?? 0) + 1;


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

    // Fast-path para messages.update: processa localmente sem chamar edge function.
    if (eventName === 'messages.update' || eventName === 'messages_update') {
      try {
        const res = await processMessagesUpdateLocal(supabase, item.payload);
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
        result.localUpdates += res.count;
      } catch (err) {
        const message = String((err as Error)?.message ?? 'erro desconhecido').slice(0, 500);
        const giveUp = attempts >= MAX_ATTEMPTS;
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
        console.error('[chat-inbound-worker] messages.update local falhou', item.id, message);
      }
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
            // Segredo compartilhado: a comparação por service role pode falhar
            // quando worker e edge function recebem formatos de chave diferentes.
            'x-worker-secret': process.env['CHAT_INBOUND_WORKER_SECRET'] ?? '',
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
