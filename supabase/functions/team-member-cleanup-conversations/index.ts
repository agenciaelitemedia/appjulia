import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Payload {
  clientId: string;
  memberName: string;
  memberId?: number;
  actorName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const clientId = (body?.clientId || '').toString().trim();
    const memberName = (body?.memberName || '').toString().trim();
    const actorName = (body?.actorName || 'Sistema').toString();

    if (!clientId || !memberName) {
      return new Response(JSON.stringify({ error: 'clientId and memberName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch all conversations assigned to this member (case-insensitive match)
    const { data: convs, error: selErr } = await supabase
      .from('chat_conversations')
      .select('id, status, assigned_to')
      .eq('client_id', clientId)
      .ilike('assigned_to', memberName);

    if (selErr) throw selErr;

    const openIds: string[] = [];
    const resolvedIds: string[] = [];
    for (const c of convs || []) {
      if (c.status === 'open' || c.status === 'pending') openIds.push(c.id);
      else if (c.status === 'resolved') resolvedIds.push(c.id);
    }

    const nowIso = new Date().toISOString();

    if (openIds.length) {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ assigned_to: null, updated_at: nowIso })
        .in('id', openIds);
      if (error) throw error;
    }

    if (resolvedIds.length) {
      // set closed_at only where currently null
      const { data: resRows, error: rErr } = await supabase
        .from('chat_conversations')
        .select('id, closed_at')
        .in('id', resolvedIds);
      if (rErr) throw rErr;
      for (const row of resRows || []) {
        const patch: Record<string, unknown> = { status: 'closed', updated_at: nowIso };
        if (!row.closed_at) patch.closed_at = nowIso;
        const { error } = await supabase.from('chat_conversations').update(patch).eq('id', row.id);
        if (error) throw error;
      }
    }

    // History entries
    const historyRows = [
      ...openIds.map((id) => ({
        conversation_id: id,
        action: 'member_removed_cleanup',
        actor_name: actorName,
        from_value: memberName,
        to_value: 'unassigned',
        notes: 'Membro removido da equipe — conversa devolvida à fila',
      })),
      ...resolvedIds.map((id) => ({
        conversation_id: id,
        action: 'member_removed_cleanup',
        actor_name: actorName,
        from_value: memberName,
        to_value: 'closed',
        notes: 'Membro removido da equipe — conversa resolvida encerrada',
      })),
    ];

    if (historyRows.length) {
      const { error } = await supabase.from('chat_conversation_history').insert(historyRows);
      if (error) console.error('[cleanup] history insert failed', error);
    }

    return new Response(
      JSON.stringify({ unassigned: openIds.length, closed: resolvedIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[team-member-cleanup-conversations] error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});