// ============================================
// UaZapi Chat Backfill
// Fetches historical messages for a single chat from UaZapi API
// and persists them locally. Triggered once per new contact.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function isGroupChatId(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@g.us');
}

function isLidJid(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@lid');
}

function isGroupMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  return isGroupChatId(msg.key?.remoteJid)
    || isGroupChatId(msg.remoteJid)
    || isGroupChatId(msg.chatId)
    || isGroupChatId(msg.chatid)
    || isGroupChatId(msg.wa_chatid)
    || isGroupChatId(msg.from)
    || isGroupChatId(msg.to)
    || msg.isGroup === true
    || msg.wa_isGroup === true
    || msg.is_group === true
    || !!msg.groupName
    || !!msg.wa_groupName
    || !!msg.group_name
    || !!msg.participant
    || !!msg.key?.participant;
}

function extractText(msg: any): string | undefined {
  if (typeof msg.text === 'string' && msg.text) return msg.text;
  if (msg.text?.body) return msg.text.body;
  if (msg.body) return msg.body;
  if (msg.content) return typeof msg.content === 'string' ? msg.content : undefined;
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  return undefined;
}

function extractType(msg: any): string {
  const mt = (msg.messageType || msg.type || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg.message?.contactMessage) return 'contact';
  return 'text';
}

function extractMediaUrl(msg: any): string | undefined {
  return msg.mediaUrl
    || msg.media?.url
    || msg.fileURL
    || msg.message?.imageMessage?.url
    || msg.message?.videoMessage?.url
    || msg.message?.audioMessage?.url
    || msg.message?.documentMessage?.url
    || undefined;
}

