// ============================================
// UaZapi Message Revalidate
// Retries fetching the real content of messages that arrived as
// "undecryptable" (placeholder text) from WhatsApp/UaZapi.
//
// Modes:
//  - single: { message_id | row_id }  → immediate retry (UI button)
//  - sweep:  {}                        → cron: pending messages from last 24h
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLACEHOLDER = '🕐 Aguardando esta mensagem. Isso pode demorar um pouco.';
const MAX_ATTEMPTS = 8;
const SWEEP_LIMIT = 40;
/** Backoff (minutos) por número de tentativas já feitas. */
const BACKOFF_MIN = [0, 2, 5, 10, 20, 40, 60, 120];

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function normalizePhone(raw: unknown): string {
  return String(raw || '').replace(/@.*/, '').replace(/[^\d]/g, '');
}

function isPlaceholderish(text: unknown): boolean {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return true;
  return t.startsWith('🕐') || t.startsWith('[undecryptable]')
    || t.includes('não foi possível descriptografar');
}

function extractText(msg: any): string | undefined {
  const candidates = [
    msg?.content?.caption,
    typeof msg?.text === 'string' ? msg.text : msg?.text?.body,
    msg?.caption,
    msg?.body,
    typeof msg?.content === 'string' ? msg.content : undefined,
    msg?.message?.conversation,
    msg?.message?.extendedTextMessage?.text,
    msg?.message?.imageMessage?.caption,
    msg?.message?.videoMessage?.caption,
    msg?.message?.documentMessage?.caption,
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (!s || s === '[object Object]') continue;
    if ((s.startsWith('{') || s.startsWith('[')) && (() => {
      try { return typeof JSON.parse(s) === 'object'; } catch { return false; }
    })()) continue;
    return s;
  }
  return undefined;
}

function extractType(msg: any): string {
  const mt = String(msg?.messageType || msg?.type || '').toLowerCase();
  if (mt.includes('image') || msg?.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg?.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg?.message?.audioMessage?.ptt) return 'ptt';
  if (mt.includes('audio') || msg?.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg?.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg?.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg?.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg?.message?.contactMessage) return 'contact';
  return 'text';
}

function extractMediaUrl(msg: any): string | undefined {
  return msg?.mediaUrl || msg?.media?.url || msg?.fileURL
    || msg?.message?.imageMessage?.url
    || msg?.message?.videoMessage?.url
    || msg?.message?.audioMessage?.url
    || msg?.message?.documentMessage?.url
    || undefined;
}

function extractFileName(msg: any): string | undefined {
  return msg?.fileName || msg?.file_name || msg?.message?.documentMessage?.fileName || undefined;
}

function msgIdOf(msg: any): string {
  return String(msg?.id || msg?.messageId || msg?.message_id || msg?.key?.id || msg?.wa_messageid || '');
}

function preview(type: string, text?: string, fileName?: string): string {
  const LABELS: Record<string, string> = {
    image: '📷 Imagem', video: '🎥 Vídeo', audio: '🎵 Áudio', ptt: '🎤 Áudio',
    document: '📄 Documento', sticker: '🌟 Sticker', location: '📍 Localização', contact: '👤 Contato',
  };
  if (type !== 'text') return text?.trim() || LABELS[type] || fileName || '📎 Anexo';
  return (text || '').slice(0, 200);
}

