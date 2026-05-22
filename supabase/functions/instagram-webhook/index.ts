// ============================================
// Instagram Webhook Edge Function
// Receives Instagram DM messages via Meta Graph API
// Same webhook infrastructure as WABA (meta-webhook)
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveQueueByInstagramPageId, resolveQueueId } from "../_shared/resolve-queue.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'julia_meta_verify_token_test_123';

// ─── Resolve agent from Instagram page_id ────────────────────────
async function resolveAgent(pageId: string): Promise<{ cod_agent: string; client_id: string } | null> {
  const { data, error } = await supabase
    .from('instagram_config')
    .select('cod_agent, client_id')
    .eq('instagram_page_id', pageId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    console.error('[instagram-webhook] No config for page:', pageId);
    return null;
  }

  return { cod_agent: data.cod_agent, client_id: data.client_id };
}

// ─── Persist message ─────────────────────────────────────────────
async function persistMessage(
  agentInfo: { cod_agent: string; client_id: string },
  senderId: string,
  senderName: string,
  message: any,
  pageId?: string,
) {
  const contactPhone = `ig_${senderId}`;
  const msgText = message.text || '';
  const msgType = message.attachments?.[0]?.type || 'text';

  // Upsert contact
  const { data: contact } = await supabase
    .from('chat_contacts')
    .upsert(
      {
        phone: contactPhone,
        client_id: agentInfo.client_id,
        cod_agent: agentInfo.cod_agent,
        name: senderName || senderId,
        channel_type: 'instagram',
        channel_source: senderId,
        last_message_at: new Date().toISOString(),
        last_message_text: msgText.slice(0, 100) || msgType,
        unread_count: 1,
      },
      { onConflict: 'phone,client_id' }
    )
    .select('id')
    .single();

  if (!contact?.id) {
    // Fallback: try to find existing
    const { data: existing } = await supabase
      .from('chat_contacts')
      .select('id')
      .eq('phone', contactPhone)
      .eq('client_id', agentInfo.client_id)
      .limit(1)
      .single();

    if (!existing) {
      console.error('[instagram-webhook] Could not create/find contact');
      return;
    }

    await insertMessage(existing.id, agentInfo, message, msgType, msgText, pageId);
    return;
  }

  await insertMessage(contact.id, agentInfo, message, msgType, msgText, pageId);
}

async function insertMessage(
  contactId: string,
  agentInfo: { cod_agent: string; client_id: string },
  message: any,
  msgType: string,
  msgText: string,
  pageId?: string,
) {
  let mediaUrl: string | null = null;
  let caption: string | null = null;
  let type = 'text';

  if (message.attachments?.length > 0) {
    const att = message.attachments[0];
    mediaUrl = att.payload?.url || null;
    type = att.type === 'image' ? 'image' : att.type === 'video' ? 'video' : att.type === 'audio' ? 'audio' : 'document';
    caption = msgText || null;
  }

  // Resolve queue_id
  let queueId: string | null = null;
  if (pageId) {
    queueId = await resolveQueueByInstagramPageId(supabase, pageId);
  }
  if (!queueId) {
    queueId = await resolveQueueId(supabase, agentInfo.cod_agent, 'instagram');
  }

  // Check/create conversation
  let { data: conv } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('client_id', agentInfo.client_id)
    .eq('channel', 'instagram')
    .in('status', ['pending', 'open'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv) {
    // Reabertura: mantém atribuição existente; atualiza queue_id se mudou.
    const { data: resolvedConv } = await supabase
      .from('chat_conversations')
      .select('id, queue_id, assigned_to')
      .eq('contact_id', contactId)
      .eq('client_id', agentInfo.client_id)
      .eq('channel', 'instagram')
      .eq('status', 'resolved')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resolvedConv) {
      const hasAssignee = !!((resolvedConv as any).assigned_to && String((resolvedConv as any).assigned_to).trim() !== '');
      const newStatus = hasAssignee ? 'open' : 'pending';
      const update: Record<string, unknown> = {
        status: newStatus,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      };
      const queueChanged = queueId && resolvedConv.queue_id !== queueId;
      if (queueChanged) update.queue_id = queueId;
      await supabase.from('chat_conversations').update(update).eq('id', resolvedConv.id);
      await supabase.from('chat_conversation_history').insert({
        conversation_id: resolvedConv.id,
        action: 'reopened',
        actor_name: 'Sistema (webhook)',
        notes: hasAssignee
          ? (queueChanged
              ? 'Cliente respondeu após resolução — atribuição mantida; fila atualizada'
              : 'Cliente respondeu após resolução — atribuição mantida')
          : (queueChanged
              ? 'Cliente respondeu após resolução — sem responsável, devolvida à fila; fila atualizada'
              : 'Cliente respondeu após resolução — sem responsável, devolvida à fila'),
      });
      conv = { id: resolvedConv.id };
    } else {
      // Closed ou nenhuma → nova conversa SEM atribuição
      const { data: newConv } = await supabase
        .from('chat_conversations')
        .insert({
          contact_id: contactId,
          client_id: agentInfo.client_id,
          cod_agent: agentInfo.cod_agent,
          channel: 'instagram',
          status: 'pending',
          queue_id: queueId,
          assigned_to: null,
        })
        .select('id')
        .single();
      if (newConv?.id) {
        await supabase.from('chat_conversation_history').insert({
          conversation_id: newConv.id,
          action: 'opened',
          actor_name: 'Sistema (webhook)',
          to_value: 'pending',
        });
        conv = newConv;
      } else {
        // Conflito do índice único parcial: outro worker criou em paralelo
        const { data: raceConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('client_id', agentInfo.client_id)
          .eq('channel', 'instagram')
          .in('status', ['pending', 'open'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        conv = raceConv ?? null;
      }
    }
  }

  await supabase.from('chat_messages').insert({
    contact_id: contactId,
    client_id: agentInfo.client_id,
    conversation_id: conv?.id || null,
    text: msgText || null,
    type,
    from_me: false,
    channel_type: 'instagram',
    media_url: mediaUrl,
    caption,
    external_id: message.mid || null,
    timestamp: new Date().toISOString(),
    status: 'delivered',
  });
}

// ─── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Webhook verification (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[instagram-webhook] Verification successful');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // POST: receive messages
  try {
    const body = await req.json();
    console.log('[instagram-webhook] Received:', JSON.stringify(body).slice(0, 500));

    // Instagram messaging webhook structure
    const entries = body.entry || [];

    for (const entry of entries) {
      const pageId = entry.id;
      const agentInfo = await resolveAgent(pageId);
      if (!agentInfo) continue;

      const messaging = entry.messaging || [];
      for (const event of messaging) {
        if (event.message) {
          const senderId = event.sender?.id || '';
          // For Instagram, we may not have the name directly
          const senderName = `Instagram ${senderId.slice(-6)}`;

          await persistMessage(agentInfo, senderId, senderName, event.message, pageId);
        }
      }
    }

    // Always return 200 to Meta quickly
    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err) {
    console.error('[instagram-webhook] Error:', err);
    return new Response('EVENT_RECEIVED', { status: 200 });
  }
});