function tsToIso(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp);
  if (!Number.isFinite(ts)) return new Date().toISOString();
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  if (d.getFullYear() <= 2000 || d.getFullYear() >= 2100) return new Date().toISOString();
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { queue_id, contact_id, chat_id, phone, limit = 50 } = body || {};

    if (!queue_id || !contact_id || (!chat_id && !phone)) {
      return respond({ error: 'queue_id, contact_id and chat_id (or phone) are required' }, 400);
    }

    const supabase = getSupabase();

    // Resolve queue credentials
    const { data: queue, error: qErr } = await supabase
      .from('queues')
      .select('id, client_id, evo_url, evo_apikey, evo_instance')
      .eq('id', queue_id)
      .single();

    if (qErr || !queue || !queue.evo_url || !queue.evo_apikey) {
      console.warn('[uazapi-chat-backfill] Queue not found or missing creds:', queue_id);
      return respond({ error: 'Queue or credentials not found', skipped: true }, 200);
    }

    // Re-check contact backfill flag (avoid duplicate runs)
    const { data: contact } = await supabase
      .from('chat_contacts')
      .select('id, history_backfilled, is_group, remote_jid')
      .eq('id', contact_id)
      .single();

    if (!contact) return respond({ error: 'Contact not found' }, 404);
    if (contact.history_backfilled) {
      return respond({ ok: true, skipped: 'already_backfilled' });
    }

    const isGroup = isGroupChatId(chat_id) || contact.is_group || isGroupChatId(contact.remote_jid);

    // For groups: only proceed when the client has ALLOW_GROUPS = true.
    if (isGroup) {
      const { data: settingsRow } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', String(queue.client_id))
        .maybeSingle();
      const allowGroups = !!(settingsRow?.settings as any)?.ALLOW_GROUPS;
      if (!allowGroups) {
        await supabase
          .from('chat_contacts')
          .update({ history_backfilled: true })
          .eq('id', contact_id);
        return respond({ ok: true, skipped: 'group_history_ignored' });
      }
    }

    // Reject LinkedIDs as a phone source — they are not real WhatsApp numbers.
    if (!isGroup && (isLidJid(chat_id) || isLidJid(contact.remote_jid))) {
      await supabase
        .from('chat_contacts')
        .update({ history_backfilled: true })
        .eq('id', contact_id);
      console.warn('[uazapi-chat-backfill] skipping LID chat_id:', chat_id || contact.remote_jid);
      return respond({ ok: true, skipped: 'lid_chat_ignored' });
    }

    // Resolve target chat id (group JID vs personal JID).
    let targetChatId = '';
    let senderPhone = '';
    if (isGroup) {
      const groupJid = [chat_id, contact.remote_jid].find((v) => isGroupChatId(v)) as string | undefined;
      if (!groupJid) {
        await supabase.from('chat_contacts').update({ history_backfilled: true }).eq('id', contact_id);
        return respond({ ok: true, skipped: 'invalid_group_jid' });
      }
      targetChatId = groupJid;
    } else {
      // Prefer the explicit phone arg, then fall back to chat_id only if it's
      // a real @s.whatsapp.net JID or pure digits — never a @lid.
      const phoneSource = phone && !isLidJid(phone) ? phone
        : (chat_id && !isLidJid(chat_id) ? chat_id : '');
      senderPhone = normalizePhone(phoneSource);
      if (!senderPhone || senderPhone.length < 8 || senderPhone.length > 13) {
        await supabase
          .from('chat_contacts')
          .update({ history_backfilled: true })
          .eq('id', contact_id);
        return respond({ ok: true, skipped: 'invalid_phone' });
      }
      targetChatId = `${senderPhone}@s.whatsapp.net`;
    }

    // Call UaZapi /message/find endpoint
    const url = `${queue.evo_url.replace(/\/$/, '')}/message/find`;
    let messages: any[] = [];

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': queue.evo_apikey,
        },
        body: JSON.stringify({
          chatid: targetChatId,
          limit,
          offset: 0,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.warn(`[uazapi-chat-backfill] /message/find failed (${resp.status}):`, txt);
        // Still mark as attempted so we don't retry forever
        await supabase
          .from('chat_contacts')
          .update({ history_backfilled: true })
          .eq('id', contact_id);
        return respond({ ok: true, imported: 0, error: `provider returned ${resp.status}` });
      }

      const data = await resp.json();
      messages = Array.isArray(data) ? data
        : Array.isArray(data?.messages) ? data.messages
        : Array.isArray(data?.data) ? data.data
        : [];
      // For personal chats, strip any group messages that leaked in.
      // For group backfill, keep everything (it's all group msgs by definition).
      if (!isGroup) {
        messages = messages.filter((msg) => !isGroupMessage(msg));
      }
    } catch (fetchErr) {
      console.error('[uazapi-chat-backfill] fetch error:', fetchErr);
      await supabase
        .from('chat_contacts')
        .update({ history_backfilled: true })
        .eq('id', contact_id);
      return respond({ ok: true, imported: 0, error: 'fetch failed' });
    }

    console.log(`[uazapi-chat-backfill] Got ${messages.length} messages for ${isGroup ? targetChatId : senderPhone}`);

    // Resolve current open conversation (if any) to attach historical messages
    let conversationId: string | null = null;
    const { data: openConv } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('contact_id', contact_id)
      .eq('client_id', queue.client_id)
      .in('status', ['pending', 'open'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openConv) conversationId = openConv.id;

    let imported = 0;
    for (const msg of messages) {
      try {
        const messageId = msg.id || msg.messageId || msg.key?.id;
        if (!messageId) continue;

        const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? false;
        const text = extractText(msg);
        const type = extractType(msg);
        const mediaUrl = extractMediaUrl(msg);
        const isoTs = tsToIso(msg.messageTimestamp || msg.timestamp);
        const participant = msg.participant || msg.key?.participant || msg.sender || '';
        const pushName = msg.pushName || msg.senderName || msg.wa_contactName
          || (isGroup && participant ? normalizePhone(participant) : '') || '';

        const { error } = await supabase
          .from('chat_messages')
          .upsert({
            contact_id,
            client_id: queue.client_id,
            message_id: messageId,
            external_id: messageId,
            text,
            type,
            from_me: fromMe,
            // Backfill on-demand: toda mensagem do histórico entra já como lida.
            status: 'read',
            media_url: mediaUrl || null,
            timestamp: isoTs,
            channel_type: 'whatsapp_uazapi',
            conversation_id: conversationId,
            sender_name: fromMe ? null : pushName || null,
            raw_payload: msg,
            metadata: { backfilled: true },
          }, { onConflict: 'message_id', ignoreDuplicates: true });

        if (!error) imported++;
      } catch (e) {
        console.warn('[uazapi-chat-backfill] msg insert error:', e);
      }
    }

    // Mark contact as backfilled
    await supabase
      .from('chat_contacts')
      .update({ history_backfilled: true })
      .eq('id', contact_id);

    return respond({ ok: true, imported, total: messages.length });
  } catch (err) {
    console.error('[uazapi-chat-backfill] Error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});
