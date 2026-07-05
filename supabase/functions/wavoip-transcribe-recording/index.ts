// ============================================
// Wavoip: transcribe a call recording and generate a compact summary.
// Body: { call_id: string, force?: boolean }
// - Only runs when the client's active Wavoip plan has the "transcription"
//   feature flag enabled. Summary requires "recording_summary" flag.
// - Idempotent: skips when already ok unless force=true.
// - Downloads the recording from the private bucket `wavoip-recordings`,
//   transcribes via Lovable AI Gateway (openai/gpt-4o-mini-transcribe),
//   post-processes into "Atendente:/Cliente:" dialog format via Gemini,
//   and stores results in wavoip_call_logs.
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveAI, providerHeaders } from '../_shared/aiGateway.ts';
import { logAIUsage } from '../_shared/aiUsageLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'wavoip-recordings';
const STT_ENDPOINT = 'https://ai.gateway.lovable.dev/v1/audio/transcriptions';
const LOVABLE_CHAT = 'https://ai.gateway.lovable.dev/v1/chat/completions';

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function hasFeature(features: unknown, key: string): boolean {
  if (!features) return false;
  if (Array.isArray(features)) return (features as unknown[]).includes(key);
  if (typeof features === 'object') {
    // deno-lint-ignore no-explicit-any
    const v = (features as any)[key];
    return v === true || v === 'true' || v === 1 || v === '1';
  }
  return false;
}

