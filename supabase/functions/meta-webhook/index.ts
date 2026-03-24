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
        await resp.text(); // consume body

        if (status >= 200 && status < 300) {
          // Mark as sent
          await supabase
            .from('webhook_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString(), n8n_response_status: status })
            .eq('id', item.id);

          // Update webhook_log as forwarded
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

            // Queue item for N8N delivery
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

            // Log entry
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
          }

          // Process status updates
          for (const status of value?.statuses || []) {
            logInserts.push({
              source: 'meta',
              from_number: status.recipient_id || 'unknown',
              message: `status:${status.status}`,
              forwarded: false,
              payload: status,
              message_id: status.id || null,
              message_type: 'status',
              status_type: status.status,
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
            });
          }
        }
      }

      // ── Batch insert into queue and logs ──
      if (queueInserts.length > 0) {
        const { error } = await supabase
          .from('webhook_queue')
          .upsert(queueInserts, { onConflict: 'message_id', ignoreDuplicates: true });
        if (error) console.error('Queue insert error:', error.message);
      }

      if (logInserts.length > 0) {
        const { error } = await supabase.from('webhook_logs').insert(logInserts);
        if (error) console.error('Log insert error:', error.message);
      }

      // ── RESPOND 200 IMMEDIATELY ──
      // Fire-and-forget: process the queue in background
      // Use waitUntil-like pattern — the response goes out, processing continues
      const response = new Response('EVENT_RECEIVED', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });

      // Schedule background processing (non-blocking)
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
