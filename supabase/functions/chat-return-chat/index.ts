// ============================================
// chat-return-chat
// Cron worker (every minute) that finds conversations where
// the NRT SLA + tolerance has been exceeded without an agent
// response, then unassigns the agent, sets status to pending,
// creates an internal note, and logs the action in history.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_LIMIT = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Find conversations where NRT + tolerance has been exceeded
    const { data: conversations, error: queryError } = await supabase.rpc(
      'get_return_chat_candidates',
      { batch_limit: BATCH_LIMIT },
    );

    // If RPC doesn't exist yet, fall back to raw query
    if (queryError) {
      console.error('RPC error, trying raw query:', queryError.message);
      return await processViaRawQuery(supabase);
    }

    return await processConversations(supabase, conversations ?? []);
  } catch (err) {
    console.error('chat-return-chat error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processViaRawQuery(supabase: ReturnType<typeof createClient>) {
  const { data: conversations, error } = await supabase
    .from('chat_conversations')
    .select(`
      id,
      assigned_to,
      client_id,
      priority,
      contact_id,
      last_customer_message_at,
      chat_sla_configs!inner(nrt_response_minutes),
      chat_client_settings!inner(settings)
    `)
    .in('status', ['open', 'pending'])
    .not('assigned_to', 'is', null)
    .eq('last_message_from_me', false)
    .not('last_customer_message_at', 'is', null)
    .limit(BATCH_LIMIT);

  if (error) throw error;

  // Filter in JS for those whose NRT + tolerance has elapsed
  // and return_chat_enabled = true, and no prior auto_returned in history
  const now = Date.now();
  const eligible: any[] = [];

  for (const conv of conversations ?? []) {
    const slaConfig = Array.isArray(conv.chat_sla_configs)
      ? conv.chat_sla_configs[0]
      : conv.chat_sla_configs;
    const clientSettings = Array.isArray(conv.chat_client_settings)
      ? conv.chat_client_settings[0]
      : conv.chat_client_settings;

    const settings = clientSettings?.settings as Record<string, unknown> | null;
    if (!settings?.return_chat_enabled) continue;

    const nrtMinutes = Number(slaConfig?.nrt_response_minutes ?? 60);
    const toleranceMinutes = Number(settings?.return_chat_tolerance_minutes ?? 0);
    const totalMinutes = nrtMinutes + toleranceMinutes;

    const lastCustomerAt = new Date(conv.last_customer_message_at).getTime();
    const deadlineMs = lastCustomerAt + totalMinutes * 60 * 1000;
    if (now < deadlineMs) continue;

    // Check idempotency: no auto_returned after last_customer_message_at
    const { count } = await supabase
      .from('chat_conversation_history')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('action', 'auto_returned')
      .gte('created_at', conv.last_customer_message_at);

    if ((count ?? 0) > 0) continue;

    eligible.push(conv);
  }

  return await processConversations(supabase, eligible);
}

async function processConversations(
  supabase: ReturnType<typeof createClient>,
  conversations: any[],
) {
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const conv of conversations) {
    try {
      const removedAgent: string = conv.assigned_to ?? 'desconhecido';

      // 1. Unassign and set pending
      const { error: updateError } = await supabase
        .from('chat_conversations')
        .update({ assigned_to: null, status: 'pending' })
        .eq('id', conv.id);

      if (updateError) throw updateError;

      const now = new Date().toISOString();

      // 2. Internal note
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          contact_id: conv.contact_id,
          conversation_id: conv.id,
          client_id: conv.client_id,
          text: `⚠️ Devido ao tempo de inatividade na conversa, o responsável ${removedAgent} foi removido e o atendimento retornado à lista Em Aberto.`,
          from_me: true,
          type: 'text',
          status: 'sent',
          internal_note: true,
          note_type: 'info',
          sender_name: 'Sistema',
          timestamp: now,
          created_at: now,
        });

      if (msgError) throw msgError;

      // 3. History entry
      const { error: histError } = await supabase
        .from('chat_conversation_history')
        .insert({
          conversation_id: conv.id,
          action: 'auto_returned',
          actor_name: 'Sistema',
          from_value: removedAgent,
          to_value: 'pending',
          notes: 'NRT vencido. Responsável removido automaticamente.',
          created_at: now,
        });

      if (histError) throw histError;

      results.push({ id: conv.id, ok: true });
    } catch (err) {
      console.error(`Failed to process conversation ${conv.id}:`, err);
      results.push({ id: conv.id, ok: false, error: String(err) });
    }
  }

  console.log(`chat-return-chat: processed ${results.length} conversations`);

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
