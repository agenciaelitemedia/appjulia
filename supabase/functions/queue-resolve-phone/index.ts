// ============================================
// Queue Resolve Phone
// Resolves the real WhatsApp phone number of a queue's connected
// instance via the provider's API (Meta Graph for WABA, UaZapi for
// the unofficial channel) and persists it on `queues.phone_number`.
//
// Used by the anti-echo filter in `uazapi-chat-webhook` and
// `meta-webhook` to discard messages exchanged between two
// instances belonging to the same client.
//
// Body: { queue_id: string }
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

function digitsOnly(input: unknown): string {
  return String(input ?? '').replace(/\D/g, '');
}

async function resolveWaba(waba_number_id: string, waba_token: string): Promise<string | null> {
  try {
    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(waba_number_id)}?fields=display_phone_number`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${waba_token}` } });
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn(`[queue-resolve-phone] WABA HTTP ${resp.status}: ${txt.slice(0, 200)}`);
      return null;
    }
    const json = await resp.json();
    const phone = digitsOnly(json?.display_phone_number);
    return phone || null;
  } catch (err) {
    console.warn('[queue-resolve-phone] WABA fetch failed:', (err as Error).message);
    return null;
  }
}

async function resolveUazapi(evo_url: string, evo_apikey: string): Promise<string | null> {
  const base = evo_url.replace(/\/+$/, '');
  const headers = { token: evo_apikey, 'Content-Type': 'application/json' };
  for (const path of ['/instance/status', '/instance/info']) {
    try {
      const resp = await fetch(`${base}${path}`, { headers });
      if (!resp.ok) continue;
      const json = await resp.json();
      const owner =
        json?.instance?.owner ??
        json?.owner ??
        json?.instance?.wid ??
        json?.wid ??
        null;
      const phone = digitsOnly(owner);
      if (phone && phone.length >= 8 && phone.length <= 15) return phone;
    } catch (err) {
      console.warn(`[queue-resolve-phone] UaZapi ${path} failed:`, (err as Error).message);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }
  const queueId = body?.queue_id;
  if (!queueId || typeof queueId !== 'string') {
    return respond({ error: 'queue_id required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: queue, error } = await supabase
    .from('queues')
    .select('id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id')
    .eq('id', queueId)
    .maybeSingle();

  if (error || !queue) {
    return respond({ error: 'Queue not found' }, 404);
  }

  let phone: string | null = null;
  if (queue.channel_type === 'waba') {
    if (!queue.waba_number_id || !queue.waba_token) {
      return respond({ ok: false, reason: 'missing waba credentials' });
    }
    phone = await resolveWaba(queue.waba_number_id, queue.waba_token);
  } else if (queue.channel_type === 'uazapi') {
    if (!queue.evo_url || !queue.evo_apikey) {
      return respond({ ok: false, reason: 'missing uazapi credentials' });
    }
    phone = await resolveUazapi(queue.evo_url, queue.evo_apikey);
  } else {
    return respond({ ok: false, reason: `unsupported channel_type: ${queue.channel_type}` });
  }

  if (!phone) {
    return respond({ ok: false, reason: 'could not resolve phone (provider returned empty/invalid)' });
  }

  const { error: updErr } = await supabase
    .from('queues')
    .update({ phone_number: phone, phone_resolved_at: new Date().toISOString() })
    .eq('id', queueId);

  if (updErr) {
    return respond({ error: updErr.message }, 500);
  }

  console.log(`[queue-resolve-phone] queue=${queueId} channel=${queue.channel_type} phone=${phone}`);
  return respond({ ok: true, phone_number: phone });
});