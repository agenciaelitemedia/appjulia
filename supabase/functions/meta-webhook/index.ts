import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveQueueByWabaNumberId, resolveQueueId } from "../_shared/resolve-queue.ts";
import { logDroppedMessage } from "../_shared/droppedLogger.ts";
import { fetchWhatsappProfile, fetchWabaProfileWithUazapiFallback, profileToContactColumns } from "../_shared/whatsapp-profile.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'julia_meta_verify_token_test_123';
const N8N_BASE_URL = 'https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start';

// In-memory cache (60s) of own phone numbers per client (anti-echo filter).
// Returns map<phoneDigits, { queueId, channelType }> of client's own queues.
const ownNumbersCache = new Map<string, { value: Map<string, { queueId: string; channelType: string }>; expires: number }>();
async function getOwnNumbersForClient(clientId: string): Promise<Map<string, { queueId: string; channelType: string }>> {
  const now = Date.now();
  const cached = ownNumbersCache.get(clientId);
  if (cached && cached.expires > now) return cached.value;
  const map = new Map<string, { queueId: string; channelType: string }>();
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('id, phone_number, channel_type, is_active, is_deleted')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('phone_number', 'is', null);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const p = String((row as any).phone_number || '').replace(/\D/g, '');
        if (p) map.set(p, { queueId: String((row as any).id), channelType: String((row as any).channel_type || '') });
      }
    }
  } catch (err) {
    console.warn('[meta-webhook] own numbers lookup failed:', err);
  }
  ownNumbersCache.set(clientId, { value: map, expires: now + 60_000 });
  return map;
}

// Check if an existing chat_contact already exists for this phone+client.
// If yes, this is a real customer conversation — never filter as echo.
async function isKnownContact(clientId: string, phoneDigits: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('chat_contacts')
      .select('id')
      .eq('client_id', clientId)
      .eq('phone', phoneDigits)
      .limit(1)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

// ─── Resolve queue (preferred) by waba phone_number_id ───────────
async function resolveQueueForWaba(phoneNumberId: string): Promise<{ id: string; client_id: string } | null> {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('id, client_id')
      .eq('channel_type', 'waba')
      .eq('waba_number_id', phoneNumberId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, client_id: String(data.client_id) };
  } catch (err) {
    console.error('[resolveQueueForWaba] Exception:', err);
    return null;
  }
}

// ─── Resolve cod_agent + client_id from phone_number_id ──────────
async function resolveAgent(phoneNumberId: string): Promise<{ cod_agent: string; client_id: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('db-query', {
      body: {
        action: 'raw',
        data: {
          query: `SELECT a.cod_agent, a.user_id 
                  FROM agents a 
                  WHERE a.waba_number_id = $1 
                  LIMIT 1`,
          params: [phoneNumberId],
        },
      },
    });

    if (error) {
      console.error('[resolveAgent] db-query error:', error);
      return null;
    }

    const row = data?.data?.[0];
    if (!row?.cod_agent || !row?.user_id) {
      console.log(`[resolveAgent] No agent found for phone_number_id=${phoneNumberId}`);
      return null;
    }

    return { cod_agent: String(row.cod_agent), client_id: String(row.user_id) };
  } catch (err) {
    console.error('[resolveAgent] Exception:', err);
    return null;
  }
}

