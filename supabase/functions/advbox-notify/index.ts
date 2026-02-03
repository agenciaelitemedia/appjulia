import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

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
const N8N_HUB_SEND_URL = Deno.env.get("N8N_HUB_SEND_URL");

// Template variables that can be replaced
type TemplateVariables = {
  client_name?: string;
  process_number?: string;
  movement_text?: string;
  movement_date?: string;
  phase?: string;
  responsible?: string;
  law_firm_name?: string;
};

// Render template by replacing placeholders with values
function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replaceAll(placeholder, value || '');
  }
  
  return result;
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

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let pool: Pool | null = null;

  try {
    const body = await req.json();
    const {
      cod_agent,
      rule_id,
      process_id,
      recipient_phone,
      variables,
      log_id, // For resending failed notifications
    } = body;

    if (!cod_agent || !recipient_phone) {
      return new Response(
        JSON.stringify({ error: "cod_agent and recipient_phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!N8N_HUB_SEND_URL) {
      return new Response(
        JSON.stringify({ error: "N8N_HUB_SEND_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    pool = createPool();
    const client = await pool.connect();

    try {
      let messageText: string;
      let integrationId: string | null = null;

      // If resending, get original log data
      if (log_id) {
        const logResult = await client.queryObject<{
          integration_id: string;
          message_text: string;
          process_id: string;
        }>(
          `SELECT integration_id, message_text, process_id 
           FROM advbox_notification_logs 
           WHERE id = $1`,
          [log_id]
        );

        if (logResult.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: "Log not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        messageText = logResult.rows[0].message_text;
        integrationId = logResult.rows[0].integration_id;
      } else {
        // Get rule template and integration
        if (rule_id) {
          const ruleResult = await client.queryObject<{
            integration_id: string;
            message_template: string;
          }>(
            `SELECT integration_id, message_template 
             FROM advbox_notification_rules 
             WHERE id = $1 AND is_active = true`,
            [rule_id]
          );

          if (ruleResult.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: "Rule not found or inactive" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          integrationId = ruleResult.rows[0].integration_id;
          messageText = renderTemplate(ruleResult.rows[0].message_template, variables || {});
        } else {
          // Direct message (no rule)
          messageText = variables?.movement_text || "Notificação do Advbox";
          
          // Get integration
          const intResult = await client.queryObject<{ id: string }>(
            `SELECT id FROM advbox_integrations WHERE cod_agent = $1 AND is_active = true`,
            [cod_agent]
          );
          
          if (intResult.rows.length > 0) {
            integrationId = intResult.rows[0].id;
          }
        }
      }

      // Create notification log (pending status)
      const insertResult = await client.queryObject<{ id: string }>(
        `INSERT INTO advbox_notification_logs 
         (agent_id, integration_id, rule_id, process_id, recipient_phone, message_text, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [agent_id, integrationId, rule_id || null, process_id || null, recipient_phone, messageText]
      );

      const notificationLogId = insertResult.rows[0].id;

      // Send via n8n Hub
      let sendSuccess = false;
      let sendError: string | null = null;
      let whatsappMessageId: string | null = null;
      let whatsappResponse: Record<string, unknown> | null = null;

      try {
        const n8nResponse = await fetch(N8N_HUB_SEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: recipient_phone,
            message: messageText,
            agent_id: agent_id,
            source: "advbox_notify",
          }),
        });

        const n8nResult = await n8nResponse.json();
        
        if (n8nResponse.ok && n8nResult.success) {
          sendSuccess = true;
          whatsappMessageId = n8nResult.message_id || null;
          whatsappResponse = n8nResult;
        } else {
          sendError = n8nResult.error || "Failed to send via n8n";
        }
      } catch (e) {
        sendError = e instanceof Error ? e.message : "Unknown error sending notification";
      }

      // Update log with result
      await client.queryObject(
        `UPDATE advbox_notification_logs 
         SET status = $1, sent_at = $2, error_message = $3, whatsapp_message_id = $4, whatsapp_response = $5
         WHERE id = $6`,
        [
          sendSuccess ? 'sent' : 'failed',
          sendSuccess ? new Date().toISOString() : null,
          sendError,
          whatsappMessageId,
          whatsappResponse ? JSON.stringify(whatsappResponse) : null,
          notificationLogId,
        ]
      );

      return new Response(
        JSON.stringify({
          success: sendSuccess,
          log_id: notificationLogId,
          message_id: whatsappMessageId,
          error: sendError,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } finally {
      client.release();
    }

  } catch (error) {
    console.error("advbox-notify error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
});
