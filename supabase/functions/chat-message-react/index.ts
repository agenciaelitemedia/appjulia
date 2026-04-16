// ============================================
// chat-message-react
// Sends a reaction to a WhatsApp message via UaZapi or WABA
// and persists it in chat_message_reactions
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReactRequest {
  message_id: string;          // chat_messages.id (uuid)
  external_message_id?: string; // whatsapp message id
  emoji: string;                // empty string removes reaction
  queue_id: string;
  contact_phone: string;
  reactor: string;              // user_id or 'me'
  from_me?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as ReactRequest;
    const { message_id, external_message_id, emoji, queue_id, contact_phone, reactor, from_me } = payload;

    if (!message_id || !queue_id || !contact_phone || !reactor) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Load queue credentials
    const { data: queue, error: qErr } = await supabase
      .from('queues')
      .select('id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id')
      .eq('id', queue_id)
      .maybeSingle();

    if (qErr || !queue) {
      return new Response(JSON.stringify({ error: 'Queue not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send to provider when we know the external message id
    let providerOk = true;
    let providerError: string | undefined;
    if (external_message_id) {
      try {
        if (queue.channel_type === 'waba') {
          // WABA Reactions: graph API
          const res = await fetch(`https://graph.facebook.com/v22.0/${queue.waba_number_id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${queue.waba_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: contact_phone,
              type: 'reaction',
              reaction: { message_id: external_message_id, emoji: emoji || '' },
            }),
          });
          if (!res.ok) {
            providerOk = false;
            providerError = `WABA ${res.status}: ${await res.text()}`;
          }
        } else {
          // UaZapi
          const baseUrl = String(queue.evo_url || '').replace(/\/+$/, '');
          const res = await fetch(`${baseUrl}/message/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': String(queue.evo_apikey || '') },
            body: JSON.stringify({
              number: contact_phone,
              messageId: external_message_id,
              reaction: emoji || '',
            }),
          });
          if (!res.ok) {
            providerOk = false;
            providerError = `UaZapi ${res.status}: ${await res.text()}`;
          }
        }
      } catch (e) {
        providerOk = false;
        providerError = (e as Error).message;
      }
    }

    // Persist (or remove) reaction in DB regardless of provider result
    if (!emoji) {
      await supabase.from('chat_message_reactions')
        .delete()
        .eq('message_id', message_id)
        .eq('reactor', reactor);
    } else {
      // Upsert: delete existing then insert new
      await supabase.from('chat_message_reactions')
        .delete()
        .eq('message_id', message_id)
        .eq('reactor', reactor);
      await supabase.from('chat_message_reactions').insert({
        message_id,
        external_message_id: external_message_id ?? null,
        reactor,
        emoji,
        from_me: !!from_me,
      });
    }

    return new Response(JSON.stringify({ ok: true, providerOk, providerError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
