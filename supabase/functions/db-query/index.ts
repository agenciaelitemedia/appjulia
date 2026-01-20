import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalizes a CA certificate string:
 * - Handles escaped newlines (\\n -> \n)
 * - Handles Windows line endings (\r\n -> \n)
 * - Decodes base64 if needed
 * - Returns array of individual certificates for Deno TLS
 */
function normalizeCaCert(input: string): string[] {
  let cert = input.trim();
  
  // Handle escaped newlines
  cert = cert.replace(/\\n/g, '\n');
  cert = cert.replace(/\r\n/g, '\n');
  
  // If it looks like base64 (no BEGIN marker), try to decode
  if (!cert.includes('BEGIN CERTIFICATE')) {
    try {
      const decoded = atob(cert);
      if (decoded.includes('BEGIN CERTIFICATE')) {
        cert = decoded;
      }
    } catch {
      // Not base64, continue with original
    }
  }
  
  // Extract all certificate blocks (handles certificate bundles)
  const certMatches = cert.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  
  if (!certMatches || certMatches.length === 0) {
    console.warn('No valid certificate blocks found in CA cert');
    return [];
  }
  
  // Ensure each cert ends with a newline (required by some TLS implementations)
  return certMatches.map(c => c.trim() + '\n');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, table, data, where, select, limit, offset, orderBy } = await req.json();

    // Get and normalize CA certificate
    const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
    const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
    
    console.log('CA certificates found:', caCerts.length);
    if (caCerts.length > 0) {
      console.log('First cert preview:', caCerts[0].substring(0, 60) + '...');
    }

    // Get connection string
    const externalDbUrl = (Deno.env.get('EXTERNAL_DB_URL') ?? '').trim();
    console.log('External DB URL provided:', Boolean(externalDbUrl));

    // Build SSL config for Deno runtime
    // In Deno, we use 'caCerts' (array of PEM strings) instead of 'ca'
    // If no custom CA, use 'require' to let Deno use its trust store
    const ssl = caCerts.length > 0 
      ? { caCerts, rejectUnauthorized: true }
      : 'require'; // Uses Deno's default CA store (mozilla + system when DENO_TLS_CA_STORE is set)

    const sql = externalDbUrl
      ? postgres(externalDbUrl, { ssl })
      : postgres({
          host: Deno.env.get('EXTERNAL_DB_HOST'),
          port: parseInt(Deno.env.get('EXTERNAL_DB_PORT') || '25061'),
          database: Deno.env.get('EXTERNAL_DB_DATABASE'),
          username: Deno.env.get('EXTERNAL_DB_USERNAME'),
          password: Deno.env.get('EXTERNAL_DB_PASSWORD'),
          ssl,
        });

    let result;

    switch (action) {
      case 'select': {
        const columns = select || '*';
        let query = `SELECT ${columns} FROM ${table}`;
        const params: any[] = [];
        
        if (where) {
          const conditions = Object.entries(where)
            .map(([key, value], index) => {
              params.push(value);
              return `${key} = $${index + 1}`;
            })
            .join(' AND ');
          query += ` WHERE ${conditions}`;
        }
        
        if (orderBy) {
          query += ` ORDER BY ${orderBy}`;
        }
        
        if (limit) {
          query += ` LIMIT ${limit}`;
        }
        
        if (offset) {
          query += ` OFFSET ${offset}`;
        }

        result = await sql.unsafe(query, params);
        break;
      }

      case 'insert': {
        const columns = Object.keys(data).join(', ');
        const values = Object.values(data) as (string | number | boolean | null)[];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
        result = await sql.unsafe(query, values);
        break;
      }

      case 'update': {
        const updates = Object.entries(data)
          .map(([key, _], index) => `${key} = $${index + 1}`)
          .join(', ');
        const dataValues = Object.values(data) as (string | number | boolean | null)[];
        
        const whereConditions = Object.entries(where)
          .map(([key, _], index) => `${key} = $${dataValues.length + index + 1}`)
          .join(' AND ');
        const whereValues = Object.values(where) as (string | number | boolean | null)[];
        
        const query = `UPDATE ${table} SET ${updates} WHERE ${whereConditions} RETURNING *`;
        result = await sql.unsafe(query, [...dataValues, ...whereValues]);
        break;
      }

      case 'delete': {
        const conditions = Object.entries(where)
          .map(([key, _], index) => `${key} = $${index + 1}`)
          .join(' AND ');
        const values = Object.values(where) as (string | number | boolean | null)[];
        const query = `DELETE FROM ${table} WHERE ${conditions} RETURNING *`;
        result = await sql.unsafe(query, values);
        break;
      }

      case 'raw': {
        // For complex queries like authentication
        const { query, params } = data;
        result = await sql.unsafe(query, params || []);
        break;
      }

      case 'ping': {
        // Simple connectivity test
        result = await sql`SELECT 1 as ok, now() as server_time`;
        console.log('Ping successful:', result);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await sql.end();

    return new Response(JSON.stringify({ data: result, error: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Database error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ data: null, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
