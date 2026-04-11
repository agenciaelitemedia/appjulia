// ============================================
// UaZapi Chat Webhook
// Receives WhatsApp events from UaZapi and persists to Supabase
// URL: /functions/v1/uazapi-chat-webhook?queue_id={queue_id}
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
  return raw.replace(/@.*/, '').replace(/[^\d]/g, '');
}

function extractMessageText(msg: any): string | undefined {
  if (msg.text) return msg.text;
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  return undefined;
}

function extractMessageType(msg: any): string {
  const mt = (msg.messageType || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg.message?.contactMessage) return 'contact';
  if (mt.includes('reaction') || msg.message?.reactionMessage) return 'reaction';
  if (mt.includes('revoked') || mt.includes('protocol') || msg.message?.protocolMessage) return 'revoked';
  return 'text';
}

function extractMediaUrl(msg: any): string | undefined {
  return msg.fileURL
    || msg.message?.imageMessage?.url
    || msg.message?.videoMessage?.url
    || msg.message?.audioMessage?.url
    || msg.message?.documentMessage?.url
    || msg.message?.stickerMessage?.url
    || undefined;
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
      .select('id, client_id, channel_type, name')
      .eq('id', queueId)
      .single();

    if (queueError || !queue) {
      console.error('[uazapi-chat-webhook] Queue not found:', queueId);
      return respond({ error: 'Queue not found' }, 404);
    }

    const payload = await req.json();
    const event = payload.event || 'messages';

    console.log(`[uazapi-chat-webhook] Event: ${event}, queue: ${queue.name}`);

    // ─── CONNECTION UPDATE ───
    if (event === 'connection.update') {
      const state = payload.state || payload.status;
      console.log(`[uazapi-chat-webhook] Connection state: ${state}`);
      // Could update queue status here in future
      return respond({ ok: true, event: 'connection.update' });
    }

    // ─── STATUS UPDATES (delivered, read, etc.) ───
    if (event === 'messages.update') {
      const updates = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
      for (const upd of updates) {
        const messageId = upd.id || upd.key?.id;
        const newStatus = upd.status || upd.update?.status;
        if (messageId && newStatus) {
          const statusMap: Record<number | string, string> = {
            0: 'error', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'played',
            'ERROR': 'error', 'PENDING': 'pending', 'SERVER_ACK': 'sent',
            'DELIVERY_ACK': 'delivered', 'READ': 'read', 'PLAYED': 'played',
          };
          const mapped = statusMap[newStatus] || String(newStatus).toLowerCase();
          await supabase
            .from('chat_messages')
            .update({ status: mapped })
            .eq('message_id', messageId);
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

    // ─── MESSAGES (main handler) ───
    // Accept both 'messages' event and default
    const messages = Array.isArray(payload.data) ? payload.data : [payload.data || payload];

    let processed = 0;
    for (const msg of messages) {
      try {
        // Skip group messages
        const chatId = msg.chatid || msg.key?.remoteJid || '';
        const isGroup = chatId.includes('@g.us') || msg.isGroup || msg.wa_isGroup;
        if (isGroup) continue;

        const messageId = msg.id || msg.messageId || msg.key?.id;
        if (!messageId) continue;

        const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? false;
        const senderPhone = normalizePhone(
          msg.sender_pn || msg.PhoneNumber || msg.phone || chatId || ''
        );
        if (!senderPhone) continue;

        const pushName = msg.pushName || msg.senderName || msg.wa_contactName || '';
        const text = extractMessageText(msg);
        const type = extractMessageType(msg);
        const mediaUrl = extractMediaUrl(msg);
        const timestamp = msg.messageTimestamp || msg.timestamp;
        const isoTimestamp = timestamp
          ? new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp).toISOString()
          : new Date().toISOString();

        // ── Upsert contact ──
        const contactName = pushName || senderPhone;
        const { data: contact } = await supabase
          .from('chat_contacts')
          .upsert({
            client_id: queue.client_id,
            phone: senderPhone,
            name: contactName,
            channel_type: 'whatsapp_uazapi',
            channel_source: queueId,
            remote_jid: chatId || null,
            avatar: msg.profilePictureUrl || null,
            last_message_at: isoTimestamp,
            last_message_text: text || `[${type}]`,
            unread_count: fromMe ? 0 : 1,
          }, {
            onConflict: 'phone,client_id',
            ignoreDuplicates: false,
          })
          .select('id, unread_count')
          .single();

        if (!contact) continue;

        // If not from_me, increment unread_count
        if (!fromMe) {
          await supabase.rpc('increment_unread_count' as any, { contact_uuid: contact.id }).catch(() => {
            // Fallback: direct update
            supabase
              .from('chat_contacts')
              .update({
                unread_count: (contact.unread_count || 0) + 1,
                last_message_at: isoTimestamp,
                last_message_text: text || `[${type}]`,
              })
              .eq('id', contact.id)
              .then(() => {});
          });
        }

        // Update contact name/avatar if we have new data
        if (pushName && pushName !== senderPhone) {
          await supabase
            .from('chat_contacts')
            .update({ name: pushName })
            .eq('id', contact.id)
            .eq('name', senderPhone); // Only update if current name is just the phone
        }

        // ── Get or create conversation ──
        let conversationId: string | null = null;
        const { data: existingConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('client_id', queue.client_id)
          .in('status', ['pending', 'open'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingConv) {
          conversationId = existingConv.id;
        } else if (!fromMe) {
          // Create new pending conversation for incoming messages
          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({
              contact_id: contact.id,
              client_id: queue.client_id,
              queue_id: queueId,
              channel: 'whatsapp_uazapi',
              status: 'pending',
              priority: 'normal',
              protocol: '', // Auto-generated by trigger
            })
            .select('id')
            .single();

          if (newConv) {
            conversationId = newConv.id;
            // Log conversation opened
            await supabase.from('chat_conversation_history').insert({
              conversation_id: newConv.id,
              action: 'opened',
              actor_name: 'Sistema (webhook)',
              to_value: 'pending',
            });
          }
        }

        // ── Insert message (deduplicate by message_id) ──
        const { error: msgError } = await supabase
          .from('chat_messages')
          .upsert({
            contact_id: contact.id,
            client_id: queue.client_id,
            message_id: messageId,
            external_id: messageId,
            text,
            type,
            from_me: fromMe,
            status: fromMe ? 'sent' : 'received',
            media_url: mediaUrl || null,
            file_name: msg.message?.documentMessage?.fileName || null,
            caption: msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || null,
            reply_to: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
            timestamp: isoTimestamp,
            channel_type: 'whatsapp_uazapi',
            conversation_id: conversationId,
            sender_name: fromMe ? null : pushName || null,
            is_forwarded: msg.message?.extendedTextMessage?.contextInfo?.isForwarded || false,
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
            },
          }, {
            onConflict: 'message_id',
            ignoreDuplicates: true,
          });

        if (msgError && !msgError.message?.includes('duplicate')) {
          console.error('[uazapi-chat-webhook] Message insert error:', msgError);
        }

        processed++;
      } catch (msgErr) {
        console.error('[uazapi-chat-webhook] Error processing message:', msgErr);
      }
    }

    return respond({ ok: true, event, processed });
  } catch (error) {
    console.error('[uazapi-chat-webhook] Error:', error);
    return respond({ error: (error as Error).message }, 500);
  }
});
