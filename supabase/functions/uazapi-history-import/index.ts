// ============================================
// UaZapi History Import (Background)
// Iterates job numbers, fetches /message/find,
// upserts contacts and messages. Long-running via EdgeRuntime.waitUntil.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/@.*/, '').replace(/[^\d]/g, '');
}

function extractText(msg: any): string | undefined {
  if (typeof msg.text === 'string' && msg.text) return msg.text;
  if (msg.text?.body) return msg.text.body;
  if (msg.body) return msg.body;
  if (msg.content) return typeof msg.content === 'string' ? msg.content : undefined;
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  return undefined;
}

function extractType(msg: any): string {
  const mt = (msg.messageType || msg.type || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  return 'text';
}

function extractMediaUrl(msg: any): string | undefined {
  return msg.mediaUrl
    || msg.media?.url
    || msg.fileURL
    || msg.message?.imageMessage?.url
    || msg.message?.videoMessage?.url
    || msg.message?.audioMessage?.url
    || msg.message?.documentMessage?.url
    || undefined;
}

function tsToIso(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp);
  if (!Number.isFinite(ts)) return new Date().toISOString();
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  if (d.getFullYear() <= 2000 || d.getFullYear() >= 2100) return new Date().toISOString();
  return d.toISOString();
}

async function processNumber(
  supabase: any,
  job: any,
  phone: string,
): Promise<{ messages_found: number; messages_inserted: number; contact_created: boolean; error?: string }> {
  const chatId = `${phone}@s.whatsapp.net`;
  const url = `${job.evo_url.replace(/\/$/, '')}/message/find`;

  let messages: any[] = [];
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': job.evo_token },
      body: JSON.stringify({ chatid: chatId, limit: 100, offset: 0 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { messages_found: 0, messages_inserted: 0, contact_created: false, error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }
    const data = await resp.json();
    messages = Array.isArray(data) ? data
      : Array.isArray(data?.messages) ? data.messages
      : Array.isArray(data?.data) ? data.data
      : [];
  } catch (e) {
    return { messages_found: 0, messages_inserted: 0, contact_created: false, error: (e as Error).message };
  }

  if (messages.length === 0) {
    return { messages_found: 0, messages_inserted: 0, contact_created: false };
  }

  // Upsert contact (only insert if new)
  let contactCreated = false;
  let contactId: string | null = null;
  const { data: existing } = await supabase
    .from('chat_contacts')
    .select('id')
    .eq('client_id', job.client_id)
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    contactId = existing.id;
  } else {
    // Use first message to extract a name
    const firstName = messages[0]?.pushName || messages[0]?.senderName || messages[0]?.wa_contactName || phone;
    const { data: created, error: cErr } = await supabase
      .from('chat_contacts')
      .insert({
        client_id: job.client_id,
        cod_agent: job.cod_agent,
        name: firstName,
        phone,
        remote_jid: chatId,
        channel_type: 'whatsapp',
        channel_source: 'uazapi',
        history_backfilled: true,
        unread_count: 0,
      })
      .select('id')
      .single();
    if (cErr || !created) {
      return { messages_found: messages.length, messages_inserted: 0, contact_created: false, error: `contact insert: ${cErr?.message}` };
    }
    contactId = created.id;
    contactCreated = true;
  }

  // Insert messages with idempotency on message_id
  let inserted = 0;
  for (const msg of messages) {
    try {
      const messageId = msg.id || msg.messageId || msg.key?.id;
      if (!messageId) continue;

      const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? false;
      const text = extractText(msg);
      const type = extractType(msg);
      const mediaUrl = extractMediaUrl(msg);
      const isoTs = tsToIso(msg.messageTimestamp || msg.timestamp);
      const pushName = msg.pushName || msg.senderName || msg.wa_contactName || '';

      const { error, count } = await supabase
        .from('chat_messages')
        .upsert({
          contact_id: contactId,
          client_id: job.client_id,
          message_id: messageId,
          external_id: messageId,
          text,
          type,
          from_me: fromMe,
          status: fromMe ? 'sent' : 'received',
          media_url: mediaUrl || null,
          timestamp: isoTs,
          channel_type: 'whatsapp_uazapi',
          sender_name: fromMe ? null : pushName || null,
          raw_payload: msg,
          metadata: { backfilled: true, sync_job_id: job.id },
        }, { onConflict: 'message_id', ignoreDuplicates: true, count: 'exact' });

      if (!error && (count ?? 0) > 0) inserted++;
    } catch (e) {
      console.warn('[uazapi-history-import] msg insert error:', e);
    }
  }

  // Force unread_count = 0 and mark as backfilled (covers concurrent webhooks)
  await supabase
    .from('chat_contacts')
    .update({ history_backfilled: true, unread_count: 0 })
    .eq('id', contactId);

  return { messages_found: messages.length, messages_inserted: inserted, contact_created: contactCreated };
}