async function fetchFromProvider(
  queue: { evo_url: string; evo_apikey: string },
  messageId: string,
  chatId: string,
): Promise<any | null> {
  const base = queue.evo_url.replace(/\/$/, '');
  const attempts: Record<string, unknown>[] = [
    { id: messageId },
    ...(chatId ? [{ chatid: chatId, limit: 60, offset: 0 }] : []),
  ];
  for (const body of attempts) {
    try {
      const resp = await fetch(`${base}/message/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: queue.evo_apikey },
        body: JSON.stringify(body),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const list: any[] = Array.isArray(data) ? data
        : Array.isArray(data?.messages) ? data.messages
        : Array.isArray(data?.data) ? data.data
        : (data && typeof data === 'object' ? [data] : []);
      const hit = list.find((m) => msgIdOf(m) === messageId);
      if (hit) return hit;
    } catch (e) {
      console.warn('[revalidate] provider fetch error', (e as Error).message);
    }
  }
  return null;
}

async function markAttempt(
  supabase: any,
  row: any,
  patch: Record<string, unknown>,
) {
  const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
  const prev = (meta as any).undecryptable || {};
  const attempts = Number(prev.attempts || 0) + 1;
  const undecryptable = {
    ...prev,
    attempts,
    last_attempt_at: new Date().toISOString(),
    ...patch,
    gave_up: patch.resolved === true ? false : attempts >= MAX_ATTEMPTS,
  };
  await supabase
    .from('chat_messages')
    .update({ metadata: { ...meta, undecryptable } })
    .eq('id', row.id);
  return undecryptable;
}

async function revalidateRow(supabase: any, row: any): Promise<{ recovered: boolean; reason?: string }> {
  // Queue credentials: prefer the conversation queue, then any active UaZapi queue of the tenant.
  let queue: any = null;
  if (row.conversation_id) {
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('queue_id')
      .eq('id', row.conversation_id)
      .maybeSingle();
    if (conv?.queue_id) {
      const { data: q } = await supabase
        .from('queues')
        .select('id, evo_url, evo_apikey')
        .eq('id', conv.queue_id)
        .maybeSingle();
      if (q?.evo_url && q?.evo_apikey) queue = q;
    }
  }
  if (!queue) {
    const { data: qs } = await supabase
      .from('queues')
      .select('id, evo_url, evo_apikey, is_active, client_id')
      .eq('client_id', row.client_id)
      .eq('is_active', true)
      .not('evo_apikey', 'is', null)
      .limit(5);
    queue = (qs || []).find((q: any) => q.evo_url && q.evo_apikey) || null;
  }
  if (!queue) {
    await markAttempt(supabase, row, { last_error: 'no_queue_credentials' });
    return { recovered: false, reason: 'no_queue_credentials' };
  }

  const { data: contact } = await supabase
    .from('chat_contacts')
    .select('id, phone, remote_jid, is_group, last_message_at')
    .eq('id', row.contact_id)
    .maybeSingle();

  const jid = String(contact?.remote_jid || '');
  const chatId = jid.includes('@')
    ? jid
    : (normalizePhone(contact?.phone) ? `${normalizePhone(contact?.phone)}@s.whatsapp.net` : '');

  const messageId = String(row.message_id || row.external_id || '');
  if (!messageId) {
    await markAttempt(supabase, row, { last_error: 'no_message_id' });
    return { recovered: false, reason: 'no_message_id' };
  }

  const found = await fetchFromProvider(queue, messageId, chatId);
  if (!found) {
    await markAttempt(supabase, row, { last_error: 'not_found_yet' });
    return { recovered: false, reason: 'not_found_yet' };
  }

  const text = extractText(found);
  const type = extractType(found);
  const mediaUrl = extractMediaUrl(found);
  const fileName = extractFileName(found);
  const hasRealContent = (!!text && !isPlaceholderish(text)) || !!mediaUrl;

  if (!hasRealContent) {
    await markAttempt(supabase, row, { last_error: 'still_undecryptable' });
    return { recovered: false, reason: 'still_undecryptable' };
  }

  const patch: Record<string, unknown> = {
    text: text && !isPlaceholderish(text) ? text : null,
    type,
    raw_payload: found,
  };
  if (mediaUrl) patch.media_url = mediaUrl;
  if (fileName) patch.file_name = fileName;

  const { error: updErr } = await supabase.from('chat_messages').update(patch).eq('id', row.id);
  if (updErr) {
    await markAttempt(supabase, row, { last_error: `update_failed: ${updErr.message}` });
    return { recovered: false, reason: 'update_failed' };
  }
  await markAttempt(supabase, row, { resolved: true, resolved_at: new Date().toISOString(), last_error: null });

  // Fix the conversation-list preview when this is still the latest message of the contact.
  try {
    const contactLast = contact?.last_message_at ? new Date(contact.last_message_at).getTime() : 0;
    const rowTs = row.timestamp ? new Date(row.timestamp).getTime() : 0;
    if (rowTs && Math.abs(contactLast - rowTs) < 2000) {
      await supabase
        .from('chat_contacts')
        .update({ last_message_text: preview(type, text, fileName) })
        .eq('id', row.contact_id);
    }
  } catch { /* preview is best-effort */ }

  return { recovered: true };
}

const SELECT_COLS =
  'id, message_id, external_id, contact_id, client_id, conversation_id, text, type, metadata, timestamp';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = getSupabase();
    const mode = body?.mode || (body?.message_id || body?.row_id ? 'single' : 'sweep');

    if (mode === 'single') {
      let q = supabase.from('chat_messages').select(SELECT_COLS).limit(1);
      q = body.row_id
        ? q.eq('id', body.row_id)
        : q.or(`message_id.eq.${body.message_id},external_id.eq.${body.message_id}`);
      const { data, error } = await q;
      if (error) return respond({ error: error.message }, 500);
      const row = data?.[0];
      if (!row) return respond({ error: 'message_not_found' }, 404);
      if (!isPlaceholderish(row.text)) {
        return respond({ ok: true, recovered: false, reason: 'already_has_content' });
      }
      const res = await revalidateRow(supabase, row);
      return respond({ ok: true, ...res });
    }

    // ── sweep ──
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from('chat_messages')
      .select(SELECT_COLS)
      .gte('timestamp', since)
      .or(`text.eq.${PLACEHOLDER},text.is.null`)
      .order('timestamp', { ascending: false })
      .limit(200);
    if (error) return respond({ error: error.message }, 500);

    const now = Date.now();
    const due = (rows || []).filter((r: any) => {
      if (!isPlaceholderish(r.text)) return false;
      const u = (r.metadata as any)?.undecryptable;
      if (!u) return true;
      if (u.resolved || u.gave_up) return false;
      const attempts = Number(u.attempts || 0);
      if (attempts >= MAX_ATTEMPTS) return false;
      const wait = (BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length - 1)] || 120) * 60_000;
      const last = u.last_attempt_at ? new Date(u.last_attempt_at).getTime() : 0;
      return now - last >= wait;
    }).slice(0, SWEEP_LIMIT);

    let recovered = 0;
    const results = await Promise.allSettled(due.map((r: any) => revalidateRow(supabase, r)));
    for (const r of results) if (r.status === 'fulfilled' && r.value.recovered) recovered++;

    console.log('[revalidate] sweep', { candidates: rows?.length ?? 0, tried: due.length, recovered });
    return respond({ ok: true, tried: due.length, recovered });
  } catch (err) {
    console.error('[revalidate] error', err);
    return respond({ error: (err as Error).message }, 500);
  }
});
