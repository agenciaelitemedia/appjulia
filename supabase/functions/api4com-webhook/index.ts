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

    const callId = event.call_id || event.uuid || event.id;
    const eventType = event.event || event.eventType || (event.hangup_cause ? 'channel-hangup' : 'unknown');
    const codAgent = event.cod_agent || event.metadata?.cod_agent || '';

    if (eventType === 'channel-create') {
      // Call initiated — insert new record
      const callData = {
        call_id: callId,
        cod_agent: codAgent,
        extension_number: event.extension || event.caller_id_number || '',
        direction: event.direction || 'unknown',
        caller: event.caller_id_number || event.from || '',
        called: event.destination_number || event.to || '',
        started_at: event.start_stamp || event.created_at || new Date().toISOString(),
        status: 'initiated',
        metadata: event,
      };

      const { data: existing } = await supabase
        .from('phone_call_logs')
        .select('id')
        .eq('call_id', callId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('phone_call_logs').insert(callData);
      }
    } else if (eventType === 'channel-answer') {
      // Call answered — update existing record
      const { data: existing } = await supabase
        .from('phone_call_logs')
        .select('id')
        .eq('call_id', callId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('phone_call_logs')
          .update({
            answered_at: event.answer_stamp || new Date().toISOString(),
            status: 'answered',
          })
          .eq('id', existing.id);
      } else {
        // If we missed the create event, insert with answered status
        await supabase.from('phone_call_logs').insert({
          call_id: callId,
          cod_agent: codAgent,
          extension_number: event.extension || event.caller_id_number || '',
          direction: event.direction || 'unknown',
          caller: event.caller_id_number || event.from || '',
          called: event.destination_number || event.to || '',
          started_at: event.start_stamp || event.created_at,
          answered_at: event.answer_stamp || new Date().toISOString(),
          status: 'answered',
          metadata: event,
        });
      }
    } else if (eventType === 'channel-hangup' || event.hangup_cause) {
      // Call ended — update or insert
      const updateData: Record<string, any> = {
        ended_at: event.end_stamp || new Date().toISOString(),
        duration_seconds: event.duration || event.billsec || 0,
        hangup_cause: event.hangup_cause || null,
        record_url: event.record_url || event.recording_url || null,
        cost: event.cost || 0,
        status: 'hangup',
        metadata: event,
      };
      if (event.answer_stamp) updateData.answered_at = event.answer_stamp;

      const { data: existing } = await supabase
        .from('phone_call_logs')
        .select('id')
        .eq('call_id', callId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('phone_call_logs')
          .update(updateData)
          .eq('id', existing.id);
      } else {
        await supabase.from('phone_call_logs').insert({
          call_id: callId,
          cod_agent: codAgent,
          extension_number: event.extension || event.caller_id_number || '',
          direction: event.direction || 'unknown',
          caller: event.caller_id_number || event.from || '',
          called: event.destination_number || event.to || '',
          started_at: event.start_stamp || event.created_at,
          ...updateData,
        });
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
