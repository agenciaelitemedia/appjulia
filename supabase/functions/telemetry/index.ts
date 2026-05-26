import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { action, data } = await req.json();
    switch (action) {
      case 'log_device': {
        const { error } = await admin.from('user_device_log').insert(data);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case 'log_performance': {
        const { error } = await admin.from('user_performance_log').insert(data);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case 'get_device_latest': {
        const ids: number[] = Array.isArray(data?.userIds) ? data.userIds : [];
        if (ids.length === 0) return json({ data: [] });
        const { data: rows, error } = await admin
          .from('user_device_latest')
          .select('*')
          .in('user_id', ids);
        if (error) return json({ error: error.message }, 400);
        return json({ data: rows ?? [] });
      }
      case 'get_user_performance': {
        const userId = Number(data?.userId);
        if (!userId) return json({ data: [] });
        const { data: rows, error } = await admin
          .from('user_performance_log')
          .select('*')
          .eq('user_id', userId)
          .order('occurred_at', { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 400);
        return json({ data: rows ?? [] });
      }
      default:
        return json({ error: 'unknown_action' }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});