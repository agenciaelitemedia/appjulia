import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callUazapi(baseUrl: string, token: string, path: string): Promise<{ ok: boolean; status: number; body: any }> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: '{}',
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* noop */ }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const queue_id: string | undefined = body?.queue_id;

    if (!queue_id) return json({ error: 'queue_id is required' }, 400);

    const { data: queue, error: qErr } = await supabase
      .from('queues')
      .select('id, name, evo_url, evo_apikey, evo_instance, channel_type, is_active')
      .eq('id', queue_id)
      .maybeSingle();

    if (qErr || !queue) return json({ error: 'queue not found', detail: qErr?.message }, 404);
    if (queue.channel_type !== 'uazapi') return json({ error: 'queue is not uazapi' }, 400);

    const baseUrl = (queue.evo_url || '').trim();
    const token = (queue.evo_apikey || '').trim();
    if (!baseUrl || !token) return json({ error: 'queue missing UaZapi credentials' }, 400);

    console.log(`[force-resync] queue=${queue.name} (${queue.id}) instance=${queue.evo_instance}`);

    // 1) disconnect (mantém pareamento, derruba sessão WS)
    const disc = await callUazapi(baseUrl, token, '/instance/disconnect');
    console.log(`[force-resync] disconnect status=${disc.status}`);

    // 2) aguarda 2s
    await new Promise((r) => setTimeout(r, 2000));

    // 3) reconnect
    const conn = await callUazapi(baseUrl, token, '/instance/connect');
    console.log(`[force-resync] connect status=${conn.status}`);

    return json({
      ok: true,
      queue_id: queue.id,
      queue_name: queue.name,
      disconnect: { status: disc.status, ok: disc.ok },
      connect: { status: conn.status, ok: conn.ok },
      message: 'Disconnect+reconnect enviado. A UaZapi deve reenviar history em alguns segundos.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[force-resync] error:', msg);
    return json({ error: msg }, 500);
  }
});