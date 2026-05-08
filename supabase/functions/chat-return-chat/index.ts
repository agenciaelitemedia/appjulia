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

const BATCH_LIMIT = 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = Date.now();
  let trigger: 'cron' | 'manual' = 'cron';
  try {
    const body = await req.clone().json().catch(() => ({}));
    if (body && body.trigger === 'manual') trigger = 'manual';
  } catch (_) { /* noop */ }

  try {
    const rpcStart = Date.now();
    const { data: conversations, error } = await supabase.rpc(
      'get_return_chat_candidates',
      { batch_limit: BATCH_LIMIT },
    );
    const rpcMs = Date.now() - rpcStart;
    if (error) throw error;

    const results = await processConversations(supabase, conversations ?? []);
    const errors = results.filter((r) => !r.ok).length;
    const durationMs = Date.now() - startedAt;
    console.log(`chat-return-chat: processed ${results.length} conversations`);

    await supabase.from('chat_return_chat_runs').insert({
      trigger,
      duration_ms: durationMs,
      rpc_ms: rpcMs,
      candidates: (conversations ?? []).length,
      processed: results.length,
      errors,
    });

    return new Response(
      JSON.stringify({ processed: results.length, results, durationMs, rpcMs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('chat-return-chat error:', err);
    await supabase.from('chat_return_chat_runs').insert({
      trigger,
      duration_ms: Date.now() - startedAt,
      rpc_ms: 0,
      candidates: 0,
      processed: 0,
      errors: 1,
      notes: String(err).slice(0, 500),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processConversations(
  supabase: ReturnType<typeof createClient>,
  conversations: any[],
) {
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const conv of conversations) {
    try {
      // assigned_to é o nome do responsável (ex.: "Raquel Souza"). Se vier
      // numérico (fallback antigo de user.id), mantemos o valor cru — não há
      // tabela team_members no schema deste projeto.
      const removedAgent: string = (conv.assigned_to ?? '').toString().trim() || 'desconhecido';

      // 1. Unassign and set pending
      const { error: updateError } = await supabase
        .from('chat_conversations')
        .update({ assigned_to: null, status: 'pending' })
        .eq('id', conv.id);
      if (updateError) throw updateError;

      const now = new Date().toISOString();
      const channelType: string = conv.channel ?? 'whatsapp_uazapi';

      // 2. Internal note
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          contact_id: conv.contact_id,
          conversation_id: conv.id,
          client_id: conv.client_id,
          text: `⚠️ Tempo de inatividade excedido. O responsável **${removedAgent}** foi removido e o atendimento retornou à lista Em Aberto.`,
          from_me: true,
          type: 'text',
          status: 'sent',
          internal_note: true,
          note_type: 'info',
          sender_name: 'Sistema',
          channel_type: channelType,
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
          notes: `NRT vencido (${conv.nrt_minutes}min + ${conv.tolerance_minutes}min tolerância). Responsável removido automaticamente.`,
          created_at: now,
        });
      if (histError) throw histError;

      results.push({ id: conv.id, ok: true });
    } catch (err) {
      console.error(`Failed to process conversation ${conv.id}:`, err);
      results.push({ id: conv.id, ok: false, error: String(err) });
    }
  }

  return results;
}
