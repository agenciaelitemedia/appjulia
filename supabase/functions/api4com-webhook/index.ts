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
    const event = await req.json();
    console.log('Webhook event received:', JSON.stringify(event));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle channel-hangup event
    if (event.event === 'channel-hangup' || event.hangup_cause) {
      const callData = {
        call_id: event.call_id || event.uuid,
        cod_agent: event.cod_agent || event.metadata?.cod_agent || '',
        extension_number: event.extension || event.caller_id_number || '',
        direction: event.direction || 'unknown',
        caller: event.caller_id_number || event.from || '',
        called: event.destination_number || event.to || '',
        started_at: event.start_stamp || event.created_at,
        answered_at: event.answer_stamp || null,
        ended_at: event.end_stamp || new Date().toISOString(),
        duration_seconds: event.duration || event.billsec || 0,
        hangup_cause: event.hangup_cause || null,
        record_url: event.record_url || event.recording_url || null,
        cost: event.cost || 0,
        metadata: event,
      };

      // Try to update existing log, or insert new one
      const { data: existing } = await supabase
        .from('phone_call_logs')
        .select('id')
        .eq('call_id', callData.call_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('phone_call_logs')
          .update(callData)
          .eq('id', existing.id);
      } else {
        await supabase.from('phone_call_logs').insert(callData);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('api4com-webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
