// ============================================
// Heartbeat / safety-net cron
// Roda a cada 1 minuto e chama uazapi-history-dispatcher (action=tick)
// para garantir que o dispatcher esteja sempre processando o backlog,
// mesmo se a instância da Edge Function tiver desligado por inatividade.
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-history-dispatcher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ action: 'tick' }),
    });
    const json = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true, dispatcher: json }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});