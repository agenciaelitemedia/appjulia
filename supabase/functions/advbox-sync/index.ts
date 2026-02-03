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

function decryptToken(encryptedToken: string): string {
  const key = Deno.env.get('ADVBOX_ENCRYPTION_KEY');
  if (!key) return encryptedToken;
  
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

interface AdvboxProcess {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  fase?: string;
  status?: string;
  responsavel?: string;
  ultima_movimentacao?: {
    id: string;
    data: string;
    texto: string;
  };
}

async function fetchAdvboxProcesses(
  apiEndpoint: string,
  apiToken: string,
  page = 1,
  limit = 100
): Promise<{ processes: AdvboxProcess[]; total: number; hasMore: boolean }> {
  const baseUrl = apiEndpoint.replace(/\/+$/, '');
  
  const response = await fetch(`${baseUrl}/processos?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Advbox API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Adapt to Advbox API response structure
  const processes = (data.data || data.processos || []).map((p: Record<string, unknown>) => ({
    id: p.id || p.processo_id,
    numero: p.numero || p.numero_processo,
    cliente_id: p.cliente_id || p.cliente?.id,
    cliente_nome: p.cliente_nome || p.cliente?.nome,
    cliente_telefone: p.cliente_telefone || p.cliente?.telefone,
    fase: p.fase || p.fase_atual,
    status: p.status,
    responsavel: p.responsavel || p.advogado_responsavel,
    ultima_movimentacao: p.ultima_movimentacao || p.movimentacao_recente,
  }));

  return {
    processes,
    total: data.total || processes.length,
    hasMore: data.hasMore || (page * limit < (data.total || 0)),
  };
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
    const { action, codAgent, integrationId } = body;

    sql = createConnection(caCerts);
    await sql`SET timezone = 'America/Sao_Paulo'`;

    switch (action) {
      case 'sync': {
        // Get integration details
        const integrations = await sql.unsafe(
          `SELECT * FROM advbox_integrations WHERE cod_agent = $1 AND is_active = true`,
          [codAgent]
        );

        if (integrations.length === 0) {
          await sql.end();
          return new Response(
            JSON.stringify({ success: false, error: 'Integração não encontrada ou inativa' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        const integration = integrations[0];
        const apiToken = decryptToken(integration.api_token);

        let totalSynced = 0;
        let newMovements = 0;
        const errors: string[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          try {
            const result = await fetchAdvboxProcesses(
              integration.api_endpoint,
              apiToken,
              page,
              100
            );

            for (const process of result.processes) {
              // Check for existing process
              const existing = await sql.unsafe(
                `SELECT id, last_movement_id FROM advbox_processes_cache 
                 WHERE agent_id = $1 AND process_id = $2`,
                [agentId, process.id]
              );

              const movementId = process.ultima_movimentacao?.id || null;
              const isNewMovement = existing.length > 0 && 
                existing[0].last_movement_id !== movementId && 
                movementId !== null;

              if (isNewMovement) {
                newMovements++;
              }

              // Upsert process
              await sql.unsafe(
                `INSERT INTO advbox_processes_cache 
                  (agent_id, integration_id, process_id, process_number, client_id, client_name, 
                   client_phone, phase, status, responsible, last_movement_id, last_movement_date, 
                   last_movement_text, full_data, cached_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
                 ON CONFLICT (agent_id, process_id) DO UPDATE SET
                   process_number = EXCLUDED.process_number,
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
                   updated_at = NOW()`,
                [
                  agentId,
                  integration.id,
                  process.id,
                  process.numero,
                  process.cliente_id,
                  process.cliente_nome,
                  process.cliente_telefone,
                  process.fase,
                  process.status,
                  process.responsavel,
                  movementId,
                  process.ultima_movimentacao?.data || null,
                  process.ultima_movimentacao?.texto || null,
                  JSON.stringify(process),
                ]
              );

              totalSynced++;
            }

            hasMore = result.hasMore;
            page++;
          } catch (error) {
            errors.push(`Página ${page}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
            hasMore = false;
          }
        }

        // Update last sync timestamp
        await sql.unsafe(
          `UPDATE advbox_integrations 
           SET last_sync_at = NOW(), 
               connection_status = 'connected',
               last_error = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [integration.id]
        );

        await sql.end();

        return new Response(
          JSON.stringify({
            success: true,
            processes_synced: totalSynced,
            new_movements: newMovements,
            errors,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_processes': {
        const { page = 1, limit = 50, phase, status, search } = body;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE agent_id = $1';
        const params: (string | number)[] = [agentId];
        let paramIndex = 2;

        if (phase) {
          whereClause += ` AND phase = $${paramIndex}`;
          params.push(phase);
          paramIndex++;
        }

        if (status) {
          whereClause += ` AND status = $${paramIndex}`;
          params.push(status);
          paramIndex++;
        }

        if (search) {
          whereClause += ` AND (client_name ILIKE $${paramIndex} OR process_number ILIKE $${paramIndex})`;
          params.push(`%${search}%`);
          paramIndex++;
        }

        const countResult = await sql.unsafe(
          `SELECT COUNT(*) as total FROM advbox_processes_cache ${whereClause}`,
          params
        );

        params.push(limit, offset);
        const processes = await sql.unsafe(
          `SELECT * FROM advbox_processes_cache ${whereClause} 
           ORDER BY cached_at DESC 
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          params
        );

        await sql.end();

        return new Response(
          JSON.stringify({
            success: true,
            data: processes,
            total: parseInt(countResult[0].total),
            page,
            limit,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_stats': {
        const stats = await sql.unsafe(
          `SELECT 
             COUNT(*) as total_processes,
             COUNT(DISTINCT client_id) as total_clients,
             MAX(cached_at) as last_cached_at
           FROM advbox_processes_cache 
           WHERE agent_id = $1`,
          [agentId]
        );

        const phaseStats = await sql.unsafe(
          `SELECT phase, COUNT(*) as count 
           FROM advbox_processes_cache 
           WHERE agent_id = $1 AND phase IS NOT NULL
           GROUP BY phase 
           ORDER BY count DESC`,
          [agentId]
        );

        await sql.end();

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              ...stats[0],
              by_phase: phaseStats,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        await sql.end();
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error) {
    if (sql) {
      try { await sql.end(); } catch { /* ignore */ }
    }
    
    console.error('Advbox sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