// ─── Persist message to chat tables ──────────────────────────────
async function persistToChat(
  agentInfo: { cod_agent: string; client_id: string },
  from: string,
  contactName: string,
  message: any,
  msgType: string,
  phoneNumberId: string,
  queueInfo: { id: string; client_id: string } | null,
) {
  try {
    // Prefer queue's client_id + queue.id as channel_source (UUID).
    const effectiveClientId = queueInfo?.client_id || agentInfo.client_id;
    const effectiveChannelSource = queueInfo?.id || phoneNumberId;

    // 1. Upsert chat_contacts
    const { data: contactData, error: contactError } = await supabase
      .from('chat_contacts')
      .upsert(
        {
          phone: from,
          client_id: effectiveClientId,
          cod_agent: agentInfo.cod_agent,
          name: contactName || from,
          channel_type: 'whatsapp_waba',
          channel_source: effectiveChannelSource,
          last_message_at: new Date().toISOString(),
          last_message_text: message.text?.body || message.type || '',
          unread_count: 1,
          wa_name: contactName || null,
        },
        { onConflict: 'phone,client_id' }
      )
      .select('id')
      .single();

    let contactId: string | null = null;

    if (contactError) {
      console.error('[persistToChat] contact upsert error:', contactError.message);
      const { data: existing } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('phone', from)
        .eq('client_id', effectiveClientId)
        .limit(1)
        .single();

      if (!existing) {
        console.error('[persistToChat] Could not find or create contact');
        return null;
      }

      await supabase
        .from('chat_contacts')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: message.text?.body || message.type || '',
          cod_agent: agentInfo.cod_agent,
          channel_source: effectiveChannelSource,
          channel_type: 'whatsapp_waba',
        })
        .eq('id', existing.id);

      contactId = existing.id;
    } else if (contactData?.id) {
      contactId = contactData.id;
    }

    if (!contactId) {
      console.error('[persistToChat] No contact id resolved');
      return null;
    }

    // Enrich WABA contact (validates wa_id; Meta does not expose photo for third parties)
    if (queueInfo?.id) {
      (async () => {
        try {
          const { data: q } = await supabase
            .from('queues')
            .select('id, client_id, channel_type, waba_token, waba_number_id')
            .eq('id', queueInfo.id)
            .maybeSingle();
          if (!q) return;
          // Skip if already enriched
          const { data: existingProfile } = await supabase
            .from('chat_contacts')
            .select('profile_fetched_at')
            .eq('id', contactId)
            .maybeSingle();
          if (existingProfile?.profile_fetched_at) return;
          // Cross-provider lookup: WABA validates wa_id; if no avatar, falls back to UaZapi queue of same client
          const profile = await fetchWabaProfileWithUazapiFallback(q as any, from, supabase);
          const update: Record<string, unknown> = { ...profileToContactColumns(profile) };
          if (profile.remoteJid) update.remote_jid = profile.remoteJid;
          if (profile.avatar) update.avatar = profile.avatar;
          await supabase.from('chat_contacts').update(update).eq('id', contactId);
        } catch (e) {
          console.warn(`[meta-webhook] enrich failed phone=${from}: ${(e as Error).message}`);
        }
      })();
    }

    // 2. Ensure an open/pending conversation exists with the right queue_id
    let conversationId: string | null = null;
    if (queueInfo) {
      const { data: openConv } = await supabase
        .from('chat_conversations')
        .select('id, queue_id')
        .eq('contact_id', contactId)
        .eq('client_id', effectiveClientId)
        .eq('queue_id', queueInfo.id)
        .eq('channel', 'whatsapp_waba')
        .in('status', ['pending', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!openConv) {
        // Reabertura: ignora queue_id (caso fila tenha mudado), mantém canal.
        const { data: resolvedConv } = await supabase
          .from('chat_conversations')
          .select('id, queue_id')
          .eq('contact_id', contactId)
          .eq('client_id', effectiveClientId)
          .eq('channel', 'whatsapp_waba')
          .eq('status', 'resolved')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (resolvedConv) {
          const update: Record<string, unknown> = {
            status: 'open',
            resolved_at: null,
            updated_at: new Date().toISOString(),
          };
          const queueChanged = resolvedConv.queue_id !== queueInfo.id;
          if (queueChanged) update.queue_id = queueInfo.id;
          await supabase.from('chat_conversations').update(update).eq('id', resolvedConv.id);
          await supabase.from('chat_conversation_history').insert({
            conversation_id: resolvedConv.id,
            action: 'reopened',
            actor_name: 'Sistema (webhook)',
            notes: queueChanged
              ? 'Cliente respondeu após resolução — atribuição mantida; fila atualizada'
              : 'Cliente respondeu após resolução — atribuição mantida',
          });
          conversationId = resolvedConv.id;
        } else {
          // Closed ou nenhuma → nova conversa SEM atribuição (volta para a fila pendente)
          const { data: created } = await supabase.from('chat_conversations').insert({
            contact_id: contactId,
            client_id: effectiveClientId,
            queue_id: queueInfo.id,
            channel: 'whatsapp_waba',
            status: 'pending',
            priority: 'normal',
            protocol: '',
            assigned_to: null,
          }).select('id').maybeSingle();
          if (created?.id) {
            await supabase.from('chat_conversation_history').insert({
              conversation_id: created.id,
              action: 'opened',
              actor_name: 'Sistema (webhook)',
              to_value: 'pending',
            });
          } else {
            // Conflito do índice único parcial: outro worker criou em paralelo
            const { data: raceConv } = await supabase
              .from('chat_conversations')
              .select('id')
              .eq('contact_id', contactId)
              .eq('client_id', effectiveClientId)
              .eq('queue_id', queueInfo.id)
              .eq('channel', 'whatsapp_waba')
              .in('status', ['pending', 'open'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (raceConv?.id) conversationId = raceConv.id;
          }
          conversationId = conversationId ?? created?.id ?? null;
        }
      } else if (!openConv.queue_id) {
        await supabase
          .from('chat_conversations')
          .update({ queue_id: queueInfo.id })
          .eq('id', openConv.id);
        conversationId = openConv.id;
      } else {
        conversationId = openConv.id;
      }
    }

    return await persistMessage(contactId, { ...agentInfo, client_id: effectiveClientId }, message, msgType, conversationId);
  } catch (err) {
    console.error('[persistToChat] Exception:', err);
    return null;
  }
}

async function persistMessage(
  contactId: string,
  agentInfo: { cod_agent: string; client_id: string },
  message: any,
  msgType: string,
  conversationId: string | null = null,
) {
  const msgText = message.text?.body || message.caption || null;
  const externalId = message.id || null;

  // Extract media URL if present (for image/audio/video/document)
  let mediaUrl: string | null = null;
  let fileName: string | null = null;
  let caption: string | null = message.caption || null;

  if (message.image) {
    mediaUrl = message.image.id ? `waba_media:${message.image.id}` : null;
    caption = message.image.caption || caption;
  } else if (message.audio) {
    mediaUrl = message.audio.id ? `waba_media:${message.audio.id}` : null;
  } else if (message.video) {
    mediaUrl = message.video.id ? `waba_media:${message.video.id}` : null;
    caption = message.video.caption || caption;
  } else if (message.document) {
    mediaUrl = message.document.id ? `waba_media:${message.document.id}` : null;
    fileName = message.document.filename || null;
    caption = message.document.caption || caption;
  } else if (message.sticker) {
    mediaUrl = message.sticker.id ? `waba_media:${message.sticker.id}` : null;
  }

  const { error } = await supabase
    .from('chat_messages')
    .insert({
      contact_id: contactId,
      client_id: agentInfo.client_id,
      conversation_id: conversationId,
      external_id: externalId,
      message_id: externalId,
      text: msgText,
      type: msgType,
      from_me: false,
      status: 'received',
      channel_type: 'whatsapp_waba',
      media_url: mediaUrl,
      file_name: fileName,
      caption: caption,
      timestamp: message.timestamp
        ? new Date(parseInt(message.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      raw_payload: message,
    });

  if (error) {
    if (error.code === '23505') {
      console.log('[persistMessage] Duplicate message, skipping:', externalId);
    } else {
      console.error('[persistMessage] insert error:', error.message);
    }
  }

  return contactId;
}

// ─── Process queue: send pending items to N8N ────────────────────────
async function processQueue() {
  try {
    const { data: items, error } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error || !items || items.length === 0) return;

    for (const item of items) {
      try {
        const wabaId = item.waba_id || 'unknown';
        const phoneNumberId = item.phone_number_id || null;

        const n8nPayload = {
          from: item.from_number,
          message_type: item.message_type,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          contacts: item.contacts,
          raw_payload: item.payload,
          message_id: item.message_id,
          timestamp: item.created_at,
        };

        // Build target URL list:
        //  - If the phone_number_id maps to a queue with linked agents,
        //    send one POST per linked cod_agent with ?app=waba&waba_id=...&c=<cod>
        //  - Otherwise fall back to the legacy single forward (?app=waba&waba_id=...)
        const targets: string[] = [];
        if (phoneNumberId) {
          const queue = await resolveQueueForWaba(phoneNumberId);
          if (queue) {
            const { data: links } = await supabase
              .from('queue_agent_links')
              .select('cod_agent')
              .eq('queue_id', queue.id);
            if (links && links.length > 0) {
              for (const l of links) {
                targets.push(`${N8N_BASE_URL}?app=waba&waba_id=${wabaId}&c=${l.cod_agent}`);
              }
            }
          }
        }
        if (targets.length === 0) {
          targets.push(`${N8N_BASE_URL}?app=waba&waba_id=${wabaId}`);
        }

        let lastStatus = 0;
        let allOk = true;
        for (const url of targets) {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(n8nPayload),
          });
          lastStatus = resp.status;
          await resp.text();
          if (!(resp.status >= 200 && resp.status < 300)) allOk = false;
        }

        if (allOk) {
          await supabase
            .from('webhook_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString(), n8n_response_status: lastStatus })
            .eq('id', item.id);

          if (item.message_id) {
            await supabase
              .from('webhook_logs')
              .update({ forwarded: true })
              .eq('message_id', item.message_id);
          }
        } else {
          await supabase
            .from('webhook_queue')
            .update({
              status: item.retries >= 2 ? 'failed' : 'pending',
              retries: item.retries + 1,
              error_message: `N8N responded ${lastStatus}`,
              n8n_response_status: lastStatus,
            })
            .eq('id', item.id);
        }
      } catch (err) {
        await supabase
          .from('webhook_queue')
          .update({
            status: item.retries >= 2 ? 'failed' : 'pending',
            retries: item.retries + 1,
            error_message: String(err),
          })
          .eq('id', item.id);
      }
    }
  } catch (err) {
    console.error('processQueue error:', err);
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── GET: Webhook verification ─────────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ─── POST ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const rawBodyText = await req.text();
      let body: any;
      try { body = JSON.parse(rawBodyText); } catch { body = {}; }

      // ── Internal action: process_queue (fallback/cron) ──
      if (body.action === 'process_queue') {
        await processQueue();
        const { data } = await supabase
          .from('webhook_queue')
          .select('id, status')
          .in('status', ['pending', 'failed'])
          .limit(100);
        return new Response(
          JSON.stringify({ processed: true, remaining: data?.length ?? 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Internal action: get_logs ──
      if (body.action === 'get_logs') {
        const { data, error } = await supabase
          .from('webhook_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        return new Response(
          JSON.stringify({ logs: error ? [] : data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Webhook POST received');

      // ── Extract messages & statuses from Meta payload ──
      const queueInserts: any[] = [];
      const logInserts: any[] = [];

      // Collect unique phone_number_ids to resolve agents
      const phoneNumberIds = new Set<string>();

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const phoneNumberId = change.value?.metadata?.phone_number_id;
          if (phoneNumberId) phoneNumberIds.add(phoneNumberId);
        }
      }

      // Resolve agents and queues for all phone_number_ids
      const agentMap = new Map<string, { cod_agent: string; client_id: string }>();
      const queueMap = new Map<string, { id: string; client_id: string }>();
      for (const pnId of phoneNumberIds) {
        const [info, queue] = await Promise.all([resolveAgent(pnId), resolveQueueForWaba(pnId)]);
        if (info) agentMap.set(pnId, info);
        if (queue) queueMap.set(pnId, queue);
      }

      for (const entry of body.entry || []) {
        const wabaId = entry.id || null;

        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;
          const queueInfo = phoneNumberId ? queueMap.get(phoneNumberId) || null : null;
          const baseAgent = phoneNumberId ? agentMap.get(phoneNumberId) || null : null;
          // Prefer queue's client_id when queue exists; fallback to agent lookup
          const agentInfo = queueInfo
            ? { cod_agent: baseAgent?.cod_agent || '', client_id: queueInfo.client_id }
            : baseAgent;

          // Process messages
          for (const message of value?.messages || []) {
            const msgId = message.id || null;
            const from = message.from || 'unknown';
            const msgText = message.text?.body || message.type || 'unknown';
            const msgType = message.type || 'text';

            // Anti-echo filter removido (causava falsos positivos).

            // Extract contact name
            const contacts = value.contacts || [];
            const contactInfo = contacts.find((c: any) => c.wa_id === from);
            const contactName = contactInfo?.profile?.name || from;

            queueInserts.push({
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              from_number: from,
              message_id: msgId,
              message_type: msgType,
              payload: message,
              contacts: contacts,
              status: 'pending',
            });

            logInserts.push({
              source: 'meta',
              from_number: from,
              message: msgText,
              forwarded: false,
              payload: message,
              message_id: msgId,
              message_type: msgType,
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              cod_agent: agentInfo?.cod_agent || null,
            });

            // ── Persist to chat tables ──
            if (agentInfo) {
              persistToChat(agentInfo, from, contactName, message, msgType, phoneNumberId, queueInfo)
                .catch(err => console.error('[persistToChat] background error:', err));
            } else {
              // No agent/queue resolved for this phone_number_id → message never
              // reaches the chat. Record it for auditing in Dropped MSG's.
              void logDroppedMessage(supabase, {
                client_id: queueInfo?.client_id ?? null,
                queue_id: queueInfo?.id ?? null,
                source: 'waba', reason: 'no_agent',
                event: 'messages', chat_id: from, msg: message,
              });
            }
          }

          // Process status updates
          for (const statusObj of value?.statuses || []) {
            const statusMsgId = statusObj.id || `status_${Date.now()}_${Math.random()}`;

            queueInserts.push({
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              from_number: statusObj.recipient_id || 'unknown',
              message_id: statusMsgId,
              message_type: 'status',
              payload: statusObj,
              contacts: [],
              status: 'pending',
            });

            logInserts.push({
              source: 'meta',
              from_number: statusObj.recipient_id || 'unknown',
              message: `status:${statusObj.status}`,
              forwarded: false,
              payload: statusObj,
              message_id: statusMsgId,
              message_type: 'status',
              status_type: statusObj.status,
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              cod_agent: agentInfo?.cod_agent || null,
            });

            // Update message status in chat_messages if we have the original message id
            if (statusObj.id && agentInfo && statusObj.status) {
              supabase
                .from('chat_messages')
                .update({ status: statusObj.status })
                .eq('external_id', statusObj.id)
                .eq('client_id', agentInfo.client_id)
                .then(({ error }) => {
                  if (error && error.code !== 'PGRST116') {
                    console.log('[statusUpdate] No matching message or error:', error.message);
                  }
                });
            }
          }
        }
      }

      // ── Batch insert into queue and logs ──
      if (queueInserts.length > 0) {
        for (const item of queueInserts) {
          const { error } = await supabase.from('webhook_queue').insert(item);
          if (error) {
            if (error.code === '23505') {
              console.log('Dedup: message_id already in queue:', item.message_id);
            } else {
              console.error('Queue insert error:', error.message);
            }
          }
        }
      }

      if (logInserts.length > 0) {
        const { error } = await supabase.from('webhook_logs').insert(logInserts);
        if (error) console.error('Log insert error:', error.message);
      }

      // ── N8N FAN-OUT (julia_MQv8.2_start) ──
      // Only for incoming messages (value.messages[]). Ignore statuses entirely.
      const N8N_HUB_WEBHOOK_URL = Deno.env.get('N8N_HUB_WEBHOOK_URL') || 'https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start';
      const fanOutPromises: Promise<void>[] = [];
      try {
        for (const entry of body.entry || []) {
          const wabaId = entry.id || '';
          for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;
            const value = change.value || {};
            const messages = Array.isArray(value.messages) ? value.messages : [];
            if (messages.length === 0) continue; // skip statuses-only changes
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) continue;
            const queue = queueMap.get(phoneNumberId);
            if (!queue) {
              console.log(`[fan-out waba] no queue for phone_number_id=${phoneNumberId}, skipping`);
              continue;
            }
            const { data: links } = await supabase
              .from('queue_agent_links')
              .select('cod_agent')
              .eq('queue_id', queue.id);
            const targets = (links || []).filter((l: any) => l.cod_agent);
            console.log(`[fan-out waba] event=messages waba_id=${wabaId} queue=${queue.id} targets=${targets.length}`);
            for (const link of targets) {
              const url = `${N8N_HUB_WEBHOOK_URL}?app=waba&waba_id=${wabaId}&c=${link.cod_agent}`;
              console.log(`[fan-out waba] POST n8n agent=${link.cod_agent} url=${url}`);
              fanOutPromises.push(
                fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: rawBodyText,
                })
                  .then((r) => { console.log(`[fan-out waba] response agent=${link.cod_agent} status=${r.status}`); })
                  .catch((err: Error) => { console.warn(`[fan-out waba] error agent=${link.cod_agent}:`, err.message); })
              );
            }
          }
        }
      } catch (fanErr) {
        console.error('[fan-out waba] Unexpected error:', fanErr);
      }

      if (fanOutPromises.length > 0) {
        await Promise.allSettled(fanOutPromises);
      }

      // ── RESPOND 200 ──
      const response = new Response('EVENT_RECEIVED', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });

      if (queueInserts.length > 0) {
        processQueue().catch((err) => console.error('Background processQueue error:', err));
      }

      return response;
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('EVENT_RECEIVED', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
