// ============================================
// UaZapi Chat Webhook
// Receives WhatsApp events from UaZapi and persists to Supabase
// URL: /functions/v1/uazapi-chat-webhook?queue_id={queue_id}
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchWhatsappProfile, profileToContactColumns } from "../_shared/whatsapp-profile.ts";
import { normalizeBrPhone } from "../_shared/phone-normalize.ts";
import { logDroppedMessage } from "../_shared/droppedLogger.ts";
import { resolveQuotedMeta } from "../_shared/quotedMessage.ts";

// ─── Avatar refresh helper (fire-and-forget) ───
// Marks a contact as needing an avatar refresh and triggers the
// `refresh-contact-avatar` edge function in background. Deduplicated:
// won't enqueue again if a request was made in the last 60 seconds.
async function triggerAvatarRefresh(supabase: any, contactId: string) {
  try {
    const { data: row } = await supabase
      .from('chat_contacts')
      .select('avatar_refresh_requested_at')
      .eq('id', contactId)
      .maybeSingle();
    if (row?.avatar_refresh_requested_at) {
      const last = new Date(row.avatar_refresh_requested_at).getTime();
      if (Date.now() - last < 60_000) return;
    }
    await supabase
      .from('chat_contacts')
      .update({ avatar_refresh_requested_at: new Date().toISOString() })
      .eq('id', contactId);
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-contact-avatar`;
    EdgeRuntime.waitUntil(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ contact_id: contactId, force: true }),
      }).catch(() => {}),
    );
  } catch (e) {
    console.warn('[avatar-refresh] trigger failed', (e as Error).message);
  }
}

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// In-memory cache (60s) for agent queue settings keyed by client_id.
const agentSettingsCache = new Map<string, { value: { allow_groups: boolean; queue_limit: number }; expires: number }>();

// In-memory cache (60s) of own phone numbers per client (anti-echo filter).
const ownNumbersCache = new Map<string, { value: Set<string>; expires: number }>();
async function getOwnNumbersForClient(clientId: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = ownNumbersCache.get(clientId);
  if (cached && cached.expires > now) return cached.value;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('queues')
      .select('phone_number')
      .eq('client_id', clientId)
      .not('phone_number', 'is', null);
    const set = new Set<string>();
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const p = String((row as any).phone_number || '').replace(/\D/g, '');
        if (p) set.add(p);
      }
    }
    ownNumbersCache.set(clientId, { value: set, expires: now + 60_000 });
    return set;
  } catch (err) {
    console.warn('[uazapi-chat-webhook] own numbers lookup failed:', err);
    const set = new Set<string>();
    ownNumbersCache.set(clientId, { value: set, expires: now + 60_000 });
    return set;
  }
}

async function getAllowGroupsForClient(clientId: string): Promise<boolean> {
  const now = Date.now();
  const cached = agentSettingsCache.get(clientId);
  if (cached && cached.expires > now) return cached.value.allow_groups;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chat_client_settings')
      .select('settings')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) {
      const value = { allow_groups: false, queue_limit: 1 };
      agentSettingsCache.set(clientId, { value, expires: now + 60_000 });
      return false;
    }
    const s = (data.settings ?? {}) as Record<string, unknown>;
    const value = {
      allow_groups: !!s?.ALLOW_GROUPS,
      queue_limit: typeof s?.QUEUE_LIMIT === 'number' && (s.QUEUE_LIMIT as number) > 0 ? (s.QUEUE_LIMIT as number) : 1,
    };
    agentSettingsCache.set(clientId, { value, expires: now + 60_000 });
    return value.allow_groups;
  } catch (err) {
    console.warn('[uazapi-chat-webhook] allow_groups lookup failed, defaulting to false:', err);
    return false;
  }
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Status helpers (shared by messages.update and messages.upsert) ──
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
/** Statuses that are strictly LOWER than the target — used as an `.in()` guard
 *  so we never downgrade an already-acked message (e.g. read → delivered). */
function lowerStatusesThan(target: string): string[] {
  const rank = STATUS_RANK[target];
  if (rank == null || rank < 0) return [];
  return Object.entries(STATUS_RANK)
    .filter(([, v]) => v < rank)
    .map(([k]) => k);
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
function buildIdOrFilter(ids: string[]): string {
  return ids
    .flatMap((id) => {
      const filters = [`message_id.eq.${id}`, `external_id.eq.${id}`];
      if (!id.includes(':')) {
        filters.push(`message_id.ilike.*:${id}`, `external_id.ilike.*:${id}`);
      }
      return filters;
    })
    .join(',');
}
async function resolveChatMessageRowIds(supabase: ReturnType<typeof getSupabase>, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];

  const directFilter = buildIdOrFilter(ids);
  const resolved = new Set<string>();

  if (directFilter) {
    const { data } = await supabase
      .from('chat_messages')
      .select('id')
      .or(directFilter);
    for (const row of data ?? []) {
      const rowId = (row as { id?: string }).id;
      if (rowId) resolved.add(rowId);
    }
  }

  const shortIds = ids.filter((id) => !id.includes(':'));
  for (const shortId of shortIds) {
    const { data } = await supabase
      .from('chat_messages')
      .select('id')
      .or(`message_id.like.%:${shortId},external_id.like.%:${shortId}`);
    for (const row of data ?? []) {
      const rowId = (row as { id?: string }).id;
      if (rowId) resolved.add(rowId);
    }
  }

  return Array.from(resolved);
}

function normalizePhone(raw: string): string {
  // Forma canônica BR: aplica regra do 9º dígito para celulares 55 + DDD + 8 díg.
  // Para demais países e fixos, preserva os dígitos como vieram.
  return normalizeBrPhone(raw);
}

/** Robust group detection across UaZapi payload variants.
 *  Returns true if the message belongs to a WhatsApp group chat. */
function isGroupMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  const jids: Array<unknown> = [
    msg.key?.remoteJid,
    msg.remoteJid,
    msg.chatId,
    msg.chatid,
    msg.wa_chatid,
    msg.from,
    msg.to,
  ];
  for (const j of jids) {
    if (typeof j === 'string' && j.includes('@g.us')) return true;
  }
  // Strict: only treat as group when a JID explicitly contains @g.us above.
  // UaZapi sometimes sends `isGroup`, `groupName: ""` or `participant` for individual chats,
  // which previously caused all messages to be skipped as "group".
  return false;
}

/** Coerce any value to a safe plain string (never returns object/JSON/[object Object]). */
function toSafeString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // object/array: try common text fields, otherwise drop it (do NOT JSON.stringify into the preview)
  if (typeof v === 'object') {
    const o = v as any;
    const candidate = o.body ?? o.text ?? o.caption ?? o.message ?? o.conversation;
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

function extractMessageText(msg: any): string | undefined {
  // msg.text/content can be string OR object ({body|text|caption: "..."}) depending on UaZapi version/media
  const candidates = [
    // UaZapi media: caption lives in msg.content.caption; msg.text may also hold it
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
    // Reject JSON-looking blobs (defensive — UaZapi sometimes dumps full media payload into text)
    if (s && !s.startsWith('{') && !s.startsWith('[') && s !== '[object Object]') return s;
  }
  return undefined;
}

/** Build a safe, human-friendly preview for `last_message_text`.
 *  Never persist raw JSON payloads or `[object Object]`. */
function buildLastMessagePreview(text: unknown, type: string, fileName?: string): string {
  const TYPE_LABELS: Record<string, string> = {
    image: '📷 Imagem',
    video: '🎥 Vídeo',
    audio: '🎵 Áudio',
    ptt: '🎵 Áudio',
    sticker: '🏷️ Sticker',
    location: '📍 Localização',
    contact: '👤 Contato',
    reaction: '💬 Reação',
    revoked: '🚫 Mensagem apagada',
  };
  const t = toSafeString(text).trim();
  const looksLikeJson = t.startsWith('{') || t.startsWith('[');
  const isObjectStr = t === '[object Object]';
  const safeText = looksLikeJson || isObjectStr ? '' : t;

  if (type === 'document') return `📎 ${fileName || 'Documento'}`;
  if (TYPE_LABELS[type]) {
    return safeText ? `${TYPE_LABELS[type]}: ${safeText.slice(0, 80)}` : TYPE_LABELS[type];
  }
  if (safeText) return safeText.slice(0, 120);
  // Fallback when text was unusable and type is unknown.
  return '📎 Mídia';
}

function extractMessageType(msg: any): string {
  // UaZapi uses messageType="ImageMessage"|"AudioMessage"|... AND mediaType="image"|"audio"|...
  const mt = (msg.mediaType || msg.messageType || msg.type || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage || msg.isMedia && mt.includes('image')) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt || msg.isPtt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg.message?.contactMessage) return 'contact';
  if (mt.includes('reaction') || msg.message?.reactionMessage) return 'reaction';
  if (mt.includes('revoked') || mt.includes('protocol') || msg.message?.protocolMessage) return 'revoked';
  // Fallback: msg.type === 'media' + presence of content.URL → guess image
  if ((msg.type === 'media' || mt === 'media') && msg.content?.URL) return 'image';
  return 'text';
}

function extractMediaUrl(msg: any): string | undefined {
  // UaZapi v2 puts the encrypted media URL inside msg.content.URL
  const uazapiUrl = msg.content?.URL || msg.content?.url;
  if (uazapiUrl) return uazapiUrl;

  // Prefer decrypted/usable URLs first; fall back to encrypted ones (frontend will request decryption on demand)
  const decrypted = msg.fileURL
    || msg.file_url
    || msg.mediaUrl
    || msg.media?.url;
  if (decrypted && !String(decrypted).includes('.enc')) return decrypted;

  return decrypted
    || msg.message?.imageMessage?.url
    || msg.message?.videoMessage?.url
    || msg.message?.audioMessage?.url
    || msg.message?.documentMessage?.url
    || msg.message?.stickerMessage?.url
    || undefined;
}

function extractMediaBase64(msg: any): string | undefined {
  return msg.fileBase64 || msg.base64 || undefined;
}

function toIsoTimestamp(rawTs: unknown): string | null {
  if (rawTs == null || rawTs === '') return null;
  const n = typeof rawTs === 'number' ? rawTs : Number(rawTs);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return d.getFullYear() > 2000 && d.getFullYear() < 2100 ? d.toISOString() : null;
}

function isHistoryReplayEvent(event: string, payload: any, messages: any[]): boolean {
  if (event === 'history' || event === 'messages.set' || event === 'message.history') return true;

  const explicitHistoryFlag =
    payload?.type === 'history'
    || payload?.syncType === 'history'
    || payload?.history === true
    || payload?.data?.history === true
    || payload?.isLatest !== undefined
    || payload?.data?.isLatest !== undefined;

  if (explicitHistoryFlag) return true;
  if (event !== 'messages' || !Array.isArray(messages) || messages.length < 50) return false;

  const distinctChats = new Set(
    messages
      .map((msg) => String(msg?.key?.remoteJid ?? msg?.remoteJid ?? msg?.chatId ?? msg?.chatid ?? ''))
      .filter(Boolean),
  ).size;

  return distinctChats >= 5;
}

/** Enqueue a UaZapi history payload into the dedicated processing queue.
 *  Returns the run_id so the caller can dispatch the background processor. */
async function enqueueHistoryRun(
  rawMessages: any[],
  queue: { id: string; client_id: string; name: string },
  event: string,
): Promise<string | null> {
  const supabase = getSupabase();

  // Group by chat and skip groups defensively at enqueue time
  const totalMessages = rawMessages.length;
  let groupMessages = 0;
  let duplicateMessages = 0;

  // ---- Pré-filtro 1: descartar grupos (zero query) ----
  const nonGroupMessages: any[] = [];
  for (const msg of rawMessages) {
    const remoteJid: string = msg?.key?.remoteJid ?? msg?.remoteJid ?? msg?.chatId ?? msg?.chatid ?? '';
    if (!remoteJid) continue;
    if (isGroupMessage(msg) || remoteJid.includes('@g.us')) {
      groupMessages++;
      continue;
    }
    nonGroupMessages.push(msg);
  }
  if (groupMessages > 0) {
    console.log(`[history-enqueue] groups skipped=${groupMessages} of total=${totalMessages} client=${queue.client_id}`);
  }

  // ---- Pré-filtro 2: dedup contra chat_messages.external_id (1 SELECT em batch) ----
  const idsInBatch: string[] = [];
  for (const msg of nonGroupMessages) {
    const mid: string = msg?.key?.id ?? msg?.messageid ?? msg?.id ?? msg?.messageId ?? '';
    if (mid) idsInBatch.push(String(mid));
  }
  const existingIds = new Set<string>();
  if (idsInBatch.length > 0) {
    try {
      // Chunk para evitar payloads grandes (Postgres aceita arrays grandes, mas
      // deixamos margem). 500 ids por chunk.
      const CHUNK = 500;
      for (let i = 0; i < idsInBatch.length; i += CHUNK) {
        const slice = idsInBatch.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('external_id')
          .eq('client_id', String(queue.client_id))
          .in('external_id', slice);
        if (error) {
          console.warn('[history-enqueue] dedup lookup failed:', error.message);
          break;
        }
        for (const row of (data ?? []) as Array<{ external_id: string | null }>) {
          if (row.external_id) existingIds.add(row.external_id);
        }
      }
    } catch (e) {
      console.warn('[history-enqueue] dedup lookup exception:', (e as Error).message);
    }
  }

  // ---- Agrupamento por chat já considerando dedup ----
  const byChat = new Map<string, { phone: string; count: number; messages: any[] }>();
  for (const msg of nonGroupMessages) {
    const remoteJid: string = msg?.key?.remoteJid ?? msg?.remoteJid ?? msg?.chatId ?? msg?.chatid ?? '';
    if (!remoteJid) continue;
    const mid: string = msg?.key?.id ?? msg?.messageid ?? msg?.id ?? msg?.messageId ?? '';
    if (mid && existingIds.has(String(mid))) {
      duplicateMessages++;
      continue;
    }
    const phone = normalizePhone(remoteJid);
    if (!phone) continue;
    const cur = byChat.get(remoteJid) ?? { phone, count: 0, messages: [] };
    cur.count++;
    cur.messages.push(msg);
    byChat.set(remoteJid, cur);
  }
  if (duplicateMessages > 0) {
    console.log(`[history-enqueue] duplicates skipped=${duplicateMessages} client=${queue.client_id}`);
  }

  // Resolve client name (best-effort) for nicer monitoring UI
  let clientName: string | null = null;
  try {
    const { data: cs } = await supabase
      .from('chat_client_settings')
      .select('client_name, client_business_name')
      .eq('client_id', String(queue.client_id))
      .maybeSingle();
    clientName = (cs as any)?.client_business_name || (cs as any)?.client_name || null;
  } catch { /* ignore */ }

  const { data: run, error: runErr } = await supabase
    .from('uazapi_history_runs')
    .insert({
      client_id: String(queue.client_id),
      client_name: clientName,
      queue_id: queue.id,
      queue_name: queue.name,
      event,
      status: byChat.size === 0 ? 'done' : 'pending',
      total_messages: totalMessages,
      group_messages: groupMessages,
      duplicate_messages: duplicateMessages,
      individual_chats: byChat.size,
      received_at: new Date().toISOString(),
      finished_at: byChat.size === 0 ? new Date().toISOString() : null,
    } as never)
    .select('id')
    .single();

  if (runErr || !run) {
    console.warn('[uazapi-history-queue] failed to insert run:', runErr?.message);
    return null;
  }

  const runId = (run as { id: string }).id;

  if (byChat.size > 0) {
    const items = Array.from(byChat.entries()).map(([remote_jid, info]) => ({
      run_id: runId,
      remote_jid,
      phone: info.phone,
      received_messages: info.count,
      status: 'pending' as const,
      payload: info.messages,
    }));
    const { error: itemsErr } = await supabase.from('uazapi_history_items').insert(items as never);
    if (itemsErr) console.warn('[uazapi-history-queue] failed to insert items:', itemsErr.message);
  }

  return runId;
}

async function dispatchHistoryProcessor(runId: string, payload: unknown): Promise<void> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/uazapi-history-processor`;
    // Fire-and-forget: do NOT await the body. The processor uses
    // EdgeRuntime.waitUntil internally, so as soon as it returns 200 we are done.
    // Awaiting the full response here was causing the webhook to time out before
    // the processor finished, leaving runs stuck in "running".
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ run_id: runId, payload }),
    });
    // Drain body to release the connection but ignore content.
    try { await res.text(); } catch { /* ignore */ }
  } catch (e) {
    console.warn('[uazapi-history-queue] dispatch failed:', (e as Error).message);
  }
}

