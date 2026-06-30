import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Baixa a gravação da Wavoip (https://storage.wavoip.com/{WHATSAPP_CALL_ID}) e
// salva no bucket privado `wavoip-recordings`, atualizando o log com o caminho.
// Input: { whatsapp_call_id?: string, call_log_id?: string }

const WAVOIP_STORAGE = 'https://storage.wavoip.com';
const BUCKET = 'wavoip-recordings';

function extFromContentType(ct?: string | null): string {
  if (!ct) return 'ogg';
  const c = ct.toLowerCase();
  if (c.includes('mpeg')) return 'mp3';
  if (c.includes('wav')) return 'wav';
  if (c.includes('mp4')) return 'm4a';
  if (c.includes('ogg') || c.includes('opus')) return 'ogg';
  if (c.includes('webm')) return 'webm';
  return 'ogg';
}

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
      return new Response(JSON.stringify({ error: 'log_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    const ext = extFromContentType(contentType);
    const path = `${log.client_id ?? 'unknown'}/${callId}.${ext}`;
    const buf = new Uint8Array(await res.arrayBuffer());

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: true,
    });
    if (upErr) {
      await admin.from('wavoip_call_logs').update({
        recording_status: 'error',
        metadata: { recording_error: upErr.message },
      }).eq('id', log.id);
      throw upErr;
    }

    await admin.from('wavoip_call_logs').update({
      recording_url: path,
      recording_status: 'available',
      recording_downloaded_at: new Date().toISOString(),
    }).eq('id', log.id);

    return new Response(JSON.stringify({ ok: true, status: 'available', path }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});