import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalize CA certificate for Deno SSL
 */
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

/**
 * Create database connection
 */
function createConnection(caCerts: string[]) {
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
        ssl,
        connect_timeout: 15,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      });
}

/**
 * Test connection to Advbox API
 */
async function testAdvboxConnection(apiEndpoint: string, apiToken: string): Promise<{
  success: boolean;
  message: string;
  client_count?: number;
}> {
  try {
    // Clean endpoint URL
    const baseUrl = apiEndpoint.replace(/\/+$/, '');
    
    // Try to fetch clients list (minimal request to test auth)
    const response = await fetch(`${baseUrl}/clientes?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Advbox API error:', response.status, errorText);
      
      if (response.status === 401) {
        return {
          success: false,
          message: 'Token inválido ou expirado. Verifique suas credenciais.',
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          message: 'Acesso negado. Verifique as permissões do token.',
        };
      }
      return {
        success: false,
        message: `Erro da API Advbox: ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Try to get total count if available
    let clientCount: number | undefined;
    if (data.total !== undefined) {
      clientCount = data.total;
    } else if (Array.isArray(data.data)) {
      // Make another request to get count
      const countResponse = await fetch(`${baseUrl}/clientes?count=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (countResponse.ok) {
        const countData = await countResponse.json();
        clientCount = countData.total || countData.count;
      }
    }

    return {
      success: true,
      message: 'Conexão estabelecida com sucesso!',
      client_count: clientCount,
    };
  } catch (error) {
    console.error('Error testing Advbox connection:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro de conexão',
    };
  }
}

/**
 * Simple encryption for storing API token
 * In production, use a proper encryption library
 */
function encryptToken(token: string): string {
  const key = Deno.env.get('ADVBOX_ENCRYPTION_KEY');
  if (!key) {
    console.warn('ADVBOX_ENCRYPTION_KEY not set, storing token as-is');
    return token;
  }
  
  // Simple XOR encryption (for demonstration - use AES in production)
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token);
  const keyBytes = encoder.encode(key);
  
  const encrypted = new Uint8Array(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * Decrypt API token
 */
function decryptToken(encryptedToken: string): string {
  const key = Deno.env.get('ADVBOX_ENCRYPTION_KEY');
  if (!key) {
    return encryptedToken;
  }
  
  try {
    const encrypted = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
    const keyBytes = new TextEncoder().encode(key);
    
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedToken;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
  const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'test': {
        // Test connection without saving
        const { apiEndpoint, apiToken } = body;
        
        if (!apiEndpoint || !apiToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Endpoint e token são obrigatórios' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const result = await testAdvboxConnection(apiEndpoint, apiToken);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save': {
        // Save integration with encrypted token
        const { codAgent, apiEndpoint, apiToken, isActive, settings, connectionStatus, lastError } = body;
        
        if (!codAgent || !apiEndpoint || !apiToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Dados incompletos' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        sql = createConnection(caCerts);
        await sql`SET timezone = 'America/Sao_Paulo'`;

        // Encrypt token before saving
        const encryptedToken = encryptToken(apiToken);

        // Upsert integration
        const result = await sql.unsafe(
          `INSERT INTO advbox_integrations (cod_agent, api_endpoint, api_token, is_active, settings, connection_status, last_error, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
           ON CONFLICT (cod_agent) DO UPDATE SET
             api_endpoint = EXCLUDED.api_endpoint,
             api_token = EXCLUDED.api_token,
             is_active = EXCLUDED.is_active,
             settings = EXCLUDED.settings,
             connection_status = EXCLUDED.connection_status,
             last_error = EXCLUDED.last_error,
             updated_at = NOW()
           RETURNING id, cod_agent, is_active, connection_status`,
          [codAgent, apiEndpoint, encryptedToken, isActive ?? false, JSON.stringify(settings || {}), connectionStatus || 'pending', lastError]
        );

        await sql.end();

        return new Response(
          JSON.stringify({ success: true, data: result[0] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get': {
        // Get integration with decrypted token (for internal use)
        const { agentId } = body;
        
        sql = createConnection(caCerts);
        await sql`SET timezone = 'America/Sao_Paulo'`;

        const result = await sql.unsafe(
          `SELECT * FROM advbox_integrations WHERE agent_id = $1 LIMIT 1`,
          [agentId]
        );

        await sql.end();

        if (result.length === 0) {
          return new Response(
            JSON.stringify({ success: true, data: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decrypt token for use
        const integration = result[0];
        integration.api_token = decryptToken(integration.api_token);

        return new Response(
          JSON.stringify({ success: true, data: integration }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { integrationId } = body;
        
        if (!integrationId) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID da integração é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        sql = createConnection(caCerts);
        
        await sql.unsafe(
          `DELETE FROM advbox_integrations WHERE id = $1`,
          [integrationId]
        );

        await sql.end();

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error) {
    if (sql) {
      try { await sql.end(); } catch { /* ignore */ }
    }
    
    console.error('Advbox integration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
