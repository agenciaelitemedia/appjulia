// ============================================
// UaZapi Instance Manager
// Server-side lifecycle management for UaZapi instances
// Uses UAZAPI_ADMIN_TOKEN and UAZAPI_BASE_URL from secrets
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getQueueCredentials(queueId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('queues')
    .select('evo_url, evo_apikey, evo_instance, name')
    .eq('id', queueId)
    .single();
  if (error || !data) throw new Error('Queue not found');
  return data;
}

async function uazapiRequest(method: string, endpoint: string, token: string, baseUrl: string, body?: Record<string, unknown>) {
  const url = `${baseUrl}${endpoint}`;
  console.log(`[uazapi-instance-manager] ${method} ${url}`);
  
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'token': token },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { response: text }; }
  
  console.log(`[uazapi-instance-manager] Response: ${res.status}`);
  return { status: res.status, ok: res.ok, data: parsed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, queue_id, instance_name } = await req.json();
    const baseUrl = Deno.env.get('UAZAPI_BASE_URL');
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!baseUrl || !adminToken) {
      return respond({ error: 'UAZAPI_BASE_URL or UAZAPI_ADMIN_TOKEN not configured' }, 500);
    }

    switch (action) {
      // ==========================================
      // CREATE instance on UaZapi server
      // ==========================================
      case 'create': {
        if (!instance_name) return respond({ error: 'instance_name required' }, 400);

        const result = await uazapiRequest('POST', '/instance/create', adminToken, baseUrl, {
          instanceName: instance_name,
        });

        if (!result.ok) {
          console.error('[uazapi-instance-manager] Create failed:', result.data);
          return respond({ error: 'Failed to create instance on UaZapi', details: result.data }, 500);
        }

        // Extract instance token from response
        const instanceData = result.data as Record<string, unknown>;
        const instanceToken = (instanceData as any)?.token || 
                             (instanceData as any)?.instance?.token ||
                             (instanceData as any)?.apikey ||
                             adminToken; // fallback to admin token

        return respond({ 
          success: true, 
          instance_token: instanceToken,
          instance_data: instanceData,
        });
      }

      // ==========================================
      // CONNECT - generate QR Code
      // ==========================================
      case 'connect': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;

        const result = await uazapiRequest('POST', '/instance/connect', token, queue.evo_url || baseUrl);
        return respond({ success: true, data: result.data });
      }

      // ==========================================
      // STATUS - check connection & get QR
      // ==========================================
      case 'status': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;

        const result = await uazapiRequest('GET', '/instance/status', token, queue.evo_url || baseUrl);

        // If 401 with instance token, retry with admin token
        if (result.status === 401 && token !== adminToken) {
          console.log('[uazapi-instance-manager] Retrying with admin token...');
          const retry = await uazapiRequest('GET', '/instance/status', adminToken, queue.evo_url || baseUrl);
          return respond({ success: retry.ok, data: retry.data });
        }

        return respond({ success: result.ok, data: result.data });
      }

      // ==========================================
      // DISCONNECT - logout instance
      // ==========================================
      case 'disconnect': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;
        const instanceName = queue.evo_instance;

        const result = await uazapiRequest('DELETE', `/instance/logout/${instanceName}`, token, queue.evo_url || baseUrl);

        // Retry with admin token if 401
        if (result.status === 401 && token !== adminToken) {
          const retry = await uazapiRequest('DELETE', `/instance/logout/${instanceName}`, adminToken, queue.evo_url || baseUrl);
          return respond({ success: retry.ok, data: retry.data });
        }

        return respond({ success: result.ok, data: result.data });
      }

      default:
        return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error('[uazapi-instance-manager] Error:', error);
    return respond({ error: (error as Error).message }, 500);
  }
});