async function runJob(jobId: string) {
  const supabase = getSupabase();

  const { data: job, error: jErr } = await supabase
    .from('whatsapp_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jErr || !job) {
    console.error('[uazapi-history-import] Job not found:', jobId);
    return;
  }

  const phones: string[] = (job.numbers as string[]).map(normalizePhone).filter((n) => n.length >= 8);
  const uniquePhones = Array.from(new Set(phones));

  await supabase
    .from('whatsapp_sync_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      total_numbers: uniquePhones.length,
    })
    .eq('id', jobId);

  // Pre-create pending log rows
  if (uniquePhones.length > 0) {
    const rows = uniquePhones.map((p) => ({ job_id: jobId, phone: p, status: 'pending' }));
    await supabase.from('whatsapp_sync_job_logs').upsert(rows, { onConflict: 'job_id,phone', ignoreDuplicates: true });
  }

  let totalInsertedMessages = 0;
  let totalInsertedContacts = 0;
  let totalErrors = 0;
  const BATCH = 3;

  for (let i = 0; i < uniquePhones.length; i += BATCH) {
    // Check cancel flag
    const { data: ck } = await supabase
      .from('whatsapp_sync_jobs')
      .select('cancel_requested')
      .eq('id', jobId)
      .single();
    if (ck?.cancel_requested) {
      await supabase
        .from('whatsapp_sync_jobs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', jobId);
      console.log('[uazapi-history-import] Job cancelled:', jobId);
      return;
    }

    const batch = uniquePhones.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((p) => processNumber(supabase, job, p)));

    for (let j = 0; j < batch.length; j++) {
      const phone = batch[j];
      const r = results[j];
      const status = r.error ? 'error' : (r.messages_found === 0 ? 'skipped' : 'ok');
      if (r.error) totalErrors++;
      totalInsertedMessages += r.messages_inserted;
      if (r.contact_created) totalInsertedContacts++;

      await supabase
        .from('whatsapp_sync_job_logs')
        .upsert({
          job_id: jobId,
          phone,
          status,
          messages_found: r.messages_found,
          messages_inserted: r.messages_inserted,
          contact_created: r.contact_created,
          error: r.error || null,
          processed_at: new Date().toISOString(),
        }, { onConflict: 'job_id,phone' });
    }

    await supabase
      .from('whatsapp_sync_jobs')
      .update({
        processed_numbers: Math.min(i + batch.length, uniquePhones.length),
        inserted_messages: totalInsertedMessages,
        inserted_contacts: totalInsertedContacts,
      })
      .eq('id', jobId);

    // Throttle between batches
    await new Promise((res) => setTimeout(res, 200));
  }

  const finalStatus = totalErrors === 0 ? 'done' : (totalErrors === uniquePhones.length ? 'error' : 'partial');
  await supabase
    .from('whatsapp_sync_jobs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      processed_numbers: uniquePhones.length,
      inserted_messages: totalInsertedMessages,
      inserted_contacts: totalInsertedContacts,
    })
    .eq('id', jobId);

  console.log(`[uazapi-history-import] Job ${jobId} ${finalStatus}: messages=${totalInsertedMessages} contacts=${totalInsertedContacts} errors=${totalErrors}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { job_id } = await req.json();
    if (!job_id) return respond({ error: 'job_id required' }, 400);

    // Fire-and-forget: keep processing after response
    // @ts-ignore EdgeRuntime is available in Supabase
    EdgeRuntime.waitUntil(runJob(job_id));

    return respond({ ok: true, job_id, status: 'started' });
  } catch (err) {
    console.error('[uazapi-history-import] Error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});