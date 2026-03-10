import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { compare, hash } from "https://esm.sh/bcryptjs@3.0.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Checks if an error is retryable (connection timeouts, network issues)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'connect_timeout',
    'connection refused',
    'connection reset',
    'econnrefused',
    'econnreset',
    'etimedout',
    'socket hang up',
    'network error',
    'write connect_timeout',
  ];
  return retryablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Normalizes settings to ensure it's stored as a JSONB object, not a string.
 * Handles double-stringified JSON like: "\"{...}\"" → {...}
 */
function normalizeSettings(input: unknown): string {
  let value = input;
  
  // If it's a string, try to parse it (possibly multiple times for double-stringified)
  let attempts = 0;
  const maxAttempts = 3; // Prevent infinite loops
  
  while (typeof value === 'string' && attempts < maxAttempts) {
    try {
      value = JSON.parse(value);
      attempts++;
    } catch {
      // Not valid JSON string, break
      break;
    }
  }
  
  // Validate that the result is a plain object (not null, not array, not primitive)
  if (value === null || value === undefined) {
    throw new Error('Settings não pode ser null ou undefined');
  }
  
  if (typeof value !== 'object') {
    throw new Error('Settings deve ser um objeto JSON, não ' + typeof value);
  }
  
  if (Array.isArray(value)) {
    throw new Error('Settings deve ser um objeto JSON, não um array');
  }
  
  // Return as JSON string for PostgreSQL ::jsonb cast
  return JSON.stringify(value);
}

/**
 * Ensures a settings value is returned to callers as an object (not a JSON string).
 */
function coerceSettingsObject(input: unknown): Record<string, unknown> {
  const normalized = normalizeSettings(input);
  return JSON.parse(normalized) as Record<string, unknown>;
}

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

/**
 * Creates a new database connection with SSL config
 */