// Extract storage path from either a raw path or a signed URL that points at
// the wavoip-recordings bucket. We always upload with `{client_id}/{callId}.mp3`.
function extractStoragePath(recordingUrl: string): string | null {
  if (!recordingUrl) return null;
  if (!recordingUrl.startsWith('http')) return recordingUrl;
  const marker = `/object/sign/${BUCKET}/`;
  const idx = recordingUrl.indexOf(marker);
  if (idx >= 0) {
    const after = recordingUrl.substring(idx + marker.length);
    return after.split('?')[0];
  }
  const pub = `/object/public/${BUCKET}/`;
  const idx2 = recordingUrl.indexOf(pub);
  if (idx2 >= 0) return recordingUrl.substring(idx2 + pub.length).split('?')[0];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const callId: string | undefined = body?.call_id;
    const force: boolean = body?.force === true;
    if (!callId) return ok({ ok: false, reason: 'bad_request', error: 'call_id required' });

    // 1) Load call log
    const { data: log, error: logErr } = await supabase
      .from('wavoip_call_logs')
      .select('id, client_id, recording_url, recording_status, transcription_status, transcription_text, transcription_summary, duration_seconds')
      .eq('id', callId)
      .maybeSingle();
    if (logErr || !log) return ok({ ok: false, reason: 'not_found' });

    if (log.recording_status !== 'available' || !log.recording_url) {
      return ok({ ok: false, reason: 'no_recording' });
    }

    if (!force && log.transcription_status === 'ok' && log.transcription_text) {
      return ok({ ok: true, status: 'ok', skipped: 'already_transcribed' });
    }

    if (!force && log.transcription_status === 'processing') {
      return ok({ ok: false, reason: 'already_processing' });
    }

    // 2) Verify plan flags
    let allowTranscription = false;
    let allowSummary = false;
    if (log.client_id != null) {
      const { data: upRows } = await supabase
        .from('wavoip_user_plans')
        .select('plan_id')
        .eq('client_id', log.client_id)
        .eq('is_active', true)
        .order('activated_at', { ascending: false })
        .limit(1);
      const planId = upRows?.[0]?.plan_id;
      if (planId) {
        const { data: plan } = await supabase
          .from('wavoip_plans')
          .select('features')
          .eq('id', planId)
          .maybeSingle();
        allowTranscription = hasFeature(plan?.features, 'transcription');
        allowSummary = hasFeature(plan?.features, 'recording_summary');
      }
    }
    if (!allowTranscription) {
      await supabase.from('wavoip_call_logs').update({
        transcription_status: 'disabled',
        transcription_error: null,
      }).eq('id', log.id);
      return ok({ ok: false, reason: 'plan_disabled' });
    }

    // 3) Mark processing
    await supabase.from('wavoip_call_logs').update({
      transcription_status: 'processing',
      transcription_error: null,
    }).eq('id', log.id);

    // 4) Download recording bytes from storage
    const path = extractStoragePath(log.recording_url);
    let audioBuf: Uint8Array | null = null;
    if (path) {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
      if (dlErr || !blob) {
        await markFailed(supabase, log.id, 'download_failed');
        return ok({ ok: false, reason: 'download_failed', error: dlErr?.message });
      }
      audioBuf = new Uint8Array(await blob.arrayBuffer());
    } else {
      // Fallback: fetch signed URL directly.
      const r = await fetch(log.recording_url);
      if (!r.ok) {
        await markFailed(supabase, log.id, 'download_failed');
        return ok({ ok: false, reason: 'download_failed', status: r.status });
      }
      audioBuf = new Uint8Array(await r.arrayBuffer());
    }
    if (!audioBuf || audioBuf.byteLength < 1024) {
      await markFailed(supabase, log.id, 'empty_recording');
      return ok({ ok: false, reason: 'empty_recording' });
    }

    // 5) Resolve STT model + prompt
    const stt = await resolveAI(supabase, 'wavoip_transcription', 'openai/gpt-4o-mini-transcribe');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY') ?? '';
    if (!lovableKey) {
      await markFailed(supabase, log.id, 'no_api_key');
      return ok({ ok: false, reason: 'no_api_key' });
    }

    // 6) Call STT via Lovable gateway
    const form = new FormData();
    // Recording was uploaded with contentType audio/mpeg (see wavoip-fetch-recording),
    // so name it as mp3 for the model to infer the format.
    form.append('file', new Blob([audioBuf], { type: 'audio/mpeg' }), 'recording.mp3');
    form.append('model', stt.model);
    form.append('language', 'pt');
    const sttStarted = Date.now();
    const sttResp = await fetch(STT_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}` },
      body: form,
    });
    const sttMs = Date.now() - sttStarted;
    if (!sttResp.ok) {
      const errTxt = await sttResp.text().catch(() => '');
      console.warn(`[wavoip-transcribe-recording] STT ${sttResp.status}: ${errTxt}`);
      await markFailed(supabase, log.id, `stt_${sttResp.status}`);
      await logAIUsage(supabase, {
        client_id: log.client_id,
        feature: 'wavoip_transcription',
        provider: 'lovable',
        endpoint: STT_ENDPOINT,
        model: stt.model,
        status: 'failed',
        duration_ms: sttMs,
        error_reason: `stt_${sttResp.status}`,
        audio_seconds: log.duration_seconds,
        context: { call_id: log.id },
      });
      return ok({ ok: false, reason: `stt_${sttResp.status}` });
    }
    const sttData = await sttResp.json();
    const rawText: string = (sttData?.text ?? '').toString().trim();
    if (!rawText) {
      await markFailed(supabase, log.id, 'empty_transcript');
      return ok({ ok: false, reason: 'empty_transcript' });
    }

    await logAIUsage(supabase, {
      client_id: log.client_id,
      feature: 'wavoip_transcription',
      provider: 'lovable',
      endpoint: STT_ENDPOINT,
      model: stt.model,
      status: 'ok',
      duration_ms: sttMs,
      usage: sttData?.usage ?? {},
      audio_seconds: log.duration_seconds,
      context: { call_id: log.id, chars: rawText.length },
    });

    // 7) Convert to Atendente/Cliente dialog via chat LLM
    const dialogPrompt = stt.prompt ??
      'Você é um transcritor pt-BR de chamadas telefônicas entre um Atendente (operador do escritório) e um Cliente. Reescreva a transcrição a seguir como um DIÁLOGO alternando estritamente linhas no formato "Atendente: ..." e "Cliente: ...". Não invente informações; mantenha o conteúdo original. Devolva APENAS o diálogo.';
    const dialogText = await callChat(lovableKey, 'google/gemini-2.5-flash', [
      { role: 'system', content: dialogPrompt },
      { role: 'user', content: `Transcrição bruta:\n\n${rawText}` },
    ]) ?? rawText;

    // 8) Summary (only when plan allows)
    let summary: string | null = null;
    if (allowSummary) {
      const sum = await resolveAI(supabase, 'wavoip_call_summary', 'google/gemini-2.5-flash');
      const summaryPrompt = sum.prompt ??
        'Você é um analista de atendimento. Gere um RESUMO OBJETIVO e COMPACTO em pt-BR da chamada transcrita: 1 frase inicial em **negrito** com o motivo do contato e até 5 bullets curtos cobrindo pedidos, decisões e próximos passos. Não invente.';
      summary = await callChat(lovableKey, sum.model, [
        { role: 'system', content: summaryPrompt },
        { role: 'user', content: dialogText },
      ]);
    }

    // 9) Persist
    await supabase.from('wavoip_call_logs').update({
      transcription_status: 'ok',
      transcription_text: dialogText,
      transcription_summary: summary,
      transcription_error: null,
      transcription_generated_at: new Date().toISOString(),
    }).eq('id', log.id);

    return ok({ ok: true, status: 'ok', text: dialogText, summary });
  } catch (err) {
    console.error('[wavoip-transcribe-recording] error', err);
    return ok({ ok: false, reason: 'exception', error: String((err as Error)?.message ?? err) });
  }
});

// deno-lint-ignore no-explicit-any
async function markFailed(supabase: any, id: string, reason: string) {
  try {
    await supabase.from('wavoip_call_logs').update({
      transcription_status: 'failed',
      transcription_error: reason,
      transcription_generated_at: new Date().toISOString(),
    }).eq('id', id);
  } catch (_e) { /* ignore */ }
}

async function callChat(
  key: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string | null> {
  try {
    const resp = await fetch(LOVABLE_CHAT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...providerHeaders('lovable'),
      },
      body: JSON.stringify({ model, messages }),
    });
    if (!resp.ok) {
      console.warn(`[wavoip-transcribe-recording] chat ${resp.status}:`, await resp.text().catch(() => ''));
      return null;
    }
    const data = await resp.json();
    const txt = data?.choices?.[0]?.message?.content?.toString().trim();
    return txt || null;
  } catch (e) {
    console.warn('[wavoip-transcribe-recording] chat exception', e);
    return null;
  }
}