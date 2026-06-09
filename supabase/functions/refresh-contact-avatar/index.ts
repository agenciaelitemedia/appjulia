// ============================================
// Refresh Contact Avatar
// On-demand refresh of a chat_contacts.avatar URL.
// Downloads the WhatsApp profile picture (UaZapi /chat/details for
// individuals, /group/info for groups) and persists it to the
// `avatars` Storage bucket. The public Storage URL is stable, so the
// frontend stops fighting expired pps.whatsapp.net signed URLs.
// ============================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { persistAvatarToStorage } from '../_shared/whatsapp-profile.ts';

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

async function fetchUazapiIndividualAvatar(
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

async function fetchUazapiGroupAvatar(
  base: string,
  token: string,
  groupJid: string,
): Promise<string | null> {
  const url = base.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', token };
  try {
    const r = await fetch(`${url}/group/info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ groupjid: groupJid, pictureUrl: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json();
      const info = data?.group || data?.data || data || null;
      return pickStr(info?.pictureUrl, info?.image, info?.profilePictureUrl, info?.imagePreview);
    }
  } catch (_) { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { contact_id, force } = body || {};
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
      .select('id, client_id, phone, channel_source, channel_type, is_group, remote_jid, avatar, avatar_storage_path, avatar_source_url, avatar_source_hash, avatar_refresh_requested_at, avatar_refreshed_at')
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
        JSON.stringify({ avatar: contact.avatar ?? null, reason: 'no_uazapi_queue' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Route group vs individual lookup.
    const isGroup = contact.is_group === true ||
      (typeof contact.phone === 'string' && contact.phone.includes('@g.us')) ||
      (typeof contact.remote_jid === 'string' && contact.remote_jid.includes('@g.us'));

    const sourceUrl = isGroup
      ? await fetchUazapiGroupAvatar(queue.evo_url, queue.evo_apikey, contact.remote_jid || contact.phone)
      : await fetchUazapiIndividualAvatar(queue.evo_url, queue.evo_apikey, contact.phone);

    // The webhook may have flagged this contact for forced refresh.
    const flagged = !!contact.avatar_refresh_requested_at &&
      (!contact.avatar_refreshed_at || new Date(contact.avatar_refresh_requested_at) > new Date(contact.avatar_refreshed_at));
    const effectiveForce = force === true || flagged;

    if (!sourceUrl) {
      // Keep whatever we already have — don't blow away a previously stored avatar.
      await supabase
        .from('chat_contacts')
        .update({ avatar_refresh_requested_at: null, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
      return new Response(
        JSON.stringify({ avatar: contact.avatar ?? null, reason: 'no_remote_avatar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = await persistAvatarToStorage(supabase, {
      contact_id: contact.id,
      client_id: contact.client_id,
      is_group: isGroup,
      phone: contact.phone,
      source_url: sourceUrl,
      previous_hash: contact.avatar_source_hash,
      force: effectiveForce,
    });

    const nowIso = new Date().toISOString();
    let avatarUrl: string | null = contact.avatar ?? null;

    if (result.public_url && (result.changed || !contact.avatar_storage_path)) {
      // Append a cache-buster on real changes so clients reload the new image.
      avatarUrl = result.changed
        ? `${result.public_url}?v=${(result.hash || nowIso).slice(0, 12)}`
        : result.public_url;
      await supabase
        .from('chat_contacts')
        .update({
          avatar: avatarUrl,
          avatar_storage_path: result.storage_path,
          avatar_source_url: sourceUrl,
          avatar_source_hash: result.hash,
          avatar_refreshed_at: nowIso,
          avatar_refresh_requested_at: null,
          updated_at: nowIso,
        })
        .eq('id', contact.id);
    } else {
      await supabase
        .from('chat_contacts')
        .update({
          avatar_source_url: sourceUrl,
          avatar_refreshed_at: nowIso,
          avatar_refresh_requested_at: null,
          updated_at: nowIso,
        })
        .eq('id', contact.id);
    }

    return new Response(
      JSON.stringify({
        avatar: avatarUrl,
        changed: result.changed,
        reason: result.reason ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});