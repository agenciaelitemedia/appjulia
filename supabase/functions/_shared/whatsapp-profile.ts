// ============================================
// WhatsApp Profile Enrichment - Multi-provider helper
// Supports UaZapi (full data + image) and WABA Official (limited data)
// ============================================

export interface QueueLike {
  id?: string;
  client_id?: string;
  channel_type?: string | null;
  evo_url?: string | null;
  evo_apikey?: string | null;
  waba_token?: string | null;
  waba_number_id?: string | null;
}

export interface NormalizedProfile {
  name: string | null;
  avatar: string | null;
  remoteJid: string | null;
  isGroup: boolean;
  waName: string | null;
  waVerifiedName: string | null;
  waBusiness: boolean | null;
  waStatus: string | null;
  leadFullName: string | null;
  leadEmail: string | null;
  leadPersonalId: string | null;
  source: 'uazapi' | 'waba';
  raw: unknown;
}

const TIMEOUT_MS = 15000;
const GRAPH_API_VERSION = 'v22.0';
const AVATAR_BUCKET = 'avatars';
const AVATAR_FETCH_TIMEOUT_MS = 15000;

function emptyProfile(source: 'uazapi' | 'waba'): NormalizedProfile {
  return {
    name: null, avatar: null, remoteJid: null, isGroup: false,
    waName: null, waVerifiedName: null, waBusiness: null, waStatus: null,
    leadFullName: null, leadEmail: null, leadPersonalId: null,
    source, raw: null,
  };
}

function pickStr(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string') {
      const v = c.trim();
      if (v) return v;
    }
  }
  return null;
}

// ────────────────────── UaZapi ──────────────────────

