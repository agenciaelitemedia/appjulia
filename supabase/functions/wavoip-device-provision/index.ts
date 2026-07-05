import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function wavoipLogin(apiBase: string, email: string, password: string) {
  const url = `${apiBase.replace(/\/$/, '')}/v2/login`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: ctrl.signal,
    });
    const raw = await resp.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!resp.ok) return { ok: false as const, error: data?.message || `HTTP ${resp.status}` };
    const token = data?.data?.token ?? data?.token;
    if (!token) return { ok: false as const, error: 'Token não retornado' };
    return { ok: true as const, token: String(token) };
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError' ? 'Timeout no login Wavoip (10s)' : String((e as Error)?.message ?? e);
    return { ok: false as const, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureToken(admin: any, provider: any): Promise<string> {
  if (provider.token) return provider.token as string;
  const login = await wavoipLogin(provider.api_base, provider.username, provider.password);
  if (!login.ok) throw new Error(`Login Wavoip falhou: ${login.error}`);
  await admin.from('wavoip_providers').update({
    token: login.token,
    token_updated_at: new Date().toISOString(),
    last_login_status: 'ok',
    last_login_error: null,
  }).eq('id', provider.id);
  return login.token;
}

async function apiFetch(apiBase: string, path: string, token: string, init: RequestInit = {}) {
  const url = `${apiBase.replace(/\/$/, '')}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      signal: ctrl.signal,
    });
    const raw = await resp.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError' ? `Timeout em ${path}` : String((e as Error)?.message ?? e);
    return { ok: false, status: 0, data: { error: msg } };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({} as any));
    const {
      provider_id, plan_id, client_id, user_plan_id,
      device_name, channels,
    } = body ?? {};

    if (!provider_id || !client_id || !device_name) {
      return json(400, { error: 'Campos obrigatórios: provider_id, client_id, device_name' });
    }

    // Load provider (with credentials)
    const { data: provider, error: provErr } = await admin
      .from('wavoip_providers').select('*').eq('id', provider_id).single();
    if (provErr || !provider) return json(404, { error: 'Provedor não encontrado' });

    const isFree = provider.type === 'wavoip_free';
    const wavoipName = `JU_${client_id}_${device_name}`;

    // Ensure token (login if missing)
    let token: string;
    try { token = await ensureToken(admin, provider); }
    catch (e) { return json(502, { error: (e as Error).message }); }

    // 1) buy-device
    const buyBody = isFree
      ? { type: 'FREE', name: wavoipName }
      : { type: 'PAID', deviceProps: [{ name: wavoipName, channels: Math.max(1, Number(channels || 1)), count: 1 }] };

    let buy = await apiFetch(provider.api_base, '/v2/sales/buy-device', token, {
      method: 'POST', body: JSON.stringify(buyBody),
    });

    // If 401, refresh token once
    if (buy.status === 401) {
      const login = await wavoipLogin(provider.api_base, provider.username, provider.password);
      if (!login.ok) return json(502, { error: `Login expirado: ${login.error}` });
      await admin.from('wavoip_providers').update({
        token: login.token, token_updated_at: new Date().toISOString(),
        last_login_status: 'ok', last_login_error: null,
      }).eq('id', provider.id);
      token = login.token;
      buy = await apiFetch(provider.api_base, '/v2/sales/buy-device', token, {
        method: 'POST', body: JSON.stringify(buyBody),
      });
    }

    if (!buy.ok) {
      console.error('[wavoip-device-provision] buy-device failed', buy);
      return json(502, { error: buy.data?.message || buy.data?.error || `Falha em buy-device (HTTP ${buy.status})`, details: buy.data });
    }

    // Extract deviceId. FREE returns { data: { deviceId } }.
    // PAID may return an array under data. Handle both.
    const d = buy.data?.data;
    let deviceId: number | null = null;
    if (Array.isArray(d)) {
      deviceId = Number(d[0]?.deviceId ?? d[0]?.id ?? d[0]);
    } else if (d && typeof d === 'object') {
      deviceId = Number(d.deviceId ?? d.id);
    } else if (typeof d === 'number') {
      deviceId = d;
    }
    if (!deviceId || Number.isNaN(deviceId)) {
      return json(502, { error: 'Wavoip não retornou deviceId', details: buy.data });
    }

    // 2) fetch device details
    const details = await apiFetch(provider.api_base, `/devices/${deviceId}`, token);
    if (!details.ok) {
      console.error('[wavoip-device-provision] /devices/:id failed', details);
      return json(502, { error: details.data?.message || `Falha ao obter dispositivo (HTTP ${details.status})`, details: details.data });
    }
    const result = Array.isArray(details.data?.result) ? details.data.result[0] : details.data?.result;
    if (!result?.token) {
      return json(502, { error: 'Wavoip não retornou token do dispositivo', details: details.data });
    }

    // 3) Insert into wavoip_devices
    const { data: inserted, error: insErr } = await admin.from('wavoip_devices').insert({
      provider_id,
      client_id,
      user_plan_id: user_plan_id ?? null,
      device_name,
      device_token: result.token,
      wavoip_device_id: deviceId,
      wavoip_raw: result,
      whatsapp_number: result.phone ?? null,
      device_model: isFree ? 'free' : 'paid',
      status: 'in_use',
      connection_status: 'disconnected',
      provisioned_at: new Date().toISOString(),
    }).select('*').single();

    if (insErr) {
      console.error('[wavoip-device-provision] insert failed', insErr);
      return json(500, { error: insErr.message });
    }

    // Renomear no Wavoip para exibir device_name amigável no widget ("Ligando de <nome>")
    // em vez do nome técnico "JU_<client>_<nome>" usado no buy-device.
    try {
      const ren = await apiFetch(provider.api_base, `/v2/devices/${deviceId}/name`, token, {
        method: 'PUT', body: JSON.stringify({ name: device_name }),
      });
      if (ren.ok) {
        await admin.from('wavoip_devices').update({
          wavoip_raw: { ...(result || {}), name: device_name },
          metadata: { last_rename_at: new Date().toISOString(), last_rename_name: device_name },
        }).eq('id', inserted.id);
      } else {
        console.warn('[wavoip-device-provision] rename after insert failed', ren.status, ren.data);
      }
    } catch (e) {
      console.warn('[wavoip-device-provision] rename after insert threw', e);
    }

    return json(200, { data: inserted });
  } catch (e) {
    console.error('[wavoip-device-provision] fatal', e);
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});