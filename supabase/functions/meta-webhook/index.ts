import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Supabase client for webhook_logs table
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function addLog(entry: { from_number: string; message: string; cod_agent: string | null; forwarded: boolean; payload: unknown }) {
  try {
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'meta',
      from_number: entry.from_number,
      message: entry.message,
      cod_agent: entry.cod_agent,
      forwarded: entry.forwarded,
      payload: entry.payload,
    });
  } catch (err) {
    console.error('Failed to persist webhook log:', err);
  }
  console.log('Webhook log:', JSON.stringify(entry));
}

async function updateLastLogForwarded(fromNumber: string) {
  try {
    const { data } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('from_number', fromNumber)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      await supabaseAdmin.from('webhook_logs').update({ forwarded: true }).eq('id', data[0].id);
    }
  } catch (err) {
    console.error('Failed to update log forwarded status:', err);
  }
}

function normalizeCaCert(input: string): string[] {
  let text = input.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!text.includes("BEGIN CERTIFICATE")) {
    try { const decoded = atob(text); if (decoded.includes("BEGIN CERTIFICATE")) text = decoded; } catch { /* ignore */ }
  }
  text = text
    .replace(/-----BEGIN CERTIFICATE-----\s+/g, "-----BEGIN CERTIFICATE-----\n")
    .replace(/\s+-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----")
    .replace(/-----END CERTIFICATE-----\s+/g, "-----END CERTIFICATE-----\n");
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || blocks.length === 0) return [];
  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;
  return blocks.map((block) => {
    const b64 = block.replace(/-----BEGIN CERTIFICATE-----/g, "").replace(/-----END CERTIFICATE-----/g, "").replace(/\s+/g, "").trim();
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

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'julia_meta_verify_token_test_123';
const N8N_HUB_SEND_URL = Deno.env.get('N8N_HUB_SEND_URL') || '';

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET - Webhook verification (Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    console.log('Webhook verification:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Internal: get debug logs from DB
      if (body.action === 'get_logs') {
        const { data, error } = await supabaseAdmin
          .from('webhook_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(
          JSON.stringify({ logs: error ? [] : data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Webhook POST received:', JSON.stringify(body, null, 2));

      // Process Meta webhook entries
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;

          if (!phoneNumberId) {
            console.warn('No phone_number_id in payload metadata');
            continue;
          }

          // Lookup agent by waba_number_id
          let codAgent: string | null = null;
          let wabaToken: string | null = null;
          try {
            const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
            const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
            const sql = createDbConnection(caCerts);
            try {
              const rows = await sql.unsafe(
                `SELECT cod_agent, waba_token FROM agents WHERE waba_number_id = $1 LIMIT 1`,
                [phoneNumberId]
              );
              if (rows.length > 0) {
                codAgent = rows[0].cod_agent;
                wabaToken = rows[0].waba_token;
              }
            } finally {
              await sql.end();
            }
          } catch (dbErr) {
            console.error('DB lookup error:', dbErr);
          }

          if (!codAgent) {
            console.warn(`No agent found for phone_number_id: ${phoneNumberId}`);
          }

          // Process each message
          for (const message of value.messages || []) {
            const from = message.from || 'unknown';
            const msgText = message.text?.body || message.type || 'unknown';

            await addLog({
              from_number: from,
              message: msgText,
              cod_agent: codAgent,
              forwarded: false,
              payload: message,
            });

            // Forward to N8N
            if (codAgent && N8N_HUB_SEND_URL) {
              try {
                const n8nPayload = {
                  cod_agent: codAgent,
                  hub: 'waba',
                  from,
                  message: msgText,
                  message_type: message.type || 'text',
                  timestamp: message.timestamp,
                  phone_number_id: phoneNumberId,
                  waba_token: wabaToken,
                  raw_payload: message,
                  contacts: value.contacts || [],
                };

                const n8nResponse = await fetch(N8N_HUB_SEND_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(n8nPayload),
                });

                console.log(`N8N forward status: ${n8nResponse.status}`);
                await updateLastLogForwarded(from);
              } catch (fwdErr) {
                console.error('N8N forward error:', fwdErr);
              }
            }
          }

          // Process status updates
          for (const status of value.statuses || []) {
            await addLog({
              from_number: status.recipient_id || 'unknown',
              message: `status:${status.status}`,
              cod_agent: codAgent,
              forwarded: false,
              payload: status,
            });
          }
        }
      }

      // Always return 200 to Meta
      return new Response('OK', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('OK', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