async function processHistorySet(
  rawMessages: any[],
  queue: { id: string; client_id: string; evo_url: string; evo_apikey: string; name: string },
  _allowGroups: boolean,
  jobId: string | null,
) {
  const supabase = getSupabase();

  const byChat = new Map<string, any[]>();
  for (const msg of rawMessages) {
    const remoteJid: string = msg.key?.remoteJid ?? msg.remoteJid ?? msg.chatId ?? '';
    if (!remoteJid) continue;
    // Histórico SEMPRE ignora grupos (detecção robusta), independente de ALLOW_GROUPS.
    if (isGroupMessage(msg) || remoteJid.includes('@g.us')) {
      console.log('[history-set] skip group remoteJid=', remoteJid);
      continue;
    }
    if (!byChat.has(remoteJid)) byChat.set(remoteJid, []);
    byChat.get(remoteJid)!.push(msg);
  }

  let totalContacts = 0;
  let totalMessages = 0;
  let totalSkipped = 0;
  let hadErrors = false;

  try {
  for (const [remoteJid, msgs] of byChat) {
    let chatInsertedMessages = 0;
    let chatContactCreated = false;
    let chatError: string | null = null;
    const phoneForLog = normalizePhone(remoteJid) || remoteJid;
    try {
      const phone = normalizePhone(remoteJid);
      if (!phone) continue;
      // Última camada de defesa: nunca processar grupo no histórico.
      if (remoteJid.includes('@g.us')) {
        console.log('[history-set] defensive skip group', remoteJid);
        continue;
      }

      const { data: preExisting } = await supabase
        .from('chat_contacts')
        .select('id, history_backfilled, avatar, last_message_at, last_message_text')
        .eq('phone', phone)
        .eq('client_id', queue.client_id)
        .maybeSingle();

      const sortedMsgs = [...msgs].sort((a, b) => {
        const aTs = toIsoTimestamp(a.messageTimestamp ?? a.timestamp) ?? '';
        const bTs = toIsoTimestamp(b.messageTimestamp ?? b.timestamp) ?? '';
        return aTs.localeCompare(bTs);
      });
      const candidateMessageIds = sortedMsgs
        .map((msg) => msg.key?.id ?? msg.id ?? msg.messageId ?? '')
        .filter(Boolean);

      const existingMessageIds = new Set<string>();
      if (preExisting?.id && candidateMessageIds.length > 0) {
        const { data: existingMsgs } = await supabase
          .from('chat_messages')
          .select('message_id')
          .eq('contact_id', preExisting.id)
          .in('message_id', candidateMessageIds);
        for (const row of existingMsgs ?? []) {
          if (row.message_id) existingMessageIds.add(row.message_id);
        }
      }

      const msgsToInsert = sortedMsgs.filter((msg) => {
        const messageId = msg.key?.id ?? msg.id ?? msg.messageId ?? '';
        return !!messageId && !existingMessageIds.has(messageId);
      });
      totalSkipped += candidateMessageIds.length - msgsToInsert.length;

      if (preExisting && msgsToInsert.length === 0) {
        continue;
      }

      let contactId = preExisting?.id ?? '';

      if (!preExisting) {
        let profileCols: Record<string, unknown> = {};
        let avatarUrl: string | null = null;
        let contactName = phone;
        try {
          const profile = await fetchWhatsappProfile(queue as any, phone);
          profileCols = profileToContactColumns(profile);
          avatarUrl = profile.avatar ?? null;
          contactName = profile.name ?? phone;
        } catch { /* non-fatal */ }

        const { data: inserted, error: insErr } = await supabase
          .from('chat_contacts')
          .insert({
            client_id: queue.client_id,
            phone,
            name: contactName,
            avatar: avatarUrl,
            channel_type: 'whatsapp_uazapi',
            channel_source: queue.id,
            remote_jid: remoteJid,
            is_group: false,
            history_backfilled: true,
            unread_count: 0,
            ...profileCols,
          })
          .select('id')
          .single();

        if (insErr || !inserted) {
          const { data: existingContact } = await supabase
            .from('chat_contacts')
            .select('id')
            .eq('phone', phone)
            .eq('client_id', queue.client_id)
            .maybeSingle();
          if (!existingContact?.id) {
            console.warn(`[history-set] contact insert failed phone=${phone}`, insErr?.message);
            continue;
          }
          contactId = existingContact.id;
        } else {
          contactId = inserted.id;
          totalContacts++;
          chatContactCreated = true;
        }
      }

      let conversationId: string | null = null;
      const { data: existingConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('client_id', queue.client_id)
        .eq('queue_id', queue.id)
        .eq('channel', 'whatsapp_uazapi')
        .in('status', ['pending', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else if (msgsToInsert.length > 0) {
        const { data: newConv } = await supabase
          .from('chat_conversations')
          .insert({
            contact_id: contactId,
            client_id: queue.client_id,
            queue_id: queue.id,
            channel: 'whatsapp_uazapi',
            status: 'pending',
            priority: 'normal',
            protocol: '',
            metadata: { backfilled: true, source: 'messages.set' },
          })
          .select('id')
          .single();
        if (newConv) conversationId = newConv.id;
      }

      let latestTs: string | null = null;
      let latestPreview: string | null = null;

      for (const msg of msgsToInsert) {
        try {
          const messageId: string = msg.key?.id ?? msg.id ?? msg.messageId ?? '';
          if (!messageId) continue;

          const fromMe: boolean = msg.key?.fromMe ?? msg.fromMe ?? msg.from_me ?? false;
          const text = extractMessageText(msg);
          const type = extractMessageType(msg);
          const mediaUrl = extractMediaUrl(msg);
          const pushName: string = msg.pushName ?? msg.senderName ?? '';

          const isoTs = toIsoTimestamp(msg.messageTimestamp ?? msg.timestamp) ?? new Date().toISOString();

          const { error: msgErr } = await supabase
            .from('chat_messages')
            .insert({
              contact_id: contactId,
              conversation_id: conversationId,
              client_id: queue.client_id,
              message_id: messageId,
              external_id: messageId,
              text: text ? toSafeString(text) : null,
              type,
              from_me: fromMe,
              status: fromMe ? 'read' : 'delivered',
              media_url: mediaUrl ?? null,
              timestamp: isoTs,
              channel_type: 'whatsapp_uazapi',
              sender_name: fromMe ? null : (pushName || null),
              raw_payload: msg,
              metadata: { backfilled: true, source: 'messages.set' },
            });

          if (!msgErr) {
            totalMessages++;
            chatInsertedMessages++;
            // Track latest message for chat list preview
            if (!latestTs || isoTs > latestTs) {
              latestTs = isoTs;
              latestPreview = buildLastMessagePreview(text, type, msg.message?.documentMessage?.fileName || msg.fileName);
            }
          } else if (msgErr.code === '23505' || msgErr.message?.includes('duplicate')) {
            totalSkipped++;
          } else {
            console.warn(`[history-set] msg insert failed phone=${phone} id=${messageId}`, msgErr.message);
            chatError = msgErr.message;
            hadErrors = true;
          }
        } catch (e) {
          console.warn(`[history-set] msg error phone=${phone}`, e);
          chatError = String((e as Error)?.message ?? e);
          hadErrors = true;
        }
      }

      const contactUpdates: Record<string, unknown> = {};
      if (!preExisting?.history_backfilled) contactUpdates.history_backfilled = true;
      const currentLastMessageAt = preExisting?.last_message_at ?? null;
      if (latestTs && (!currentLastMessageAt || latestTs > currentLastMessageAt)) {
        contactUpdates.last_message_at = latestTs;
        contactUpdates.last_message_text = latestPreview;
      }

      if (Object.keys(contactUpdates).length > 0) {
        await supabase
          .from('chat_contacts')
          .update(contactUpdates)
          .eq('id', contactId);
      }

    } catch (chatErr) {
      console.warn(`[history-set] chat error remoteJid=${remoteJid}`, chatErr);
      chatError = String((chatErr as Error)?.message ?? chatErr);
      hadErrors = true;
    }

    // Atualiza log do telefone + contadores do job.
    if (jobId) {
      try {
        await supabase
          .from('whatsapp_sync_job_logs')
          .update({
            status: chatError ? 'error' : (chatInsertedMessages > 0 ? 'ok' : 'skipped'),
            messages_found: msgs.length,
            messages_inserted: chatInsertedMessages,
            contact_created: chatContactCreated,
            error: chatError,
            processed_at: new Date().toISOString(),
          })
          .eq('job_id', jobId)
          .eq('phone', phoneForLog);

        const { data: cur } = await supabase
          .from('whatsapp_sync_jobs')
          .select('processed_numbers, inserted_messages, inserted_contacts')
          .eq('id', jobId)
          .single();
        if (cur) {
          await supabase
            .from('whatsapp_sync_jobs')
            .update({
              processed_numbers: (cur.processed_numbers ?? 0) + 1,
              inserted_messages: (cur.inserted_messages ?? 0) + chatInsertedMessages,
              inserted_contacts: (cur.inserted_contacts ?? 0) + (chatContactCreated ? 1 : 0),
            })
            .eq('id', jobId);
        }
      } catch (logErr) {
        console.warn('[history-set] log update failed', logErr);
      }
    }
  }

    if (jobId) {
      await supabase
        .from('whatsapp_sync_jobs')
        .update({
          status: hadErrors ? 'partial' : 'done',
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  } catch (fatal) {
    console.error('[history-set] fatal error', fatal);
    if (jobId) {
      await supabase
        .from('whatsapp_sync_jobs')
        .update({
          status: 'error',
          error: String((fatal as Error)?.message ?? fatal),
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  }

  console.log(`[history-set] done queue=${queue.name} contacts=${totalContacts} messages=${totalMessages} skipped=${totalSkipped}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const queueId = url.searchParams.get('queue_id');

    if (!queueId) {
      return respond({ error: 'queue_id query param required' }, 400);
    }

    const supabase = getSupabase();

    // Resolve queue to get client_id
    const { data: queue, error: queueError } = await supabase
      .from('queues')
      .select('id, client_id, channel_type, name, evo_url, evo_apikey, waba_token, waba_number_id')
      .eq('id', queueId)
      .single();

    if (queueError || !queue) {
      console.error('[uazapi-chat-webhook] Queue not found:', queueId);
      return respond({ error: 'Queue not found' }, 404);
    }

    const payload = await req.json();
    // Resolve event name resilient to UaZapi sometimes sending `event` as an
    // object instead of string (observed for messages_update payloads).
    function resolveEventName(p: any): string {
      const direct = p?.EventType ?? p?.eventType ?? p?.type;
      if (typeof direct === 'string' && direct.trim()) return direct;

      const raw = p?.event;
      if (raw && typeof raw === 'object') {
        const candidate = raw.type || raw.name || raw.event;
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
        const keys = Object.keys(raw);
        if (keys.length === 1) return keys[0];
      }
      return 'messages';
    }
    const rawEvent = resolveEventName(payload);
    if (payload?.event && typeof payload.event === 'object') {
      console.log('[uazapi-chat-webhook] event was object, resolved to:', rawEvent, 'keys:', Object.keys(payload.event));
    }
    // uazapi.com sends underscore event names (messages_update); Evolution/Baileys
    // send dot-notation (messages.update). Normalize underscore -> dot so the
    // branches below match BOTH providers. 'messages' stays an upsert alias.
    const EVENT_ALIAS: Record<string, string> = {
      messages_update: 'messages.update',
      message_update: 'messages.update',
      'message-update': 'messages.update',
      messages_delete: 'messages.delete',
      message_delete: 'messages.delete',
      connection: 'connection.update',
      connection_update: 'connection.update',
      contacts: 'contacts.update',
      contacts_update: 'contacts.update',
      chats: 'chats.update',
      chats_update: 'chats.update',
    };
    const event = EVENT_ALIAS[rawEvent] || rawEvent;
    // Normalize: treat messages, messages.upsert, message as the same logical MESSAGE_UPSERT event
    const MESSAGE_UPSERT_ALIASES = new Set(['messages', 'messages.upsert', 'message']);
    const isMessageUpsert = MESSAGE_UPSERT_ALIASES.has(event);

    console.log(`[uazapi-chat-webhook] Event: ${event} (isMessageUpsert=${isMessageUpsert}), queue: ${queue.name}`);

    let n8nFanOutPromise: Promise<void> = Promise.resolve();

    // ─── CONNECTION UPDATE ───
    if (event === 'connection.update') {
      const state = payload.state || payload.status;
      console.log(`[uazapi-chat-webhook] Connection state: ${state}`);
      // Could update queue status here in future
      return respond({ ok: true, event: 'connection.update' });
    }

    // ─── STATUS UPDATES (delivered, read, etc.) + EDITS ───
    if (event === 'messages.update') {
      const updates = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.event)
          ? payload.event
          : [payload.data || payload.event || payload];
      for (const upd of updates) {
        const idCandidates = collectMessageIds(upd);
        if (idCandidates.length === 0) continue;
        const rowIds = await resolveChatMessageRowIds(supabase, idCandidates);
        if (rowIds.length === 0) {
          console.warn('[uazapi-chat-webhook] messages.update: no row matched', { idCandidates });
          continue;
        }

        // Inbound EDIT: provider resends the message with new content for an existing id.
        const editedText: string | undefined =
          (typeof upd.edited === 'string' && upd.edited.trim()) ? upd.edited
          : (upd.update?.message?.editedMessage?.message?.conversation
            ?? upd.message?.editedMessage?.message?.conversation
            ?? upd.editedText);
        if (editedText && String(editedText).trim()) {
          const { data: updRows } = await supabase
            .from('chat_messages')
            .update({ text: String(editedText), edited_at: new Date().toISOString() })
            .in('id', rowIds)
            .select('id');
          if (!updRows?.length) {
            console.warn('[uazapi-chat-webhook] messages.update EDIT: no row matched', { idCandidates });
          }
        }

        const mapped = mapStatus(
          upd.status
          ?? upd.update?.status
          ?? upd.ack
          ?? upd.Type
          ?? upd.type
          ?? upd.event?.status
          ?? upd.event?.update?.status,
        );
        if (mapped) {
          const lower = lowerStatusesThan(mapped);
          let q = supabase
            .from('chat_messages')
            .update({ status: mapped })
            .in('id', rowIds);
          // Guard against downgrade (e.g. read → delivered). For 'failed' or
          // unknown statuses with no rank, allow unconditional update.
          if (lower.length > 0) q = q.in('status', lower);
          const { data: stRows } = await q.select('id');
          console.log('[uazapi-chat-webhook] messages.update STATUS', {
            status: mapped, affected: stRows?.length ?? 0, idCandidates,
          });
        }
      }
      return respond({ ok: true, event: 'messages.update', count: updates.length });
    }

    // ─── MESSAGE DELETE ───
    if (event === 'messages.delete') {
      const messageId = payload.id || payload.key?.id;
      if (messageId) {
        await supabase
          .from('chat_messages')
          .update({ type: 'revoked', text: '🚫 Mensagem apagada' })
          .eq('message_id', messageId);
      }
      return respond({ ok: true, event: 'messages.delete' });
    }

    // ─── CONTACTS UPDATE ───
    if (event === 'contacts.update') {
      const contacts = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
      for (const c of contacts) {
        const phone = normalizePhone(c.id || c.phone || '');
        if (!phone) continue;
        const updates: Record<string, unknown> = {};
        if (c.name || c.pushName || c.notify) updates.name = c.name || c.pushName || c.notify;
        if (c.imgUrl || c.profilePictureUrl) updates.avatar = c.imgUrl || c.profilePictureUrl;
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('chat_contacts')
            .update(updates)
            .eq('phone', phone)
            .eq('channel_source', queueId);
        }
      }
      return respond({ ok: true, event: 'contacts.update' });
    }

    // ─── CHATS UPDATE (archive, mute) ───
    if (event === 'chats.update') {
      const chats = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
      for (const ch of chats) {
        const phone = normalizePhone(ch.id || '');
        if (!phone) continue;
        const updates: Record<string, unknown> = {};
        if (ch.archived !== undefined) updates.is_archived = ch.archived;
        if (ch.mute !== undefined) updates.is_muted = !!ch.mute;
        if (ch.unreadCount !== undefined) updates.unread_count = ch.unreadCount;
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('chat_contacts')
            .update(updates)
            .eq('phone', phone)
            .eq('channel_source', queueId);
        }
      }
      return respond({ ok: true, event: 'chats.update' });
    }

    // ─── HISTORY DUMP (messages.set / history) ───
    if (event === 'history' || event === 'messages.set' || event === 'message.history') {
      const historyMsgsRaw: any[] = (
        payload.data?.messages ??
        payload.messages ??
        (Array.isArray(payload.data) ? payload.data : null) ??
        []
      );
      console.log(`[uazapi-webhook] ${event} queue=${queue.name} count=${historyMsgsRaw.length}`);

      const runId = await enqueueHistoryRun(historyMsgsRaw, queue as any, event);
      // NÃO disparamos o processor diretamente — o cron uazapi-history-resume
      // drena os items em lotes pequenos para não saturar o EdgeRuntime.
      return respond({ ok: true, event, queued: historyMsgsRaw.length, run_id: runId });
    }

    // ─── MESSAGES (main handler) ───
    // UaZapi pode enviar em payload.data, payload.message, payload.messages, ou direto
    let messages: any[] = [];
    if (Array.isArray(payload.data)) messages = payload.data;
    else if (Array.isArray(payload.messages)) messages = payload.messages;
    else if (payload.message) messages = [payload.message];
    else if (payload.data) messages = [payload.data];
    else messages = [payload];

    console.log(`[uazapi-chat-webhook] Parsed ${messages.length} message(s). First keys: ${messages[0] ? Object.keys(messages[0]).slice(0, 20).join(',') : 'none'}`);

    const isHistoryReplay = isHistoryReplayEvent(event, payload, messages);
    if (isHistoryReplay) {
      console.log(`[uazapi-chat-webhook] treating batch as history replay event=${event} count=${messages.length}`);
      const runId = await enqueueHistoryRun(messages, queue as any, `${event}:replay`);
      // Idem: cron drena. Webhook responde 200 imediato.
      return respond({ ok: true, event, queued: messages.length, replay: true, run_id: runId });
    }

    if (isMessageUpsert) {
      const { data: agentLinks, error: linksErr } = await supabase
        .from('queue_agent_links')
        .select('cod_agent')
        .eq('queue_id', queueId);

      if (linksErr) console.error('[fan-out] Error fetching links:', linksErr);

      const targets = (agentLinks || []).filter((l: any) => l.cod_agent) as Array<{ cod_agent: string }>;
      console.log(`[fan-out] event=${event} queue=${queueId} targets=${targets.length}`);

      if (targets.length > 0) {
        const N8N_BASE_URL = Deno.env.get('N8N_HUB_WEBHOOK_URL') || 'https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start';
        const rawBody = JSON.stringify(payload);
        // 10s timeout per agent — prevents a slow N8N instance from
        // blocking the whole fan-out when running in EdgeRuntime.waitUntil().
        const N8N_TIMEOUT_MS = 10_000;
        const promises = targets.map((link) => {
          const n8nUrl = `${N8N_BASE_URL}?app=uazapi&c=${link.cod_agent}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
          console.log(`[fan-out] POST n8n agent=${link.cod_agent}`);
          return fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rawBody,
            signal: controller.signal,
          })
            .then((r) => { clearTimeout(timer); console.log(`[fan-out] agent=${link.cod_agent} status=${r.status}`); })
            .catch((err: Error) => {
              clearTimeout(timer);
              const reason = controller.signal.aborted ? `timeout after ${N8N_TIMEOUT_MS}ms` : err.message;
              console.warn(`[fan-out] error agent=${link.cod_agent}: ${reason}`);
            });
        });
        n8nFanOutPromise = Promise.allSettled(promises).then(() => undefined);
      }
    }

    let processed = 0;
    const skipped: Record<string, number> = { group: 0, no_id: 0, no_phone: 0 };
    const backfillTriggered = new Set<string>();
    const audioMessageIdsToTranscribe: string[] = [];
    for (const msg of messages) {
      try {
        const chatId = msg.chatid || msg.chatId || msg.key?.remoteJid || msg.remoteJid || msg.from || msg.sender || '';
        // Strict group detection: only @g.us in a JID counts.
        // Avoid false positives from `isGroup`/`groupName` flags that UaZapi
        // sometimes sends for individual chats.
        const isGroup =
          String(chatId).includes('@g.us') ||
          (typeof msg.wa_chatid === 'string' && msg.wa_chatid.includes('@g.us'));

        // Honor agent's ALLOW_GROUPS flag — silently skip group messages when disabled.
        if (isGroup) {
          const allowGroups = await getAllowGroupsForClient(String(queue.client_id));
          if (!allowGroups) {
            skipped.group++;
            void logDroppedMessage(supabase, {
              client_id: queue.client_id, queue_id: queue.id, queue_name: queue.name,
              source: 'uazapi', reason: 'group_blocked', event, chat_id: String(chatId), msg,
            });
            continue;
          }
        }

        const messageId = msg.id || msg.messageId || msg.message_id || msg.key?.id || msg.wa_messageid;
        if (!messageId) {
          skipped.no_id++;
          console.log('[uazapi-chat-webhook] no messageId, sample:', JSON.stringify(msg).slice(0, 400));
          void logDroppedMessage(supabase, {
            client_id: queue.client_id, queue_id: queue.id, queue_name: queue.name,
            source: 'uazapi', reason: 'no_id', event, chat_id: String(chatId), msg,
          });
          continue;
        }

        // ── EDIT DETECTION: provider may re-deliver edits as a fresh upsert
        //    (with a new key.id) wrapping a protocolMessage.editedMessage.
        //    Detect, UPDATE the original row, and skip the insert.
        const protoEdited = msg.message?.protocolMessage?.editedMessage
          || msg.message?.editedMessage?.message
          || msg.editedMessage?.message
          || null;
        const originalEditedId: string | undefined =
          msg.message?.protocolMessage?.key?.id
          || msg.message?.editedMessage?.message?.protocolMessage?.key?.id
          || msg.editedMessageId
          || msg.edited?.id;
        const editedText: string | undefined =
          protoEdited?.conversation
          || protoEdited?.extendedTextMessage?.text
          || (typeof msg.edited === 'string' ? msg.edited : undefined);
        if (originalEditedId && editedText && String(editedText).trim()) {
          const { data: upd, error: updErr } = await supabase
            .from('chat_messages')
            .update({ text: String(editedText), edited_at: new Date().toISOString() })
            .eq('client_id', queue.client_id)
            .or(`message_id.eq.${originalEditedId},external_id.eq.${originalEditedId}`)
            .select('id');
          console.log('[uazapi-chat-webhook] edit-detected via upsert', {
            originalEditedId, affected: upd?.length ?? 0, err: updErr?.message,
          });
          processed++;
          continue; // do NOT insert as a new message
        }

        const { data: existingMessage } = await supabase
          .from('chat_messages')
          .select('id, status')
          .eq('client_id', queue.client_id)
          .or(`message_id.eq.${messageId},external_id.eq.${messageId}`)
          .limit(1)
          .maybeSingle();

        if (existingMessage) {
          // Some providers re-deliver the outbound echo of an already-sent
          // message inside the upsert stream (instead of as messages.update),
          // carrying a fresher status like Delivered/Read. Apply the status
          // bump here too — otherwise outbound ticks stay stuck at 'sent'.
          const upsertStatus = mapStatus(msg.status ?? msg.ack);
          if (upsertStatus) {
            const lower = lowerStatusesThan(upsertStatus);
            if (lower.length === 0 || lower.includes(String(existingMessage.status))) {
              await supabase
                .from('chat_messages')
                .update({ status: upsertStatus })
                .eq('id', existingMessage.id);
              console.log('[uazapi-chat-webhook] upsert STATUS bump', {
                from: existingMessage.status, to: upsertStatus, messageId,
              });
            }
          }
          processed++;
          continue;
        }

        const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? msg.wa_fromMe ?? false;

        // Resolve PEER (group id or peer phone) — never the instance owner.
        let senderPhone = '';
        let groupName = '';
        if (isGroup) {
          const rawGroupId = String(chatId || msg.wa_chatid || '').replace(/@g\.us.*/, '').trim();
          if (!rawGroupId) {
            skipped.no_phone++;
            console.log('[uazapi-chat-webhook] group without id, sample:', JSON.stringify(msg).slice(0, 300));
            void logDroppedMessage(supabase, {
              client_id: queue.client_id, queue_id: queue.id, queue_name: queue.name,
              source: 'uazapi', reason: 'group_no_id', event, chat_id: String(chatId), from_me: fromMe, msg,
            });
            continue;
          }
          senderPhone = rawGroupId;
          groupName = msg.groupName || msg.wa_groupName || msg.subject || `Grupo ${rawGroupId.slice(-6)}`;
        } else {
          let candidates: any[];
          if (fromMe) {
            candidates = [msg.chatid, msg.chatId, msg.wa_chatid, msg.to, msg.recipient];
          } else {
            candidates = [
              msg.chatid,
              msg.chatId,
              msg.sender_pn,
              msg.PhoneNumber,
              msg.phone,
              msg.from,
              msg.sender,
              msg.wa_chatid,
              chatId,
            ];
          }
          for (const cand of candidates) {
            if (!cand) continue;
            const raw = String(cand);
            if (raw.includes('@lid')) continue;
            if (raw.includes('@g.us')) continue;
            const normalized = normalizePhone(raw);
            if (normalized && normalized.length >= 8 && normalized.length <= 13) {
              senderPhone = normalized;
              break;
            }
          }
          if (!senderPhone) {
            skipped.no_phone++;
            console.log('[uazapi-chat-webhook] no valid peer phone, fromMe=', fromMe, 'sample:', JSON.stringify({ chatid: msg.chatid, sender: msg.sender, sender_pn: msg.sender_pn, from: msg.from }).slice(0, 300));
            void logDroppedMessage(supabase, {
              client_id: queue.client_id, queue_id: queue.id, queue_name: queue.name,
              source: 'uazapi', reason: 'no_phone', event, chat_id: String(chatId), from_me: fromMe, msg,
            });
            continue;
          }
        }

        // Anti-echo filter removed (causava falsos positivos com mesmo número em filas diferentes).

        // pushName/senderName belongs to the message author. For fromMe=true that's the OWNER.
        // In groups, pushName is the in-group sender — store on message but never use as contact name.
        const pushName = fromMe ? '' : (msg.pushName || msg.senderName || msg.wa_contactName || '');
        const text = extractMessageText(msg);
        const type = extractMessageType(msg);
        const mediaUrl = extractMediaUrl(msg);
        const timestamp = msg.messageTimestamp || msg.timestamp;
        let isoTimestamp: string;
        if (timestamp) {
          const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp);
          const msTs = ts > 1e12 ? ts : ts * 1000;
          const d = new Date(msTs);
          isoTimestamp = (d.getFullYear() > 2000 && d.getFullYear() < 2100) ? d.toISOString() : new Date().toISOString();
        } else {
          isoTimestamp = new Date().toISOString();
        }

        // ── Upsert contact ──
        const { data: preExisting } = await supabase
          .from('chat_contacts')
          .select('id, name, avatar, history_backfilled, unread_count')
          .eq('phone', senderPhone)
          .eq('client_id', queue.client_id)
          .maybeSingle();
        const isNewContact = !preExisting;
        const alreadyBackfilled = preExisting?.history_backfilled === true;
        const nextUnreadCount = fromMe
          ? (preExisting?.unread_count || 0)
          : (preExisting?.unread_count || 0) + 1;

        const isPhoneLikeName = (n: string | null | undefined): boolean => {
          if (!n) return true;
          if (n === senderPhone) return true;
          if (normalizePhone(n) === senderPhone) return true;
          return /^[\d\s+\-()]+$/.test(n.trim());
        };

        let contactNameToWrite: string;
        if (isGroup) {
          contactNameToWrite = preExisting?.name && !isPhoneLikeName(preExisting.name)
            ? preExisting.name
            : groupName;
        } else if (preExisting?.name) {
          contactNameToWrite = (!fromMe && pushName && isPhoneLikeName(preExisting.name))
            ? pushName
            : preExisting.name;
        } else {
          contactNameToWrite = (!fromMe && pushName) ? pushName : senderPhone;
        }

        const { data: contact }: { data: any } = await supabase
          .from('chat_contacts')
          .upsert({
            client_id: queue.client_id,
            phone: senderPhone,
            name: contactNameToWrite,
            channel_type: 'whatsapp_uazapi',
            channel_source: queueId,
            // NEVER persist a @lid identifier — always normalize to <phone>@s.whatsapp.net
            // (or @g.us for groups). This avoids contacts being keyed by LinkedIDs.
            remote_jid: (chatId && !String(chatId).includes('@lid'))
              ? chatId
              : (isGroup ? `${senderPhone}@g.us` : `${senderPhone}@s.whatsapp.net`),
            is_group: isGroup,
            avatar: fromMe ? ((preExisting as any)?.avatar ?? null) : (msg.profilePictureUrl || msg.groupPictureUrl || null),
            last_message_at: isoTimestamp,
            last_message_text: (isGroup && pushName ? `${pushName}: ` : '') + buildLastMessagePreview(text, type, msg.message?.documentMessage?.fileName || msg.fileName),
            unread_count: nextUnreadCount,
          }, {
            onConflict: 'phone,client_id',
            ignoreDuplicates: false,
          })
          .select('id, unread_count')
          .single();

        if (!contact) continue;

        // ── Enrich profile (avatar, name, wa_*, lead_*) ──
        // Runs only when the contact is brand new OR still has no avatar after persistence.
        // No TTL / no retries: a single attempt at "first contact" is enough.
        const needsEnrich = isNewContact || !preExisting?.avatar;
        if (needsEnrich) {
          // For groups, query by the group JID so /group/info is used.
          const lookupKey = isGroup
            ? (chatId && String(chatId).includes('@g.us') ? String(chatId) : `${senderPhone}@g.us`)
            : senderPhone;
          // Fire-and-forget so we don't block message persistence
          (async () => {
            try {
              const profile = await fetchWhatsappProfile(queue as any, lookupKey);
              const cols = profileToContactColumns(profile);
              const update: Record<string, unknown> = { ...cols };
              if (profile.avatar) update.avatar = profile.avatar;
              if (profile.name && (isPhoneLikeName(contactNameToWrite) || isNewContact)) {
                update.name = profile.name;
              }
              if (profile.remoteJid && !String(profile.remoteJid).includes('@lid')) {
                update.remote_jid = profile.remoteJid;
              }
              await supabase.from('chat_contacts').update(update).eq('id', contact.id);
            } catch (e) {
              console.warn(`[uazapi-chat-webhook] enrich failed phone=${senderPhone}: ${(e as Error).message}`);
            }
          })();
        }

        // ── Trigger one-time backfill from UaZapi for new contacts ──
        if (!isGroup && (isNewContact || !alreadyBackfilled) && !backfillTriggered.has(contact.id)) {
          backfillTriggered.add(contact.id);
          const backfillUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/uazapi-chat-backfill`;
          void fetch(backfillUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              queue_id: queueId,
              contact_id: contact.id,
              chat_id: chatId || senderPhone,
              phone: senderPhone,
              limit: 50,
            }),
          }).catch((e) => console.warn('[uazapi-chat-webhook] backfill trigger failed:', e));
        }

        // ── Get or create conversation ──
        let conversationId: string | null = null;

        // 1) Look for an active conversation (pending or open)
        const { data: activeConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('client_id', queue.client_id)
          .eq('queue_id', queueId)
          .eq('channel', 'whatsapp_uazapi')
          .in('status', ['pending', 'open'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeConv) {
          conversationId = activeConv.id;
        } else {
          // 2) Check for a resolved conversation to reopen (resolved = soft close).
          //    Lookup mais permissivo: ignora queue_id (caso a fila tenha sido trocada),
          //    mantém isolamento por canal.
          const { data: resolvedConv }: { data: any } = await supabase
            .from('chat_conversations')
            .select('id, queue_id, assigned_to')
            .eq('contact_id', contact.id)
            .eq('client_id', queue.client_id)
            .eq('channel', 'whatsapp_uazapi')
            .eq('status', 'resolved')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (resolvedConv) {
            if (!fromMe) {
              const hasAssignee = !!(resolvedConv.assigned_to && String(resolvedConv.assigned_to).trim() !== '');
              const newStatus = hasAssignee ? 'open' : 'pending';
              const update: Record<string, unknown> = {
                status: newStatus,
                resolved_at: null,
                updated_at: new Date().toISOString(),
              };
              const queueChanged = resolvedConv.queue_id !== queueId;
              if (queueChanged) update.queue_id = queueId;
              await supabase.from('chat_conversations').update(update).eq('id', resolvedConv.id);
              await supabase.from('chat_conversation_history').insert({
                conversation_id: resolvedConv.id,
                action: 'reopened',
                actor_name: 'Sistema (webhook)',
                notes: hasAssignee
                  ? (queueChanged
                      ? 'Cliente respondeu após resolução — atribuição mantida; fila atualizada'
                      : 'Cliente respondeu após resolução — atribuição mantida')
                  : (queueChanged
                      ? 'Cliente respondeu após resolução — sem responsável, devolvida à fila; fila atualizada'
                      : 'Cliente respondeu após resolução — sem responsável, devolvida à fila'),
              });
            }
            conversationId = resolvedConv.id;
          } else {
            // 3) No active or resolved conversation — create new (also for echoes,
            // so external sends/agent replies are not orphaned with conversation_id=null)
            const { data: newConv } = await supabase
              .from('chat_conversations')
              .insert({
                contact_id: contact.id,
                client_id: queue.client_id,
                queue_id: queueId,
                channel: 'whatsapp_uazapi',
                status: 'pending',
                priority: 'normal',
                protocol: '',
                assigned_to: null,
              })
              .select('id')
              .single();

            if (newConv) {
              conversationId = newConv.id;
              await supabase.from('chat_conversation_history').insert({
                conversation_id: newConv.id,
                action: 'opened',
                actor_name: 'Sistema (webhook)',
                to_value: 'pending',
              });
            } else {
              // INSERT bloqueado pelo índice único parcial (race: outro worker
              // criou em paralelo). Recupera a conversa ativa que já existe.
              const { data: raceConv } = await supabase
                .from('chat_conversations')
                .select('id')
                .eq('contact_id', contact.id)
                .eq('client_id', queue.client_id)
                .eq('queue_id', queueId)
                .eq('channel', 'whatsapp_uazapi')
                .in('status', ['pending', 'open'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (raceConv) conversationId = raceConv.id;
            }
          }
        }

        // ── Insert message (deduplicate by message_id) ──
        // ── Reactions: persist into chat_message_reactions instead of chat_messages ──
        if (type === 'reaction') {
          try {
            const rm = msg.message?.reactionMessage || msg.reactionMessage || {};
            const targetExternalId =
              rm.key?.id || rm.id || msg.reaction?.key?.id || msg.reaction?.id || null;
            const emoji = toSafeString(rm.text ?? msg.reaction?.text ?? '').trim();
            const reactor = fromMe
              ? 'me'
              : (msg.participant || msg.sender || msg.sender_pn || senderPhone);

            if (targetExternalId) {
              const { data: targetMsg } = await supabase
                .from('chat_messages')
                .select('id')
                .eq('client_id', queue.client_id)
                .eq('contact_id', contact.id)
                .eq('message_id', targetExternalId)
                .limit(1)
                .maybeSingle();

              if (targetMsg) {
                // Always remove previous reaction by this reactor on this message
                await supabase
                  .from('chat_message_reactions')
                  .delete()
                  .eq('message_id', targetMsg.id)
                  .eq('reactor', reactor);

                if (emoji) {
                  await supabase.from('chat_message_reactions').insert({
                    message_id: targetMsg.id,
                    external_message_id: targetExternalId,
                    reactor,
                    emoji,
                    from_me: !!fromMe,
                  });
                }
              } else {
                console.log('[uazapi-chat-webhook] reaction target not found locally, skipping. external_id=', targetExternalId);
              }
            }
          } catch (rErr) {
            console.error('[uazapi-chat-webhook] reaction processing error:', rErr);
          }
          processed++;
          continue; // do NOT insert reaction as a chat_messages row
        }

        // Reply/forward context. uazapi.com sends a FLAT payload (msg.quoted =
        // id da mensagem citada); Evolution/Baileys nest it under contextInfo.
        const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
          || msg.message?.imageMessage?.contextInfo
          || msg.message?.videoMessage?.contextInfo
          || msg.message?.audioMessage?.contextInfo
          || msg.message?.documentMessage?.contextInfo
          || (msg.content && typeof msg.content === 'object' ? (msg.content as any).contextInfo : null)
          || msg.contextInfo
          || null;
        const quotedId = msg.quoted || msg.quotedMessageId || ctxInfo?.stanzaId || ctxInfo?.stanzaID || null;
        const qm = ctxInfo?.quotedMessage;
        const embeddedQuotedText = qm?.conversation
          || qm?.extendedTextMessage?.text
          || qm?.imageMessage?.caption
          || qm?.videoMessage?.caption
          || qm?.documentMessage?.caption
          || null;
        const embeddedQuotedType = qm
          ? (qm.imageMessage ? 'image' : qm.videoMessage ? 'video' : qm.audioMessage ? 'audio' : qm.documentMessage ? 'document' : 'text')
          : null;
        // Determine who sent the quoted message. In an inbound reply (fromMe=false),
        // if contextInfo.participant matches the contact's own JID, the quoted msg
        // was the lead's own previous message; otherwise it's ours (from_me=true).
        const ctxParticipant = ctxInfo?.participant || null;
        const contactJids = [msg.sender_lid, msg.sender, msg.sender_pn, msg.chatid, msg.chatlid].filter(Boolean);
        let embeddedFromMe: boolean;
        if (fromMe) {
          embeddedFromMe = !ctxParticipant || contactJids.includes(ctxParticipant) ? false : true;
        } else {
          embeddedFromMe = ctxParticipant && contactJids.includes(ctxParticipant) ? false : true;
        }
        const embeddedSenderName = embeddedFromMe ? null : (contact?.name || senderPhone || null);
        const quotedMeta = await resolveQuotedMeta(
          supabase, queue.client_id, quotedId,
          { text: embeddedQuotedText, type: embeddedQuotedType, from_me: embeddedFromMe, sender_name: embeddedSenderName },
        );

        const { data: insertedMsg, error: msgError } = await supabase
          .from('chat_messages')
          .insert({
            contact_id: contact.id,
            client_id: queue.client_id,
            message_id: messageId,
            external_id: messageId,
            text: toSafeString(text) || (type !== 'text' ? buildLastMessagePreview(text, type, msg.message?.documentMessage?.fileName || msg.fileName) : null),
            type,
            from_me: fromMe,
            status: fromMe ? 'sent' : 'received',
            media_url: mediaUrl || null,
            file_name: msg.message?.documentMessage?.fileName || msg.fileName || null,
            caption: toSafeString(msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || msg.caption) || null,
            reply_to: quotedId || null,
            timestamp: isoTimestamp,
            channel_type: 'whatsapp_uazapi',
            conversation_id: conversationId,
            sender_name: fromMe ? null : pushName || null,
            is_forwarded: msg.forwarded ?? msg.isForwarded ?? ctxInfo?.isForwarded ?? false,
            forwarded_score: msg.forwardingScore ?? ctxInfo?.forwardingScore ?? null,
            raw_payload: msg,
            metadata: {
              sender_id: msg.participant || null,
              sender_name: pushName || null,
              is_ptt: msg.message?.audioMessage?.ptt || false,
              duration: msg.message?.audioMessage?.seconds || msg.message?.videoMessage?.seconds || null,
              mimetype: msg.message?.audioMessage?.mimetype
                || msg.message?.imageMessage?.mimetype
                || msg.message?.videoMessage?.mimetype
                || msg.message?.documentMessage?.mimetype
                || null,
              ...(quotedMeta ? { quoted_message: quotedMeta } : {}),
            },
          })
          .select('id')
          .maybeSingle();

        if (msgError) {
          const isDuplicate = msgError.code === '23505' || msgError.message?.toLowerCase().includes('duplicate');
          if (!isDuplicate) {
            console.error('[uazapi-chat-webhook] Message insert error:', msgError);
            continue;
          }
        }

        // Track audio/ptt inserts (both fromMe and !fromMe) for auto-transcription
        if (insertedMsg?.id && (type === 'audio' || type === 'ptt')) {
          audioMessageIdsToTranscribe.push(insertedMsg.id);
        }

        processed++;
      } catch (msgErr) {
        console.error('[uazapi-chat-webhook] Error processing message:', msgErr);
      }
    }

    console.log(`[uazapi-chat-webhook] Done. processed=${processed} skipped=${JSON.stringify(skipped)} backfills=${backfillTriggered.size}`);

    // Auto-transcribe audios when ANY agent of the queue's client_id has AUTO_TRANSCRIBE_AUDIO enabled.
    // Fire-and-forget via EdgeRuntime.waitUntil so the webhook responds immediately.
    if (audioMessageIdsToTranscribe.length > 0) {
      const transcribePromise = (async () => {
        try {
          const { fetchEffectiveQueueFlags } = await import('../_shared/agentSettings.ts');
          const flags = await fetchEffectiveQueueFlags(queue.client_id, queue.id);
          if (!flags.autoTranscribeAudio) {
            console.log('[uazapi-chat-webhook] auto-transcribe disabled (client/queue)', queue.client_id, queue.id);
            return;
          }
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          for (const mid of audioMessageIdsToTranscribe) {
            fetch(`${supabaseUrl}/functions/v1/chat-transcribe-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
              },
              body: JSON.stringify({ message_id: mid }),
            }).catch((e) => console.warn('[uazapi-chat-webhook] transcribe invoke err:', String(e)));
          }
        } catch (e) {
          console.warn('[uazapi-chat-webhook] auto-transcribe error:', String(e));
        }
      })();
      EdgeRuntime.waitUntil(transcribePromise);
    }

    // Move n8n fan-out to background so webhook responds immediately.
    // EdgeRuntime.waitUntil keeps the isolate alive until the promise settles
    // without blocking the HTTP response — prevents duplicate deliveries caused
    // by provider retries when fan-out to many agents takes > 15s.
    if (n8nFanOutPromise) {
      EdgeRuntime.waitUntil(n8nFanOutPromise);
    }

    return respond({ ok: true, event, processed, skipped, backfills: backfillTriggered.size });
  } catch (error) {
    console.error('[uazapi-chat-webhook] Error:', error);
    return respond({ error: (error as Error).message }, 500);
  }
});
