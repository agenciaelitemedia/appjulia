// ============================================
// UaZAPI History Sync
// Bulk imports individual WhatsApp conversation history for a queue.
// Called manually from the queue card UI.
// Deduplicates contacts (phone+client_id) and messages (external_id).
// Marks each conversation as read after import.
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

async function uazapiPost(baseUrl: string, apikey: string, path: string, body: unknown) {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': apikey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`UaZAPI ${path} returned ${resp.status}: ${txt}`);
  }
  return resp.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { queue_id } = body || {};
    if (!queue_id) return respond({ error: 'queue_id is required' }, 400);

    const supabase = getSupabase();

    // 1. Resolve queue credentials
    const { data: queue, error: qErr } = await supabase
      .from('queues')
      .select('id, client_id, evo_url, evo_apikey, evo_instance')
      .eq('id', queue_id)
      .single();

    if (qErr || !queue || !queue.evo_url || !queue.evo_apikey || !queue.evo_instance) {
      return respond({ error: 'Queue or credentials not found' }, 404);
    }

    const { evo_url, evo_apikey, evo_instance, client_id } = queue;

    // 2. Read configured history window
    const { data: settingsRow } = await supabase
      .from('chat_client_settings')
      .select('settings')
      .eq('client_id', client_id)
      .maybeSingle();

    const settingsJson = (settingsRow?.settings ?? {}) as any;
    const rawDays = typeof settingsJson?.history_sync_days === 'number'
      ? settingsJson.history_sync_days
      : 7;
    // Cap at 7 — UaZAPI only stores 7 days
    const syncDays = Math.min(rawDays, 7);
    const cutoffMs = Date.now() - syncDays * 86_400_000;

    console.log(`[uazapi-history-sync] queue=${queue_id} client=${client_id} syncDays=${syncDays}`);

    // 3. Enumerate individual chats via /chat/find (paginated)
    const allChats: any[] = [];
    let page = 1;
    const PAGE_SIZE = 100;
    const MAX_CHATS = 200;

    while (allChats.length < MAX_CHATS) {
      let pageData: any;
      try {
        pageData = await uazapiPost(evo_url, evo_apikey, `/chat/find`, {
          operator: 'AND',
          sort: '-wa_lastMsgTimestamp',
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          wa_isGroup: false,
        });
      } catch (e) {
        console.warn(`[uazapi-history-sync] /chat/find page ${page} failed:`, e);
        break;
      }

      const chats: any[] = Array.isArray(pageData) ? pageData
        : Array.isArray(pageData?.chats) ? pageData.chats
        : Array.isArray(pageData?.data) ? pageData.data
        : Array.isArray(pageData?.results) ? pageData.results
        : Array.isArray(pageData?.items) ? pageData.items
        : [];

      if (page === 1) {
        const sample = chats[0] ? Object.keys(chats[0]).slice(0, 25) : [];
        console.log(`[uazapi-history-sync] /chat/find page1 raw keys=${JSON.stringify(Object.keys(pageData || {}))} count=${chats.length} sampleChatKeys=${JSON.stringify(sample)}`);
      }

      if (chats.length === 0) break;

      // Filter to chats with messages within the sync window
      const relevant = chats.filter((c) => {
        const ts = c.wa_lastMsgTimestamp ?? c.lastMessageTimestamp ?? c.messageTimestamp ?? c.timestamp ?? c.wa_lastMessageTimestamp ?? 0;
        if (!ts) return true; // keep if no ts info — let message fetch decide
        const tsMs = ts > 1e12 ? ts : ts * 1000;
        return tsMs >= cutoffMs;
      });

      console.log(`[uazapi-history-sync] page ${page}: total=${chats.length} relevant=${relevant.length}`);
      allChats.push(...relevant);
      if (chats.length < PAGE_SIZE) break;
      page++;
    }

    console.log(`[uazapi-history-sync] Found ${allChats.length} relevant chats`);

    let syncedChats = 0;
    let syncedMessages = 0;
    let skippedDuplicates = 0;

    // 4. Process each chat
    for (const chat of allChats) {
      const chatId: string = chat.id || chat.remoteJid || chat.jid || '';
      if (!chatId || chatId.includes('@g.us')) continue; // skip groups just in case

      const phone = normalizePhone(chatId);
      if (!phone) continue;

      const displayName: string = chat.name || chat.pushName || chat.wa_contactName || phone;

      try {
        // 4a. Upsert contact (dedup by phone+client_id)
        const { data: upsertedContact, error: contactErr } = await supabase
          .from('chat_contacts')
          .upsert(
            { phone, client_id, name: displayName, channel_type: 'whatsapp_uazapi' },
            { onConflict: 'phone,client_id', ignoreDuplicates: false },
          )
          .select('id, history_backfilled')
          .single();

        if (contactErr || !upsertedContact) {
          // Try to fetch existing
          const { data: existing } = await supabase
            .from('chat_contacts')
            .select('id, history_backfilled')
            .eq('phone', phone)
            .eq('client_id', client_id)
            .maybeSingle();
          if (!existing) {
            console.warn(`[uazapi-history-sync] Could not upsert contact ${phone}`);
            continue;
          }
        }

        const contactId = upsertedContact?.id ?? (await (async () => {
          const { data } = await supabase
            .from('chat_contacts')
            .select('id')
            .eq('phone', phone)
            .eq('client_id', client_id)
            .maybeSingle();
          return data?.id;
        })());

        if (!contactId) continue;

        // 4b. Fetch messages for this chat (paginated)
        const chatMessages: any[] = [];
        let msgOffset = 0;
        const MSG_LIMIT = 100;
        let hasMore = true;

        while (hasMore) {
          let msgData: any;
          try {
            msgData = await uazapiPost(evo_url, evo_apikey, `/message/find`, {
              chatid: chatId,
              limit: MSG_LIMIT,
              offset: msgOffset,
            });
          } catch (e) {
            console.warn(`[uazapi-history-sync] /message/find failed for ${chatId}:`, e);
            break;
          }

          const msgs: any[] = Array.isArray(msgData) ? msgData
            : Array.isArray(msgData?.messages) ? msgData.messages
            : Array.isArray(msgData?.data) ? msgData.data
            : [];

          hasMore = msgData?.hasMore === true && msgs.length === MSG_LIMIT;

          // Stop paginating if oldest message in this page is before cutoff
          let reachedCutoff = false;
          for (const m of msgs) {
            const ts = m.messageTimestamp || m.timestamp || 0;
            const tsMs = (ts > 1e12 ? ts : ts * 1000);
            if (tsMs < cutoffMs) {
              reachedCutoff = true;
              break;
            }
            chatMessages.push(m);
          }
          if (reachedCutoff) break;
          msgOffset += msgs.length;
        }

        // 4c. Resolve or create conversation
        let conversationId: string | null = null;
        const { data: openConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('client_id', client_id)
          .in('status', ['pending', 'open'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (openConv) {
          conversationId = openConv.id;
        }

        // 4d. Upsert messages
        let lastMsgId: string | null = null;
        for (const msg of chatMessages) {
          const messageId = msg.id || msg.messageId || msg.key?.id;
          if (!messageId) continue;
          lastMsgId = messageId;

          const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? false;
          const text = extractText(msg);
          const type = extractType(msg);
          const mediaUrl = extractMediaUrl(msg);
          const isoTs = tsToIso(msg.messageTimestamp || msg.timestamp);
          const pushName = msg.pushName || msg.senderName || '';

          const { error: msgErr } = await supabase
            .from('chat_messages')
            .upsert({
              contact_id: contactId,
              client_id,
              message_id: messageId,
              external_id: messageId,
              text,
              type,
              from_me: fromMe,
              status: fromMe ? 'sent' : 'received',
              media_url: mediaUrl || null,
              timestamp: isoTs,
              channel_type: 'whatsapp_uazapi',
              conversation_id: conversationId,
              sender_name: fromMe ? null : pushName || null,
              raw_payload: msg,
              metadata: { history_sync: true },
            }, { onConflict: 'message_id', ignoreDuplicates: true });

          if (msgErr) {
            skippedDuplicates++;
          } else {
            syncedMessages++;
          }
        }

        // 4e. Mark conversation as read
        if (lastMsgId) {
          try {
            await uazapiPost(evo_url, evo_apikey, `/chat/read`, {
              number: chatId,
              read: true,
            });
          } catch (e) {
            console.warn(`[uazapi-history-sync] /chat/read failed for ${chatId}:`, e);
          }
        }

        // 4f. Mark contact history_backfilled
        await supabase
          .from('chat_contacts')
          .update({ history_backfilled: true })
          .eq('id', contactId);

        syncedChats++;
      } catch (chatErr) {
        console.warn(`[uazapi-history-sync] Error processing chat ${chatId}:`, chatErr);
      }
    }

    console.log(`[uazapi-history-sync] Done: chats=${syncedChats} msgs=${syncedMessages} dupes=${skippedDuplicates}`);

    return respond({
      ok: true,
      synced_chats: syncedChats,
      synced_messages: syncedMessages,
      skipped_duplicates: skippedDuplicates,
      sync_days: syncDays,
    });
  } catch (err) {
    console.error('[uazapi-history-sync] Fatal error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});
