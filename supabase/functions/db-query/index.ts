import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { compare, hash } from "https://esm.sh/bcryptjs@3.0.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalizes a CA certificate string into STRICT PEM blocks that Deno can load.
 *
 * Problem we must handle:
 * - Many secret managers store PEM as a single line, e.g.
 *   "-----BEGIN CERTIFICATE----- MII... -----END CERTIFICATE-----"
 *   (spaces instead of newlines), which causes:
 *   "Unable to add pem file to certificate store".
 */
function normalizeCaCert(input: string): string[] {
  let text = input.trim();

  // Handle escaped newlines + Windows line endings
  text = text.replace(/\\n/g, "\n");
  text = text.replace(/\r\n/g, "\n");

  // If it looks like base64 (no BEGIN marker), try to decode
  if (!text.includes("BEGIN CERTIFICATE")) {
    try {
      const decoded = atob(text);
      if (decoded.includes("BEGIN CERTIFICATE")) text = decoded;
    } catch {
      // ignore
    }
  }

  // Fix the common "single-line PEM" case: ensure BEGIN/END markers are on their own lines.
  text = text
    .replace(/-----BEGIN CERTIFICATE-----\s+/g, "-----BEGIN CERTIFICATE-----\n")
    .replace(/\s+-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----")
    .replace(/-----END CERTIFICATE-----\s+/g, "-----END CERTIFICATE-----\n");

  const blocks = text.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
  );

  if (!blocks || blocks.length === 0) {
    console.warn("No valid certificate blocks found in CA cert");
    return [];
  }

  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;

  return blocks.map((block) => {
    // Strip headers/footers and ALL whitespace, then re-wrap to strict PEM.
    const b64 = block
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "")
      .trim();

    return `-----BEGIN CERTIFICATE-----\n${wrap64(b64)}\n-----END CERTIFICATE-----\n`;
  });
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
    
    console.log("CA certificates found:", caCerts.length);
    if (caCerts.length > 0) {
      console.log("First cert preview:", caCerts[0].substring(0, 60) + "...");
    }

    // Get connection string
    const externalDbUrl = (Deno.env.get('EXTERNAL_DB_URL') ?? '').trim();
    console.log('External DB URL provided:', Boolean(externalDbUrl));

    // Build SSL config for Deno runtime
    // In Deno, we use 'caCerts' (array of PEM strings) instead of 'ca'
    // If no custom CA, use 'require' to let Deno use its trust store
    const ssl = caCerts.length > 0
      ? { caCerts, rejectUnauthorized: true }
      : "require" as const; // Uses Deno's default CA store (mozilla + system when DENO_TLS_CA_STORE is set)

    const sql = externalDbUrl
      ? postgres(externalDbUrl, { 
          ssl,
          connect_timeout: 10,
          idle_timeout: 20,
          max_lifetime: 60 * 30,
        })
      : postgres({
          host: Deno.env.get('EXTERNAL_DB_HOST'),
          port: parseInt(Deno.env.get('EXTERNAL_DB_PORT') || '25061'),
          database: Deno.env.get('EXTERNAL_DB_DATABASE'),
          username: Deno.env.get('EXTERNAL_DB_USERNAME'),
          password: Deno.env.get('EXTERNAL_DB_PASSWORD'),
          ssl,
          connect_timeout: 10,
          idle_timeout: 20,
          max_lifetime: 60 * 30,
        });

    // Set timezone for this session to America/Sao_Paulo (UTC-3)
    // This ensures consistent date/time handling across all queries
    await sql`SET timezone = 'America/Sao_Paulo'`;

    let result: Record<string, unknown>[] = [];

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
        // For complex queries (NOT for authentication - use 'login' action instead)
        const { query, params } = data;
        result = await sql.unsafe(query, params || []);
        break;
      }

      case 'login': {
        // Secure authentication with bcrypt verification
        const { email, password } = data;
        
        // Fetch user by email only (including client_id)
        const users = await sql.unsafe(
          `SELECT id, name, email, role, cod_agent, client_id, evo_url, evo_instance, evo_apikey, data_mask, hub, created_at, password 
           FROM users 
           WHERE email = $1 
           LIMIT 1`,
          [email]
        );
        
        if (users.length === 0) {
          result = [];
          break;
        }
        
        const user = users[0];
        const storedHash = user.password;
        
        // Handle PHP-style $2y$ prefix (convert to $2a$ for bcrypt compatibility)
        const normalizedHash = storedHash.replace(/^\$2y\$/, '$2a$');
        
        // Verify password using bcrypt
        const isValid = await compare(password, normalizedHash);
        
        if (!isValid) {
          result = [];
          break;
        }
        
        // Remove password from result before returning
        delete user.password;
        result = [user];
        break;
      }

      case 'change_password': {
        // Secure password change with bcrypt verification
        const { userId, currentPassword, newPassword } = data;
        
        // Fetch user by ID to verify current password
        const users = await sql.unsafe(
          `SELECT id, password FROM users WHERE id = $1 LIMIT 1`,
          [userId]
        );
        
        if (users.length === 0) {
          throw new Error('Usuário não encontrado');
        }
        
        const user = users[0];
        const storedHash = user.password;
        
        // Handle PHP-style $2y$ prefix (convert to $2a$ for bcrypt compatibility)
        const normalizedHash = storedHash.replace(/^\$2y\$/, '$2a$');
        
        // Verify current password
        const isValid = await compare(currentPassword, normalizedHash);
        
        if (!isValid) {
          throw new Error('Senha atual incorreta');
        }
        
        // Hash new password
        const newHash = await hash(newPassword, 10);
        
        // Update password in database
        await sql.unsafe(
          `UPDATE users SET password = $1 WHERE id = $2`,
          [newHash, userId]
        );
        
        result = [{ success: true }];
        break;
      }

      case 'get_client': {
        // Fetch client data by ID
        const { clientId } = data;
        const clients = await sql.unsafe(
          `SELECT id, name, business_name, federal_id, email, phone, 
                  country, state, city, zip_code, photo, created_at, updated_at
           FROM clients 
           WHERE id = $1 
           LIMIT 1`,
          [clientId]
        );
        result = clients;
        break;
      }

      case 'update_client': {
        // Update client data
        const { clientId, clientData } = data;
        
        // Build dynamic update query
        const allowedFields = ['name', 'business_name', 'federal_id', 'email', 'phone', 'state', 'city', 'zip_code', 'street', 'neighborhood', 'photo'];
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;
        
        for (const [key, value] of Object.entries(clientData)) {
          if (allowedFields.includes(key)) {
            updates.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        }
        
        if (updates.length === 0) {
          throw new Error('No valid fields to update');
        }
        
        // Add updated_at
        updates.push(`updated_at = now()`);
        
        // Add clientId as last parameter
        values.push(clientId);
        
        const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        result = await sql.unsafe(query, values);
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
