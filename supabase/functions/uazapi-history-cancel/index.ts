// ============================================
// UaZapi History Cancel
// Marks a sync job as cancel_requested so the worker stops at the next batch.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { job_id } = await req.json();
    if (!job_id) return respond({ error: 'job_id required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase
      .from('whatsapp_sync_jobs')
      .update({ cancel_requested: true })
      .eq('id', job_id)
      .eq('status', 'running');

    if (error) return respond({ error: error.message }, 500);
    return respond({ ok: true, job_id });
  } catch (err) {
    return respond({ error: (err as Error).message }, 500);
  }
});