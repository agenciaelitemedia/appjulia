// ============================================
// Refresh Contact Avatar
// On-demand refresh of a chat_contacts.avatar URL when the
// stored signed URL from pps.whatsapp.net has expired (403/404).
// ============================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const TIMEOUT_MS = 12000;

function pickStr(...c: unknown[]): string | null {
  for (const v of c) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

async function fetchUazapiAvatar(
  base: string,
  token: string,
  phone: string,
): Promise<string | null> {
  const url = base.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', token };
  // 1) /chat/details (preview=false to get high-res when possible)
  try {
    const r = await fetch(`${url}/chat/details`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: phone, preview: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json();
      const d = data?.chat || data?.data || data || null;
      const u = pickStr(d?.image, d?.profilePictureUrl, d?.imagePreview);
      if (u) return u;
    }
  } catch (_) { /* ignore */ }
  // 2) Fallback /chat/GetNameAndImageURL
  try {
    const r = await fetch(`${url}/chat/GetNameAndImageURL`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: phone, preview: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json();
      const u = pickStr(data?.imageURL, data?.image, data?.profilePictureUrl);
      if (u) return u;
    }
  } catch (_) { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { contact_id } = await req.json();
    if (!contact_id || typeof contact_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: contact, error: cErr } = await supabase
      .from('chat_contacts')
      .select('id, client_id, phone, channel_source, channel_type, is_group')
      .eq('id', contact_id)
      .maybeSingle();

    if (cErr || !contact) {
      return new Response(
        JSON.stringify({ error: 'contact_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Find a usable UaZapi queue (same client). We prefer the contact's own
    // channel_source queue when it's UaZapi; otherwise any active sibling.
    let queue: { evo_url?: string | null; evo_apikey?: string | null } | null = null;
    if (contact.channel_source) {
      const { data: q } = await supabase
        .from('queues')
        .select('evo_url, evo_apikey, channel_type')
        .eq('id', contact.channel_source)
        .maybeSingle();
      if (q?.evo_url && q?.evo_apikey) queue = q;
    }
    if (!queue) {
      const { data: qs } = await supabase
        .from('queues')
        .select('evo_url, evo_apikey')
        .eq('client_id', contact.client_id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .not('evo_url', 'is', null)
        .not('evo_apikey', 'is', null)
        .limit(1);
      queue = (qs && qs[0]) || null;
    }

    if (!queue?.evo_url || !queue?.evo_apikey) {
      return new Response(
        JSON.stringify({ avatar: null, reason: 'no_uazapi_queue' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const avatar = await fetchUazapiAvatar(
      queue.evo_url,
      queue.evo_apikey,
      contact.phone,
    );

    if (avatar) {
      await supabase
        .from('chat_contacts')
        .update({ avatar, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
    } else {
      // Clear stale URL so we stop hitting expired CDN links
      await supabase
        .from('chat_contacts')
        .update({ avatar: null, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
    }

    return new Response(
      JSON.stringify({ avatar }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});