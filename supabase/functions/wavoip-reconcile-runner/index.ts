import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Cron a cada 1 min: puxa itens vencidos da fila wavoip_reconcile_queue e invoca wavoip-reconcile-call.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: items } = await admin
      .from('wavoip_reconcile_queue')
      .select('id,whatsapp_call_id,attempts')
      .eq('status', 'pending')
      .lte('run_after', new Date().toISOString())
      .order('run_after', { ascending: true })
      .limit(20);

    const results: any[] = [];
    for (const it of items ?? []) {
      // marca como done antes de invocar; o próprio reconcile reagenda um novo se necessário
      await admin.from('wavoip_reconcile_queue')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', it.id);

      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/wavoip-reconcile-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
          body: JSON.stringify({ whatsapp_call_id: it.whatsapp_call_id }),
        });
        results.push({ wid: it.whatsapp_call_id, status: r.status });
      } catch (e) {
        results.push({ wid: it.whatsapp_call_id, error: String((e as Error)?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});