import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ProviderRow = {
  id: string;
  name: string;
  type: string;
  api_base: string;
  username: string;
  password: string;
  token: string | null;
  token_updated_at: string | null;
  last_login_status: string | null;
  last_login_error: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitize(row: ProviderRow) {
  const { password: _p, token, ...rest } = row;
  return { ...rest, has_password: !!row.password, has_token: !!token };
}

async function wavoipLogin(apiBase: string, username: string, password: string) {
  const url = `${apiBase.replace(/\/$/, '')}/v2/login`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
      signal: ctrl.signal,
    });
    const raw = await resp.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!resp.ok) {
      return { ok: false as const, error: data?.message || `HTTP ${resp.status}`, data };
    }
    const token = data?.data?.token ?? data?.token;
    if (!token) return { ok: false as const, error: 'Token não retornado pelo endpoint de login', data };
    return { ok: true as const, token: String(token), data };
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError'
      ? 'Timeout ao conectar na Wavoip (10s)'
      : String((e as Error)?.message ?? e);
    console.error('[wavoip-providers] login error:', msg);
    return { ok: false as const, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({} as any));
    const action: string = body?.action ?? '';
    const data = body?.data ?? {};
    console.log('[wavoip-providers] action:', action);

    switch (action) {
      case 'list': {
        const { data: rows, error } = await admin
          .from('wavoip_providers')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) return json(500, { error: error.message });
        return json(200, { data: (rows as ProviderRow[]).map(sanitize) });
      }

      case 'create': {
        const { name, type, api_base, username, password } = data ?? {};
        if (!name || !type || !username || !password) {
          return json(400, { error: 'Campos obrigatórios: name, type, username, password' });
        }
        if (!['wavoip_multicanal', 'wavoip_free'].includes(type)) {
          return json(400, { error: 'Tipo inválido' });
        }
        const base = (api_base || 'https://api.wavoip.com').trim();
        // Insert first so the provider is saved even if Wavoip is down
        const { data: row, error } = await admin.from('wavoip_providers').insert({
          name, type, api_base: base, username, password,
          last_login_status: 'pending',
        }).select('*').single();
        if (error) return json(500, { error: error.message });

        const login = await wavoipLogin(base, username, password);
        const patch = login.ok
          ? { token: login.token, token_updated_at: new Date().toISOString(), last_login_status: 'ok', last_login_error: null }
          : { last_login_status: 'error', last_login_error: login.error };
        const { data: updated } = await admin.from('wavoip_providers').update(patch).eq('id', (row as any).id).select('*').single();
        const final = (updated ?? row) as ProviderRow;
        if (!login.ok) return json(200, { data: sanitize(final), warning: `Provedor salvo, mas login falhou: ${login.error}` });
        return json(200, { data: sanitize(final) });
      }

      case 'update': {
        const { id, name, type, api_base, username, password, is_active } = data ?? {};
        if (!id) return json(400, { error: 'id obrigatório' });
        const { data: current, error: fetchErr } = await admin.from('wavoip_providers').select('*').eq('id', id).single();
        if (fetchErr || !current) return json(404, { error: 'Provedor não encontrado' });

        const nextBase = (api_base ?? current.api_base).trim();
        const nextUser = username ?? current.username;
        const nextPass = (password && password.length > 0) ? password : current.password;

        const credsChanged = nextBase !== current.api_base || nextUser !== current.username || nextPass !== current.password;

        const patch: any = {
          name: name ?? current.name,
          type: type ?? current.type,
          api_base: nextBase,
          username: nextUser,
          password: nextPass,
          is_active: typeof is_active === 'boolean' ? is_active : current.is_active,
        };

        if (credsChanged) {
          const login = await wavoipLogin(nextBase, nextUser, nextPass);
          patch.token = login.ok ? login.token : null;
          patch.token_updated_at = login.ok ? new Date().toISOString() : null;
          patch.last_login_status = login.ok ? 'ok' : 'error';
          patch.last_login_error = login.ok ? null : login.error;
        }

        const { data: row, error } = await admin.from('wavoip_providers').update(patch).eq('id', id).select('*').single();
        if (error) return json(500, { error: error.message });
        return json(200, { data: sanitize(row as ProviderRow) });
      }

      case 'delete': {
        const { id } = data ?? {};
        if (!id) return json(400, { error: 'id obrigatório' });
        const { error } = await admin.from('wavoip_providers').delete().eq('id', id);
        if (error) return json(500, { error: error.message });
        return json(200, { ok: true });
      }

      case 'refresh_token': {
        const { id } = data ?? {};
        if (!id) return json(400, { error: 'id obrigatório' });
        const { data: current, error: fetchErr } = await admin.from('wavoip_providers').select('*').eq('id', id).single();
        if (fetchErr || !current) return json(404, { error: 'Provedor não encontrado' });
        const login = await wavoipLogin(current.api_base, current.username, current.password);
        const patch = login.ok
          ? { token: login.token, token_updated_at: new Date().toISOString(), last_login_status: 'ok', last_login_error: null }
          : { last_login_status: 'error', last_login_error: login.error };
        const { data: row, error } = await admin.from('wavoip_providers').update(patch).eq('id', id).select('*').single();
        if (error) return json(500, { error: error.message });
        if (!login.ok) return json(200, { data: sanitize(row as ProviderRow), warning: login.error });
        return json(200, { data: sanitize(row as ProviderRow) });
      }

      case 'get_token': {
        const { id } = data ?? {};
        if (!id) return json(400, { error: 'id obrigatório' });
        const { data: row, error } = await admin.from('wavoip_providers').select('id,api_base,token,token_updated_at').eq('id', id).single();
        if (error || !row) return json(404, { error: 'Provedor não encontrado' });
        return json(200, { data: row });
      }

      default:
        return json(400, { error: `Ação desconhecida: ${action}` });
    }
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});