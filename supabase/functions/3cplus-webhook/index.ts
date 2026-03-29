import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fixTimezone(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const s = String(ts).trim();
  if (/[+-]\d{2}:\d{2}$/.test(s) || s.endsWith('Z')) return s;
  return `${s}-03:00`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event = await req.json();
    console.log('3C+ webhook event received:', JSON.stringify(event));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3C+ event structure: { event: 'call-was-ended', data: { ... } }
    const eventType = event.event || event.type || 'unknown';
    const eventData = event.data || event;

    const callId = eventData.id ? String(eventData.id) : (eventData.call_id ? String(eventData.call_id) : null);
    const agentId = eventData.agent_id ? String(eventData.agent_id) : null;
    const extensionNumber = eventData.extension || eventData.caller || '';

    // Resolve cod_agent via threecplus_agent_id or threecplus_extension
    let codAgent: number | null = null;

    if (agentId) {
      const { data: extRecord } = await supabase
        .from('phone_extensions')
        .select('cod_agent')
        .eq('threecplus_agent_id', agentId)
        .maybeSingle();
      if (extRecord?.cod_agent) {
        codAgent = extRecord.cod_agent;
        console.log(`Resolved cod_agent=${codAgent} from threecplus_agent_id=${agentId}`);
      }
    }

    if (!codAgent && extensionNumber) {
      const { data: extRecord } = await supabase
        .from('phone_extensions')
        .select('cod_agent')
        .eq('threecplus_extension', extensionNumber)
        .maybeSingle();
      if (extRecord?.cod_agent) {
        codAgent = extRecord.cod_agent;
        console.log(`Resolved cod_agent=${codAgent} from extension ${extensionNumber}`);
      }
    }

    console.log(`Event: ${eventType}, callId: ${callId}, codAgent: ${codAgent}`);

    // Only persist on call-was-ended (equivalent to api4com channel-hangup)
    if (eventType === 'call-was-ended' || eventType === 'call.ended' || eventData.hangup_cause) {
      const duration = eventData.duration || eventData.talk_time || eventData.billsec || 0;
      const recordUrl = eventData.record_url || eventData.recording_url || null;
      const cost = eventData.cost || 0;
      const hangupCause = eventData.hangup_cause || eventData.end_reason || null;
      const startedAt = fixTimezone(eventData.started_at || eventData.created_at);
      const answeredAt = fixTimezone(eventData.answered_at || eventData.answer_stamp);
      const endedAt = fixTimezone(eventData.ended_at || eventData.finished_at) || new Date().toISOString();
      const direction = eventData.direction || eventData.call_type || 'unknown';
      const caller = eventData.from || eventData.caller || eventData.origin || '';
      const called = eventData.to || eventData.destination || eventData.phone_number || '';

      const metadata: Record<string, any> = {
        provider: '3cplus',
        ...(agentId ? { agent_id: agentId } : {}),
        ...(eventData.campaign_id ? { campaign_id: eventData.campaign_id } : {}),
        ...(eventData.metadata ? { raw_metadata: eventData.metadata } : {}),
      };

      const logData: Record<string, any> = {
        call_id: callId,
        cod_agent: codAgent || null,
        extension_number: extensionNumber,
        direction,
        caller,
        called,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: Number(duration),
        hangup_cause: hangupCause,
        record_url: recordUrl,
        cost: Number(cost) || 0,
        status: 'hangup',
        metadata,
      };
      if (answeredAt) logData.answered_at = answeredAt;

      if (callId) {
        const { error: upsertError } = await supabase
          .from('phone_call_logs')
          .upsert(logData, { onConflict: 'call_id' });
        if (upsertError) {
          console.error('Upsert error:', upsertError);
        }
      } else {
        await supabase.from('phone_call_logs').insert(logData);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('3cplus-webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
