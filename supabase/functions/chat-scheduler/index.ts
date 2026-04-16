// ============================================
// chat-scheduler
// Cron worker that processes due chat_scheduled_messages
// and dispatches them via the proper provider (UaZapi/WABA).
// Runs every minute via pg_cron.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH = 25;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  try {
    // Pick due, pending messages
    const { data: due, error } = await supabase
      .from('chat_scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(MAX_BATCH);

    if (error) throw error;

    for (const item of due || []) {
      try {
        // Lookup contact & queue (via conversation -> queue, fallback to client_id agent queue)
        const { data: contact } = await supabase
          .from('chat_contacts')
          .select('id, phone, cod_agent, channel_type')
          .eq('id', item.contact_id)
          .maybeSingle();

        if (!contact) throw new Error('contact_not_found');

        // Find a queue for this contact: prefer conversation.queue_id
        let queueId: string | null = null;
        if (item.conversation_id) {
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('queue_id')
            .eq('id', item.conversation_id)
            .maybeSingle();
          queueId = conv?.queue_id || null;
        }

        if (!queueId) {
          // fallback: any active queue for this client
          const { data: q } = await supabase
            .from('queues' as never)
            .select('id')
            .eq('client_id', item.client_id)
            .limit(1)
            .maybeSingle() as { data: { id: string } | null };
          queueId = q?.id || null;
        }

        if (!queueId) throw new Error('queue_not_found');

        const { data: queue } = await supabase
          .from('queues' as never)
          .select('id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id')
          .eq('id', queueId)
          .maybeSingle() as { data: any };

        if (!queue) throw new Error('queue_load_failed');

        let externalMessageId: string | undefined;

        // Send TEXT
        if (item.text && !item.media_url) {
          if (queue.channel_type === 'waba') {
            const r = await fetch(`https://graph.facebook.com/v22.0/${queue.waba_number_id}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${queue.waba_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: contact.phone,
                type: 'text',
                text: { body: item.text },
              }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(`WABA ${r.status}: ${JSON.stringify(j)}`);
            externalMessageId = j?.messages?.[0]?.id;
          } else {
            const baseUrl = String(queue.evo_url || '').replace(/\/+$/, '');
            const r = await fetch(`${baseUrl}/message/sendText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': String(queue.evo_apikey || '') },
              body: JSON.stringify({
                number: contact.phone,
                text: item.text,
                quotedMessageId: item.reply_to || undefined,
              }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(`UaZapi ${r.status}: ${JSON.stringify(j)}`);
            externalMessageId = j?.messageId || j?.id || j?.data?.messageId;
          }
        } else if (item.media_url) {
          // Send MEDIA via UaZapi (sendMedia accepts URL)
          const baseUrl = String(queue.evo_url || '').replace(/\/+$/, '');
          const r = await fetch(`${baseUrl}/message/sendMedia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': String(queue.evo_apikey || '') },
            body: JSON.stringify({
              number: contact.phone,
              mediatype: item.media_type || 'document',
              media: item.media_url,
              caption: item.caption || undefined,
              fileName: item.file_name || undefined,
            }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(`UaZapi media ${r.status}: ${JSON.stringify(j)}`);
          externalMessageId = j?.messageId || j?.id || j?.data?.messageId;
        } else {
          throw new Error('empty_payload');
        }

        // Persist as a real message
        const newMsg = {
          contact_id: item.contact_id,
          client_id: item.client_id,
          conversation_id: item.conversation_id,
          text: item.text,
          caption: item.caption,
          media_url: item.media_url,
          file_name: item.file_name,
          type: item.media_url ? (item.media_type || 'document') : 'text',
          from_me: true,
          status: 'sent',
          message_id: externalMessageId,
          external_id: externalMessageId,
          timestamp: new Date().toISOString(),
          sender_name: item.created_by_name || 'Agendado',
          metadata: { scheduled_message_id: item.id },
        };

        const { data: inserted } = await supabase
          .from('chat_messages')
          .insert(newMsg)
          .select('id')
          .single();

        await supabase.from('chat_contacts').update({
          last_message_at: new Date().toISOString(),
          last_message_text: item.text || item.caption || '[mídia]',
        }).eq('id', item.contact_id);

        await supabase.from('chat_scheduled_messages').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_message_id: inserted?.id,
          attempts: (item.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);

        results.push({ id: item.id, ok: true });
      } catch (e) {
        const attempts = (item.attempts || 0) + 1;
        const finalStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await supabase.from('chat_scheduled_messages').update({
          status: finalStatus,
          attempts,
          last_error: (e as Error).message?.slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);
        results.push({ id: item.id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, results }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
