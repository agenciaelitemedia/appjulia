// ============================================
// UaZapi History Processor
// Consumes uazapi_history_runs/items and persists ONLY missing messages
// into chat_messages, NEVER mutating existing contacts/messages and NEVER
// raising unread_count. Always ignores group chats.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchWhatsappProfile, profileToContactColumns } from "../_shared/whatsapp-profile.ts";

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

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/@.*/, '').replace(/[^\d]/g, '');
}

function isGroupJid(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@g.us');
}

function isGroupMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  const jids = [
    msg.key?.remoteJid, msg.remoteJid, msg.chatId, msg.chatid,
    msg.wa_chatid, msg.from, msg.to,
  ];
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

async function processRun(runId: string, payload: any): Promise<void> {
  const supabase = getSupabase();

  const { data: run, error: runErr } = await supabase
    .from('uazapi_history_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runErr || !run) {
    console.error('[uazapi-history-processor] run not found:', runId, runErr?.message);
    return;
  }

  await supabase
    .from('uazapi_history_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', runId);

  const { data: queue } = await supabase
    .from('queues')
    .select('id, client_id, name, channel_type, evo_url, evo_apikey, evo_instance')
    .eq('id', (run as any).queue_id)
    .maybeSingle();

  const clientId = String((run as any).client_id);

  // Group payload messages by remote_jid (skip groups defensively)
  const rawMessages: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
  const byChat = new Map<string, any[]>();
  for (const msg of rawMessages) {
    const remoteJid: string = msg?.key?.remoteJid ?? msg?.remoteJid ?? msg?.chatId ?? msg?.chatid ?? '';
    if (!remoteJid || isGroupMessage(msg) || isGroupJid(remoteJid)) continue;
    if (!byChat.has(remoteJid)) byChat.set(remoteJid, []);
    byChat.get(remoteJid)!.push(msg);
  }

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalContactsCreated = 0;
  let hadErrors = false;

  for (const [remoteJid, msgs] of byChat) {
    const phone = normalizePhone(remoteJid);
    if (!phone) continue;

    let chatInserted = 0;
    let chatDuplicates = 0;
    let contactCreated = false;
    let conversationCreated = false;
    let chatError: string | null = null;

    try {
      // ── Lookup existing contact (NEVER recreate) ──
      const { data: existingContact } = await supabase
        .from('chat_contacts')
        .select('id, last_message_at, last_message_text, history_backfilled')
        .eq('phone', phone)
        .eq('client_id', clientId)
        .maybeSingle();

      // Sort messages chronologically
      const sortedMsgs = [...msgs].sort((a, b) => {
        const aTs = toIso(a.messageTimestamp ?? a.timestamp) ?? '';
        const bTs = toIso(b.messageTimestamp ?? b.timestamp) ?? '';
        return aTs.localeCompare(bTs);
      });
      const candidateIds = sortedMsgs
        .map((m) => m.key?.id ?? m.id ?? m.messageId ?? '')
        .filter(Boolean);

      // ── Fetch existing message_ids to dedupe (NEVER update existing) ──
      const existingIds = new Set<string>();
      if (existingContact?.id && candidateIds.length > 0) {
        const { data: existing } = await supabase
          .from('chat_messages')
          .select('message_id')
          .eq('contact_id', existingContact.id)
          .in('message_id', candidateIds);
        for (const row of existing ?? []) {
          if (row.message_id) existingIds.add(row.message_id);
        }
      }

      const newMsgs = sortedMsgs.filter((m) => {
        const mid = m.key?.id ?? m.id ?? m.messageId ?? '';
        return mid && !existingIds.has(mid);
      });
      chatDuplicates = candidateIds.length - newMsgs.length;

      // If contact exists and there are no new messages → skip everything
      if (existingContact && newMsgs.length === 0) {
        await supabase.from('uazapi_history_items').update({
          status: 'skipped',
          inserted_messages: 0,
          duplicate_messages: chatDuplicates,
          processed_at: new Date().toISOString(),
        }).eq('run_id', runId).eq('remote_jid', remoteJid);
        totalDuplicates += chatDuplicates;
        totalProcessed++;
        continue;
      }

      // ── Resolve contact_id (only insert if missing) ──
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

        const { data: inserted, error: insErr } = await supabase
          .from('chat_contacts')
          .insert({
            client_id: clientId,
            phone,
            name: contactName,
            avatar: avatarUrl,
            channel_type: 'whatsapp_uazapi',
            channel_source: queue?.id ?? (run as any).queue_id,
            remote_jid: remoteJid,
            is_group: false,
            history_backfilled: true,
            unread_count: 0,
            ...profileCols,
          })
          .select('id')
          .single();
        if (insErr || !inserted) {
          // Race condition: another worker may have inserted it concurrently
          const { data: again } = await supabase
            .from('chat_contacts').select('id')
            .eq('phone', phone).eq('client_id', clientId).maybeSingle();
          if (!again?.id) {
            chatError = `contact insert failed: ${insErr?.message}`;
            throw new Error(chatError);
          }
          contactId = again.id;
        } else {
          contactId = inserted.id;
          contactCreated = true;
          totalContactsCreated++;
        }
      }

      // ── Resolve or create conversation only when there are new messages ──
      let conversationId: string | null = null;
      const { data: activeConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('client_id', clientId)
        .in('status', ['pending', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeConv) {
        conversationId = activeConv.id;
      } else if (newMsgs.length > 0) {
        const { data: newConv } = await supabase
          .from('chat_conversations')
          .insert({
            contact_id: contactId,
            client_id: clientId,
            queue_id: queue?.id ?? (run as any).queue_id ?? null,
            channel: 'whatsapp_uazapi',
            status: 'pending',
            priority: 'normal',
            protocol: '',
            metadata: { source: 'uazapi_history', run_id: runId },
          })
          .select('id')
          .single();
        if (newConv) {
          conversationId = newConv.id;
          conversationCreated = true;
        }
      }

      // ── Insert ONLY new messages (never update existing) ──
      let latestTs: string | null = existingContact?.last_message_at ?? null;
      let latestPreview: string | null = existingContact?.last_message_text ?? null;
      let latestFromHistory = false;

      for (const msg of newMsgs) {
        const messageId: string = msg.key?.id ?? msg.id ?? msg.messageId ?? '';
        if (!messageId) continue;
        const fromMe: boolean = msg.key?.fromMe ?? msg.fromMe ?? msg.from_me ?? false;
        const text = extractText(msg);
        const type = extractType(msg);
        if (type === 'reaction') continue; // skip reactions in history
        const mediaUrl = extractMediaUrl(msg);
        const pushName: string = msg.pushName ?? msg.senderName ?? '';
        const isoTs = toIso(msg.messageTimestamp ?? msg.timestamp) ?? new Date().toISOString();

        const { error: msgErr } = await supabase
          .from('chat_messages')
          .insert({
            contact_id: contactId,
            conversation_id: conversationId,
            client_id: clientId,
            message_id: messageId,
            external_id: messageId,
            text: text ? toSafeString(text) : null,
            type,
            from_me: fromMe,
            // Use 'read' so the realtime listener never increments unread_count
            status: 'read',
            media_url: mediaUrl ?? null,
            timestamp: isoTs,
            channel_type: 'whatsapp_uazapi',
            sender_name: fromMe ? null : (pushName || null),
            raw_payload: msg,
            metadata: { source: 'uazapi_history', run_id: runId, history: true },
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
          console.warn(`[uazapi-history-processor] insert failed phone=${phone} id=${messageId}:`, msgErr.message);
          chatError = msgErr.message;
          hadErrors = true;
        }
      }

      // ── Conservative contact updates: NEVER bump unread, only refresh
      //    last_message_* when the historical message is actually newer than
      //    what we already have stored. ──
      const updates: Record<string, unknown> = {};
      if (existingContact && !existingContact.history_backfilled) {
        updates.history_backfilled = true;
      }
      if (latestFromHistory && latestTs && (!existingContact?.last_message_at || latestTs > existingContact.last_message_at)) {
        updates.last_message_at = latestTs;
        updates.last_message_text = latestPreview;
      }
      // Always force unread_count = 0 to honor the rule "history never marks as unread"
      updates.unread_count = 0;
      if (Object.keys(updates).length > 0) {
        await supabase.from('chat_contacts').update(updates).eq('id', contactId);
      }

      totalInserted += chatInserted;
      totalDuplicates += chatDuplicates;
      totalProcessed++;

      await supabase.from('uazapi_history_items').update({
        status: chatError ? 'error' : (chatInserted > 0 ? 'ok' : 'skipped'),
        inserted_messages: chatInserted,
        duplicate_messages: chatDuplicates,
        contact_created: contactCreated,
        conversation_created: conversationCreated,
        error: chatError,
        processed_at: new Date().toISOString(),
      }).eq('run_id', runId).eq('remote_jid', remoteJid);
    } catch (e) {
      hadErrors = true;
      const msg = (e as Error)?.message ?? String(e);
      console.warn(`[uazapi-history-processor] chat error remoteJid=${remoteJid}:`, msg);
      await supabase.from('uazapi_history_items').update({
        status: 'error',
        inserted_messages: chatInserted,
        duplicate_messages: chatDuplicates,
        error: msg,
        processed_at: new Date().toISOString(),
      }).eq('run_id', runId).eq('remote_jid', remoteJid);
    }
  }

  await supabase.from('uazapi_history_runs').update({
    status: hadErrors ? 'partial' : 'done',
    processed_chats: totalProcessed,
    inserted_messages: totalInserted,
    duplicate_messages: totalDuplicates,
    inserted_contacts: totalContactsCreated,
    finished_at: new Date().toISOString(),
  }).eq('id', runId);

  console.log(`[uazapi-history-processor] run=${runId} processed=${totalProcessed} inserted=${totalInserted} duplicates=${totalDuplicates} contacts=${totalContactsCreated}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const runId: string = body?.run_id;
    if (!runId) return respond({ error: 'run_id required' }, 400);

    EdgeRuntime.waitUntil(processRun(runId, body?.payload ?? {}));
    return respond({ ok: true, run_id: runId, status: 'started' });
  } catch (err) {
    console.error('[uazapi-history-processor] error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});