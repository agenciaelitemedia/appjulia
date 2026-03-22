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
    const extensionNumber = event.extension || event.caller_id_number || event.caller || '';

    // Resolve cod_agent: metadata > direct field > lookup by extension
    let codAgent = event.metadata?.cod_agent || event.cod_agent || '';

    if (!codAgent && extensionNumber) {
      const { data: extRecord } = await supabase
        .from('phone_extensions')
        .select('cod_agent')
        .eq('api4com_ramal', extensionNumber)
        .maybeSingle();
      if (extRecord?.cod_agent) {
        codAgent = extRecord.cod_agent;
        console.log(`Resolved cod_agent=${codAgent} from extension ${extensionNumber}`);
      }
    }

    console.log(`Event: ${eventType}, callId: ${callId}, codAgent: ${codAgent}, ext: ${extensionNumber}`);

    if (eventType === 'channel-hangup' || event.hangup_cause) {
      // Complete hangup event — check if we have all data
      const duration = event.duration || event.billsec || 0;
      const recordUrl = event.record_url || event.recording_url || event.recordUrl || null;
      const cost = event.cost || event.call_price || 0;
      const hangupCause = event.hangup_cause || event.hangupCause || null;
      const startedAt = event.start_stamp || event.created_at || event.startedAt || null;
      const answeredAt = event.answer_stamp || event.answeredAt || null;
      const endedAt = event.end_stamp || event.endedAt || new Date().toISOString();
      const direction = event.direction || event.call_type || 'unknown';
      const caller = event.caller_id_number || event.from || event.caller || '';
      const called = event.destination_number || event.to || event.called || '';
      const minutePrice = event.minute_price != null ? Number(event.minute_price) : null;
      const attendantName = [event.first_name, event.last_name].filter(Boolean).join(' ').trim() || null;

      const metadata: Record<string, any> = { ...event };
      if (attendantName) metadata.attendant_name = attendantName;
      if (minutePrice != null) metadata.minute_price = minutePrice;

      const logData: Record<string, any> = {
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
        logData.call_id = String(callId);
        const { data: existing } = await supabase
          .from('phone_call_logs')
          .select('id')
          .eq('call_id', String(callId))
          .maybeSingle();

        if (existing) {
          await supabase.from('phone_call_logs').update(logData).eq('id', existing.id);
        } else {
          await supabase.from('phone_call_logs').insert(logData);
        }
      } else {
        await supabase.from('phone_call_logs').insert(logData);
      }

      // If data is incomplete (no duration or no cost), trigger incremental sync
      const dataComplete = duration > 0 || hangupCause;
      if (!dataComplete && codAgent && callId) {
        console.log('Hangup data incomplete, triggering incremental sync for callId:', callId);
        try {
          // Get config for this agent
          const { data: config } = await supabase
            .from('phone_config')
            .select('api4com_domain, api4com_token')
            .eq('cod_agent', codAgent)
            .eq('is_active', true)
            .maybeSingle();

          if (config) {
            const baseUrl = `https://${config.api4com_domain}/api/v1`;
            const headers = { 'Authorization': config.api4com_token, 'Content-Type': 'application/json' };
            const resp = await fetch(`${baseUrl}/calls?page=1`, { headers });
            if (resp.ok) {
              const callsData = await resp.json();
              const records = Array.isArray(callsData) ? callsData : (callsData?.data || []);
              const match = records.find((r: any) => String(r.id) === String(callId));
              if (match) {
                const cdrUpdate: Record<string, any> = {
                  duration_seconds: Number(match.duration ?? 0),
                  cost: Number(match.call_price ?? 0),
                  record_url: match.record_url || null,
                  hangup_cause: match.hangup_cause || hangupCause,
                  started_at: match.started_at || startedAt,
                  ended_at: match.ended_at || endedAt,
                  status: 'hangup',
                };
                const cdrMeta: Record<string, any> = { ...metadata };
                if (match.minute_price != null) cdrMeta.minute_price = Number(match.minute_price);
                const attName = [match.first_name, match.last_name].filter(Boolean).join(' ').trim();
                if (attName) cdrMeta.attendant_name = attName;
                cdrUpdate.metadata = cdrMeta;

                const { data: ex } = await supabase.from('phone_call_logs').select('id').eq('call_id', String(callId)).maybeSingle();
                if (ex) {
                  await supabase.from('phone_call_logs').update(cdrUpdate).eq('id', ex.id);
                  console.log('Enriched call log from CDR for callId:', callId);
                }
              }
            }
          }
        } catch (e) {
          console.error('Incremental sync from webhook failed (non-critical):', e);
        }
      }
    } else if (eventType === 'channel-create') {
      // Only upsert if no existing record — avoid creating partial records
      if (callId) {
        const { data: existing } = await supabase.from('phone_call_logs').select('id').eq('call_id', String(callId)).maybeSingle();
        if (!existing) {
          await supabase.from('phone_call_logs').insert({
            call_id: String(callId),
            cod_agent: codAgent || null,
            extension_number: extensionNumber,
            direction: event.direction || 'unknown',
            caller: event.caller_id_number || event.from || event.caller || '',
            called: event.destination_number || event.to || event.called || '',
            started_at: event.start_stamp || event.created_at || new Date().toISOString(),
            status: 'initiated',
            metadata: event,
          });
        }
      }
    } else if (eventType === 'channel-answer') {
      if (callId) {
        const { data: existing } = await supabase.from('phone_call_logs').select('id').eq('call_id', String(callId)).maybeSingle();
        if (existing) {
          await supabase.from('phone_call_logs').update({
            answered_at: event.answer_stamp || new Date().toISOString(),
            status: 'answered',
          }).eq('id', existing.id);
        }
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
