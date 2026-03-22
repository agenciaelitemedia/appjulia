import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Append -03:00 (Brasília) to naive timestamps from Api4Com
function fixTimezone(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const s = String(ts).trim();
  // Already has timezone info
  if (/[+-]\d{2}:\d{2}$/.test(s) || s.endsWith('Z')) return s;
  // Naive timestamp — assume Brasília
  return `${s}-03:00`;
}

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
      // Only process hangup events — this is the only webhook event that persists data
      const duration = event.duration || event.billsec || 0;
      const recordUrl = event.record_url || event.recording_url || event.recordUrl || null;
      const cost = event.cost || event.call_price || 0;
      const hangupCause = event.hangup_cause || event.hangupCause || null;
      const startedAt = fixTimezone(event.start_stamp || event.created_at || event.startedAt);
      const answeredAt = fixTimezone(event.answer_stamp || event.answeredAt);
      const endedAt = fixTimezone(event.end_stamp || event.endedAt) || new Date().toISOString();
      const direction = event.direction || event.call_type || 'unknown';
      const caller = event.caller_id_number || event.from || event.caller || '';
      const called = event.destination_number || event.to || event.called || '';
      const minutePrice = event.minute_price != null ? Number(event.minute_price) : null;
      const attendantName = [event.first_name, event.last_name].filter(Boolean).join(' ').trim() || null;

      const metadata: Record<string, any> = { ...event };
      if (attendantName) metadata.attendant_name = attendantName;
      if (event.metadata?.origin) metadata.origin = event.metadata.origin;
      if (event.metadata?.whatsapp_number) metadata.whatsapp_number = event.metadata.whatsapp_number;
      if (minutePrice != null) metadata.minute_price = minutePrice;

      const logData: Record<string, any> = {
        call_id: callId ? String(callId) : null,
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

      // Check if we have complete data
      const dataComplete = (duration > 0 || hangupCause) && callId;

      if (callId) {
        // Use upsert with onConflict to prevent duplicates (UNIQUE constraint on call_id)
        const { error: upsertError } = await supabase
          .from('phone_call_logs')
          .upsert(logData, { onConflict: 'call_id' });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
        }
      } else {
        // No call_id — just insert (rare case)
        await supabase.from('phone_call_logs').insert(logData);
      }

      // If data is incomplete, trigger incremental sync for this specific call
      if (!dataComplete && codAgent && callId) {
        console.log('Hangup data incomplete, triggering incremental sync for callId:', callId);
        try {
          const { data: config } = await supabase
            .from('phone_config')
            .select('api4com_domain, api4com_token')
            .eq('cod_agent', codAgent)
            .eq('is_active', true)
            .maybeSingle();

          if (config) {
            const apiBaseUrl = `https://${config.api4com_domain}/api/v1`;
            const apiHeaders = { 'Authorization': config.api4com_token, 'Content-Type': 'application/json' };
            const resp = await fetch(`${apiBaseUrl}/calls?page=1`, { headers: apiHeaders });
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
                  started_at: fixTimezone(match.started_at) || startedAt,
                  ended_at: fixTimezone(match.ended_at) || endedAt,
                  status: 'hangup',
                };
                if (match.answer_stamp || match.answeredAt) {
                  cdrUpdate.answered_at = fixTimezone(match.answer_stamp || match.answeredAt);
                }
                const cdrMeta: Record<string, any> = { ...metadata };
                if (match.minute_price != null) cdrMeta.minute_price = Number(match.minute_price);
                const attName = [match.first_name, match.last_name].filter(Boolean).join(' ').trim();
                if (attName) cdrMeta.attendant_name = attName;
                cdrUpdate.metadata = cdrMeta;

                await supabase.from('phone_call_logs')
                  .update(cdrUpdate)
                  .eq('call_id', String(callId));
                console.log('Enriched call log from CDR for callId:', callId);
              }
            }
          }
        } catch (e) {
          console.error('Incremental sync from webhook failed (non-critical):', e);
        }
      }
    }
    // channel-create and channel-answer are ignored — no partial records

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
