import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Baixa a gravação da Wavoip (https://storage.wavoip.com/{WHATSAPP_CALL_ID}) e
// salva no bucket privado `wavoip-recordings`, atualizando o log com o caminho.
// Input: { whatsapp_call_id?: string, call_log_id?: string }

const WAVOIP_STORAGE = 'https://storage.wavoip.com';
const BUCKET = 'wavoip-recordings';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 anos (bucket privado, workspace bloqueia público)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const inputCallId = body?.whatsapp_call_id ? String(body.whatsapp_call_id) : null;
    const inputLogId = body?.call_log_id ? String(body.call_log_id) : null;
    if (!inputCallId && !inputLogId) {
      return new Response(JSON.stringify({ error: 'missing whatsapp_call_id or call_log_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega log alvo
    const q = admin.from('wavoip_call_logs').select('id,whatsapp_call_id,client_id,recording_status,recording_url').limit(1);
    const { data: rows, error: selErr } = inputLogId
      ? await q.eq('id', inputLogId)
      : await q.eq('whatsapp_call_id', inputCallId!);
    if (selErr) throw selErr;
    const log = rows?.[0];
    if (!log) {
      // Race comum: RECORD/terminal chegou antes do CALL persistir a linha.
      // Retornar 200 evita que o SDK do cliente trate como erro fatal; cron de
      // sync irá reprocessar quando o log existir.
      return new Response(JSON.stringify({ ok: false, status: 'log_not_found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (log.recording_status === 'available' && log.recording_url) {
      return new Response(JSON.stringify({ ok: true, status: 'available', recording_url: log.recording_url }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callId = log.whatsapp_call_id || inputCallId;
    if (!callId) {
      return new Response(JSON.stringify({ error: 'no_whatsapp_call_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('wavoip_call_logs').update({ recording_status: 'downloading' }).eq('id', log.id);

    const res = await fetch(`${WAVOIP_STORAGE}/${encodeURIComponent(callId)}`);
    if (res.status === 404) {
      await admin.from('wavoip_call_logs').update({ recording_status: 'pending' }).eq('id', log.id);
      return new Response(JSON.stringify({ ok: false, status: 'pending' }), {
        status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      await admin.from('wavoip_call_logs').update({
        recording_status: 'error',
        metadata: { recording_error: `http_${res.status}` },
      }).eq('id', log.id);
      return new Response(JSON.stringify({ ok: false, error: `wavoip_http_${res.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = res.headers.get('content-type') || 'audio/ogg';
    const path = `${log.client_id ?? 'unknown'}/${callId}.mp3`;
    const buf = new Uint8Array(await res.arrayBuffer());

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      await admin.from('wavoip_call_logs').update({
        recording_status: 'error',
        metadata: { recording_error: upErr.message },
      }).eq('id', log.id);
      throw upErr;
    }

    // Bucket é privado (workspace bloqueia público). Geramos signed URL longa e salvamos direto.
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    const finalUrl = signed?.signedUrl ?? path;

    await admin.from('wavoip_call_logs').update({
      recording_url: finalUrl,
      recording_status: 'available',
      recording_downloaded_at: new Date().toISOString(),
    }).eq('id', log.id);

    // Fire-and-forget: trigger transcription (checks plan flags internally).
    try {
      fetch(`${supabaseUrl}/functions/v1/wavoip-transcribe-recording`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ call_id: log.id }),
      }).catch(() => {});
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, status: 'available', path, url: finalUrl }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});