function createConnection(caCerts: string[]) {
  const externalDbUrl = (Deno.env.get('EXTERNAL_DB_URL') ?? '').trim();
  
  const ssl = caCerts.length > 0
    ? { caCerts, rejectUnauthorized: true }
    : "require" as const;

  return externalDbUrl
    ? postgres(externalDbUrl, { 
        ssl,
        connect_timeout: 15,
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
        connect_timeout: 15,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get and normalize CA certificate once
  const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
  const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
  
  console.log("CA certificates found:", caCerts.length);
  if (caCerts.length > 0) {
    console.log("First cert preview:", caCerts[0].substring(0, 60) + "...");
  }
  console.log('External DB URL provided:', Boolean(Deno.env.get('EXTERNAL_DB_URL')));

  let lastError: unknown = null;
  
  // Parse JSON body ONCE before retry loop (body can only be consumed once)
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch (parseError) {
    console.error('Failed to parse request body:', parseError);
    return new Response(
      JSON.stringify({ data: null, error: 'Invalid JSON body' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
  
  const { action, table, data, where, select, limit, offset, orderBy } = body;
  
  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let sql: ReturnType<typeof postgres> | null = null;
    
    try {

      sql = createConnection(caCerts);

      // Set timezone for this session to America/Sao_Paulo (UTC-3)
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
        // Special handling for agents table with settings field
        if (table === 'agents' && data && 'settings' in data) {
          const normalizedSettings = normalizeSettings(data.settings);
          const columnsArr = Object.keys(data);
          const valuesArr: any[] = [];
          const placeholdersArr: string[] = [];
          
          columnsArr.forEach((col, i) => {
            if (col === 'settings') {
              // Use CTE + CASE to ensure JSONB object
              placeholdersArr.push(`(SELECT CASE WHEN jsonb_typeof($${i + 1}::jsonb) = 'string' THEN ($${i + 1}::jsonb #>> '{}')::jsonb ELSE $${i + 1}::jsonb END)`);
              valuesArr.push(normalizedSettings);
            } else {
              placeholdersArr.push(`$${i + 1}`);
              valuesArr.push(data[col]);
            }
          });
          
          const query = `INSERT INTO ${table} (${columnsArr.join(', ')}) VALUES (${placeholdersArr.join(', ')}) RETURNING *`;
          result = await sql.unsafe(query, valuesArr);
        } else {
          // Standard insert for other tables
          const columns = Object.keys(data).join(', ');
          const values = Object.values(data) as (string | number | boolean | null)[];
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
          result = await sql.unsafe(query, values);
        }
        break;
      }

      case 'update': {
        // Special handling for agents table with settings field
        if (table === 'agents' && data && 'settings' in data) {
          const normalizedSettings = normalizeSettings(data.settings);
          const columnsArr = Object.keys(data);
          const dataValues: any[] = [];
          const updateParts: string[] = [];
          let paramIndex = 1;
          
          columnsArr.forEach((col) => {
            if (col === 'settings') {
              // Use CASE to ensure JSONB object even if string arrives
              updateParts.push(`settings = CASE WHEN jsonb_typeof($${paramIndex}::jsonb) = 'string' THEN ($${paramIndex}::jsonb #>> '{}')::jsonb ELSE $${paramIndex}::jsonb END`);
              dataValues.push(normalizedSettings);
            } else {
              updateParts.push(`${col} = $${paramIndex}`);
              dataValues.push(data[col]);
            }
            paramIndex++;
          });
          
          const whereConditions = Object.entries(where)
            .map(([key, _], index) => `${key} = $${paramIndex + index}`)
            .join(' AND ');
          const whereValues = Object.values(where) as (string | number | boolean | null)[];
          
          const query = `UPDATE ${table} SET ${updateParts.join(', ')} WHERE ${whereConditions} RETURNING *`;
          result = await sql.unsafe(query, [...dataValues, ...whereValues]);
        } else {
          // Standard update for other tables
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
        }
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
        
        // Fetch user by email only (including client_id and photo from clients table)
        const users = await sql.unsafe(
          `SELECT u.id, u.name, u.email, u.role, u.cod_agent, u.client_id, u.evo_url, u.evo_instance, u.evo_apikey, u.data_mask, u.hub, u.created_at, u.password, u.is_active, c.photo as avatar
           FROM users u
           LEFT JOIN clients c ON c.id = u.client_id
           WHERE u.email = $1 
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
                  country, state, city, zip_code, street, street_number, 
                  complement, neighborhood, photo, created_at, updated_at
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
        const allowedFields = ['name', 'business_name', 'federal_id', 'email', 'phone', 'state', 'city', 'zip_code', 'street', 'street_number', 'complement', 'neighborhood', 'photo'];
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

      case 'get_user_agents': {
        const { userId } = data;
        result = await sql.unsafe(
          `SELECT 
            ua.agent_id,
            ua.cod_agent::text as cod_agent,
            a.id as agent_id_from_agents,
            a.status,
            a.hub,
            a.evo_url,
            a.evo_apikey,
            a.evo_instance as evo_instancia,
            c.name as client_name,
            c.business_name,
            ap.name as plan_name,
            ap."limit" as plan_limit,
            (SELECT COUNT(DISTINCT s.id) FROM sessions s 
             WHERE s.agent_id = a.id 
             AND EXISTS (SELECT 1 FROM log_messages lm 
                         WHERE lm.session_id = s.id 
                         AND lm.created_at >= DATE_TRUNC('month', CURRENT_DATE))) as leads_received
          FROM user_agents ua
          LEFT JOIN agents a ON a.id = ua.agent_id OR a.cod_agent::text = ua.cod_agent::text
          LEFT JOIN clients c ON c.id = a.client_id
          LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
          WHERE ua.user_id = $1
          ORDER BY c.business_name`,
          [userId]
        );
        break;
      }

      case 'get_agents_list': {
        // Optimized query with pre-aggregated leads count and settings for business hours
        // Supports showLegacy parameter to filter legacy agents (without user_agents link)
        const { showLegacy, showAll } = data || {};
        const legacyFilter = showLegacy ? '' : 'AND ua.agent_id IS NOT NULL';
        const visibilityFilter = showAll ? '' : 'AND a.is_visibilided = true';
        
        result = await sql.unsafe(`
          SELECT 
            a.id,
            a.cod_agent,
            a.status,
            a.settings,
            c.name AS client_name,
            c.business_name,
            ap.name AS plan_name,
            COALESCE(ap."limit", 0) AS plan_limit,
            COALESCE(leads.count, 0) AS leads_received,
            a.last_used,
            a.due_date,
            ua.agent_id AS user_agent_id
          FROM agents a
          JOIN clients c ON c.id = a.client_id
          LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
          LEFT JOIN user_agents ua ON ua.agent_id = a.id AND ua.cod_agent = a.cod_agent
          LEFT JOIN (
            SELECT s.agent_id, COUNT(DISTINCT s.id) as count
            FROM sessions s
            INNER JOIN log_messages lm ON lm.session_id = s.id
            WHERE lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
              AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            GROUP BY s.agent_id
          ) leads ON leads.agent_id = a.id
          WHERE 1=1
            ${visibilityFilter}
            ${legacyFilter}
          ORDER BY c.business_name
        `);
        break;
      }

      case 'search_clients': {
        const { term } = data;
        const searchTerm = `%${term.toLowerCase()}%`;
        result = await sql.unsafe(
          `SELECT id, name, business_name, email, phone
           FROM clients
           WHERE LOWER(name) LIKE $1 
              OR LOWER(business_name) LIKE $1 
              OR LOWER(email) LIKE $1
           ORDER BY name ASC
           LIMIT 20`,
          [searchTerm]
        );
        break;
      }

      case 'search_users': {
        const { term } = data;
        const searchTerm = `%${term.toLowerCase()}%`;
        result = await sql.unsafe(
          `SELECT id, name, email, role
           FROM users
           WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1
           ORDER BY name ASC
           LIMIT 20`,
          [searchTerm]
        );
        break;
      }

      case 'search_agents': {
        const { term } = data;
        const searchTerm = `%${term.toLowerCase()}%`;
        result = await sql.unsafe(
          `SELECT 
             a.id,
             a.cod_agent::text as cod_agent,
             c.name AS client_name,
             c.business_name
           FROM agents a
           JOIN clients c ON c.id = a.client_id
           WHERE a.is_visibilided = true
             AND (
               LOWER(a.cod_agent::text) LIKE $1 
               OR LOWER(c.name) LIKE $1 
               OR LOWER(c.business_name) LIKE $1
             )
           ORDER BY c.business_name ASC
           LIMIT 20`,
          [searchTerm]
        );
        break;
      }

      case 'get_next_agent_code': {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${year}${month}`;
        
        const rows = await sql.unsafe(
          `SELECT COALESCE(
             MAX(CAST(SUBSTRING(cod_agent::text FROM 7) AS INTEGER)),
             0
           ) + 1 as next_seq
           FROM agents
           WHERE cod_agent::text LIKE $1`,
          [`${prefix}%`]
        );
        
        const nextSeq = String(rows[0].next_seq).padStart(3, '0');
        result = [{ cod_agent: `${prefix}${nextSeq}` }];
        break;
      }

      case 'get_plans': {
        result = await sql.unsafe(
          `SELECT id, name, "limit" as leads_limit, 0 as price
           FROM agents_plan
           WHERE satus = true
           ORDER BY "limit" ASC`
        );
        break;
      }

      case 'insert_client': {
        const { clientData } = data;
        const columns = Object.keys(clientData).join(', ');
        const values = Object.values(clientData) as (string | number | boolean | null)[];
        const placeholders = values.map((_, i: number) => `$${i + 1}`).join(', ');
        
        result = await sql.unsafe(
          `INSERT INTO clients (${columns}, created_at, updated_at) 
           VALUES (${placeholders}, now(), now()) 
           RETURNING *`,
          values
        );
        break;
      }

      case 'check_federal_id_exists': {
        const { federalId } = data;
        const rows = await sql.unsafe(
          `SELECT id FROM clients WHERE federal_id = $1 LIMIT 1`,
          [federalId]
        );
        result = [{ exists: rows.length > 0, clientId: rows.length > 0 ? rows[0].id : null }];
        break;
      }

      case 'check_user_email_exists': {
        const { email } = data;
        const rows = await sql.unsafe(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`,
          [email]
        );
        result = [{ exists: rows.length > 0, userId: rows.length > 0 ? rows[0].id : null }];
        break;
      }

      case 'check_agent_code_exists': {
        const { codAgent } = data;
        // Handle empty or null codAgent - return false without querying
        if (!codAgent || codAgent.trim() === '') {
          result = [{ exists: false }];
          break;
        }
        const rows = await sql.unsafe(
          `SELECT id FROM agents WHERE cod_agent = $1 LIMIT 1`,
          [codAgent]
        );
        result = [{ exists: rows.length > 0 }];
        break;
      }

      case 'insert_user': {
        const { name, email, hashedPassword, rawPassword, clientId } = data;
        const rows = await sql.unsafe(
          `INSERT INTO users (name, email, password, remember_token, role, client_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'user', $5, now(), now())
           RETURNING id, name, email`,
          [name, email, hashedPassword, rawPassword, clientId]
        );
        result = rows;
        break;
      }

      case 'insert_agent': {
        const { client_id, cod_agent, settings, prompt, is_closer, agent_plan_id, due_date } = data;
        
        // Normalize settings using robust function (handles double-stringified JSON)
        const normalizedSettings = normalizeSettings(settings);
        
        // Use CTE + CASE to ensure settings is ALWAYS stored as JSONB object (never string)
        const rows = await sql.unsafe(
          `WITH s AS (SELECT $3::jsonb AS v)
           INSERT INTO agents (client_id, cod_agent, settings, prompt, is_closer, agent_plan_id, due_date, status, is_visibilided, created_at, updated_at)
           SELECT $1, $2, 
             CASE WHEN jsonb_typeof(s.v) = 'string' THEN (s.v #>> '{}')::jsonb ELSE s.v END,
             $4, $5, $6, $7, true, true, now(), now()
           FROM s
           RETURNING id`,
          [client_id, cod_agent, normalizedSettings, prompt, is_closer, agent_plan_id, due_date]
        );
        result = rows;
        break;
      }

      case 'insert_user_agent': {
        const { userId, agentId, codAgent } = data;
        
        // Verificar duplicidade
        if (agentId === null || agentId === undefined) {
          const existing = await sql.unsafe(
            `SELECT id FROM user_agents WHERE user_id = $1 AND cod_agent = $2::bigint AND agent_id IS NULL LIMIT 1`,
            [userId, codAgent]
          );
          if (existing.length > 0) {
            throw new Error('duplicate: Este usuário já monitora este agente');
          }
        } else {
          const existing = await sql.unsafe(
            `SELECT id FROM user_agents WHERE user_id = $1 AND cod_agent = $2::bigint AND agent_id IS NOT NULL LIMIT 1`,
            [userId, codAgent]
          );
          if (existing.length > 0) {
            throw new Error('duplicate: Este usuário já é proprietário deste agente');
          }
        }
        
        const rows = await sql.unsafe(
          `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
           VALUES ($1, $2::int, $3::bigint, now())
           RETURNING id`,
          [userId, agentId ?? null, codAgent]
        );
        result = rows;
        break;
      }

      case 'delete_agent': {
        const { agentId } = data;
        await sql.unsafe(`DELETE FROM agents WHERE id = $1`, [agentId]);
        result = [{ success: true }];
        break;
      }

      case 'delete_user': {
        const { userId } = data;
        await sql.unsafe(`DELETE FROM users WHERE id = $1`, [userId]);
        result = [{ success: true }];
        break;
      }

      case 'delete_client': {
        const { clientId } = data;
        await sql.unsafe(`DELETE FROM clients WHERE id = $1`, [clientId]);
        result = [{ success: true }];
        break;
      }

      case 'check_user_has_agents': {
        const { userId } = data;
        const rows = await sql.unsafe(
          `SELECT COUNT(*) as count FROM user_agents WHERE user_id = $1`,
          [userId]
        );
        result = [{ hasAgents: parseInt(rows[0].count) > 0 }];
        break;
      }

      case 'check_client_has_agents': {
        const { clientId } = data;
        const rows = await sql.unsafe(
          `SELECT COUNT(*) as count FROM agents WHERE client_id = $1`,
          [clientId]
        );
        result = [{ hasAgents: parseInt(rows[0].count) > 0 }];
        break;
      }

      case 'get_agent_details': {
        const { agentId } = data;
        const rows = await sql.unsafe(
          `SELECT 
            a.id,
            a.cod_agent::text as cod_agent,
            a.status,
            a.is_closer,
            -- Ensure settings is always returned as object, even if stored as string
            CASE 
              WHEN jsonb_typeof(a.settings) = 'string' 
              THEN (a.settings #>> '{}')::jsonb 
              ELSE a.settings 
            END as settings,
            a.prompt,
            a.due_date,
            a.created_at,
            -- Cliente
            c.id as client_id,
            c.name as client_name,
            c.business_name,
            c.federal_id,
            c.email as client_email,
            c.phone as client_phone,
            c.zip_code,
            c.street,
            c.street_number,
            c.complement,
            c.neighborhood,
            c.city,
            c.state,
            -- Plano
            ap.id as plan_id,
            ap.name as plan_name,
            ap."limit" as plan_limit,
            -- Usuario
            u.id as user_id,
            u.name as user_name,
            u.email as user_email,
            u.remember_token,
            -- Leads do mes
            (SELECT COUNT(DISTINCT s.id) FROM sessions s 
             WHERE s.agent_id = a.id 
             AND EXISTS (SELECT 1 FROM log_messages lm 
                         WHERE lm.session_id = s.id 
                         AND lm.created_at >= DATE_TRUNC('month', CURRENT_DATE))) as leads_received
          FROM agents a
          JOIN clients c ON c.id = a.client_id
          LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
          LEFT JOIN user_agents ua ON ua.agent_id = a.id
          LEFT JOIN users u ON u.id = ua.user_id
          WHERE a.id = $1
          LIMIT 1`,
          [agentId]
        );
        result = rows;
        break;
      }

      case 'update_agent': {
        const { agentId, agentData } = data;
        const { settings, prompt, is_closer, agent_plan_id, due_date, status } = agentData;
        
        // Normalize settings using robust function (handles double-stringified JSON)
        const normalizedSettings = normalizeSettings(settings);
        
        // Use CTE + CASE to ensure settings is ALWAYS stored as JSONB object (never string)
        const rows = await sql.unsafe(
          `WITH s AS (SELECT $1::jsonb AS v)
           UPDATE agents 
           SET settings = CASE WHEN jsonb_typeof(s.v) = 'string' THEN (s.v #>> '{}')::jsonb ELSE s.v END, 
               prompt = $2, is_closer = $3, agent_plan_id = $4, due_date = $5, status = $6, updated_at = now()
           FROM s
           WHERE agents.id = $7
           RETURNING agents.*`,
          [normalizedSettings, prompt, is_closer, agent_plan_id, due_date, status, agentId]
        );

        // IMPORTANT: some drivers may serialize jsonb as string on RETURNING *.
        // Force settings to be an object in the API response.
        result = rows.map((row) => {
          const r = row as Record<string, unknown>;
          if ('settings' in r) {
            try {
              return { ...r, settings: coerceSettingsObject(r.settings) };
            } catch {
              // If something unexpected slips through, keep original.
              return r;
            }
          }
          return r;
        });
        break;
      }

      case 'reset_user_password': {
        const { userId, hashedPassword, rawPassword } = data;
        
        const rows = await sql.unsafe(
          `UPDATE users 
           SET password = $1, remember_token = $2, updated_at = now()
           WHERE id = $3
           RETURNING id, name, email`,
          [hashedPassword, rawPassword, userId]
        );
        result = rows;
        break;
      }

      case 'normalize_agents_settings': {
        // Diagnose and fix legacy settings stored as JSONB string
        
        // Pre-check: count records with settings as string
        const preCheck = await sql.unsafe(
          `SELECT jsonb_typeof(settings) AS t, COUNT(*)::int as count 
           FROM agents 
           WHERE settings IS NOT NULL 
           GROUP BY jsonb_typeof(settings)`
        );
        
        // Find count of string-type settings
        const stringCount = ([...preCheck] as unknown as Array<{t: string; count: number}>).find(r => r.t === 'string')?.count || 0;
        
        // Get sample of IDs that will be fixed
        let fixedIds: number[] = [];
        if (stringCount > 0) {
          const sampleIds = await sql.unsafe(
            `SELECT id FROM agents WHERE jsonb_typeof(settings) = 'string' LIMIT 10`
          );
          fixedIds = (sampleIds as Array<Record<string, unknown>>).map((r) => r.id as number);
          
          // Fix: convert string to proper object
          await sql.unsafe(
            `UPDATE agents 
             SET settings = (settings #>> '{}')::jsonb, updated_at = now()
             WHERE jsonb_typeof(settings) = 'string'`
          );
        }
        
        // Post-check: verify fix
        const postCheck = await sql.unsafe(
          `SELECT jsonb_typeof(settings) AS t, COUNT(*)::int as count 
           FROM agents 
           WHERE settings IS NOT NULL 
           GROUP BY jsonb_typeof(settings)`
        );
        
        result = [{
          pre_check: preCheck,
          fixed_count: stringCount,
          fixed_ids_sample: fixedIds,
          post_check: postCheck
        }];
        break;
      }

      case 'diagnose_agents_settings': {
        // Just diagnose without fixing
        const diagnosis = await sql.unsafe(
          `SELECT jsonb_typeof(settings) AS type, COUNT(*)::int as count 
           FROM agents 
           WHERE settings IS NOT NULL 
           GROUP BY jsonb_typeof(settings)`
        );
        result = diagnosis;
        break;
      }

      case 'diagnose_latest_agents_settings': {
        // Detailed diagnosis of the 5 most recent agents
        const diagnosis = await sql.unsafe(
          `SELECT 
            id,
            created_at,
            jsonb_typeof(settings) as settings_type,
            settings ? 'CONTRACT_SIGNED' as has_contract_signed_key,
            settings->>'CONTRACT_SIGNED' as contract_signed_value,
            LEFT(settings::text, 100) as settings_preview
           FROM agents 
           ORDER BY created_at DESC 
           LIMIT 5`
        );
        result = diagnosis;
        break;
      }

      case 'diagnose_db_identity': {
        // Returns database identity info to confirm which DB is being queried
        const diagnosis = await sql.unsafe(
          `SELECT 
            current_database() as db_name,
            current_schema() as schema_name,
            current_user as db_user,
            inet_server_addr()::text as server_addr,
            inet_server_port() as server_port,
            version() as pg_version`
        );
        result = diagnosis;
        break;
      }

      case 'update_agent_connection': {
        const { agentId, connectionData } = data;
        const { hub, evo_url, evo_apikey, evo_instancia } = connectionData;
        
        await sql.unsafe(
          `UPDATE agents 
           SET hub = $1, evo_url = $2, evo_apikey = $3, evo_instance = $4, updated_at = now()
           WHERE id = $5`,
          [hub, evo_url, evo_apikey, evo_instancia, agentId]
        );
        result = [{ success: true }];
        break;
      }

      case 'get_crm_agents_for_user': {
        const { userId } = data;
        result = await sql.unsafe(
          `SELECT DISTINCT 
            COALESCE(ua.cod_agent::text, a.cod_agent::text) as cod_agent,
            c.name as owner_name,
            c.business_name as owner_business_name
          FROM user_agents ua
          LEFT JOIN agents a ON a.id = ua.agent_id OR a.cod_agent::text = ua.cod_agent::text
          LEFT JOIN clients c ON c.id = a.client_id
          WHERE ua.user_id = $1
            AND (a.id IS NOT NULL)
          ORDER BY c.name`,
          [userId]
        );
        break;
      }

      // === Team Members Actions ===

      case 'get_team_members': {
        const { userId, isAdmin } = data;
        // For admin: get all team members (role='time')
        // For user: get only their team members (where user_id = userId)
        if (isAdmin) {
          result = await sql.unsafe(
            `SELECT 
              u.id, u.name, u.email, u.user_id, u.created_at, u.remember_token,
              c.photo,
              COUNT(ua.id)::int as agents_count
            FROM users u
            LEFT JOIN user_agents ua ON ua.user_id = u.id
            LEFT JOIN clients c ON c.id = u.client_id
            WHERE u.role = 'time'
            GROUP BY u.id, c.photo
            ORDER BY u.name`
          );
        } else {
          result = await sql.unsafe(
            `SELECT 
              u.id, u.name, u.email, u.user_id, u.created_at, u.remember_token,
              c.photo,
              COUNT(ua.id)::int as agents_count
            FROM users u
            LEFT JOIN user_agents ua ON ua.user_id = u.id
            LEFT JOIN clients c ON c.id = u.client_id
            WHERE u.user_id = $1 AND u.role = 'time'
            GROUP BY u.id, c.photo
            ORDER BY u.name`,
            [userId]
          );
        }
        break;
      }

      case 'get_principal_users': {
        const { userId, isAdmin } = data;
        // For admin: all users with role != 'time'
        // For user: only themselves
        if (isAdmin) {
          result = await sql.unsafe(
            `SELECT id, name, email, role
             FROM users
             WHERE role IN ('admin', 'user')
             ORDER BY name`
          );
        } else {
          result = await sql.unsafe(
            `SELECT id, name, email, role
             FROM users
             WHERE id = $1
             ORDER BY name`,
            [userId]
          );
        }
        break;
      }

      case 'get_user_agents_for_principal': {
        // Returns both "own" agents (agent_id filled) and "monitored" agents (agent_id null)
        const { principalUserId } = data;
        result = await sql.unsafe(
          `SELECT 
            ua.agent_id,
            ua.cod_agent::text as cod_agent,
            COALESCE(a.status, true) as status,
            COALESCE(c.business_name, 'Agente ' || ua.cod_agent) as business_name,
            CASE WHEN ua.agent_id IS NOT NULL THEN 'own' ELSE 'monitored' END as agent_type
          FROM user_agents ua
          LEFT JOIN agents a ON a.id = ua.agent_id OR a.cod_agent::text = ua.cod_agent::text
          LEFT JOIN clients c ON c.id = a.client_id
          WHERE ua.user_id = $1
          ORDER BY 
            CASE WHEN ua.agent_id IS NOT NULL THEN 0 ELSE 1 END,
            c.business_name`,
          [principalUserId]
        );
        break;
      }

      case 'get_team_member_agents': {
        const { memberId } = data;
        result = await sql.unsafe(
          `SELECT ua.agent_id, ua.cod_agent::text as cod_agent
           FROM user_agents ua
           WHERE ua.user_id = $1`,
          [memberId]
        );
        break;
      }

      case 'insert_team_member': {
        const { name, email, hashedPassword, rawPassword, principalUserId, clientId, agentIds, modulePermissions } = data;
        
        // Insert user with role='time', user_id pointing to principal, and use_custom_permissions = true
        const userRows = await sql.unsafe(
          `INSERT INTO users (name, email, password, remember_token, role, user_id, client_id, use_custom_permissions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'time', $5, $6, TRUE, now(), now())
           RETURNING id, name, email`,
          [name, email, hashedPassword, rawPassword, principalUserId, clientId]
        );
        
        const newUserId = userRows[0].id;
        
        // Insert user_agents for each selected agent (agentId can be null for monitored)
        for (const agent of agentIds) {
          await sql.unsafe(
            `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
             VALUES ($1, $2, $3::bigint, now())`,
            [newUserId, agent.agentId, agent.codAgent]
          );
        }
        
        // Insert user_permissions for selected modules
        if (modulePermissions && modulePermissions.length > 0) {
          for (const mod of modulePermissions) {
            await sql.unsafe(
              `INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete)
               SELECT $1, id, TRUE, TRUE, TRUE, FALSE FROM modules WHERE code = $2`,
              [newUserId, mod.moduleCode]
            );
          }
        }
        
        result = userRows;
        break;
      }

      case 'update_team_member': {
        const { memberId, name, principalUserId, agentIds, modulePermissions } = data;
        
        // Update user name and principal
        await sql.unsafe(
          `UPDATE users SET name = $1, user_id = $2, use_custom_permissions = TRUE, updated_at = now() WHERE id = $3`,
          [name, principalUserId, memberId]
        );
        
        // Sync user_agents: delete existing, insert new
        await sql.unsafe(
          `DELETE FROM user_agents WHERE user_id = $1`,
          [memberId]
        );
        
        for (const agent of agentIds) {
          await sql.unsafe(
            `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
             VALUES ($1, $2, $3::bigint, now())`,
            [memberId, agent.agentId, agent.codAgent]
          );
        }
        
        // Sync user_permissions: delete existing, insert new
        if (modulePermissions !== undefined) {
          await sql.unsafe(`DELETE FROM user_permissions WHERE user_id = $1`, [memberId]);
          
          if (modulePermissions && modulePermissions.length > 0) {
            for (const mod of modulePermissions) {
              await sql.unsafe(
                `INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete)
                 SELECT $1, id, TRUE, TRUE, TRUE, FALSE FROM modules WHERE code = $2`,
                [memberId, mod.moduleCode]
              );
            }
          }
        }
        
        result = [{ success: true }];
        break;
      }

      case 'delete_team_member': {
        const { memberId } = data;
        
        // Delete user_agents first (FK constraint)
        await sql.unsafe(
          `DELETE FROM user_agents WHERE user_id = $1`,
          [memberId]
        );
        
        // Delete user
        await sql.unsafe(
          `DELETE FROM users WHERE id = $1 AND role = 'time'`,
          [memberId]
        );
        
        result = [{ success: true }];
        break;
      }

      case 'reset_team_member_password': {
        const { memberId, hashedPassword, rawPassword } = data;
        
        // Update password and remember_token for team member
        await sql.unsafe(
          `UPDATE users 
           SET password = $1, remember_token = $2, updated_at = now() 
           WHERE id = $3 AND role = 'time'`,
          [hashedPassword, rawPassword, memberId]
        );
        
        result = [{ success: true }];
        break;
      }

      // ==================== PERMISSION SYSTEM ====================

      case 'init_permission_system': {
        // Creates the permission tables and populates initial data
        // Should only be run once by an admin

        // 1. Create modules table
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS public.modules (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            category VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            display_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // 2. Create user_permissions table
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS public.user_permissions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
            can_view BOOLEAN DEFAULT FALSE,
            can_create BOOLEAN DEFAULT FALSE,
            can_edit BOOLEAN DEFAULT FALSE,
            can_delete BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, module_id)
          )
        `);

        // 3. Create role_default_permissions table
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS public.role_default_permissions (
            id SERIAL PRIMARY KEY,
            role VARCHAR(20) NOT NULL,
            module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
            can_view BOOLEAN DEFAULT FALSE,
            can_create BOOLEAN DEFAULT FALSE,
            can_edit BOOLEAN DEFAULT FALSE,
            can_delete BOOLEAN DEFAULT FALSE,
            UNIQUE(role, module_id)
          )
        `);

        // 4. Create indexes
        await sql.unsafe(`
          CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id ON user_permissions(module_id);
          CREATE INDEX IF NOT EXISTS idx_role_default_permissions_role ON role_default_permissions(role);
        `);

        // 5. Add columns to users table if not exist
        await sql.unsafe(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS use_custom_permissions BOOLEAN DEFAULT FALSE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        `);

        // 6. Insert modules (using INSERT ... ON CONFLICT to avoid duplicates)
        const modulesData = [
          { code: 'dashboard', name: 'Dashboard', category: 'principal', display_order: 1 },
          { code: 'crm_leads', name: 'Leads', category: 'crm', display_order: 10 },
          { code: 'crm_monitoring', name: 'Monitoramento', category: 'crm', display_order: 11 },
          { code: 'crm_statistics', name: 'Estatísticas', category: 'crm', display_order: 12 },
          { code: 'agent_management', name: 'Meus Agentes', category: 'agente', display_order: 20 },
          { code: 'followup', name: 'FollowUp', category: 'agente', display_order: 21 },
          { code: 'strategic_perf', name: 'Desempenho Julia', category: 'agente', display_order: 22 },
          { code: 'strategic_contract', name: 'Contratos Julia', category: 'agente', display_order: 23 },
          { code: 'library', name: 'Biblioteca', category: 'sistema', display_order: 30 },
          { code: 'team', name: 'Equipe', category: 'sistema', display_order: 31 },
          { code: 'admin_agents', name: 'Lista de Agentes', category: 'admin', display_order: 40 },
          { code: 'admin_products', name: 'Produtos', category: 'admin', display_order: 41 },
          { code: 'admin_files', name: 'Arquivos Clientes', category: 'admin', display_order: 42 },
          { code: 'finance_billing', name: 'Cobranças', category: 'financeiro', display_order: 50 },
          { code: 'finance_clients', name: 'Clientes', category: 'financeiro', display_order: 51 },
          { code: 'finance_reports', name: 'Relatórios', category: 'financeiro', display_order: 52 },
          { code: 'settings', name: 'Configurações', category: 'admin', display_order: 60 },
        ];

        for (const mod of modulesData) {
          await sql.unsafe(
            `INSERT INTO modules (code, name, category, display_order)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (code) DO UPDATE SET name = $2, category = $3, display_order = $4`,
            [mod.code, mod.name, mod.category, mod.display_order]
          );
        }

        // 7. Insert role_default_permissions
        // First, clear existing defaults
        await sql.unsafe(`DELETE FROM role_default_permissions`);

        // ADMIN: all permissions on all modules
        await sql.unsafe(`
          INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
          SELECT 'admin', id, TRUE, TRUE, TRUE, TRUE FROM modules
        `);

        // COLABORADOR: all except admin/financeiro categories
        await sql.unsafe(`
          INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
          SELECT 'colaborador', id, TRUE, TRUE, TRUE, FALSE 
          FROM modules WHERE category NOT IN ('admin', 'financeiro')
        `);

        // USER: client-facing modules
        await sql.unsafe(`
          INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
          SELECT 'user', id, TRUE, TRUE, TRUE, TRUE 
          FROM modules WHERE category IN ('principal', 'crm', 'agente', 'sistema')
        `);

        // TIME: restricted (no team, settings, view only)
        await sql.unsafe(`
          INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
          SELECT 'time', id, TRUE, FALSE, FALSE, FALSE 
          FROM modules WHERE code NOT IN ('team', 'settings') AND category IN ('principal', 'crm', 'agente')
        `);

        // 8. Create the check_user_permission function
        await sql.unsafe(`
          CREATE OR REPLACE FUNCTION check_user_permission(
            p_user_id BIGINT,
            p_module_code VARCHAR,
            p_permission_type VARCHAR DEFAULT 'view'
          ) RETURNS BOOLEAN AS $$
          DECLARE
            v_user RECORD;
            v_permission BOOLEAN;
            v_parent_permission BOOLEAN;
            v_module_id INT;
          BEGIN
            SELECT id, role, user_id, use_custom_permissions, is_active 
            INTO v_user FROM users WHERE id = p_user_id;
            
            IF NOT FOUND OR NOT COALESCE(v_user.is_active, TRUE) THEN
              RETURN FALSE;
            END IF;
            
            IF v_user.role = 'admin' THEN
              RETURN TRUE;
            END IF;
            
            SELECT id INTO v_module_id FROM modules WHERE code = p_module_code AND is_active = TRUE;
            IF NOT FOUND THEN
              RETURN FALSE;
            END IF;
            
            IF COALESCE(v_user.use_custom_permissions, FALSE) THEN
              SELECT 
                CASE p_permission_type
                  WHEN 'view' THEN can_view
                  WHEN 'create' THEN can_create
                  WHEN 'edit' THEN can_edit
                  WHEN 'delete' THEN can_delete
                  ELSE FALSE
                END INTO v_permission
              FROM user_permissions 
              WHERE user_id = p_user_id AND module_id = v_module_id;
            ELSE
              SELECT 
                CASE p_permission_type
                  WHEN 'view' THEN can_view
                  WHEN 'create' THEN can_create
                  WHEN 'edit' THEN can_edit
                  WHEN 'delete' THEN can_delete
                  ELSE FALSE
                END INTO v_permission
              FROM role_default_permissions 
              WHERE role = v_user.role AND module_id = v_module_id;
            END IF;
            
            v_permission := COALESCE(v_permission, FALSE);
            
            IF v_user.role = 'time' AND v_user.user_id IS NOT NULL THEN
              v_parent_permission := check_user_permission(v_user.user_id, p_module_code, p_permission_type);
              RETURN v_permission AND v_parent_permission;
            END IF;
            
            RETURN v_permission;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER
        `);

        result = [{ success: true, message: 'Permission system initialized' }];
        break;
      }

      case 'get_user_permissions': {
        // Get all permissions for a user (used after login)
        const { userId } = data;

        // First check if user exists and get their role
        const users = await sql.unsafe(
          `SELECT id, role, use_custom_permissions, is_active FROM users WHERE id = $1`,
          [userId]
        );

        if (users.length === 0) {
          result = [];
          break;
        }

        const user = users[0];

        // Admin gets all permissions
        if (user.role === 'admin') {
          result = await sql.unsafe(`
            SELECT m.code as module_code, m.name as module_name, m.category,
                   TRUE as can_view, TRUE as can_create, TRUE as can_edit, TRUE as can_delete
            FROM modules m
            WHERE m.is_active = TRUE
            ORDER BY m.display_order
          `);
          break;
        }

        // Get permissions based on custom or default
        if (user.use_custom_permissions) {
          result = await sql.unsafe(`
            SELECT m.code as module_code, m.name as module_name, m.category,
                   COALESCE(up.can_view, FALSE) as can_view,
                   COALESCE(up.can_create, FALSE) as can_create,
                   COALESCE(up.can_edit, FALSE) as can_edit,
                   COALESCE(up.can_delete, FALSE) as can_delete
            FROM modules m
            LEFT JOIN user_permissions up ON up.module_id = m.id AND up.user_id = $1
            WHERE m.is_active = TRUE
            ORDER BY m.display_order
          `, [userId]);
        } else {
          result = await sql.unsafe(`
            SELECT m.code as module_code, m.name as module_name, m.category,
                   COALESCE(rdp.can_view, FALSE) as can_view,
                   COALESCE(rdp.can_create, FALSE) as can_create,
                   COALESCE(rdp.can_edit, FALSE) as can_edit,
                   COALESCE(rdp.can_delete, FALSE) as can_delete
            FROM modules m
            LEFT JOIN role_default_permissions rdp ON rdp.module_id = m.id AND rdp.role = $1
            WHERE m.is_active = TRUE
            ORDER BY m.display_order
          `, [user.role]);
        }

        // For 'time' users, also check parent permissions
        if (user.role === 'time') {
          const parentUserId = await sql.unsafe(
            `SELECT user_id FROM users WHERE id = $1`,
            [userId]
          );
          
          if (parentUserId.length > 0 && parentUserId[0].user_id) {
            const pid = parentUserId[0].user_id;

            // Check if parent uses custom permissions
            const parentUser = await sql.unsafe(
              `SELECT role, use_custom_permissions FROM users WHERE id = $1`,
              [pid]
            );

            let parentPerms;
            const pu = parentUser[0];

            if (pu?.role === 'admin') {
              // Admin parent: all modules allowed
              parentPerms = await sql.unsafe(`
                SELECT code as module_code, TRUE as can_view, TRUE as can_create, TRUE as can_edit, TRUE as can_delete
                FROM modules WHERE is_active = TRUE
              `);
            } else if (pu?.use_custom_permissions) {
              // Parent has custom permissions: use them
              parentPerms = await sql.unsafe(`
                SELECT m.code as module_code,
                       COALESCE(up.can_view, FALSE) as can_view,
                       COALESCE(up.can_create, FALSE) as can_create,
                       COALESCE(up.can_edit, FALSE) as can_edit,
                       COALESCE(up.can_delete, FALSE) as can_delete
                FROM modules m
                LEFT JOIN user_permissions up ON up.module_id = m.id AND up.user_id = $1
                WHERE m.is_active = TRUE
              `, [pid]);
            } else {
              // Parent uses role defaults
              parentPerms = await sql.unsafe(`
                SELECT m.code as module_code,
                       COALESCE(rdp.can_view, FALSE) as can_view,
                       COALESCE(rdp.can_create, FALSE) as can_create,
                       COALESCE(rdp.can_edit, FALSE) as can_edit,
                       COALESCE(rdp.can_delete, FALSE) as can_delete
                FROM modules m
                LEFT JOIN role_default_permissions rdp ON rdp.module_id = m.id AND rdp.role = $1
                WHERE m.is_active = TRUE
              `, [pu?.role || 'user']);
            }

            // Intersect permissions: child can only have permission if parent also has it
            const parentMap = new Map(parentPerms.map(p => [p.module_code, p]));
            result = result.map(perm => {
              const parent = parentMap.get(perm.module_code);
              if (parent) {
                return {
                  ...perm,
                  can_view: perm.can_view && parent.can_view,
                  can_create: perm.can_create && parent.can_create,
                  can_edit: perm.can_edit && parent.can_edit,
                  can_delete: perm.can_delete && parent.can_delete,
                };
              }
              return perm;
            });
          }
        }
        break;
      }

      case 'get_modules': {
        // Get all modules (for admin UI)
        // Check if new columns exist
        const modColumnCheck = await sql.unsafe(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'modules' AND column_name = 'icon'
        `);
        
        if (modColumnCheck.length > 0) {
          result = await sql.unsafe(`
            SELECT id, code, name, description, category, is_active, display_order,
                   icon, route, parent_module_id, menu_group, is_menu_visible
            FROM modules
            ORDER BY display_order
          `);
        } else {
          result = await sql.unsafe(`
            SELECT id, code, name, description, category, is_active, display_order,
                   NULL as icon, NULL as route, NULL as parent_module_id, 
                   category as menu_group, TRUE as is_menu_visible
            FROM modules
            ORDER BY display_order
          `);
        }
        break;
      }

      case 'get_menu_modules': {
        // Get modules visible in the menu (for Sidebar)
        // First check if the new columns exist (schema might not be migrated yet)
        const columnCheck = await sql.unsafe(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'modules' AND column_name = 'icon'
        `);
        
        if (columnCheck.length > 0) {
          // New schema - use all columns
          result = await sql.unsafe(`
            SELECT id, code, name, category, display_order,
                   icon, route, parent_module_id, menu_group, is_menu_visible
            FROM modules
            WHERE is_active = TRUE AND COALESCE(is_menu_visible, TRUE) = TRUE
            ORDER BY COALESCE(menu_group, 'OUTROS'), display_order
          `);
        } else {
          // Old schema - return basic columns with defaults
          result = await sql.unsafe(`
            SELECT id, code, name, category, display_order,
                   NULL as icon, NULL as route, NULL as parent_module_id, 
                   category as menu_group, TRUE as is_menu_visible
            FROM modules
            WHERE is_active = TRUE
            ORDER BY category, display_order
          `);
        }
        break;
      }

      case 'create_module': {
        const { moduleData } = data;
        const { code, name, description, category, icon, route, menu_group, is_menu_visible, display_order } = moduleData;
        
        const inserted = await sql.unsafe(
          `INSERT INTO modules (code, name, description, category, icon, route, menu_group, is_menu_visible, display_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, now(), now())
           RETURNING *`,
          [code, name, description || null, category, icon || null, route || null, menu_group || null, is_menu_visible ?? true, display_order || 0]
        );
        
        // Criar permissões padrão para todos os cargos automaticamente
        if (inserted.length > 0) {
          const moduleId = inserted[0].id;
          await sql.unsafe(`
            INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
            SELECT role, $1, 
                   CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
                   CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
                   CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
                   CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END
            FROM (VALUES ('admin'), ('colaborador'), ('user'), ('time')) AS r(role)
            ON CONFLICT (role, module_id) DO NOTHING
          `, [moduleId]);
        }
        
        result = inserted;
        break;
      }

      case 'update_module': {
        const { moduleId, moduleData } = data;
        const { code, name, description, category, icon, route, menu_group, is_menu_visible, display_order, is_active } = moduleData;
        
        result = await sql.unsafe(
          `UPDATE modules 
           SET code = $1, name = $2, description = $3, category = $4, icon = $5, 
               route = $6, menu_group = $7, is_menu_visible = $8, display_order = $9, 
               is_active = $10, updated_at = now()
           WHERE id = $11
           RETURNING *`,
          [code, name, description || null, category, icon || null, route || null, menu_group || null, is_menu_visible ?? true, display_order || 0, is_active ?? true, moduleId]
        );
        break;
      }

      case 'delete_module': {
        // Soft delete - just deactivate
        const { moduleId } = data;
        
        result = await sql.unsafe(
          `UPDATE modules SET is_active = FALSE, updated_at = now() WHERE id = $1 RETURNING *`,
          [moduleId]
        );
        break;
      }

      case 'migrate_modules_schema': {
        // Add new columns to modules table if they don't exist
        await sql.unsafe(`
          ALTER TABLE modules ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
          ALTER TABLE modules ADD COLUMN IF NOT EXISTS route VARCHAR(100);
          ALTER TABLE modules ADD COLUMN IF NOT EXISTS parent_module_id INT REFERENCES modules(id);
          ALTER TABLE modules ADD COLUMN IF NOT EXISTS menu_group VARCHAR(50);
          ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_menu_visible BOOLEAN DEFAULT TRUE;
        `);

        // Update existing modules with route, icon, and menu_group
        const moduleUpdates = [
          { code: 'dashboard', icon: 'LayoutDashboard', route: '/dashboard', menu_group: 'PRINCIPAL' },
          { code: 'agent_management', icon: 'Bot', route: '/agente/meus-agentes', menu_group: 'AGENTES DA JULIA' },
          { code: 'followup', icon: 'MessageSquare', route: '/agente/followup', menu_group: 'AGENTES DA JULIA' },
          { code: 'strategic_perf', icon: 'BarChart3', route: '/estrategico/desempenho', menu_group: 'AGENTES DA JULIA' },
          { code: 'strategic_contract', icon: 'FileCheck', route: '/estrategico/contratos', menu_group: 'AGENTES DA JULIA' },
          { code: 'crm_leads', icon: 'Users', route: '/crm/leads', menu_group: 'CRM' },
          { code: 'crm_monitoring', icon: 'Activity', route: '/crm/lead-monitoramento', menu_group: 'CRM' },
          { code: 'crm_statistics', icon: 'BarChart3', route: '/crm/lead-estatisticas', menu_group: 'CRM' },
          { code: 'library', icon: 'Library', route: '/biblioteca', menu_group: 'SISTEMA' },
          { code: 'team', icon: 'UsersRound', route: '/equipe', menu_group: 'SISTEMA' },
          { code: 'admin_agents', icon: 'Bot', route: '/admin/agentes', menu_group: 'ADMINISTRATIVO' },
          { code: 'admin_products', icon: 'Package', route: '/admin/produtos', menu_group: 'ADMINISTRATIVO' },
          { code: 'admin_files', icon: 'FileText', route: '/admin/arquivos-clientes', menu_group: 'ADMINISTRATIVO' },
          { code: 'finance_billing', icon: 'CreditCard', route: '/financeiro/cobrancas', menu_group: 'FINANCEIRO' },
          { code: 'finance_clients', icon: 'Users', route: '/financeiro/clientes', menu_group: 'FINANCEIRO' },
          { code: 'finance_reports', icon: 'BarChart3', route: '/financeiro/relatorios', menu_group: 'FINANCEIRO' },
          { code: 'settings', icon: 'Settings', route: '/configuracoes', menu_group: 'CONFIGURAÇÕES' },
        ];

        for (const mod of moduleUpdates) {
          await sql.unsafe(
            `UPDATE modules SET icon = $1, route = $2, menu_group = $3, is_menu_visible = TRUE WHERE code = $4`,
            [mod.icon, mod.route, mod.menu_group, mod.code]
          );
        }

        // Insert new modules that don't exist yet
        const newModules = [
          { code: 'video_room', name: 'Sala de Reunião', category: 'sistema', icon: 'Video', route: '/video/queue', menu_group: 'SISTEMA', display_order: 29 },
          { code: 'admin_new_agent', name: 'Novo Agente', category: 'admin', icon: 'UserPlus', route: '/admin/agentes-novo', menu_group: 'ADMINISTRATIVO', display_order: 41 },
          { code: 'admin_modules', name: 'Módulos', category: 'admin', icon: 'Layers', route: '/admin/modulos', menu_group: 'ADMINISTRATIVO', display_order: 42 },
          { code: 'admin_permissions', name: 'Permissões', category: 'admin', icon: 'Shield', route: '/admin/permissoes', menu_group: 'ADMINISTRATIVO', display_order: 43 },
        ];

        for (const mod of newModules) {
          await sql.unsafe(
            `INSERT INTO modules (code, name, category, icon, route, menu_group, display_order, is_menu_visible, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, now(), now())
             ON CONFLICT (code) DO UPDATE SET icon = $4, route = $5, menu_group = $6, display_order = $7, is_menu_visible = TRUE`,
            [mod.code, mod.name, mod.category, mod.icon, mod.route, mod.menu_group, mod.display_order]
          );
        }

        // Add admin permissions for new modules
        await sql.unsafe(`
          INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
          SELECT 'admin', id, TRUE, TRUE, TRUE, TRUE FROM modules 
          WHERE code IN ('video_room', 'admin_new_agent', 'admin_modules', 'admin_permissions')
          ON CONFLICT (role, module_id) DO NOTHING
        `);

        result = [{ success: true, message: 'Schema migrated and modules updated' }];
        break;
      }

      case 'get_role_default_permissions': {
        // Get default permissions for a specific role
        // LEFT JOIN para retornar TODOS os módulos ativos, mesmo sem registro em role_default_permissions
        const { role } = data;
        result = await sql.unsafe(`
          SELECT m.code as module_code, m.name as module_name, m.category,
                 COALESCE(rdp.can_view, FALSE) as can_view, 
                 COALESCE(rdp.can_create, FALSE) as can_create, 
                 COALESCE(rdp.can_edit, FALSE) as can_edit, 
                 COALESCE(rdp.can_delete, FALSE) as can_delete
          FROM modules m
          LEFT JOIN role_default_permissions rdp ON m.id = rdp.module_id AND rdp.role = $1
          WHERE m.is_active = TRUE
          ORDER BY m.display_order
        `, [role]);
        break;
      }

      case 'update_user_permissions': {
        // Update permissions for a specific user (admin action)
        const { userId, permissions, useCustom } = data;

        // Update the use_custom_permissions flag
        await sql.unsafe(
          `UPDATE users SET use_custom_permissions = $1, updated_at = now() WHERE id = $2`,
          [useCustom, userId]
        );

        if (useCustom && permissions && permissions.length > 0) {
          // Clear existing custom permissions
          await sql.unsafe(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);

          // Insert new permissions
          for (const perm of permissions) {
            const moduleResult = await sql.unsafe(
              `SELECT id FROM modules WHERE code = $1`,
              [perm.moduleCode]
            );
            
            if (moduleResult.length > 0) {
              await sql.unsafe(
                `INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, module_id) DO UPDATE SET
                   can_view = $3, can_create = $4, can_edit = $5, can_delete = $6, updated_at = now()`,
                [userId, moduleResult[0].id, perm.canView, perm.canCreate, perm.canEdit, perm.canDelete]
              );
            }
          }
        }

        result = [{ success: true }];
        break;
      }

      case 'update_role_default_permissions': {
        // Update default permissions for a role (admin action)
        // Usa UPSERT para criar/atualizar registros que podem não existir
        const { role, permissions } = data;

        for (const perm of permissions) {
          const moduleResult = await sql.unsafe(
            `SELECT id FROM modules WHERE code = $1`,
            [perm.moduleCode]
          );
          
          if (moduleResult.length > 0) {
            await sql.unsafe(
              `INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (role, module_id) DO UPDATE SET
                 can_view = EXCLUDED.can_view, 
                 can_create = EXCLUDED.can_create, 
                 can_edit = EXCLUDED.can_edit, 
                 can_delete = EXCLUDED.can_delete`,
              [role, moduleResult[0].id, perm.canView, perm.canCreate, perm.canEdit, perm.canDelete]
            );
          }
        }

        result = [{ success: true }];
        break;
      }

      case 'sync_role_permissions': {
        // Sincroniza todos os módulos ativos com todos os cargos
        // Cria registros faltantes em role_default_permissions
        await sql.unsafe(`
          INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
          SELECT r.role, m.id, 
                 CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END,
                 CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END,
                 CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END,
                 CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END
          FROM modules m
          CROSS JOIN (VALUES ('admin'), ('colaborador'), ('user'), ('time')) AS r(role)
          WHERE m.is_active = TRUE
          ON CONFLICT (role, module_id) DO NOTHING
        `);
        
        result = [{ success: true, message: 'Permissões sincronizadas com sucesso' }];
        break;
      }

      case 'get_users_with_permissions': {
        // Get all users with their permission info (for admin UI)
        const { roleFilter } = data || {};
        
        let query = `
          SELECT u.id, u.name, u.email, u.role, u.use_custom_permissions, u.is_active,
                 u.user_id as parent_user_id, u.created_at, u.remember_token
          FROM users u
          WHERE 1=1
        `;
        const params: any[] = [];
        
        if (roleFilter) {
          params.push(roleFilter);
          query += ` AND u.role = $${params.length}`;
        }
        
        query += ` ORDER BY u.role, u.name`;
        
        result = await sql.unsafe(query, params);
        break;
      }

      case 'check_permission': {
        // Check if user has permission for a module/action
        const { userId, moduleCode, permissionType } = data;
        
        const checkResult = await sql.unsafe(
          `SELECT check_user_permission($1, $2, $3) as has_permission`,
          [userId, moduleCode, permissionType || 'view']
        );
        
        result = checkResult;
        break;
      }

      case 'update_user_profile': {
        // Update user profile (admin action)
        const { userId, name, email, role, isActive } = data;
        
        // Sync is_active with status (legacy field)
        const status = isActive ? 1 : 0;
        
        const rows = await sql.unsafe(
          `UPDATE users 
           SET name = $1, email = $2, role = $3, is_active = $4, status = $5, updated_at = now()
           WHERE id = $6
           RETURNING id, name, email, role, is_active, status, user_id as parent_user_id, created_at, use_custom_permissions`,
          [name, email, role, isActive, status, userId]
        );
        result = rows;
        break;
      }

      case 'get_session_status': {
        // Fetch session status for a WhatsApp number and agent
        const { whatsappNumber, codAgent } = data;
        
        // Remove non-digits from whatsapp
        const cleanNumber = whatsappNumber.replace(/\D/g, '');
        
        const rows = await sql.unsafe(
          `SELECT 
            s.id,
            s.active,
            s.whatsapp_number::text,
            s.created_at,
            s.updated_at,
            a.cod_agent::text
          FROM sessions s
          JOIN agents a ON a.id = s.agent_id
          WHERE s.whatsapp_number::text = $1
            AND a.cod_agent::text = $2
          ORDER BY s.created_at DESC
          LIMIT 1`,
          [cleanNumber, codAgent]
        );
        result = rows;
        break;
      }

      case 'update_session_status': {
        // Update session active status
        const { sessionId, active } = data;
        
        await sql.unsafe(
          `UPDATE sessions 
           SET active = $1, updated_at = now()
           WHERE id = $2`,
          [active, sessionId]
        );
        result = [{ success: true }];
        break;
      }

      // ================== ADVBOX INTEGRATION ACTIONS ==================

      case 'advbox_get_integration': {
        // Get Advbox integration for an agent
        const { agentId } = data;
        
        const rows = await sql.unsafe(
          `SELECT 
            ai.*,
            (SELECT COUNT(*) FROM advbox_processes_cache apc WHERE apc.agent_id = ai.agent_id) as total_processes_cached,
            (SELECT COUNT(*) FROM advbox_notification_logs anl WHERE anl.agent_id = ai.agent_id AND anl.created_at >= NOW() - INTERVAL '24 hours') as notifications_sent_24h,
            (SELECT COUNT(*) FROM advbox_client_queries acq WHERE acq.agent_id = ai.agent_id AND acq.created_at >= NOW() - INTERVAL '24 hours') as queries_answered_24h
          FROM advbox_integrations ai
          WHERE ai.agent_id = $1
          LIMIT 1`,
          [agentId]
        );
        result = rows;
        break;
      }

      case 'advbox_save_integration': {
        // Create or update Advbox integration
        const { agentId, apiEndpoint, apiToken, isActive, settings, connectionStatus, lastError } = data;
        
        const rows = await sql.unsafe(
          `INSERT INTO advbox_integrations (agent_id, api_endpoint, api_token, is_active, settings, connection_status, last_error, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
           ON CONFLICT (agent_id) DO UPDATE SET
             api_endpoint = EXCLUDED.api_endpoint,
             api_token = EXCLUDED.api_token,
             is_active = EXCLUDED.is_active,
             settings = EXCLUDED.settings,
             connection_status = EXCLUDED.connection_status,
             last_error = EXCLUDED.last_error,
             updated_at = NOW()
           RETURNING *`,
          [agentId, apiEndpoint, apiToken, isActive, JSON.stringify(settings || {}), connectionStatus || 'pending', lastError]
        );
        result = rows;
        break;
      }

      case 'advbox_update_connection_status': {
        // Update connection status after test
        const { agentId, connectionStatus, lastError, lastSyncAt } = data;
        
        let query = `UPDATE advbox_integrations SET connection_status = $1, last_error = $2, updated_at = NOW()`;
        const params: any[] = [connectionStatus, lastError];
        
        if (lastSyncAt) {
          query += `, last_sync_at = $3 WHERE agent_id = $4 RETURNING *`;
          params.push(lastSyncAt, agentId);
        } else {
          query += ` WHERE agent_id = $3 RETURNING *`;
          params.push(agentId);
        }
        
        const rows = await sql.unsafe(query, params);
        result = rows;
        break;
      }

      case 'advbox_delete_integration': {
        // Delete Advbox integration (cascades to rules, processes, logs)
        const { integrationId } = data;
        
        await sql.unsafe(
          `DELETE FROM advbox_integrations WHERE id = $1`,
          [integrationId]
        );
        result = [{ success: true }];
        break;
      }

      case 'advbox_get_rules': {
        // Get notification rules for an agent
        const { agentId, integrationId } = data;
        
        let query = `
          SELECT 
            anr.*,
            (SELECT COUNT(*) FROM advbox_notification_logs anl WHERE anl.rule_id = anr.id) as notifications_sent,
            (SELECT MAX(created_at) FROM advbox_notification_logs anl WHERE anl.rule_id = anr.id) as last_triggered
          FROM advbox_notification_rules anr
          WHERE 1=1
        `;
        const params: any[] = [];
        
        if (agentId) {
          params.push(agentId);
          query += ` AND anr.agent_id = $${params.length}`;
        }
        if (integrationId) {
          params.push(integrationId);
          query += ` AND anr.integration_id = $${params.length}`;
        }
        
        query += ` ORDER BY anr.created_at DESC`;
        
        result = await sql.unsafe(query, params);
        break;
      }

      case 'advbox_save_rule': {
        // Create or update notification rule
        const { id, agentId, integrationId, ruleName, isActive, processPhases, eventTypes, keywords, messageTemplate, sendTo, cooldownMinutes } = data;
        
        if (id) {
          // Update existing rule
          const rows = await sql.unsafe(
            `UPDATE advbox_notification_rules SET
              rule_name = $1,
              is_active = $2,
              process_phases = $3,
              event_types = $4,
              keywords = $5,
              message_template = $6,
              send_to = $7,
              cooldown_minutes = $8,
              updated_at = NOW()
            WHERE id = $9
            RETURNING *`,
            [ruleName, isActive, processPhases || [], eventTypes || [], keywords || [], messageTemplate, sendTo || 'cliente', cooldownMinutes || 60, id]
          );
          result = rows;
        } else {
          // Create new rule
          const rows = await sql.unsafe(
            `INSERT INTO advbox_notification_rules (agent_id, integration_id, rule_name, is_active, process_phases, event_types, keywords, message_template, send_to, cooldown_minutes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [agentId, integrationId, ruleName, isActive ?? true, processPhases || [], eventTypes || [], keywords || [], messageTemplate, sendTo || 'cliente', cooldownMinutes || 60]
          );
          result = rows;
        }
        break;
      }

      case 'advbox_toggle_rule': {
        // Toggle rule active status
        const { ruleId, isActive } = data;
        
        const rows = await sql.unsafe(
          `UPDATE advbox_notification_rules SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [isActive, ruleId]
        );
        result = rows;
        break;
      }

      case 'advbox_delete_rule': {
        // Delete notification rule
        const { ruleId } = data;
        
        await sql.unsafe(
          `DELETE FROM advbox_notification_rules WHERE id = $1`,
          [ruleId]
        );
        result = [{ success: true }];
        break;
      }

      case 'advbox_get_processes': {
        // Get cached processes for an agent
        const { agentId, search, phase, limit: processLimit, offset: processOffset } = data;
        
        let query = `
          SELECT *
          FROM advbox_processes_cache
          WHERE agent_id = $1
        `;
        const params: any[] = [agentId];
        
        if (search) {
          params.push(`%${search}%`);
          query += ` AND (client_name ILIKE $${params.length} OR process_number ILIKE $${params.length} OR client_phone ILIKE $${params.length})`;
        }
        if (phase) {
          params.push(phase);
          query += ` AND phase = $${params.length}`;
        }
        
        query += ` ORDER BY last_movement_date DESC NULLS LAST`;
        
        if (processLimit) {
          params.push(processLimit);
          query += ` LIMIT $${params.length}`;
        }
        if (processOffset) {
          params.push(processOffset);
          query += ` OFFSET $${params.length}`;
        }
        
        result = await sql.unsafe(query, params);
        break;
      }

      case 'advbox_upsert_process': {
        // Insert or update a process in cache
        const { agentId, integrationId, processId, processNumber, clientId, clientName, clientPhone, phase, status, responsible, lastMovementId, lastMovementDate, lastMovementText, fullData } = data;
        
        const rows = await sql.unsafe(
          `INSERT INTO advbox_processes_cache (agent_id, integration_id, process_id, process_number, client_id, client_name, client_phone, phase, status, responsible, last_movement_id, last_movement_date, last_movement_text, full_data, cached_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW(), NOW())
           ON CONFLICT (agent_id, process_id) DO UPDATE SET
             process_number = EXCLUDED.process_number,
             client_id = EXCLUDED.client_id,
             client_name = EXCLUDED.client_name,
             client_phone = EXCLUDED.client_phone,
             phase = EXCLUDED.phase,
             status = EXCLUDED.status,
             responsible = EXCLUDED.responsible,
             last_movement_id = EXCLUDED.last_movement_id,
             last_movement_date = EXCLUDED.last_movement_date,
             last_movement_text = EXCLUDED.last_movement_text,
             full_data = EXCLUDED.full_data,
             cached_at = NOW(),
             updated_at = NOW()
           RETURNING *`,
          [agentId, integrationId, processId, processNumber, clientId, clientName, clientPhone, phase, status, responsible, lastMovementId, lastMovementDate, lastMovementText, JSON.stringify(fullData || {})]
        );
        result = rows;
        break;
      }

      case 'advbox_get_notification_logs': {
        // Get notification logs for an agent
        const { agentId, status: logStatus, ruleId, limit: logLimit, offset: logOffset } = data;
        
        let query = `
          SELECT 
            anl.*,
            anr.rule_name,
            apc.process_number
          FROM advbox_notification_logs anl
          LEFT JOIN advbox_notification_rules anr ON anr.id = anl.rule_id
          LEFT JOIN advbox_processes_cache apc ON apc.process_id = anl.process_id AND apc.agent_id = anl.agent_id
          WHERE anl.agent_id = $1
        `;
        const params: any[] = [agentId];
        
        if (logStatus) {
          params.push(logStatus);
          query += ` AND anl.status = $${params.length}`;
        }
        if (ruleId) {
          params.push(ruleId);
          query += ` AND anl.rule_id = $${params.length}`;
        }
        
        query += ` ORDER BY anl.created_at DESC`;
        
        if (logLimit) {
          params.push(logLimit);
          query += ` LIMIT $${params.length}`;
        }
        if (logOffset) {
          params.push(logOffset);
          query += ` OFFSET $${params.length}`;
        }
        
        result = await sql.unsafe(query, params);
        break;
      }

      case 'advbox_save_notification_log': {
        // Save notification log entry
        const { agentId, integrationId, ruleId, processId, recipientPhone, messageText, status: notifStatus, sentAt, errorMessage, whatsappMessageId, whatsappResponse } = data;
        
        const rows = await sql.unsafe(
          `INSERT INTO advbox_notification_logs (agent_id, integration_id, rule_id, process_id, recipient_phone, message_text, status, sent_at, error_message, whatsapp_message_id, whatsapp_response)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
           RETURNING *`,
          [agentId, integrationId, ruleId, processId, recipientPhone, messageText, notifStatus || 'pending', sentAt, errorMessage, whatsappMessageId, JSON.stringify(whatsappResponse || null)]
        );
        result = rows;
        break;
      }

      case 'advbox_update_notification_status': {
        // Update notification log status
        const { logId, status: newStatus, sentAt, errorMessage, whatsappMessageId, whatsappResponse } = data;
        
        const rows = await sql.unsafe(
          `UPDATE advbox_notification_logs SET
            status = $1,
            sent_at = $2,
            error_message = $3,
            whatsapp_message_id = $4,
            whatsapp_response = $5::jsonb
          WHERE id = $6
          RETURNING *`,
          [newStatus, sentAt, errorMessage, whatsappMessageId, JSON.stringify(whatsappResponse || null), logId]
        );
        result = rows;
        break;
      }

      case 'advbox_get_client_queries': {
        // Get client query logs for an agent
        const { agentId, limit: queryLimit, offset: queryOffset } = data;
        
        let query = `
          SELECT *
          FROM advbox_client_queries
          WHERE agent_id = $1
          ORDER BY created_at DESC
        `;
        const params: any[] = [agentId];
        
        if (queryLimit) {
          params.push(queryLimit);
          query += ` LIMIT $${params.length}`;
        }
        if (queryOffset) {
          params.push(queryOffset);
          query += ` OFFSET $${params.length}`;
        }
        
        result = await sql.unsafe(query, params);
        break;
      }

      case 'advbox_save_client_query': {
        // Save client query log
        const { agentId, integrationId, clientPhone, clientName, queryText, queryType, foundProcesses, responseText, responseSent, queryTimeMs } = data;
        
        const rows = await sql.unsafe(
          `INSERT INTO advbox_client_queries (agent_id, integration_id, client_phone, client_name, query_text, query_type, found_processes, response_text, response_sent, query_time_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [agentId, integrationId, clientPhone, clientName, queryText, queryType, foundProcesses || 0, responseText, responseSent ?? false, queryTimeMs]
        );
        result = rows;
        break;
      }

      case 'advbox_get_lead_syncs': {
        // Get lead sync logs for an agent
        const { agentId, status: syncStatus, limit: syncLimit, offset: syncOffset } = data;
        
        let query = `
          SELECT *
          FROM advbox_lead_sync
          WHERE agent_id = $1
        `;
        const params: any[] = [agentId];
        
        if (syncStatus) {
          params.push(syncStatus);
          query += ` AND sync_status = $${params.length}`;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        if (syncLimit) {
          params.push(syncLimit);
          query += ` LIMIT $${params.length}`;
        }
        if (syncOffset) {
          params.push(syncOffset);
          query += ` OFFSET $${params.length}`;
        }
        
        result = await sql.unsafe(query, params);
        break;
      }

      case 'advbox_save_lead_sync': {
        // Save lead sync entry
        const { agentId, integrationId, whatsappNumber, leadName, leadEmail, leadSource, leadNotes, syncStatus, advboxClientId, syncedAt, errorMessage, retryCount, fullLeadData, advboxResponse } = data;
        
        const rows = await sql.unsafe(
          `INSERT INTO advbox_lead_sync (agent_id, integration_id, whatsapp_number, lead_name, lead_email, lead_source, lead_notes, sync_status, advbox_client_id, synced_at, error_message, retry_count, full_lead_data, advbox_response)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
           RETURNING *`,
          [agentId, integrationId, whatsappNumber, leadName, leadEmail, leadSource || 'whatsapp_chat', leadNotes, syncStatus || 'pending', advboxClientId, syncedAt, errorMessage, retryCount || 0, JSON.stringify(fullLeadData || null), JSON.stringify(advboxResponse || null)]
        );
        result = rows;
        break;
      }

      case 'advbox_update_lead_sync': {
        // Update lead sync status
        const { leadSyncId, syncStatus, advboxClientId, syncedAt, errorMessage, retryCount, advboxResponse } = data;
        
        const rows = await sql.unsafe(
          `UPDATE advbox_lead_sync SET
            sync_status = $1,
            advbox_client_id = $2,
            synced_at = $3,
            error_message = $4,
            retry_count = $5,
            advbox_response = $6::jsonb,
            updated_at = NOW()
          WHERE id = $7
          RETURNING *`,
          [syncStatus, advboxClientId, syncedAt, errorMessage, retryCount, JSON.stringify(advboxResponse || null), leadSyncId]
        );
        result = rows;
        break;
      }

      case 'advbox_search_processes_by_phone': {
        // Search processes by client phone (used by Julia IA)
        const { agentId, clientPhone } = data;
        
        // Clean phone number
        const cleanPhone = clientPhone.replace(/\D/g, '');
        
        const rows = await sql.unsafe(
          `SELECT *
           FROM advbox_processes_cache
           WHERE agent_id = $1
             AND (client_phone = $2 OR client_phone LIKE $3 OR client_phone LIKE $4)
           ORDER BY last_movement_date DESC NULLS LAST`,
          [agentId, cleanPhone, `%${cleanPhone}`, `${cleanPhone}%`]
        );
        result = rows;
        break;
      }

      case 'get_available_agents_for_user': {
        const { userId } = data;
        result = await sql.unsafe(
          `SELECT a.id, a.cod_agent::text as cod_agent, c.name AS client_name, c.business_name
           FROM agents a
           JOIN clients c ON c.id = a.client_id
           WHERE a.is_visibilided = true
           AND NOT EXISTS (
             SELECT 1 FROM user_agents ua
             WHERE ua.cod_agent = a.cod_agent AND ua.user_id = $1
           )
           ORDER BY c.business_name`,
          [userId]
        );
        break;
      }

      case 'delete_user_agent': {
        const { userId, codAgent } = data;
        await sql.unsafe(
          `DELETE FROM user_agents WHERE user_id = $1 AND cod_agent = $2::bigint`,
          [userId, codAgent]
        );
        result = [{ success: true }];
        break;
      }

      case 'update_user_agent_ownership': {
        const { userId, codAgent, agentId } = data;
        await sql.unsafe(
          `UPDATE user_agents SET agent_id = $3::int WHERE user_id = $1 AND cod_agent = $2::bigint`,
          [userId, codAgent, agentId]
        );
        result = [{ success: true }];
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
      // Close connection on error
      if (sql) {
        try { await sql.end(); } catch { /* ignore */ }
      }
      
      lastError = error;
      
      // Check if this is a retryable error and we have attempts left
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed with retryable error, waiting ${delayMs}ms before retry:`, error);
        await sleep(delayMs);
        continue; // Try again
      }
      
      // Non-retryable error or no more attempts
      console.error('Database error (final):', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ data: null, error: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }
  
  // All retries exhausted
  console.error('All retry attempts exhausted:', lastError);
  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
  return new Response(
    JSON.stringify({ data: null, error: `Connection failed after ${MAX_RETRIES} attempts: ${errorMessage}` }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
