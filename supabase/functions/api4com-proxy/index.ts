import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, codAgent, ...params } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API4Com config for this agent
    const { data: config, error: configError } = await supabase
      .from('phone_config')
      .select('*')
      .eq('cod_agent', codAgent)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Configuração Api4Com não encontrada para este agente');
    }

    const baseUrl = `https://${config.api4com_domain}/api/v1`;
    const headers = {
      'Authorization': config.api4com_token,
      'Content-Type': 'application/json',
    };

    let result: any;

    switch (action) {
      case 'dial': {
        const { extension, phone, metadata } = params;
        const response = await fetch(`${baseUrl}/dialer`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ extension, phone, metadata: metadata || {} }),
        });
        result = await response.json();
        
        // Log the call
        await supabase.from('phone_call_logs').insert({
          call_id: result.call_id || result.id || null,
          cod_agent: codAgent,
          extension_number: extension,
          direction: 'outbound',
          caller: extension,
          called: phone,
          started_at: new Date().toISOString(),
          status: 'initiated',
          metadata: metadata || {},
        });
        break;
      }

      case 'list_extensions': {
        const response = await fetch(`${baseUrl}/extensions`, { headers });
        result = await response.json();
        break;
      }

      case 'create_extension': {
        const { firstName, lastName, email } = params;
        const response = await fetch(`${baseUrl}/extensions/nextAvailable`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            first_name: firstName || 'Ramal',
            last_name: lastName || codAgent,
            email_address: email || `ramal_${Date.now()}@atendejulia.com`,
            gravar_audio: 1,
          }),
        });
        result = await response.json();
        // result expected: { ramal, senha, id, domain, bina }
        break;
      }

      case 'update_extension': {
        const { extensionId, extensionData } = params;
        const response = await fetch(`${baseUrl}/extensions/${extensionId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(extensionData),
        });
        result = await response.json();
        break;
      }

      case 'delete_extension': {
        const { extensionId } = params;
        const response = await fetch(`${baseUrl}/extensions/${extensionId}`, {
          method: 'DELETE',
          headers,
        });
        result = { success: response.ok };
        break;
      }

      case 'hangup': {
        const { callId } = params;
        const response = await fetch(`${baseUrl}/calls/hangup`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ call_id: callId }),
        });
        result = await response.json();
        break;
      }

      case 'get_sip_credentials': {
        const { extensionId } = params;
        // Get extension from our DB
        const { data: ext } = await supabase
          .from('phone_extensions')
          .select('api4com_ramal, api4com_password')
          .eq('id', extensionId)
          .eq('cod_agent', codAgent)
          .single();

        if (!ext?.api4com_ramal || !ext?.api4com_password) {
          throw new Error('Credenciais SIP não encontradas para este ramal');
        }

        result = {
          domain: config.api4com_domain,
          username: ext.api4com_ramal,
          password: ext.api4com_password,
          wsUrl: `wss://${config.api4com_domain}:6443`,
        };
        break;
      }

      case 'setup_webhook': {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/api4com-webhook`;
        const response = await fetch(`${baseUrl}/integrations`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            gateway: 'atende-julia',
            webhook: true,
            webhookConstraint: {
              metadata: { gateway: 'atende-julia' }
            },
            metadata: {
              webhookUrl,
              webhookVersion: 'v1.4',
              webhookTypes: ['channel-create', 'channel-answer', 'channel-hangup']
            }
          }),
        });
        result = await response.json();
        break;
      }

      case 'get_account': {
        const response = await fetch(`${baseUrl}/accounts`, { headers });
        result = await response.json();
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('api4com-proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