async function fetchUazapiGroupProfile(queue: QueueLike, groupJid: string): Promise<NormalizedProfile> {
  const result = emptyProfile('uazapi');
  result.isGroup = true;
  if (!queue.evo_url || !queue.evo_apikey) return result;

  const base = queue.evo_url.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', token: queue.evo_apikey };

  try {
    const r = await fetch(`${base}/group/info`, {
      method: 'POST', headers,
      body: JSON.stringify({ groupjid: groupJid, pictureUrl: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json();
      const info = data?.group || data?.data || data || null;
      if (info) {
        result.name = pickStr(info.subject, info.name, info.groupName);
        result.avatar = pickStr(info.pictureUrl, info.image, info.profilePictureUrl, info.imagePreview);
        result.remoteJid = pickStr(info.groupjid, info.id, groupJid);
        result.raw = info;
      }
    } else {
      console.warn(`[whatsapp-profile][uazapi] /group/info HTTP ${r.status} jid=${groupJid}`);
    }
  } catch (e) {
    console.warn(`[whatsapp-profile][uazapi] /group/info failed jid=${groupJid}: ${(e as Error).message}`);
  }

  return result;
}

async function fetchUazapiProfile(queue: QueueLike, phone: string): Promise<NormalizedProfile> {
  const result = emptyProfile('uazapi');
  if (!queue.evo_url || !queue.evo_apikey) return result;

  const base = queue.evo_url.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', token: queue.evo_apikey };

  // 1) /chat/details
  let details: any = null;
  try {
    const r = await fetch(`${base}/chat/details`, {
      method: 'POST', headers,
      body: JSON.stringify({ number: phone, preview: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json();
      details = data?.chat || data?.data || data || null;
    }
  } catch (e) {
    console.warn(`[whatsapp-profile][uazapi] /chat/details failed phone=${phone}: ${(e as Error).message}`);
  }

  // 2) Fallback for high-res image
  if (details && !pickStr(details.image, details.profilePictureUrl, details.imagePreview)) {
    try {
      const r = await fetch(`${base}/chat/GetNameAndImageURL`, {
        method: 'POST', headers,
        body: JSON.stringify({ number: phone, preview: false }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.ok) {
        const data = await r.json();
        const url = pickStr(data?.imageURL, data?.image, data?.profilePictureUrl);
        if (url) details.image = url;
        const nm = pickStr(data?.name);
        if (nm && !details.name) details.name = nm;
      }
    } catch (e) {
      console.warn(`[whatsapp-profile][uazapi] /chat/GetNameAndImageURL failed phone=${phone}: ${(e as Error).message}`);
    }
  }

  if (!details) return result;

  result.name = pickStr(
    details.lead_fullName, details.lead_name, details.name,
    details.wa_name, details.wa_contactName,
  );
  result.avatar = pickStr(details.image, details.profilePictureUrl, details.imagePreview);
  result.remoteJid = pickStr(details.wa_chatid, details.remoteJid);
  result.isGroup = Boolean(details.wa_isGroup);
  result.waName = pickStr(details.wa_name, details.wa_contactName);
  result.waVerifiedName = pickStr(details.wa_verifiedName, details.wa_businessName);
  result.waBusiness = typeof details.wa_isBusiness === 'boolean' ? details.wa_isBusiness : null;
  result.waStatus = pickStr(details.wa_status, details.status);
  result.leadFullName = pickStr(details.lead_fullName, details.lead_name);
  result.leadEmail = pickStr(details.lead_email);
  result.leadPersonalId = pickStr(details.lead_personalid, details.lead_personalId, details.lead_cpf);
  result.raw = details;
  return result;
}

// ────────────────────── WABA (Meta Cloud API) ──────────────────────
// Meta API does NOT expose third-party contact photos or names beyond
// what arrives in the inbound message payload. We only enrich what the
// official endpoints allow: contact existence check (wa_id) and the
// business profile of the OWN number.

async function fetchWabaProfile(queue: QueueLike, phone: string): Promise<NormalizedProfile> {
  const result = emptyProfile('waba');
  if (!queue.waba_token || !queue.waba_number_id) return result;

  const base = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
  const auth = { Authorization: `Bearer ${queue.waba_token}`, 'Content-Type': 'application/json' };

  // 1) Validate contact exists on WhatsApp (returns wa_id only)
  try {
    const r = await fetch(`${base}/${queue.waba_number_id}/contacts`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        blocking: 'wait',
        contacts: [phone.startsWith('+') ? phone : `+${phone}`],
        force_check: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json();
      const c = Array.isArray(data?.contacts) ? data.contacts[0] : null;
      if (c?.wa_id) {
        result.remoteJid = `${String(c.wa_id).replace(/\D/g, '')}@s.whatsapp.net`;
      }
      result.raw = data;
    } else {
      // Not all WABA accounts have /contacts enabled — non-fatal
      console.warn(`[whatsapp-profile][waba] /contacts HTTP ${r.status} phone=${phone}`);
    }
  } catch (e) {
    console.warn(`[whatsapp-profile][waba] /contacts failed phone=${phone}: ${(e as Error).message}`);
  }

  return result;
}

// ────────────────────── Public API ──────────────────────

export async function fetchWhatsappProfile(
  queue: QueueLike,
  phone: string,
): Promise<NormalizedProfile> {
  const ch = (queue.channel_type || '').toLowerCase();
  const isWaba = ch.includes('waba') || ch.includes('cloud') || (!queue.evo_url && !!queue.waba_token);
  const isGroupJid = typeof phone === 'string' && phone.includes('@g.us');
  try {
    if (isGroupJid && !isWaba) return await fetchUazapiGroupProfile(queue, phone);
    return isWaba ? await fetchWabaProfile(queue, phone) : await fetchUazapiProfile(queue, phone);
  } catch (e) {
    console.warn(`[whatsapp-profile] unexpected error phone=${phone}: ${(e as Error).message}`);
    return emptyProfile(isWaba ? 'waba' : 'uazapi');
  }
}

/** Builds the partial column update for chat_contacts from a profile. */
export function profileToContactColumns(p: NormalizedProfile): Record<string, unknown> {
  return {
    wa_name: p.waName,
    wa_verified_name: p.waVerifiedName,
    wa_business: p.waBusiness,
    wa_status: p.waStatus,
    lead_full_name: p.leadFullName,
    lead_email: p.leadEmail,
    lead_personalid: p.leadPersonalId,
    profile_fetched_at: new Date().toISOString(),
    profile_source: p.source,
  };
}

// ────────────────────── Cross-Provider WABA → UaZapi ──────────────────────
// When a WABA queue cannot fetch the contact's avatar (Meta limitation),
// try to look up the same phone via any active UaZapi queue of the same client.
// Falls back gracefully if no UaZapi queue exists.
export async function fetchWabaProfileWithUazapiFallback(
  wabaQueue: QueueLike,
  phone: string,
  supabase: any,
): Promise<NormalizedProfile> {
  const profile = await fetchWabaProfile(wabaQueue, phone);

  // Only fallback if avatar is missing and we have a client_id to look up sibling queues
  if (profile.avatar || !wabaQueue.client_id) return profile;

  try {
    const { data: uaQueues } = await supabase
      .from('queues')
      .select('id, evo_url, evo_apikey, channel_type')
      .eq('client_id', wabaQueue.client_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('evo_url', 'is', null)
      .not('evo_apikey', 'is', null)
      .limit(1);

    const uaQueue = Array.isArray(uaQueues) && uaQueues.length > 0 ? uaQueues[0] : null;
    if (!uaQueue) return profile;

    const uaProfile = await fetchUazapiProfile(uaQueue as QueueLike, phone);
    if (uaProfile.avatar) profile.avatar = uaProfile.avatar;
    if (!profile.waName && uaProfile.waName) profile.waName = uaProfile.waName;
    if (!profile.name && uaProfile.name) profile.name = uaProfile.name;
  } catch (e) {
    console.warn(`[whatsapp-profile] WABA→UaZapi fallback failed phone=${phone}: ${(e as Error).message}`);
  }

  return profile;
}

// ────────────────────── Avatar Storage Cache ──────────────────────
// Downloads a WhatsApp profile picture and persists it to the
// `avatars` Storage bucket, returning a stable public URL. Uses a
// SHA-256 hash to avoid re-uploading unchanged images.

export interface PersistAvatarInput {
  contact_id: string;
  client_id: string;
  is_group: boolean;
  phone: string;
  source_url: string | null;
  /** Previous hash stored in chat_contacts.avatar_source_hash */
  previous_hash?: string | null;
  /** When true, re-uploads even if hash matches */
  force?: boolean;
}

export interface PersistAvatarResult {
  changed: boolean;
  public_url: string | null;
  storage_path: string | null;
  hash: string | null;
  reason?: string;
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function inferContentType(url: string, fallback = 'image/jpeg'): string {
  const u = url.toLowerCase();
  if (u.includes('.png')) return 'image/png';
  if (u.includes('.webp')) return 'image/webp';
  if (u.includes('.gif')) return 'image/gif';
  return fallback;
}

export async function persistAvatarToStorage(
  supabase: any,
  input: PersistAvatarInput,
): Promise<PersistAvatarResult> {
  const empty: PersistAvatarResult = {
    changed: false, public_url: null, storage_path: null, hash: null,
  };
  if (!input.source_url) return { ...empty, reason: 'no_source_url' };

  // 1) Download the picture binary server-side (no CORS).
  let bin: ArrayBuffer;
  let contentType = 'image/jpeg';
  try {
    const r = await fetch(input.source_url, {
      signal: AbortSignal.timeout(AVATAR_FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 AvatarFetcher' },
    });
    if (!r.ok) {
      return { ...empty, reason: `fetch_${r.status}` };
    }
    contentType = r.headers.get('content-type') || inferContentType(input.source_url);
    if (!contentType.startsWith('image/')) {
      contentType = inferContentType(input.source_url);
    }
    bin = await r.arrayBuffer();
    if (!bin || bin.byteLength === 0) return { ...empty, reason: 'empty_body' };
  } catch (e) {
    return { ...empty, reason: `fetch_error:${(e as Error).message}` };
  }

  // 2) Hash for change detection.
  const hashBuf = await crypto.subtle.digest('SHA-256', bin);
  const hash = bufToHex(hashBuf);

  const storage_path = `whatsapp/${input.client_id}/${input.contact_id}.jpg`;
  const { data: existingPublic } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storage_path);
  const public_url = existingPublic?.publicUrl || null;

  if (!input.force && input.previous_hash && input.previous_hash === hash) {
    return { changed: false, public_url, storage_path, hash, reason: 'hash_match' };
  }

  // 3) Upload (upsert) to Storage.
  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storage_path, new Uint8Array(bin), {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });

  if (upErr) {
    return { ...empty, hash, reason: `upload_error:${upErr.message}` };
  }

  return { changed: true, public_url, storage_path, hash };
}
