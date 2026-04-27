import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// ---------- External DB (read-only para resolver dados de usuário) ----------
function normalizeCaCert(input: string): string[] {
  let text = input.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!text.includes("BEGIN CERTIFICATE")) {
    try {
      const decoded = atob(text);
      if (decoded.includes("BEGIN CERTIFICATE")) text = decoded;
    } catch { /* ignore */ }
  }
  text = text
    .replace(/-----BEGIN CERTIFICATE-----\s+/g, "-----BEGIN CERTIFICATE-----\n")
    .replace(/\s+-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----")
    .replace(/-----END CERTIFICATE-----\s+/g, "-----END CERTIFICATE-----\n");
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks) return [];
  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;
  return blocks.map((block) => {
    const b64 = block
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "")
      .trim();
    return `-----BEGIN CERTIFICATE-----\n${wrap64(b64)}\n-----END CERTIFICATE-----\n`;
  });
}

const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
let extPool: ReturnType<typeof postgres> | null = null;

function getExternalPool() {
  if (extPool) return extPool;
  const externalDbUrl = (Deno.env.get('EXTERNAL_DB_URL') ?? '').trim();
  const ssl = caCerts.length > 0 ? { caCerts, rejectUnauthorized: true } : "require" as const;
  extPool = externalDbUrl
    ? postgres(externalDbUrl, { ssl, connect_timeout: 15, idle_timeout: 20, max: 2, prepare: false })
    : postgres({
        host: Deno.env.get('EXTERNAL_DB_HOST'),
        port: parseInt(Deno.env.get('EXTERNAL_DB_PORT') || '25061'),
        database: Deno.env.get('EXTERNAL_DB_DATABASE'),
        username: Deno.env.get('EXTERNAL_DB_USERNAME'),
        password: Deno.env.get('EXTERNAL_DB_PASSWORD'),
        ssl, connect_timeout: 15, idle_timeout: 20, max: 2, prepare: false,
      });
  return extPool;
}

