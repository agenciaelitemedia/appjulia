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

// ─── Resolve cod_agent + client_id from phone_number_id ──────────
async function resolveAgent(phoneNumberId: string): Promise<{ cod_agent: string; client_id: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('db-query', {
      body: {
        action: 'raw',
        data: {
          query: `SELECT a.cod_agent, ua.user_id 
                  FROM agents a 
                  JOIN user_agents ua ON ua.cod_agent = a.cod_agent 
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
) {
  try {
    // 1. Upsert chat_contacts
    const { data: contactData, error: contactError } = await supabase
      .from('chat_contacts')
      .upsert(
        {
          phone: from,
          client_id: agentInfo.client_id,
          cod_agent: agentInfo.cod_agent,
          name: contactName || from,
          channel_type: 'whatsapp_waba',
          channel_source: phoneNumberId,
          last_message_at: new Date().toISOString(),
          last_message_text: message.text?.body || message.type || '',
          unread_count: 1,
        },
        { onConflict: 'phone,client_id' }
      )
      .select('id')
      .single();

    if (contactError) {
      console.error('[persistToChat] contact upsert error:', contactError.message);
      // Try to fetch existing contact
      const { data: existing } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('phone', from)
        .eq('client_id', agentInfo.client_id)
        .limit(1)
        .single();

      if (!existing) {
        console.error('[persistToChat] Could not find or create contact');
        return null;
      }

      // Update last message info
      await supabase
        .from('chat_contacts')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: message.text?.body || message.type || '',
          cod_agent: agentInfo.cod_agent,
        })
        .eq('id', existing.id);

      return await persistMessage(existing.id, agentInfo, message, msgType);
    }

    if (!contactData?.id) {
      console.error('[persistToChat] No contact id returned');
      return null;
    }

    return await persistMessage(contactData.id, agentInfo, message, msgType);
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

        const status = resp.status;
        await resp.text();

        if (status >= 200 && status < 300) {
          await supabase
            .from('webhook_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString(), n8n_response_status: status })
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
              error_message: `N8N responded ${status}`,
              n8n_response_status: status,
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

      // Collect unique phone_number_ids to resolve agents
      const phoneNumberIds = new Set<string>();

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const phoneNumberId = change.value?.metadata?.phone_number_id;
          if (phoneNumberId) phoneNumberIds.add(phoneNumberId);
        }
      }

      // Resolve agents for all phone_number_ids
      const agentMap = new Map<string, { cod_agent: string; client_id: string }>();
      for (const pnId of phoneNumberIds) {
        const info = await resolveAgent(pnId);
        if (info) agentMap.set(pnId, info);
      }

      for (const entry of body.entry || []) {
        const wabaId = entry.id || null;

        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;
          const agentInfo = phoneNumberId ? agentMap.get(phoneNumberId) : null;

          // Process messages
          for (const message of value?.messages || []) {
            const msgId = message.id || null;
            const from = message.from || 'unknown';
            const msgText = message.text?.body || message.type || 'unknown';
            const msgType = message.type || 'text';

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
              persistToChat(agentInfo, from, contactName, message, msgType, phoneNumberId)
                .catch(err => console.error('[persistToChat] background error:', err));
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

      // ── RESPOND 200 IMMEDIATELY ──
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
