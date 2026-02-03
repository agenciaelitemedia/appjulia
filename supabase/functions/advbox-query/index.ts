import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Environment variables
const EXTERNAL_DB_HOST = Deno.env.get("EXTERNAL_DB_HOST");
const EXTERNAL_DB_PORT = Deno.env.get("EXTERNAL_DB_PORT");
const EXTERNAL_DB_USERNAME = Deno.env.get("EXTERNAL_DB_USERNAME");
const EXTERNAL_DB_PASSWORD = Deno.env.get("EXTERNAL_DB_PASSWORD");
const EXTERNAL_DB_DATABASE = Deno.env.get("EXTERNAL_DB_DATABASE");
const EXTERNAL_DB_CA_CERT = Deno.env.get("EXTERNAL_DB_CA_CERT");

interface CachedProcess {
  id: string;
  process_number: string;
  client_name: string;
  phase: string;
  status: string;
  responsible: string;
  last_movement_date: string;
  last_movement_text: string;
}

interface QueryResult {
  success: boolean;
  found_processes: number;
  processes: Array<{
    process_number: string;
    phase: string;
    status: string;
    last_movement: string;
  }>;
  formatted_response: string;
  query_time_ms: number;
}

// Create database pool
function createPool(): Pool {
  const caCert = EXTERNAL_DB_CA_CERT
    ? EXTERNAL_DB_CA_CERT.replace(/\\n/g, "\n")
    : undefined;

  return new Pool(
    {
      hostname: EXTERNAL_DB_HOST,
      port: parseInt(EXTERNAL_DB_PORT || "5432"),
      user: EXTERNAL_DB_USERNAME,
      password: EXTERNAL_DB_PASSWORD,
      database: EXTERNAL_DB_DATABASE,
      tls: caCert
        ? {
            enabled: true,
            caCertificates: [caCert],
          }
        : { enabled: true },
    },
    1,
    true
  );
}

// Format date to Brazilian format
function formatDateBR(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

// Generate formatted response for WhatsApp
function generateFormattedResponse(clientName: string, processes: CachedProcess[]): string {
  if (processes.length === 0) {
    return `Olá! Não encontrei nenhum processo vinculado ao seu cadastro. Por favor, entre em contato com o escritório para mais informações.`;
  }

  const firstName = clientName.split(' ')[0];
  let response = `Olá ${firstName}! `;
  
  if (processes.length === 1) {
    const p = processes[0];
    response += `Encontrei 1 processo vinculado ao seu cadastro:\n\n`;
    response += `📋 *Processo:* ${p.process_number}\n`;
    response += `📌 *Fase:* ${p.phase}\n`;
    response += `📊 *Status:* ${p.status}\n`;
    response += `👤 *Responsável:* ${p.responsible}\n`;
    response += `📅 *Última movimentação:* ${formatDateBR(p.last_movement_date)}\n`;
    response += `📝 ${p.last_movement_text}`;
  } else {
    response += `Encontrei ${processes.length} processos vinculados ao seu cadastro:\n`;
    
    processes.forEach((p, index) => {
      response += `\n*${index + 1}. Processo ${p.process_number}*\n`;
      response += `   📌 Fase: ${p.phase}\n`;
      response += `   📊 Status: ${p.status}\n`;
      response += `   📅 Última mov.: ${formatDateBR(p.last_movement_date)} - ${p.last_movement_text.substring(0, 50)}${p.last_movement_text.length > 50 ? '...' : ''}`;
    });
  }

  response += `\n\n_Para mais detalhes, entre em contato com o escritório._`;
  
  return response;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let pool: Pool | null = null;

  try {
    const body = await req.json();
    const {
      cod_agent,
      client_phone,
      query_type = 'status_processo',
      query_text = '',
    } = body;

    if (!cod_agent || !client_phone) {
      return new Response(
        JSON.stringify({ error: "cod_agent and client_phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove non-digits)
    const normalizedPhone = client_phone.replace(/\D/g, '');

    pool = createPool();
    const client = await pool.connect();

    try {
      // Check if integration exists and has queries enabled
      const integrationResult = await client.queryObject<{
        id: string;
        settings: { enable_client_queries?: boolean };
      }>(
        `SELECT id, settings 
         FROM advbox_integrations 
         WHERE agent_id = $1 AND is_active = true`,
        [agent_id]
      );

      if (integrationResult.rows.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Integration not found or inactive" 
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const integration = integrationResult.rows[0];
      
      if (integration.settings?.enable_client_queries === false) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Client queries are disabled for this integration" 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Search processes by phone in cache
      const processesResult = await client.queryObject<CachedProcess>(
        `SELECT 
          id, process_number, client_name, phase, status, 
          responsible, last_movement_date, last_movement_text
         FROM advbox_processes_cache 
         WHERE agent_id = $1 
           AND (
             client_phone = $2 
             OR client_phone LIKE '%' || $2 
             OR $2 LIKE '%' || client_phone
           )
         ORDER BY last_movement_date DESC
         LIMIT 10`,
        [agent_id, normalizedPhone]
      );

      const processes = processesResult.rows;
      const queryTimeMs = Date.now() - startTime;

      // Get client name from first process or use generic
      const clientName = processes.length > 0 
        ? processes[0].client_name 
        : 'Cliente';

      // Generate formatted response
      const formattedResponse = generateFormattedResponse(clientName, processes);

      // Log the query
      await client.queryObject(
        `INSERT INTO advbox_client_queries 
         (agent_id, integration_id, client_phone, client_name, query_text, query_type, 
          found_processes, response_text, response_sent, query_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
        [
          agent_id,
          integration.id,
          normalizedPhone,
          clientName,
          query_text,
          query_type,
          processes.length,
          formattedResponse,
          queryTimeMs,
        ]
      );

      const result: QueryResult = {
        success: true,
        found_processes: processes.length,
        processes: processes.map(p => ({
          process_number: p.process_number,
          phase: p.phase,
          status: p.status,
          last_movement: `${p.last_movement_text} em ${formatDateBR(p.last_movement_date)}`,
        })),
        formatted_response: formattedResponse,
        query_time_ms: queryTimeMs,
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } finally {
      client.release();
    }

  } catch (error) {
    console.error("advbox-query error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        query_time_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
});
