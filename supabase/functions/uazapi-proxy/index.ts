// ============================================
// UaZapi Proxy Edge Function
// Server-side proxy to bypass CORS restrictions
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Allowed endpoint prefixes for security
const ALLOWED_PREFIXES = [
  '/chat/',
  '/message/',
  '/send/',
  '/instance/',
  '/labels/',
  '/group/',
  '/call/',
  '/business/',
  '/chatwoot/',
];

function isEndpointAllowed(endpoint: string): boolean {
  return ALLOWED_PREFIXES.some(prefix => endpoint.startsWith(prefix));
}

interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  body?: Record<string, unknown>;
  token: string;
  baseUrl: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: ProxyRequest = await req.json();
    const { method, endpoint, body, token, baseUrl } = payload;

    // Validate required fields
    if (!method || !endpoint || !token || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: method, endpoint, token, baseUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate endpoint against whitelist
    if (!isEndpointAllowed(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the full URL
    const url = `${baseUrl}${endpoint}`;
    console.log(`[uazapi-proxy] ${method} ${url}`);

    // Make the actual request to UaZapi
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    // Get response text
    const responseText = await response.text();
    
    // Try to parse as JSON
    let responseData: unknown;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { response: responseText };
    }

    console.log(`[uazapi-proxy] Response status: ${response.status}`);

    // Return the response with status
    return new Response(
      JSON.stringify({
        status: response.status,
        ok: response.ok,
        data: responseData,
      }),
      { 
        status: 200, // Always return 200 from proxy, include actual status in body
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[uazapi-proxy] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        status: 500,
        ok: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