// ---------- Helpers ----------
function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlText(s: string): string {
  return base64url(new TextEncoder().encode(s));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

// ---------- Auth: extrair user do JWT do Supabase ----------
async function getCallerUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

// ---------- Resolve dados autoritativos do usuário no DB externo ----------
// Aceita: external user_id (numérico) OU email do supabase user.
async function loadExternalUser(opts: { externalUserId?: number; email?: string }) {
  const sql = getExternalPool();
  let rows;
  if (opts.externalUserId) {
    rows = await sql.unsafe(
      `SELECT id, name, email, role, client_id, cod_agent, user_id, is_active
       FROM users WHERE id = $1 LIMIT 1`,
      [opts.externalUserId]
    );
  } else if (opts.email) {
    rows = await sql.unsafe(
      `SELECT id, name, email, role, client_id, cod_agent, user_id, is_active
       FROM users WHERE email = $1 LIMIT 1`,
      [opts.email]
    );
  } else {
    return null;
  }
  return rows && rows.length > 0 ? rows[0] : null;
}

async function checkPermission(userExt: any, moduleCode: string): Promise<boolean> {
  if (userExt.role === 'admin') return true;
  const sql = getExternalPool();
  const modRows = await sql.unsafe(
    `SELECT id FROM modules WHERE code = $1 LIMIT 1`, [moduleCode]
  );
  if (modRows.length === 0) return false;
  const moduleId = modRows[0].id;
  const effectiveUserId = (userExt.role === 'time' && userExt.user_id) ? userExt.user_id : userExt.id;

  const metaRows = await sql.unsafe(
    `SELECT role, COALESCE(use_custom_permissions, FALSE) as use_custom FROM users WHERE id = $1`,
    [effectiveUserId]
  );
  const meta = metaRows[0] || {};
  if (meta.use_custom) {
    const r = await sql.unsafe(
      `SELECT can_view FROM user_permissions WHERE user_id = $1 AND module_id = $2`,
      [effectiveUserId, moduleId]
    );
    return r.length > 0 && r[0].can_view === true;
  } else {
    const r = await sql.unsafe(
      `SELECT can_view FROM role_default_permissions WHERE role = $1 AND module_id = $2`,
      [meta.role || userExt.role, moduleId]
    );
    return r.length > 0 && r[0].can_view === true;
  }
}

// ---------- Serve ----------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supaUser = await getCallerUser(req);
    if (!supaUser) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // -------- LIST --------
    if (action === 'list') {
      const { data, error } = await admin
        .from('module_embeds')
        .select('id, code, url_template, auth_mode, hmac_ttl_seconds, iframe_sandbox, iframe_referrer_policy, open_in_new_tab, allowed_origins, variables, is_active, hmac_secret')
        .order('code');
      if (error) return json({ error: error.message }, 500);
      const rows = (data || []).map((r: any) => {
        const has_secret = !!(r.hmac_secret && String(r.hmac_secret).length > 0);
        const { hmac_secret: _omit, ...rest } = r;
        return { ...rest, has_secret };
      });
      return json({ data: rows });
    }

    // -------- UPSERT --------
    if (action === 'upsert') {
      const e = body.embed || {};
      if (!e.code) return json({ error: 'code obrigatório' }, 400);
      if (!e.url_template) return json({ error: 'url_template obrigatório' }, 400);

      const payload: any = {
        code: String(e.code).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
        url_template: String(e.url_template),
        auth_mode: e.auth_mode === 'signed' ? 'signed' : 'simple',
        hmac_ttl_seconds: Number(e.hmac_ttl_seconds) || 300,
        iframe_sandbox: e.iframe_sandbox || 'allow-scripts allow-forms allow-same-origin',
        iframe_referrer_policy: e.iframe_referrer_policy || 'strict-origin',
        open_in_new_tab: !!e.open_in_new_tab,
        allowed_origins: Array.isArray(e.allowed_origins) ? e.allowed_origins : null,
        variables: e.variables || {},
        is_active: e.is_active ?? true,
      };

      // Só grava hmac_secret se foi explicitamente enviado (string não vazia)
      if (typeof e.hmac_secret === 'string' && e.hmac_secret.length > 0) {
        payload.hmac_secret = e.hmac_secret;
      }

      // Upsert por code (PK alternativa única)
      const { data: existing } = await admin
        .from('module_embeds').select('id').eq('code', payload.code).maybeSingle();

      let result;
      if (existing?.id) {
        const { data, error } = await admin
          .from('module_embeds').update(payload).eq('id', existing.id).select().single();
        if (error) return json({ error: error.message }, 500);
        result = data;
      } else {
        const { data, error } = await admin
          .from('module_embeds').insert(payload).select().single();
        if (error) return json({ error: error.message }, 500);
        result = data;
      }
      return json({ data: { id: result.id, ok: true } });
    }

    // -------- DELETE --------
    if (action === 'delete') {
      const id = body.id;
      if (!id) return json({ error: 'id obrigatório' }, 400);
      const { error } = await admin.from('module_embeds').delete().eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ data: { ok: true } });
    }

    // -------- RESOLVE --------
    if (action === 'resolve') {
      const code = String(body.code || '');
      if (!code) return json({ error: 'code obrigatório' }, 400);

      // Busca embed
      const { data: emb, error: embErr } = await admin
        .from('module_embeds')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (embErr) return json({ error: embErr.message }, 500);
      if (!emb) return json({ error: 'Embed não encontrado' }, 404);

      // Resolve user no DB externo (frontend pode enviar external_user_id)
      const externalUserId = body.external_user_id ? Number(body.external_user_id) : undefined;
      const userExt = await loadExternalUser({
        externalUserId,
        email: supaUser.email || undefined,
      });
      if (!userExt) return json({ error: 'Usuário externo não encontrado' }, 403);
      if (userExt.is_active === false) return json({ error: 'Usuário inativo' }, 403);

      // Permissão (módulo correspondente no banco externo, com mesmo code)
      const allowed = await checkPermission(userExt, code);
      if (!allowed) return json({ error: 'Sem permissão para este embed' }, 403);

      // Monta contexto de variáveis (server-trusted)
      const ctx: Record<string, string> = {
        userId: String(userExt.id ?? ''),
        clientId: String(userExt.client_id ?? ''),
        codAgent: String(userExt.cod_agent ?? ''),
        role: String(userExt.role ?? ''),
        email: String(userExt.email ?? ''),
        name: String(userExt.name ?? ''),
        timestamp: String(Math.floor(Date.now() / 1000)),
        ticket: '',
        signature: '',
      };
      const customVars = (emb.variables || {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(customVars)) {
        if (!(k in ctx)) ctx[k] = String(v ?? '');
      }

      // Modo signed: gera ticket+signature
      if (emb.auth_mode === 'signed' && emb.hmac_secret) {
        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + (Number(emb.hmac_ttl_seconds) || 300);
        const payloadObj = {
          userId: ctx.userId,
          clientId: ctx.clientId,
          codAgent: ctx.codAgent,
          role: ctx.role,
          email: ctx.email,
          iat, exp,
          nonce: generateNonce(),
        };
        const ticket = base64urlText(JSON.stringify(payloadObj));
        const sig = hex(await hmacSha256(emb.hmac_secret, ticket));
        ctx.ticket = ticket;
        ctx.signature = sig;
      }

      // Substituição
      let finalUrl = String(emb.url_template || '');
      for (const [k, v] of Object.entries(ctx)) {
        finalUrl = finalUrl.split(`{{${k}}}`).join(encodeURIComponent(v));
      }

      return json({
        data: {
          url: finalUrl,
          name: code,
          open_in_new_tab: !!emb.open_in_new_tab,
          iframe_sandbox: emb.iframe_sandbox,
          iframe_referrer_policy: emb.iframe_referrer_policy,
        },
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[embed-config] error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});