// ============================================
// UaZapi Chat Webhook
// Receives WhatsApp events from UaZapi and persists to Supabase
// URL: /functions/v1/uazapi-chat-webhook?queue_id={queue_id}
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

// In-memory cache (60s) for agent queue settings keyed by client_id.
const agentSettingsCache = new Map<string, { value: { allow_groups: boolean; queue_limit: number }; expires: number }>();
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

function normalizePhone(raw: string): string {
  return raw.replace(/@.*/, '').replace(/[^\d]/g, '');
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
    msg.text,
    msg.body,
    msg.content,
    msg.caption,
    msg.message?.conversation,
    msg.message?.extendedTextMessage?.text,
    msg.message?.imageMessage?.caption,
    msg.message?.videoMessage?.caption,
    msg.message?.documentMessage?.caption,
  ];
  for (const c of candidates) {
    const s = toSafeString(c).trim();
    if (s) return s;
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
  const mt = (msg.messageType || msg.type || '').toLowerCase();
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
  return 'text';
}

function extractMediaUrl(msg: any): string | undefined {
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
    const rawEvent = payload.event || 'messages';
    // Normalize: treat messages, messages.upsert, message as the same logical MESSAGE_UPSERT event
    const MESSAGE_UPSERT_ALIASES = new Set(['messages', 'messages.upsert', 'message']);
    const isMessageUpsert = MESSAGE_UPSERT_ALIASES.has(rawEvent);
    const event = rawEvent;

    console.log(`[uazapi-chat-webhook] Event: ${event} (isMessageUpsert=${isMessageUpsert}), queue: ${queue.name}`);

    // ─── N8N FAN-OUT (early dispatch) ───
    // Fire BEFORE the messages loop so the fetch has the full processing time to complete.
    // Only for MESSAGE_UPSERT events; status/delete/contacts/chats/connection return early below.
    let n8nFanOutPromise: Promise<void> = Promise.resolve();
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
        const promises = targets.map((link) => {
          const n8nUrl = `${N8N_BASE_URL}?app=uazapi&c=${link.cod_agent}`;
          console.log(`[fan-out] POST n8n agent=${link.cod_agent} url=${n8nUrl}`);
          return fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rawBody,
          })
            .then((r) => console.log(`[fan-out] response agent=${link.cod_agent} status=${r.status}`))
            .catch((err: Error) => console.warn(`[fan-out] error agent=${link.cod_agent}:`, err.message));
        });
        n8nFanOutPromise = Promise.allSettled(promises).then(() => undefined);
      }
    }

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
    // UaZapi pode enviar em payload.data, payload.message, payload.messages, ou direto
    let messages: any[] = [];
    if (Array.isArray(payload.data)) messages = payload.data;
    else if (Array.isArray(payload.messages)) messages = payload.messages;
    else if (payload.message) messages = [payload.message];
    else if (payload.data) messages = [payload.data];
    else messages = [payload];

    console.log(`[uazapi-chat-webhook] Parsed ${messages.length} message(s). First keys: ${messages[0] ? Object.keys(messages[0]).slice(0, 20).join(',') : 'none'}`);

    let processed = 0;
    const skipped: Record<string, number> = { group: 0, no_id: 0, no_phone: 0 };
    const backfillTriggered = new Set<string>();
    for (const msg of messages) {
      try {
        const chatId = msg.chatid || msg.chatId || msg.key?.remoteJid || msg.remoteJid || msg.from || msg.sender || '';
        const isGroup = String(chatId).includes('@g.us')
          || msg.isGroup
          || msg.wa_isGroup
          || msg.wa_chatid?.includes('@g.us')
          || !!msg.groupName
          || !!msg.wa_groupName;

        // Honor agent's ALLOW_GROUPS flag — silently skip group messages when disabled.
        if (isGroup) {
          const allowGroups = await getAllowGroupsForClient(String(queue.client_id));
          if (!allowGroups) {
            skipped.group++;
            continue;
          }
        }

        const messageId = msg.id || msg.messageId || msg.message_id || msg.key?.id || msg.wa_messageid;
        if (!messageId) { skipped.no_id++; console.log('[uazapi-chat-webhook] no messageId, sample:', JSON.stringify(msg).slice(0, 400)); continue; }

        const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? msg.wa_fromMe ?? false;

        // Resolve PEER (group id or peer phone) — never the instance owner.
        let senderPhone = '';
        let groupName = '';
        if (isGroup) {
          const rawGroupId = String(chatId || msg.wa_chatid || '').replace(/@g\.us.*/, '').trim();
          if (!rawGroupId) {
            skipped.no_phone++;
            console.log('[uazapi-chat-webhook] group without id, sample:', JSON.stringify(msg).slice(0, 300));
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
            continue;
          }
        }

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

        const { data: contact } = await supabase
          .from('chat_contacts')
          .upsert({
            client_id: queue.client_id,
            phone: senderPhone,
            name: contactNameToWrite,
            channel_type: 'whatsapp_uazapi',
            channel_source: queueId,
            remote_jid: chatId || null,
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

        // ── Enrich profile (avatar, wa_*, lead_*) for new contacts or those still missing avatar ──
        const needsEnrich = !isGroup && (isNewContact || !preExisting?.avatar);
        if (needsEnrich) {
          // Fire-and-forget so we don't block message persistence
          (async () => {
            try {
              const profile = await fetchWhatsappProfile(queue as any, senderPhone);
              const cols = profileToContactColumns(profile);
              const update: Record<string, unknown> = { ...cols };
              if (profile.avatar) update.avatar = profile.avatar;
              if (profile.name && (isPhoneLikeName(contactNameToWrite) || isNewContact)) {
                update.name = profile.name;
              }
              if (profile.remoteJid) update.remote_jid = profile.remoteJid;
              await supabase.from('chat_contacts').update(update).eq('id', contact.id);
            } catch (e) {
              console.warn(`[uazapi-chat-webhook] enrich failed phone=${senderPhone}: ${(e as Error).message}`);
            }
          })();
        }

        // ── Trigger one-time backfill from UaZapi for new contacts ──
        if ((isNewContact || !alreadyBackfilled) && !backfillTriggered.has(contact.id)) {
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
          .in('status', ['pending', 'open'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeConv) {
          conversationId = activeConv.id;
        } else if (!fromMe) {
          // 2) Check for a resolved conversation to reopen (resolved = soft close, reopens on reply)
          const { data: resolvedConv } = await supabase
            .from('chat_conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('client_id', queue.client_id)
            .eq('status', 'resolved')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (resolvedConv) {
            // Reopen the resolved conversation
            await supabase
              .from('chat_conversations')
              .update({ status: 'open', resolved_at: null })
              .eq('id', resolvedConv.id);
            await supabase.from('chat_conversation_history').insert({
              conversation_id: resolvedConv.id,
              action: 'reopened',
              actor_name: 'Sistema (webhook)',
              notes: 'Cliente respondeu após resolução',
            });
            conversationId = resolvedConv.id;
          } else {
            // 3) No active or resolved conversation — create new
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

        const { data: existingMessage } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('message_id', messageId)
          .limit(1)
          .maybeSingle();

        if (existingMessage) {
          processed++;
          continue;
        }

        const { error: msgError } = await supabase
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
          });

        if (msgError) {
          const isDuplicate = msgError.code === '23505' || msgError.message?.toLowerCase().includes('duplicate');
          if (!isDuplicate) {
            console.error('[uazapi-chat-webhook] Message insert error:', msgError);
            continue;
          }
        }

        processed++;
      } catch (msgErr) {
        console.error('[uazapi-chat-webhook] Error processing message:', msgErr);
      }
    }

    console.log(`[uazapi-chat-webhook] Done. processed=${processed} skipped=${JSON.stringify(skipped)} backfills=${backfillTriggered.size}`);

    // Await the n8n fan-out promise that was started early (before messages loop).
    await n8nFanOutPromise;

    return respond({ ok: true, event, processed, skipped, backfills: backfillTriggered.size });
  } catch (error) {
    console.error('[uazapi-chat-webhook] Error:', error);
    return respond({ error: (error as Error).message }, 500);
  }
});
