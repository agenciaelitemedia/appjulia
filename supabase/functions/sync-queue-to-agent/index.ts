// ============================================
// Sync Queue to Agent
// Syncs queue credentials to linked agents in external DB
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { queue_id } = await req.json();
    if (!queue_id) {
      return new Response(JSON.stringify({ error: 'queue_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch queue
    const { data: queue, error: queueError } = await supabase
      .from('queues')
      .select('*')
      .eq('id', queue_id)
      .eq('is_deleted', false)
      .single();

    if (queueError || !queue) {
      return new Response(JSON.stringify({ error: 'Queue not found', details: queueError?.message }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch linked agents
    const { data: links, error: linksError } = await supabase
      .from('queue_agent_links')
      .select('cod_agent')
      .eq('queue_id', queue_id);

    if (linksError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch agent links', details: linksError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!links || links.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: 'No agents linked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Sync credentials to each agent via db-query
    const results: Array<{ cod_agent: string; success: boolean; error?: string }> = [];

    for (const link of links) {
      try {
        // Determine which fields to update based on channel_type
        let action: string;
        let data: Record<string, unknown>;

        if (queue.channel_type === 'uazapi' || queue.hub === 'uazapi') {
          // Use existing update_agent_connection action
          // First we need the agent's internal ID - fetch via db-query
          const agentRes = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              action: 'get_agent_by_cod',
              data: { codAgent: link.cod_agent },
            }),
          });
          const agentData = await agentRes.json();
          const agentId = agentData?.data?.[0]?.id;

          if (!agentId) {
            results.push({ cod_agent: link.cod_agent, success: false, error: 'Agent not found in external DB' });
            continue;
          }

          action = 'update_agent_connection';
          data = {
            agentId,
            connectionData: {
              hub: 'uazapi',
              evo_url: queue.evo_url,
              evo_apikey: queue.evo_apikey,
              evo_instancia: queue.evo_instance,
            },
          };
        } else if (queue.channel_type === 'waba' || queue.hub === 'waba') {
          const agentRes = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              action: 'get_agent_by_cod',
              data: { codAgent: link.cod_agent },
            }),
          });
          const agentData = await agentRes.json();
          const agentId = agentData?.data?.[0]?.id;

          if (!agentId) {
            results.push({ cod_agent: link.cod_agent, success: false, error: 'Agent not found in external DB' });
            continue;
          }

          action = 'update_agent_waba_connection';
          data = {
            agentId,
            wabaId: queue.waba_id,
            wabaToken: queue.waba_token,
            wabaNumberId: queue.waba_number_id,
          };
        } else {
          // webchat/instagram don't sync to agents table
          results.push({ cod_agent: link.cod_agent, success: true, error: 'Channel type does not sync to agents' });
          continue;
        }

        const syncRes = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ action, data }),
        });
        const syncResult = await syncRes.json();

        if (syncResult.error) {
          results.push({ cod_agent: link.cod_agent, success: false, error: syncResult.error });
        } else {
          results.push({ cod_agent: link.cod_agent, success: true });
        }
      } catch (err) {
        results.push({ cod_agent: link.cod_agent, success: false, error: (err as Error).message });
      }
    }

    const synced = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    return new Response(JSON.stringify({
      success: failed.length === 0,
      synced,
      total: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-queue-to-agent] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
