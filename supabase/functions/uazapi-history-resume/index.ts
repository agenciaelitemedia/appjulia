// ============================================
// UaZapi History Resume Worker
// Cron-driven worker that drains uazapi_history_items with status='pending'
// in small batches, avoiding EdgeRuntime saturation that occurs when many
// `messages:replay` events arrive at once.
//
// Each pending item carries its own `payload` (jsonb array of raw messages),
// stored at enqueue time by the webhook. The worker reprocesses one item at
// a time and updates the parent run aggregates.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchWhatsappProfile, profileToContactColumns } from "../_shared/whatsapp-profile.ts";

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

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/@.*/, '').replace(/[^\d]/g, '');
}
function isGroupJid(v: unknown): boolean { return typeof v === 'string' && v.includes('@g.us'); }
function isLidJid(v: unknown): boolean { return typeof v === 'string' && v.includes('@lid'); }

function resolvePeerPhone(msg: any): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const fromMe: boolean = msg.key?.fromMe ?? msg.fromMe ?? msg.from_me ?? false;
  const ordered: unknown[] = [
    msg.sender_pn, msg.PhoneNumber, msg.phone,
    msg.chatid, msg.chatId, msg.key?.remoteJid, msg.remoteJid, msg.wa_chatid,
    fromMe ? msg.to : msg.from, msg.sender, msg.recipient,
  ];
  for (const cand of ordered) {
    if (!cand) continue;
    const raw = String(cand);
    if (isLidJid(raw) || isGroupJid(raw)) continue;
    const n = normalizePhone(raw);
    if (n && n.length >= 8 && n.length <= 13) return n;
  }
  return null;
}

function isGroupMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  const jids = [msg.key?.remoteJid, msg.remoteJid, msg.chatId, msg.chatid, msg.wa_chatid, msg.from, msg.to];
  return jids.some(isGroupJid);
}

function toSafeString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as any;
    const c = o.body ?? o.text ?? o.caption ?? o.message ?? o.conversation;
    if (typeof c === 'string') return c;
  }
  return '';
}
function extractText(msg: any): string | undefined {
  const candidates = [
    msg.content?.caption, msg.text, msg.body, msg.caption,
    msg.message?.conversation,
    msg.message?.extendedTextMessage?.text,
    msg.message?.imageMessage?.caption,
    msg.message?.videoMessage?.caption,
    msg.message?.documentMessage?.caption,
  ];
  for (const c of candidates) {
    const s = toSafeString(c).trim();
    if (s && !s.startsWith('{') && !s.startsWith('[') && s !== '[object Object]') return s;
  }
  return undefined;
}
function extractType(msg: any): string {
  const mt = (msg.mediaType || msg.messageType || msg.type || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt || msg.isPtt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg.message?.contactMessage) return 'contact';
  if (mt.includes('reaction') || msg.message?.reactionMessage) return 'reaction';
  if (mt.includes('revoked') || mt.includes('protocol')) return 'revoked';
  if ((msg.type === 'media' || mt === 'media') && msg.content?.URL) return 'image';
  return 'text';
}
function extractMediaUrl(msg: any): string | undefined {
  return msg.content?.URL || msg.content?.url
    || msg.fileURL || msg.file_url || msg.mediaUrl || msg.media?.url
    || msg.message?.imageMessage?.url
    || msg.message?.videoMessage?.url
    || msg.message?.audioMessage?.url
    || msg.message?.documentMessage?.url
    || msg.message?.stickerMessage?.url
    || undefined;
}
function toIso(rawTs: unknown): string | null {
  if (rawTs == null || rawTs === '') return null;
  const n = typeof rawTs === 'number' ? rawTs : Number(rawTs);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return d.getFullYear() > 2000 && d.getFullYear() < 2100 ? d.toISOString() : null;
}
function buildPreview(text: unknown, type: string, fileName?: string): string {
  const labels: Record<string, string> = {
    image: '📷 Imagem', video: '🎥 Vídeo', audio: '🎵 Áudio', ptt: '🎵 Áudio',
    sticker: '🏷️ Sticker', location: '📍 Localização', contact: '👤 Contato',
    reaction: '💬 Reação', revoked: '🚫 Mensagem apagada',
  };
  const t = toSafeString(text).trim();
  const safe = (t.startsWith('{') || t.startsWith('[') || t === '[object Object]') ? '' : t;
  if (type === 'document') return `📎 ${fileName || 'Documento'}`;
  if (labels[type]) return safe ? `${labels[type]}: ${safe.slice(0, 80)}` : labels[type];
  if (safe) return safe.slice(0, 120);
  return '📎 Mídia';
}

