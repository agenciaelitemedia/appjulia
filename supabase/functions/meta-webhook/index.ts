import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'julia_meta_verify_token_test_123';
const N8N_BASE_URL = 'https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start';

// ─── DB pool for external database ────────────────────────
async function getExternalPool() {
  const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const externalDbUrl = Deno.env.get("EXTERNAL_DB_URL")!;
  const externalDbCa = Deno.env.get("EXTERNAL_DB_CA_CERT");

  const poolConfig: any = {
    connectionString: externalDbUrl,
    size: 1,
  };

  // Socket DSN (host via unix path) cannot accept tls options in deno-postgres
  const isSocketConnection =
    externalDbUrl.includes("@/") ||
    externalDbUrl.includes("host=/") ||
    externalDbUrl.includes("host=%2F") ||
    externalDbUrl.includes("/.s.PGSQL.");

  if (externalDbCa && !isSocketConnection) {
    poolConfig.tls = { enabled: true, caCertificates: [externalDbCa] };
  }

  return new Pool(poolConfig, 1);
}

// ─── Resolve cod_agent and client_id from phone_number_id / waba_id ──
async function resolveAgent(phoneNumberId: string, wabaId: string): Promise<{ cod_agent: string; client_id: string } | null> {
  let pool: any;
  try {
    pool = await getExternalPool();
    const conn = await pool.connect();
    try {
      const result = await conn.queryObject<{ cod_agent: string; client_id: string }>(
        `SELECT cod_agent, COALESCE(client_id::text, cod_agent) as client_id
         FROM agents
         WHERE hub = 'waba'
           AND (
             ($1 IS NOT NULL AND waba_number_id = $1)
             OR ($2 IS NOT NULL AND waba_id = $2)
           )
         ORDER BY CASE WHEN waba_number_id = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [phoneNumberId || null, wabaId || null]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('resolveAgent error:', err);
    return null;
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

// ─── Normalize WABA message type ──────────────────────────
function normalizeWabaType(wabaType: string): string {
  const map: Record<string, string> = {
    text: 'text',
    image: 'image',
    video: 'video',
    audio: 'audio',
    document: 'document',
    sticker: 'sticker',
    location: 'location',
    contacts: 'contact',
    reaction: 'reaction',
    interactive: 'text',
    button: 'text',
    order: 'text',
    system: 'text',
    unsupported: 'text',
  };
  return map[wabaType] || 'text';
}

// ─── Extract text from WABA message ───────────────────────
function extractWabaText(message: any): string | null {
  if (message.text?.body) return message.text.body;
  if (message.image?.caption) return message.image.caption;
  if (message.video?.caption) return message.video.caption;
  if (message.document?.caption) return message.document.caption;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.location) {
    return message.location.name || `${message.location.latitude},${message.location.longitude}`;
  }
  if (message.contacts?.[0]?.name?.formatted_name) return message.contacts[0].name.formatted_name;
  if (message.reaction?.emoji) return message.reaction.emoji;
  return null;
}

// ─── Extract media ID from WABA message ───────────────────
function extractWabaMediaId(message: any): string | null {
  const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
  for (const t of mediaTypes) {
    if (message[t]?.id) return message[t].id;
  }
  return null;
}

// ─── Save incoming message to chat tables ─────────────────
async function saveMessageToChat(
  phoneNumberId: string,
  wabaId: string,
  message: any,
  contacts: any[]
) {
  try {
    const agent = await resolveAgent(phoneNumberId, wabaId);
    if (!agent) {
      console.log('saveMessageToChat: no agent found for phone_number_id/waba_id', phoneNumberId, wabaId);
      return;
    }

    const fromNumber = message.from || 'unknown';
    const contactName = contacts?.[0]?.profile?.name || fromNumber;
    const normalizedPhone = fromNumber.replace(/\D/g, '');

    // UPSERT chat_contact
    const { data: contactData, error: contactError } = await supabase
      .from('chat_contacts')
      .upsert({
        client_id: agent.client_id,
        cod_agent: agent.cod_agent,
        phone: normalizedPhone,
        name: contactName,
        channel_type: 'whatsapp_official',
        channel_source: phoneNumberId,
        is_group: false,
        unread_count: 1,
        last_message_at: new Date().toISOString(),
        last_message_text: extractWabaText(message) || message.type || '',
      }, {
        onConflict: 'client_id,channel_source,phone',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (contactError) {
      // Fallback: try to find existing contact
      const { data: existingContact } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('client_id', agent.client_id)
        .eq('phone', normalizedPhone)
        .limit(1)
        .single();

      if (!existingContact) {
        console.error('saveMessageToChat: could not find/create contact', contactError.message);
        return;
      }

      // Update last message info and increment unread
      await supabase
        .from('chat_contacts')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: extractWabaText(message) || message.type || '',
          channel_type: 'whatsapp_official',
          channel_source: phoneNumberId,
        })
        .eq('id', existingContact.id);

      // Insert the message with this contact
      await insertChatMessage(existingContact.id, agent.client_id, message);
      return;
    }

    if (contactData?.id) {
      await insertChatMessage(contactData.id, agent.client_id, message);
    }
  } catch (err) {
    console.error('saveMessageToChat error:', err);
  }
}

async function insertChatMessage(contactId: string, clientId: string, message: any) {
  const msgType = normalizeWabaType(message.type || 'text');
  const text = extractWabaText(message);
  const mediaId = extractWabaMediaId(message);
  const timestamp = message.timestamp
    ? new Date(parseInt(message.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  // Build metadata
  const metadata: any = {};
  if (message.image) {
    metadata.mimetype = message.image.mime_type;
    metadata.media_id = message.image.id;
  }
  if (message.video) {
    metadata.mimetype = message.video.mime_type;
    metadata.media_id = message.video.id;
  }
  if (message.audio) {
    metadata.mimetype = message.audio.mime_type;
    metadata.media_id = message.audio.id;
    metadata.is_ptt = message.audio.voice === true;
  }
  if (message.document) {
    metadata.mimetype = message.document.mime_type;
    metadata.media_id = message.document.id;
    metadata.file_name = message.document.filename;
  }
  if (message.sticker) {
    metadata.mimetype = message.sticker.mime_type;
    metadata.media_id = message.sticker.id;
  }
  if (message.location) {
    metadata.latitude = message.location.latitude;
    metadata.longitude = message.location.longitude;
    metadata.location_name = message.location.name;
    metadata.location_address = message.location.address;
  }
  if (message.contacts) {
    metadata.contact_name = message.contacts[0]?.name?.formatted_name;
    metadata.contact_phone = message.contacts[0]?.phones?.[0]?.phone;
  }
  if (message.reaction) {
    metadata.reaction_emoji = message.reaction.emoji;
    metadata.reaction_target_id = message.reaction.message_id;
  }
  if (message.context?.id) {
    metadata.quoted_message = {
      id: message.context.id,
      from_me: message.context.from === 'me',
    };
  }

  const { error } = await supabase.from('chat_messages').insert({
    contact_id: contactId,
    client_id: clientId,
    external_id: message.id,
    text,
    type: msgType === 'audio' && metadata.is_ptt ? 'ptt' : msgType,
    from_me: false,
    status: 'delivered',
    file_name: metadata.file_name || null,
    caption: message.image?.caption || message.video?.caption || message.document?.caption || null,
    metadata,
    timestamp,
    channel_type: 'whatsapp_official',
    raw_payload: message,
  });

  if (error) {
    if (error.code === '23505') {
      console.log('Dedup: message already exists, external_id:', message.id);
    } else {
      console.error('insertChatMessage error:', error.message);
    }
  }

  // Fire-and-forget media download if applicable
  if (mediaId) {
    try {
      const funcUrl = `${supabaseUrl}/functions/v1/waba-send`;
      fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: 'download_and_store',
          cod_agent: '', // Will be resolved by phone_number_id lookup
          media_id: mediaId,
          external_id: message.id,
          contact_id: contactId,
        }),
      }).catch(err => console.error('Media download fire-and-forget error:', err));
    } catch (e) {
      console.error('Error triggering media download:', e);
    }
  }
}

// ─── Update message status ────────────────────────────────
async function updateMessageStatus(statusObj: any) {
  try {
    const externalId = statusObj.id;
    const status = statusObj.status; // sent, delivered, read, failed
    
    if (!externalId || !status) return;

    // Map Meta statuses
    const statusMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
    };
    const mappedStatus = statusMap[status] || status;

    const { error } = await supabase
      .from('chat_messages')
      .update({ status: mappedStatus })
      .eq('external_id', externalId);

    if (error) {
      console.log('updateMessageStatus: no message found for external_id', externalId);
    }

    // If read, reset unread count on contact
    if (status === 'read') {
      // Find the contact for this message
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('contact_id')
        .eq('external_id', externalId)
        .limit(1)
        .single();

      if (msg?.contact_id) {
        await supabase
          .from('chat_contacts')
          .update({ unread_count: 0 })
          .eq('id', msg.contact_id);
      }
    }
  } catch (err) {
    console.error('updateMessageStatus error:', err);
  }
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
        const url = `${N8N_BASE_URL}?app=waba&waba_id=${wabaId}`;

        const n8nPayload = {
          from: item.from_number,
          message_type: item.message_type,
          phone_number_id: item.phone_number_id,
          waba_id: wabaId,
          contacts: item.contacts,
          raw_payload: item.payload,
          message_id: item.message_id,
          timestamp: item.created_at,
        };

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload),
        });

        const respStatus = resp.status;
        await resp.text(); // consume body

        if (respStatus >= 200 && respStatus < 300) {
          await supabase
            .from('webhook_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString(), n8n_response_status: respStatus })
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
              error_message: `N8N responded ${respStatus}`,
              n8n_response_status: respStatus,
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
      const body = await req.json();

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
      const chatSavePromises: Promise<void>[] = [];

      for (const entry of body.entry || []) {
        const wabaId = entry.id || null;

        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;

          // Process messages
          for (const message of value?.messages || []) {
            const msgId = message.id || null;
            const from = message.from || 'unknown';
            const msgText = message.text?.body || message.type || 'unknown';
            const msgType = message.type || 'text';

            queueInserts.push({
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              from_number: from,
              message_id: msgId,
              message_type: msgType,
              payload: message,
              contacts: value.contacts || [],
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
            });

            // Save to chat tables (fire-and-forget)
            chatSavePromises.push(
              saveMessageToChat(phoneNumberId, wabaId, message, value.contacts || [])
            );
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
            });

            // Update message status in chat_messages (fire-and-forget)
            chatSavePromises.push(updateMessageStatus(statusObj));
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

      // ── RESPOND 200 IMMEDIATELY ──
      const response = new Response('EVENT_RECEIVED', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });

      // Schedule background processing (non-blocking)
      if (queueInserts.length > 0) {
        processQueue().catch((err) => console.error('Background processQueue error:', err));
      }

      // Chat save promises run in background
      Promise.allSettled(chatSavePromises).catch(err => 
        console.error('Chat save background error:', err)
      );

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
