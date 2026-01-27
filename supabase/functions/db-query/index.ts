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
  
  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let sql: ReturnType<typeof postgres> | null = null;
    
    try {
      const { action, table, data, where, select, limit, offset, orderBy } = await req.json();

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
        // Optimized query with pre-aggregated leads count
        result = await sql.unsafe(`
          SELECT 
            a.id,
            a.cod_agent,
            a.status,
            c.name AS client_name,
            c.business_name,
            ap.name AS plan_name,
            COALESCE(ap."limit", 0) AS plan_limit,
            COALESCE(leads.count, 0) AS leads_received,
            a.last_used,
            a.due_date
          FROM agents a
          JOIN clients c ON c.id = a.client_id
          LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
          LEFT JOIN (
            SELECT s.agent_id, COUNT(DISTINCT s.id) as count
            FROM sessions s
            INNER JOIN log_messages lm ON lm.session_id = s.id
            WHERE lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
              AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            GROUP BY s.agent_id
          ) leads ON leads.agent_id = a.id
          WHERE a.is_visibilided = true
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
        const rows = await sql.unsafe(
          `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
           VALUES ($1, $2, $3::bigint, now())
           RETURNING id`,
          [userId, agentId, codAgent]
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
            ua.cod_agent::text as cod_agent,
            c.name as owner_name,
            c.business_name as owner_business_name
          FROM user_agents ua
          JOIN agents a ON a.id = ua.agent_id
          JOIN clients c ON c.id = a.client_id
          WHERE ua.user_id = $1
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
              u.id, u.name, u.email, u.user_id, u.created_at,
              COUNT(ua.id)::int as agents_count
            FROM users u
            LEFT JOIN user_agents ua ON ua.user_id = u.id
            WHERE u.role = 'time'
            GROUP BY u.id
            ORDER BY u.name`
          );
        } else {
          result = await sql.unsafe(
            `SELECT 
              u.id, u.name, u.email, u.user_id, u.created_at,
              COUNT(ua.id)::int as agents_count
            FROM users u
            LEFT JOIN user_agents ua ON ua.user_id = u.id
            WHERE u.user_id = $1 AND u.role = 'time'
            GROUP BY u.id
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
        const { principalUserId } = data;
        result = await sql.unsafe(
          `SELECT ua.agent_id, ua.cod_agent::text as cod_agent, a.status, c.business_name
           FROM user_agents ua
           JOIN agents a ON a.id = ua.agent_id
           JOIN clients c ON c.id = a.client_id
           WHERE ua.user_id = $1
           ORDER BY c.business_name`,
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
        const { name, email, hashedPassword, rawPassword, principalUserId, clientId, agentIds } = data;
        
        // Insert user with role='time' and user_id pointing to principal
        const userRows = await sql.unsafe(
          `INSERT INTO users (name, email, password, remember_token, role, user_id, client_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'time', $5, $6, now(), now())
           RETURNING id, name, email`,
          [name, email, hashedPassword, rawPassword, principalUserId, clientId]
        );
        
        const newUserId = userRows[0].id;
        
        // Insert user_agents for each selected agent
        for (const agent of agentIds) {
          await sql.unsafe(
            `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
             VALUES ($1, $2, $3::bigint, now())`,
            [newUserId, agent.agentId, agent.codAgent]
          );
        }
        
        result = userRows;
        break;
      }

      case 'update_team_member': {
        const { memberId, name, principalUserId, agentIds } = data;
        
        // Update user name and principal
        await sql.unsafe(
          `UPDATE users SET name = $1, user_id = $2, updated_at = now() WHERE id = $3`,
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
