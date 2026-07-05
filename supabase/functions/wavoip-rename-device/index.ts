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
  const resp = await fetch(`${apiBase.replace(/\/$/, '')}/v2/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const raw = await resp.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!resp.ok) return { ok: false as const, error: data?.message || `HTTP ${resp.status}` };
  const token = data?.data?.token ?? data?.token;
  if (!token) return { ok: false as const, error: 'Token não retornado' };
  return { ok: true as const, token: String(token) };
}

async function apiFetch(apiBase: string, path: string, token: string, init: RequestInit = {}) {
  const resp = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const raw = await resp.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  return { ok: resp.ok, status: resp.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({} as any));
    const { device_id, name: nameOverride } = body ?? {};
    if (!device_id) return json(400, { error: 'device_id é obrigatório' });

    const { data: device, error: dErr } = await admin
      .from('wavoip_devices')
      .select('id, provider_id, wavoip_device_id, device_name, friendly_code, wavoip_raw, metadata')
      .eq('id', device_id)
      .single();
    if (dErr || !device) return json(404, { error: 'Dispositivo não encontrado' });
    if (!device.wavoip_device_id) return json(400, { error: 'Dispositivo sem wavoip_device_id' });

    const desiredName = String(
      nameOverride ?? device.device_name ?? `WAPhone_${device.friendly_code ?? ''}`
    ).trim();
    if (!desiredName) return json(400, { error: 'Nome inválido' });

    const { data: provider, error: pErr } = await admin
      .from('wavoip_providers').select('*').eq('id', device.provider_id).single();
    if (pErr || !provider) return json(404, { error: 'Provedor não encontrado' });

    let token: string | null = provider.token ?? null;
    if (!token) {
      const login = await wavoipLogin(provider.api_base, provider.username, provider.password);
      if (!login.ok) return json(502, { error: `Login Wavoip falhou: ${login.error}` });
      token = login.token;
      await admin.from('wavoip_providers').update({
        token, token_updated_at: new Date().toISOString(),
        last_login_status: 'ok', last_login_error: null,
      }).eq('id', provider.id);
    }

    let res = await apiFetch(provider.api_base, `/v2/devices/${device.wavoip_device_id}/name`, token!, {
      method: 'PUT', body: JSON.stringify({ name: desiredName }),
    });
    if (res.status === 401) {
      const login = await wavoipLogin(provider.api_base, provider.username, provider.password);
      if (!login.ok) return json(502, { error: `Login expirado: ${login.error}` });
      token = login.token;
      await admin.from('wavoip_providers').update({
        token, token_updated_at: new Date().toISOString(),
        last_login_status: 'ok', last_login_error: null,
      }).eq('id', provider.id);
      res = await apiFetch(provider.api_base, `/v2/devices/${device.wavoip_device_id}/name`, token!, {
        method: 'PUT', body: JSON.stringify({ name: desiredName }),
      });
    }
    if (!res.ok) {
      console.error('[wavoip-rename-device] PUT name failed', res);
      return json(502, { error: res.data?.message || `Falha ao renomear (HTTP ${res.status})`, details: res.data });
    }

    const rawObj = (device.wavoip_raw && typeof device.wavoip_raw === 'object') ? device.wavoip_raw : {};
    const metaObj = (device.metadata && typeof device.metadata === 'object') ? device.metadata : {};
    await admin.from('wavoip_devices').update({
      wavoip_raw: { ...rawObj, name: desiredName },
      metadata: { ...metaObj, last_rename_at: new Date().toISOString(), last_rename_name: desiredName },
      updated_at: new Date().toISOString(),
    }).eq('id', device.id);

    return json(200, { ok: true, wavoip_name: desiredName });
  } catch (e) {
    console.error('[wavoip-rename-device] error', e);
    return json(500, { error: (e as Error).message });
  }
});