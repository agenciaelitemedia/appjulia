import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeCaCert(input: string): string[] {
  let text = input.trim();
  text = text.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

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
  if (!blocks || blocks.length === 0) return [];

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

function createDbConnection(caCerts: string[]) {
  const externalDbUrl = (Deno.env.get('EXTERNAL_DB_URL') ?? '').trim();
  const ssl = caCerts.length > 0 ? { caCerts, rejectUnauthorized: true } : "require" as const;

  return externalDbUrl
    ? postgres(externalDbUrl, { ssl, connect_timeout: 15, idle_timeout: 20, max_lifetime: 60 * 30 })
    : postgres({
        host: Deno.env.get('EXTERNAL_DB_HOST'),
        port: parseInt(Deno.env.get('EXTERNAL_DB_PORT') || '25061'),
        database: Deno.env.get('EXTERNAL_DB_DATABASE'),
        username: Deno.env.get('EXTERNAL_DB_USERNAME'),
        password: Deno.env.get('EXTERNAL_DB_PASSWORD'),
        ssl, connect_timeout: 15, idle_timeout: 20, max_lifetime: 60 * 30,
      });
}

type ResolvedWabaInfo = {
  wabaId: string;
  phoneNumberId: string;
};

// ─── Shared helper: subscribe a queue's webhook to Meta ─────────────
// Persists status/error on the queue row, retries once on transient errors.
async function subscribeQueueWebhook(
  supabase: ReturnType<typeof createClient>,
  queueId: string,
): Promise<{
  success: boolean;
  error?: string;
  subscribed?: boolean;
  webhook_registered?: boolean;
  webhook_warning?: string | null;
  callback_url?: string;
  waba_id?: string;
  subscribed_apps?: unknown[];
}> {
  const META_APP_ID = Deno.env.get('META_APP_ID');
  const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const META_VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ?? '';

  const persistFail = async (msg: string) => {
    await supabase
      .from('queues')
      .update({ waba_webhook_status: 'failed', waba_webhook_last_error: msg })
      .eq('id', queueId);
  };

  if (!META_APP_ID || !META_APP_SECRET) {
    const msg = 'Meta credentials (META_APP_ID/META_APP_SECRET) not configured';
    await persistFail(msg);
    return { success: false, error: msg };
  }

  const { data: queue, error: qErr } = await supabase
    .from('queues')
    .select('id, channel_type, waba_id, waba_token, waba_number_id')
    .eq('id', queueId)
    .maybeSingle();

  if (qErr || !queue) return { success: false, error: 'Fila não encontrada' };
  if (queue.channel_type !== 'waba') return { success: false, error: 'Fila não é do tipo WABA' };
  if (!queue.waba_id || !queue.waba_token) {
    const msg = 'Credenciais WABA (waba_id/waba_token) ausentes na fila';
    await persistFail(msg);
    return { success: false, error: msg };
  }

  const callbackUrl = `${SUPABASE_URL}/functions/v1/meta-webhook`;
  console.log('[subscribe_queue] queue', queueId, 'waba', queue.waba_id);

  const runOnce = async () => {
    // 1) Subscribe app to WABA
    const subRes = await fetch(
      `https://graph.facebook.com/v25.0/${queue.waba_id}/subscribed_apps`,
      { method: 'POST', headers: { 'Authorization': `Bearer ${queue.waba_token}` } },
    );
    const subData = await subRes.json().catch(() => ({}));
    console.log('[subscribe_queue] subscribed_apps POST:', JSON.stringify(subData));
    if (subData?.error) throw new Error(`subscribed_apps: ${subData.error.message}`);

    // 2) Confirm subscription
    const listRes = await fetch(
      `https://graph.facebook.com/v25.0/${queue.waba_id}/subscribed_apps`,
      { headers: { 'Authorization': `Bearer ${queue.waba_token}` } },
    );
    const listData = await listRes.json().catch(() => ({}));
    console.log('[subscribe_queue] subscribed_apps GET:', JSON.stringify(listData));

    // 3) Register callback on the Meta App (idempotent)
    const appToken = `${META_APP_ID}|${META_APP_SECRET}`;
    const webhookRes = await fetch(
      `https://graph.facebook.com/v25.0/${META_APP_ID}/subscriptions`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${appToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object: 'whatsapp_business_account',
          callback_url: callbackUrl,
          verify_token: META_VERIFY_TOKEN,
          fields: ['messages'],
        }),
      },
    );
    const webhookData = await webhookRes.json().catch(() => ({}));
    console.log('[subscribe_queue] app subscriptions:', JSON.stringify(webhookData));

    return { subData, listData, webhookData };
  };

  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < 2) {
    attempt++;
    try {
      const { subData, listData, webhookData } = await runOnce();
      await supabase
        .from('queues')
        .update({
          waba_webhook_status: 'subscribed',
          waba_webhook_last_error: null,
          waba_webhook_subscribed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return {
        success: true,
        subscribed: subData?.success === true,
        subscribed_apps: Array.isArray(listData?.data) ? listData.data : [],
        webhook_registered: !webhookData?.error,
        webhook_warning: webhookData?.error?.message || null,
        callback_url: callbackUrl,
        waba_id: queue.waba_id,
      };
    } catch (e) {
      lastErr = e;
      console.warn(`[subscribe_queue] attempt ${attempt} failed:`, (e as Error).message);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const msg = (lastErr as Error)?.message || 'Erro desconhecido ao inscrever webhook';
  await persistFail(msg);
  return { success: false, error: msg };
}

function extractWabaIdFromScopes(granularScopes: Array<{ scope: string; target_ids?: string[] }>): string {
  const scopeNames = ['whatsapp_business_management', 'whatsapp_business_messaging'];
  for (const name of scopeNames) {
    for (const scope of granularScopes) {
      if (scope.scope === name && Array.isArray(scope.target_ids) && scope.target_ids.length > 0) {
        return String(scope.target_ids[0]);
      }
    }
  }
  return '';
}

async function resolveWabaInfoFromToken(token: string): Promise<ResolvedWabaInfo> {
  const META_APP_ID = Deno.env.get('META_APP_ID') ?? '';
  const META_APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';
  const appToken = `${META_APP_ID}|${META_APP_SECRET}`;

  let wabaId = '';
  let phoneNumberId = '';

  // Retry debug_token up to 3 times with increasing delay (token propagation can be slow)
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [0, 2000, 4000];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`debug_token retry ${attempt}/${MAX_RETRIES - 1}, waiting ${RETRY_DELAYS[attempt]}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }

    console.log(`resolveWabaInfoFromToken: debug_token attempt ${attempt + 1}`);
    const debugRes = await fetch(
      `https://graph.facebook.com/v22.0/debug_token?input_token=${encodeURIComponent(token)}`,
      { headers: { 'Authorization': `Bearer ${appToken}` } }
    );
    const debugData = await debugRes.json();
    console.log(`debug_token attempt ${attempt + 1} response:`, JSON.stringify(debugData?.data?.granular_scopes || debugData?.error || 'no data'));

    if (debugData?.data?.granular_scopes) {
      wabaId = extractWabaIdFromScopes(debugData.data.granular_scopes);
      if (wabaId) {
        console.log(`Found WABA ID on attempt ${attempt + 1}:`, wabaId);
        break;
      }
    }
  }

  // Fetch phone numbers if we have a WABA ID
  if (wabaId) {
    const phonesRes = await fetch(
      `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const phonesData = await phonesRes.json();
    console.log('phone_numbers response:', JSON.stringify(phonesData?.data?.length ?? phonesData?.error ?? 'no data'));

    if (!phonesData?.error && Array.isArray(phonesData?.data) && phonesData.data.length > 0) {
      phoneNumberId = String(phonesData.data[0].id);
      console.log('Found phone_number_id:', phoneNumberId);
    }
  } else {
    console.warn('Could not resolve WABA ID after all retries');
  }

  return { wabaId, phoneNumberId };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    console.log('WABA Admin action:', action);

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');

    switch (action) {
      case 'exchange_token': {
        const { code } = params;
        if (!code) throw new Error('Missing authorization code');
        if (!META_APP_ID || !META_APP_SECRET) throw new Error('Meta credentials not configured');

        // Exchange code for short-lived token
        const tokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
        tokenUrl.searchParams.set('client_id', META_APP_ID);
        tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
        tokenUrl.searchParams.set('code', code);

        const tokenResponse = await fetch(tokenUrl.toString());
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          throw new Error(tokenData.error.message || 'Token exchange failed');
        }

        const shortLivedToken = tokenData.access_token;

        // Exchange short-lived for long-lived token
        const longLivedUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
        longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
        longLivedUrl.searchParams.set('client_id', META_APP_ID);
        longLivedUrl.searchParams.set('client_secret', META_APP_SECRET);
        longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

        const longLivedResponse = await fetch(longLivedUrl.toString());
        const longLivedData = await longLivedResponse.json();

        if (longLivedData.error) {
          // If long-lived exchange fails, return short-lived token
          console.warn('Long-lived token exchange failed, using short-lived:', longLivedData.error);
          return new Response(
            JSON.stringify({ success: true, access_token: shortLivedToken, token_type: 'short_lived' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, access_token: longLivedData.access_token, token_type: 'long_lived' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch_waba_info': {
        const token = typeof params.accessToken === 'string' ? params.accessToken.trim() : '';
        if (!token) throw new Error('Missing accessToken');

        const resolved = await resolveWabaInfoFromToken(token);

        return new Response(
          JSON.stringify({ success: true, waba_id: resolved.wabaId, phone_number_id: resolved.phoneNumberId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save_credentials': {
        const agentId = params.agentId;
        const accessToken = typeof params.accessToken === 'string' ? params.accessToken.trim() : '';
        let wabaId = typeof params.wabaId === 'string' ? params.wabaId.trim() : '';
        let phoneNumberId = typeof params.phoneNumberId === 'string' ? params.phoneNumberId.trim() : '';

        if (agentId === null || agentId === undefined || agentId === '') {
          throw new Error('Missing required parameter: agentId');
        }
        if (!accessToken) {
          throw new Error('Missing required parameter: accessToken');
        }

        if (!wabaId || !phoneNumberId) {
          const resolved = await resolveWabaInfoFromToken(accessToken);
          wabaId = wabaId || resolved.wabaId;
          phoneNumberId = phoneNumberId || resolved.phoneNumberId;
        }

        if (!wabaId || !phoneNumberId) {
          throw new Error('Unable to resolve WABA ID / Phone Number ID from token. Complete Embedded Signup and ensure the Meta app has WhatsApp permissions.');
        }

        const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
        const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
        const sql = createDbConnection(caCerts);

        try {
          await sql.unsafe(
            `UPDATE agents 
             SET hub = 'waba', 
                 waba_id = $1, 
                 waba_token = $2, 
                 waba_number_id = $3, 
                 updated_at = now()
             WHERE id = $4`,
            [wabaId, accessToken, phoneNumberId, agentId]
          );
        } finally {
          await sql.end();
        }

        // Auto-register webhook after saving credentials
        try {
          console.log('Auto-registering webhook for WABA:', wabaId);
          const subRes = await fetch(
            `https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}` },
            }
          );
          const subData = await subRes.json();
          console.log('Auto subscribed_apps result:', JSON.stringify(subData));
        } catch (e) {
          console.warn('Auto webhook registration failed (non-blocking):', e);
        }

        return new Response(
          JSON.stringify({ success: true, webhook_subscribed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify_connection': {
        const { agentId } = params;
        if (!agentId) throw new Error('Missing agentId');

        const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
        const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
        const sql = createDbConnection(caCerts);

        let agentData;
        try {
          const rows = await sql.unsafe(
            `SELECT waba_id, waba_token, waba_number_id FROM agents WHERE id = $1`,
            [agentId]
          );
          agentData = rows[0];
        } finally {
          await sql.end();
        }

        if (!agentData?.waba_token || !agentData?.waba_number_id) {
          return new Response(
            JSON.stringify({ success: true, connected: false, reason: 'no_credentials' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify token by calling Graph API
        const verifyResponse = await fetch(
          `https://graph.facebook.com/v22.0/${agentData.waba_number_id}`,
          { headers: { 'Authorization': `Bearer ${agentData.waba_token}` } }
        );

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({}));
          return new Response(
            JSON.stringify({ 
              success: true, 
              connected: false, 
              reason: 'token_invalid',
              error: errorData?.error?.message || `HTTP ${verifyResponse.status}` 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const phoneData = await verifyResponse.json();

        return new Response(
          JSON.stringify({ 
            success: true, 
            connected: true, 
            phone_number: phoneData.display_phone_number,
            quality_rating: phoneData.quality_rating,
            verified_name: phoneData.verified_name,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        const { agentId } = params;
        if (!agentId) throw new Error('Missing agentId');

        const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
        const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
        const sql = createDbConnection(caCerts);

        try {
          await sql.unsafe(
            `UPDATE agents 
             SET hub = NULL, 
                 waba_id = NULL, 
                 waba_token = NULL, 
                 waba_number_id = NULL, 
                 updated_at = now()
             WHERE id = $1`,
            [agentId]
          );
        } finally {
          await sql.end();
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'register_webhook': {
        let { wabaId, accessToken, agentId } = params;

        // If agentId provided, fetch credentials from DB
        if (agentId && (!wabaId || !accessToken)) {
          const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
          const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
          const sql = createDbConnection(caCerts);
          try {
            const rows = await sql.unsafe(
              `SELECT waba_id, waba_token FROM agents WHERE id = $1`,
              [agentId]
            );
            if (rows[0]) {
              wabaId = wabaId || rows[0].waba_id;
              accessToken = accessToken || rows[0].waba_token;
            }
          } finally {
            await sql.end();
          }
        }

        if (!wabaId) throw new Error('Missing wabaId');
        if (!accessToken) throw new Error('Missing accessToken');

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
        const META_VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ?? '';
        const callbackUrl = `${SUPABASE_URL}/functions/v1/meta-webhook`;

        console.log('Registering webhook for WABA:', wabaId, 'callback:', callbackUrl);

        // Subscribe the app to the WABA
        const subscribeRes = await fetch(
          `https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const subscribeData = await subscribeRes.json();
        console.log('subscribed_apps response:', JSON.stringify(subscribeData));

        if (subscribeData?.error) {
          throw new Error(`Failed to subscribe app: ${subscribeData.error.message}`);
        }

        // Register the webhook callback URL on the Meta App
        const appToken = `${META_APP_ID}|${META_APP_SECRET}`;
        const webhookRes = await fetch(
          `https://graph.facebook.com/v22.0/${META_APP_ID}/subscriptions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              object: 'whatsapp_business_account',
              callback_url: callbackUrl,
              verify_token: META_VERIFY_TOKEN,
              fields: ['messages'],
            }),
          }
        );
        const webhookData = await webhookRes.json();
        console.log('App subscriptions response:', JSON.stringify(webhookData));

        if (webhookData?.error) {
          // App subscription may already exist, still return success if subscribed_apps worked
          console.warn('App subscription warning:', webhookData.error.message);
        }

        return new Response(
          JSON.stringify({
            success: true,
            subscribed: subscribeData?.success === true,
            webhook_registered: !webhookData?.error,
            callback_url: callbackUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_phone_numbers': {
        const wabaBusinessId = typeof params.wabaBusinessId === 'string' ? params.wabaBusinessId.trim() : '';
        const accessToken = typeof params.accessToken === 'string' ? params.accessToken.trim() : '';
        if (!wabaBusinessId) throw new Error('Missing wabaBusinessId');
        if (!accessToken) throw new Error('Missing accessToken');

        const res = await fetch(
          `https://graph.facebook.com/v22.0/${wabaBusinessId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        if (data?.error) {
          return new Response(
            JSON.stringify({ success: false, error: data.error.message || 'Failed to list phone numbers' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const numbers = (Array.isArray(data?.data) ? data.data : []).map((n: Record<string, unknown>) => ({
          id: String(n.id ?? ''),
          display_phone_number: String(n.display_phone_number ?? ''),
          verified_name: String(n.verified_name ?? ''),
          quality_rating: String(n.quality_rating ?? 'UNKNOWN'),
          code_verification_status: String(n.code_verification_status ?? ''),
        }));

        return new Response(
          JSON.stringify({ success: true, numbers }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test_credentials': {
        const accessToken = typeof params.accessToken === 'string' ? params.accessToken.trim() : '';
        const phoneNumberId = typeof params.phoneNumberId === 'string' ? params.phoneNumberId.trim() : '';
        if (!accessToken) throw new Error('Missing accessToken');
        if (!phoneNumberId) throw new Error('Missing phoneNumberId');

        const res = await fetch(
          `https://graph.facebook.com/v22.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        if (!res.ok || data?.error) {
          return new Response(
            JSON.stringify({ success: false, error: data?.error?.message || `HTTP ${res.status}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            phone: data.display_phone_number,
            verified_name: data.verified_name,
            quality_rating: data.quality_rating,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_waba_agents': {
        const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
        const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
        const sql = createDbConnection(caCerts);

        let agents;
        try {
          agents = await sql.unsafe(
            `SELECT id, cod_agent, hub, waba_id, waba_number_id FROM agents WHERE hub = 'waba' AND waba_id IS NOT NULL LIMIT 10`
          );
        } finally {
          await sql.end();
        }

        return new Response(
          JSON.stringify({ success: true, agents }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'subscribe_queue': {
        const queueId = typeof params.queueId === 'string' ? params.queueId.trim() : '';
        if (!queueId) throw new Error('Missing queueId');
        if (!META_APP_ID || !META_APP_SECRET) throw new Error('Meta credentials not configured');

        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        const result = await subscribeQueueWebhook(supabase, queueId);
        return new Response(
          JSON.stringify(result),
          { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      case 'subscribe_all_pending': {
        if (!META_APP_ID || !META_APP_SECRET) throw new Error('Meta credentials not configured');

        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        const { data: pending, error: pErr } = await supabase
          .from('queues')
          .select('id, name, waba_id, waba_webhook_status')
          .eq('channel_type', 'waba')
          .eq('is_deleted', false)
          .not('waba_id', 'is', null)
          .not('waba_token', 'is', null)
          .or('waba_webhook_status.is.null,waba_webhook_status.neq.subscribed');

        if (pErr) throw pErr;

        const results: Array<Record<string, unknown>> = [];
        for (const q of pending ?? []) {
          const r = await subscribeQueueWebhook(supabase, q.id);
          results.push({ queue_id: q.id, name: q.name, waba_id: q.waba_id, ...r });
        }

        return new Response(
          JSON.stringify({ success: true, processed: results.length, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    console.error('WABA Admin error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