interface PendingItem {
  id: string;
  run_id: string;
  remote_jid: string;
  phone: string | null;
  payload: any[] | null;
  attempts: number;
}

async function processOneItem(supabase: any, item: PendingItem, run: any, queue: any) {
  const clientId = String(run.client_id);
  const messages: any[] = Array.isArray(item.payload) ? item.payload : [];

  // No payload stored (legacy item) — cannot recover, mark as error.
  if (messages.length === 0) {
    await supabase.from('uazapi_history_items').update({
      status: 'error',
      error: 'no_payload_stored',
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return { processed: 1, inserted: 0, duplicates: 0, contactCreated: 0, error: true };
  }

  // Resolve real phone (LID-safe)
  let phone: string | null = item.phone && !isLidJid(item.remote_jid) ? item.phone : null;
  if (!phone) {
    for (const m of messages) {
      const p = resolvePeerPhone(m);
      if (p) { phone = p; break; }
    }
  }
  if (!phone) {
    await supabase.from('uazapi_history_items').update({
      status: 'error',
      error: 'no_real_phone',
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return { processed: 1, inserted: 0, duplicates: 0, contactCreated: 0, error: true };
  }

  const remoteJid = `${phone}@s.whatsapp.net`;
  let chatInserted = 0;
  let chatDuplicates = 0;
  let contactCreated = false;
  let chatError: string | null = null;

  try {
    const { data: existingContact } = await supabase
      .from('chat_contacts')
      .select('id, last_message_at, last_message_text, history_backfilled')
      .eq('phone', phone).eq('client_id', clientId).maybeSingle();

    const sortedMsgs = messages
      .filter((m) => !isGroupMessage(m))
      .sort((a, b) => {
        const aTs = toIso(a.messageTimestamp ?? a.timestamp) ?? '';
        const bTs = toIso(b.messageTimestamp ?? b.timestamp) ?? '';
        return aTs.localeCompare(bTs);
      });
    const candidateIds = sortedMsgs.map((m) => m.key?.id ?? m.id ?? m.messageId ?? '').filter(Boolean);

    const existingIds = new Set<string>();
    if (existingContact?.id && candidateIds.length > 0) {
      const { data: existing } = await supabase.from('chat_messages')
        .select('message_id').eq('contact_id', existingContact.id).in('message_id', candidateIds);
      for (const row of existing ?? []) if (row.message_id) existingIds.add(row.message_id);
    }
    const newMsgs = sortedMsgs.filter((m) => {
      const mid = m.key?.id ?? m.id ?? m.messageId ?? '';
      return mid && !existingIds.has(mid);
    });
    chatDuplicates = candidateIds.length - newMsgs.length;

    let contactId = existingContact?.id ?? '';
    if (!existingContact) {
      let profileCols: Record<string, unknown> = {};
      let avatarUrl: string | null = null;
      let contactName = phone;
      try {
        if (queue?.evo_url && queue?.evo_apikey) {
          const profile = await fetchWhatsappProfile(queue as any, phone);
          profileCols = profileToContactColumns(profile);
          avatarUrl = profile.avatar ?? null;
          contactName = profile.name ?? phone;
        }
      } catch { /* non-fatal */ }

      const { data: inserted, error: insErr } = await supabase.from('chat_contacts').insert({
        client_id: clientId, phone, name: contactName, avatar: avatarUrl,
        channel_type: 'whatsapp_uazapi',
        channel_source: queue?.id ?? run.queue_id,
        remote_jid: remoteJid, is_group: false,
        history_backfilled: true, unread_count: 0, ...profileCols,
      }).select('id').single();
      if (insErr || !inserted) {
        const { data: again } = await supabase.from('chat_contacts').select('id')
          .eq('phone', phone).eq('client_id', clientId).maybeSingle();
        if (!again?.id) throw new Error(`contact insert failed: ${insErr?.message}`);
        contactId = again.id;
      } else {
        contactId = inserted.id; contactCreated = true;
      }
    }

    let conversationId: string | null = null;
    const { data: activeConv } = await supabase.from('chat_conversations')
      .select('id').eq('contact_id', contactId).eq('client_id', clientId)
      .in('status', ['pending', 'open'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (activeConv) {
      conversationId = activeConv.id;
    } else if (newMsgs.length > 0) {
      const { data: newConv } = await supabase.from('chat_conversations').insert({
        contact_id: contactId, client_id: clientId,
        queue_id: queue?.id ?? run.queue_id ?? null,
        channel: 'whatsapp_uazapi', status: 'pending', priority: 'normal',
        protocol: '', metadata: { source: 'uazapi_history_resume', run_id: run.id },
      }).select('id').single();
      if (newConv) conversationId = newConv.id;
    }

    let latestTs: string | null = existingContact?.last_message_at ?? null;
    let latestPreview: string | null = existingContact?.last_message_text ?? null;
    let latestFromHistory = false;

    for (const msg of newMsgs) {
      const messageId: string = msg.key?.id ?? msg.id ?? msg.messageId ?? '';
      if (!messageId) continue;
      const fromMe: boolean = msg.key?.fromMe ?? msg.fromMe ?? msg.from_me ?? false;
      const text = extractText(msg);
      const type = extractType(msg);
      if (type === 'reaction') continue;
      const mediaUrl = extractMediaUrl(msg);
      const pushName: string = msg.pushName ?? msg.senderName ?? '';
      const isoTs = toIso(msg.messageTimestamp ?? msg.timestamp) ?? new Date().toISOString();

      const { error: msgErr } = await supabase.from('chat_messages').insert({
        contact_id: contactId, conversation_id: conversationId, client_id: clientId,
        message_id: messageId, external_id: messageId,
        text: text ? toSafeString(text) : null, type, from_me: fromMe,
        status: 'read', media_url: mediaUrl ?? null, timestamp: isoTs,
        channel_type: 'whatsapp_uazapi',
        sender_name: fromMe ? null : (pushName || null),
        raw_payload: msg,
        metadata: { source: 'uazapi_history_resume', run_id: run.id, history: true },
      });
      if (!msgErr) {
        chatInserted++;
        if (!latestTs || isoTs > latestTs) {
          latestTs = isoTs;
          latestPreview = buildPreview(text, type, msg.message?.documentMessage?.fileName || msg.fileName);
          latestFromHistory = true;
        }
      } else if (msgErr.code === '23505' || msgErr.message?.includes('duplicate')) {
        chatDuplicates++;
      } else {
        chatError = msgErr.message;
      }
    }

    const updates: Record<string, unknown> = { unread_count: 0 };
    if (existingContact && !existingContact.history_backfilled) updates.history_backfilled = true;
    if (latestFromHistory && latestTs && (!existingContact?.last_message_at || latestTs > existingContact.last_message_at)) {
      updates.last_message_at = latestTs;
      updates.last_message_text = latestPreview;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('chat_contacts').update(updates).eq('id', contactId);
    }

    await supabase.from('uazapi_history_items').update({
      status: chatError ? 'error' : (chatInserted > 0 ? 'ok' : 'skipped'),
      inserted_messages: chatInserted,
      duplicate_messages: chatDuplicates,
      contact_created: contactCreated,
      conversation_created: !!conversationId,
      error: chatError,
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      // free up payload to keep table small once successfully drained
      payload: chatError ? item.payload : null,
    }).eq('id', item.id);

    return { processed: 1, inserted: chatInserted, duplicates: chatDuplicates, contactCreated: contactCreated ? 1 : 0, error: !!chatError };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.warn(`[uazapi-history-resume] item error id=${item.id}:`, msg);
    await supabase.from('uazapi_history_items').update({
      status: 'error',
      inserted_messages: chatInserted,
      duplicate_messages: chatDuplicates,
      error: msg,
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return { processed: 1, inserted: chatInserted, duplicates: chatDuplicates, contactCreated: 0, error: true };
  }
}

async function finalizeRunIfDone(supabase: any, runId: string) {
  // If no more pending items for this run → mark run done/partial and aggregate
  const { count: stillPending } = await supabase
    .from('uazapi_history_items')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId).eq('status', 'pending');
  if ((stillPending ?? 0) > 0) return;

  const { data: items } = await supabase
    .from('uazapi_history_items')
    .select('status, inserted_messages, duplicate_messages, contact_created')
    .eq('run_id', runId);
  const list = items ?? [];
  const totalInserted = list.reduce((a: number, b: any) => a + (b.inserted_messages || 0), 0);
  const totalDuplicates = list.reduce((a: number, b: any) => a + (b.duplicate_messages || 0), 0);
  const totalContacts = list.reduce((a: number, b: any) => a + (b.contact_created ? 1 : 0), 0);
  const processed = list.length;
  const hadErrors = list.some((b: any) => b.status === 'error');

  await supabase.from('uazapi_history_runs').update({
    status: hadErrors ? 'partial' : 'done',
    processed_chats: processed,
    inserted_messages: totalInserted,
    duplicate_messages: totalDuplicates,
    inserted_contacts: totalContacts,
    finished_at: new Date().toISOString(),
  }).eq('id', runId);
}

async function drain(maxItems: number) {
  const supabase = getSupabase();

  const { data: items, error } = await supabase
    .from('uazapi_history_items')
    .select('id, run_id, remote_jid, phone, payload, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(maxItems);

  if (error) {
    console.error('[uazapi-history-resume] fetch pending failed:', error.message);
    return { picked: 0, processed: 0, inserted: 0 };
  }

  const list = (items ?? []) as PendingItem[];
  if (list.length === 0) return { picked: 0, processed: 0, inserted: 0 };

  // Cache run + queue per run_id to avoid N round-trips
  const runCache = new Map<string, any>();
  const queueCache = new Map<string, any>();

  let totalInserted = 0;
  const touchedRuns = new Set<string>();

  for (const item of list) {
    let run = runCache.get(item.run_id);
    if (!run) {
      const { data } = await supabase.from('uazapi_history_runs').select('*').eq('id', item.run_id).single();
      if (!data) continue;
      run = data; runCache.set(item.run_id, run);
    }
    let queue = run.queue_id ? queueCache.get(run.queue_id) : null;
    if (run.queue_id && !queue) {
      const { data } = await supabase.from('queues')
        .select('id, client_id, name, channel_type, evo_url, evo_apikey, evo_instance')
        .eq('id', run.queue_id).maybeSingle();
      queue = data; if (queue) queueCache.set(run.queue_id, queue);
    }

    // Mark run as running on first touch
    if (run.status === 'pending') {
      await supabase.from('uazapi_history_runs').update({
        status: 'running', started_at: new Date().toISOString(),
      }).eq('id', run.id);
      run.status = 'running';
    }

    const r = await processOneItem(supabase, item, run, queue);
    totalInserted += r.inserted;
    touchedRuns.add(item.run_id);
  }

  for (const runId of touchedRuns) {
    await finalizeRunIfDone(supabase, runId);
  }

  console.log(`[uazapi-history-resume] picked=${list.length} inserted=${totalInserted} runs=${touchedRuns.size}`);
  return { picked: list.length, processed: list.length, inserted: totalInserted };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let max = 5;
    let force = false;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (typeof body?.max_items === 'number') max = Math.max(1, Math.min(50, body.max_items));
        force = !!body?.force;
      } catch { /* empty body OK */ }
    }
    // When `force=true` we drain a larger batch in one go (still bounded)
    if (force) max = Math.max(max, 25);

    const result = await drain(max);
    return respond({ ok: true, ...result, force });
  } catch (err) {
    console.error('[uazapi-history-resume] error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});