import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalizes a CA certificate string into STRICT PEM blocks that Deno can load.
 */
function normalizeCaCert(input: string): string[] {
  let text = input.trim();
  text = text.replace(/\\n/g, "\n");
  text = text.replace(/\r\n/g, "\n");

  if (!text.includes("BEGIN CERTIFICATE")) {
    try {
      const decoded = atob(text);
      if (decoded.includes("BEGIN CERTIFICATE")) text = decoded;
    } catch {
      // ignore
    }
  }

  text = text
    .replace(/-----BEGIN CERTIFICATE-----\s+/g, "-----BEGIN CERTIFICATE-----\n")
    .replace(/\s+-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----")
    .replace(/-----END CERTIFICATE-----\s+/g, "-----END CERTIFICATE-----\n");

  const blocks = text.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
  );

  if (!blocks || blocks.length === 0) {
    return [];
  }

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

function createDbConnection(caCerts: string[]) {
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

  try {
    const { action, ...params } = await req.json();
    
    const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
    const UAZAPI_ADMIN_TOKEN = Deno.env.get('UAZAPI_ADMIN_TOKEN');
    const UAZAPI_WEBHOOK_URL = Deno.env.get('UAZAPI_WEBHOOK_URL');

    if (!UAZAPI_BASE_URL || !UAZAPI_ADMIN_TOKEN) {
      throw new Error('Missing UaZapi configuration (UAZAPI_BASE_URL or UAZAPI_ADMIN_TOKEN)');
    }

    console.log('UaZapi Admin action:', action);

    switch (action) {
      case 'create_instance': {
        const { agentId, instanceName, codAgent } = params;
        
        if (!agentId || !instanceName) {
          throw new Error('Missing required parameters: agentId, instanceName');
        }

        console.log('Step 1: Creating instance on UaZapi...');
        
        // Step 1: Create instance on UaZapi
        const createResponse = await fetch(`${UAZAPI_BASE_URL}/admin/instance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'admintoken': UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ name: instanceName }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('UaZapi create instance error:', errorText);
          throw new Error(`Failed to create instance: ${errorText}`);
        }

        const instanceData = await createResponse.json();
        console.log('Instance created:', instanceData.name || instanceName);
        
        // Extract token from response
        const instanceToken = instanceData.token;
        const finalInstanceName = instanceData.name || instanceName;
        
        if (!instanceToken) {
          throw new Error('No token returned from UaZapi');
        }

        console.log('Step 2: Configuring webhook...');
        
        // Step 2: Configure webhook for the new instance
        if (UAZAPI_WEBHOOK_URL) {
          const webhookResponse = await fetch(`${UAZAPI_BASE_URL}/webhook/set`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': instanceToken,
            },
            body: JSON.stringify({
              url: UAZAPI_WEBHOOK_URL,
              events: ['messages.upsert'],
              webhook_by_events: false,
              ignore_groups: true,
              ignore_status: true,
              ignore_broadcast: true,
            }),
          });

          if (!webhookResponse.ok) {
            const webhookError = await webhookResponse.text();
            console.warn('Webhook configuration warning:', webhookError);
            // Don't throw - webhook config failure shouldn't stop the process
          } else {
            console.log('Webhook configured successfully');
          }
        } else {
          console.log('No UAZAPI_WEBHOOK_URL configured, skipping webhook setup');
        }

        console.log('Step 3: Saving credentials to database...');
        
        // Step 3: Update database with connection credentials
        const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
        const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
        const sql = createDbConnection(caCerts);

        try {
          await sql.unsafe(
            `UPDATE agents 
             SET hub = 'uazapi', 
                 evo_url = $1, 
                 evo_apikey = $2, 
                 evo_instance = $3, 
                 updated_at = now()
             WHERE id = $4`,
            [UAZAPI_BASE_URL, instanceToken, finalInstanceName, agentId]
          );
          console.log('Database updated successfully');
        } finally {
          await sql.end();
        }

        return new Response(
          JSON.stringify({
            success: true,
            instanceName: finalInstanceName,
            token: instanceToken,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_instance': {
        const { instanceName, agentId } = params;
        
        if (!instanceName) {
          throw new Error('Missing required parameter: instanceName');
        }

        console.log('Deleting instance:', instanceName);
        
        // Delete instance from UaZapi
        const deleteResponse = await fetch(`${UAZAPI_BASE_URL}/admin/instance/${encodeURIComponent(instanceName)}`, {
          method: 'DELETE',
          headers: {
            'admintoken': UAZAPI_ADMIN_TOKEN,
          },
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error('UaZapi delete instance error:', errorText);
          throw new Error(`Failed to delete instance: ${errorText}`);
        }

        // Clear credentials from database if agentId provided
        if (agentId) {
          const rawCaCert = Deno.env.get('EXTERNAL_DB_CA_CERT') ?? '';
          const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
          const sql = createDbConnection(caCerts);

          try {
            await sql.unsafe(
              `UPDATE agents 
               SET hub = NULL, 
                   evo_url = NULL, 
                   evo_apikey = NULL, 
                   evo_instance = NULL, 
                   updated_at = now()
               WHERE id = $1`,
              [agentId]
            );
            console.log('Database credentials cleared');
          } finally {
            await sql.end();
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_instances': {
        const listResponse = await fetch(`${UAZAPI_BASE_URL}/admin/instances`, {
          method: 'GET',
          headers: {
            'admintoken': UAZAPI_ADMIN_TOKEN,
          },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          throw new Error(`Failed to list instances: ${errorText}`);
        }

        const instances = await listResponse.json();
        
        return new Response(
          JSON.stringify({ success: true, instances }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    console.error('UaZapi Admin error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
