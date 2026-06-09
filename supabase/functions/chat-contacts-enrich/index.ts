// ============================================
// Chat Contacts Enrich (one-shot batch)
// Reprocessa contatos sem foto/perfil enriquecido,
// agrupando por queue_id (channel_source) para
// resolver o provider correto (UaZapi ou WABA).
// POST { client_id, queue_id?, only_missing_avatar?, limit? }
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchWhatsappProfile, profileToContactColumns, persistAvatarToStorage } from "../_shared/whatsapp-profile.ts";

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

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function loadQueue(supabase: any, queueId: string) {
  const { data } = await supabase
    .from('queues')
    .select('id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id')
    .eq('id', queueId)
    .maybeSingle();
  return data;
}

async function runJob(params: {
  client_id: string;
  queue_id?: string;
  only_missing_avatar?: boolean;
  limit?: number;
}) {
  const supabase = getSupabase();
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  let query = supabase
    .from('chat_contacts')
    .select('id, client_id, phone, channel_source, avatar, profile_fetched_at, is_group, name, remote_jid, avatar_storage_path, avatar_source_hash, avatar_refreshed_at')
    .eq('client_id', params.client_id)
    .order('profile_fetched_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (params.queue_id) query = query.eq('channel_source', params.queue_id);
  if (params.only_missing_avatar) query = query.is('avatar', null);

  const { data: contacts, error } = await query;
  if (error) {
    console.error('[chat-contacts-enrich] query error', error.message);
    return;
  }
  if (!contacts || contacts.length === 0) {
    console.log('[chat-contacts-enrich] no contacts to enrich');
    return;
  }

  // Group by channel_source (queue_id)
  const byQueue = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const k = c.channel_source || '';
    if (!byQueue.has(k)) byQueue.set(k, [] as any);
    byQueue.get(k)!.push(c);
  }

  let enriched = 0;
  let failed = 0;

  for (const [queueId, group] of byQueue) {
    if (!queueId) {
      console.warn('[chat-contacts-enrich] skipping group with empty channel_source');
      continue;
    }
    const queue = await loadQueue(supabase, queueId);
    if (!queue) {
      console.warn(`[chat-contacts-enrich] queue not found id=${queueId}`);
      continue;
    }

    const BATCH = 3;
    for (let i = 0; i < group.length; i += BATCH) {
      const slice = group.slice(i, i + BATCH);
      await Promise.all(slice.map(async (contact) => {
        try {
          const profile = await fetchWhatsappProfile(queue as any, contact.phone);
          const update: Record<string, unknown> = { ...profileToContactColumns(profile) };
          if (profile.avatar) {
            // Persist to Storage so the saved URL is stable and survives
            // pps.whatsapp.net signed URL expiration.
            const persisted = await persistAvatarToStorage(supabase, {
              contact_id: contact.id,
              client_id: contact.client_id,
              is_group: contact.is_group === true ||
                (typeof contact.phone === 'string' && contact.phone.includes('@g.us')),
              phone: contact.phone,
              source_url: profile.avatar,
              previous_hash: (contact as any).avatar_source_hash || null,
              force: false,
            });
            if (persisted.public_url) {
              update.avatar = persisted.changed
                ? `${persisted.public_url}?v=${(persisted.hash || Date.now().toString()).slice(0, 12)}`
                : persisted.public_url;
              update.avatar_storage_path = persisted.storage_path;
              update.avatar_source_url = profile.avatar;
              update.avatar_source_hash = persisted.hash;
              update.avatar_refreshed_at = new Date().toISOString();
              update.avatar_refresh_requested_at = null;
            } else {
              // Storage upload failed — fall back to the raw URL to avoid
              // losing the picture entirely; SmartAvatarImage tolerates 403.
              update.avatar = profile.avatar;
            }
          }
          if (profile.name && profile.name !== contact.phone &&
              (!contact.name || /^[\d\s+\-()]+$/.test(contact.name) || contact.name === contact.phone)) {
            update.name = profile.name;
          }
          if (profile.remoteJid) update.remote_jid = profile.remoteJid;
          const { error: uErr } = await supabase
            .from('chat_contacts')
            .update(update)
            .eq('id', contact.id);
          if (uErr) { failed++; console.warn(`[chat-contacts-enrich] update failed id=${contact.id}: ${uErr.message}`); }
          else enriched++;
        } catch (e) {
          failed++;
          console.warn(`[chat-contacts-enrich] enrich failed phone=${contact.phone}: ${(e as Error).message}`);
        }
      }));
      // light throttle
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log(`[chat-contacts-enrich] done client=${params.client_id} enriched=${enriched} failed=${failed} total=${contacts.length}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { client_id, queue_id, only_missing_avatar, limit } = body || {};
    if (!client_id) return respond({ error: 'client_id required' }, 400);

    // @ts-ignore EdgeRuntime is available in Supabase
    EdgeRuntime.waitUntil(runJob({ client_id: String(client_id), queue_id, only_missing_avatar, limit }));

    return respond({ ok: true, status: 'started', client_id, queue_id: queue_id || null });
  } catch (err) {
    console.error('[chat-contacts-enrich] error', err);
    return respond({ error: (err as Error).message }, 500);
  }
});