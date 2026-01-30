import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory storage for webhook logs (for testing purposes)
const webhookLogs: Array<{
  id: string;
  from: string;
  message: string;
  timestamp: string;
  payload: unknown;
}> = [];

const VERIFY_TOKEN = 'julia_meta_verify_token_test_123';

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET - Webhook verification (required by Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Forbidden', { status: 403 });
  }

  // POST - Receive messages or get logs
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Internal action to get logs
      if (body.action === 'get_logs') {
        return new Response(
          JSON.stringify({ logs: webhookLogs.slice(-20) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // Process Meta webhook payload
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;

            for (const message of value.messages || []) {
              const logEntry = {
                id: crypto.randomUUID(),
                from: message.from || 'unknown',
                message: message.text?.body || message.type || 'unknown',
                timestamp: new Date().toISOString(),
                payload: message,
              };

              webhookLogs.push(logEntry);
              console.log('Message logged:', logEntry);

              // Keep only last 100 logs
              if (webhookLogs.length > 100) {
                webhookLogs.shift();
              }
            }
          }
        }
      }

      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
