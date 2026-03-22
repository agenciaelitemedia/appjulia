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

    // Resolve cod_agent: metadata > direct field > lookup by extension
    const codAgent = event.metadata?.cod_agent
      || event.cod_agent
      || event.metadata?.gateway === 'atende-julia' ? (event.metadata?.cod_agent || '') : '';

    const extensionNumber = event.extension || event.caller_id_number || event.caller || '';

    console.log(`Event: ${eventType}, callId: ${callId}, codAgent: ${codAgent}, ext: ${extensionNumber}`);

    if (eventType === 'channel-create') {
      const callData = {
        call_id: callId,
        cod_agent: codAgent || null,
        extension_number: extensionNumber,
        direction: event.direction || 'unknown',
        caller: event.caller_id_number || event.from || event.caller || '',
        called: event.destination_number || event.to || event.called || '',
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
        await supabase.from('phone_call_logs').insert({
          call_id: callId,
          cod_agent: codAgent || null,
          extension_number: extensionNumber,
          direction: event.direction || 'unknown',
          caller: event.caller_id_number || event.from || event.caller || '',
          called: event.destination_number || event.to || event.called || '',
          started_at: event.start_stamp || event.created_at || new Date().toISOString(),
          answered_at: event.answer_stamp || new Date().toISOString(),
          status: 'answered',
          metadata: event,
        });
      }
    } else if (eventType === 'channel-hangup' || event.hangup_cause) {
      const updateData: Record<string, any> = {
        ended_at: event.end_stamp || event.endedAt || new Date().toISOString(),
        duration_seconds: event.duration || event.billsec || 0,
        hangup_cause: event.hangup_cause || event.hangupCause || null,
        record_url: event.record_url || event.recording_url || event.recordUrl || null,
        cost: event.cost || 0,
        status: 'hangup',
        metadata: event,
      };
      if (event.answer_stamp || event.answeredAt) {
        updateData.answered_at = event.answer_stamp || event.answeredAt;
      }

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
          cod_agent: codAgent || null,
          extension_number: extensionNumber,
          direction: event.direction || 'unknown',
          caller: event.caller_id_number || event.from || event.caller || '',
          called: event.destination_number || event.to || event.called || '',
          started_at: event.start_stamp || event.created_at || event.startedAt || new Date().toISOString(),
          ...updateData,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('api4com-webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
