// ============================================
// WhatsApp Profile Enrichment - Multi-provider helper
// Supports UaZapi (full data + image) and WABA Official (limited data)
// ============================================

export interface QueueLike {
  id?: string;
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
  try {
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
