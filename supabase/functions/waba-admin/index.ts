import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

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

async function resolveWabaInfoFromToken(token: string): Promise<ResolvedWabaInfo> {
  const headers = { 'Authorization': `Bearer ${token}` };

  const bizRes = await fetch(
    'https://graph.facebook.com/v22.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}',
    { headers }
  );
  const bizData = await bizRes.json();

  if (bizData?.error) {
    throw new Error(bizData.error.message || 'Failed to fetch businesses from Graph API');
  }

  const wabaIds = new Set<string>();
  const businesses = Array.isArray(bizData?.data) ? bizData.data : [];

  for (const biz of businesses) {
    const owned = Array.isArray(biz?.owned_whatsapp_business_accounts?.data)
      ? biz.owned_whatsapp_business_accounts.data
      : [];
    const client = Array.isArray(biz?.client_whatsapp_business_accounts?.data)
      ? biz.client_whatsapp_business_accounts.data
      : [];

    for (const waba of [...owned, ...client]) {
      if (waba?.id) wabaIds.add(String(waba.id));
    }
  }

  for (const currentWabaId of wabaIds) {
    const phonesRes = await fetch(
      `https://graph.facebook.com/v22.0/${currentWabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      { headers }
    );
    const phonesData = await phonesRes.json();

    if (phonesData?.error) {
      console.warn(`Could not fetch phone numbers for WABA ${currentWabaId}:`, phonesData.error?.message);
      continue;
    }

    const phones = Array.isArray(phonesData?.data) ? phonesData.data : [];
    if (phones.length > 0 && phones[0]?.id) {
      return {
        wabaId: currentWabaId,
        phoneNumberId: String(phones[0].id),
      };
    }
  }

  return {
    wabaId: Array.from(wabaIds)[0] ?? '',
    phoneNumberId: '',
  };
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

        return new Response(
          JSON.stringify({ success: true }),
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
