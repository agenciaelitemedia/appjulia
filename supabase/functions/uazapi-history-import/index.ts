// ============================================
// UaZapi History Import (Background)
// Iterates job numbers, fetches /message/find,
// upserts contacts and messages. Long-running via EdgeRuntime.waitUntil.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchWhatsappProfile, profileToContactColumns } from "../_shared/whatsapp-profile.ts";
import { normalizeBrPhone, brPhoneVariants } from "../_shared/phone-normalize.ts";

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
  // Canonical BR-aware normalization (forces 9th digit on mobile).
  return normalizeBrPhone(raw);
}

function isGroupChatId(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@g.us');
}

function isGroupMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  return isGroupChatId(msg.key?.remoteJid)
    || isGroupChatId(msg.remoteJid)
    || isGroupChatId(msg.chatId)
    || isGroupChatId(msg.chatid)
    || isGroupChatId(msg.wa_chatid)
    || isGroupChatId(msg.from)
    || isGroupChatId(msg.to)
    || msg.isGroup === true
    || msg.wa_isGroup === true
    || msg.is_group === true
    || !!msg.groupName
    || !!msg.wa_groupName
    || !!msg.group_name
    || !!msg.participant
    || !!msg.key?.participant;
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

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'ptt', 'document', 'sticker']);

function resolveContactName(profileName: string | null, firstMsg: any, phone: string): string {
  const candidates = [
    profileName,
    firstMsg?.pushName,
    firstMsg?.senderName,
    firstMsg?.wa_contactName,
  ];
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : '';
    if (v && v !== phone && !/^\d+$/.test(v)) return v;
  }
  return phone;
}

async function processNumber(
  supabase: any,
  job: any,
  phone: string,
): Promise<{ messages_found: number; messages_inserted: number; contact_created: boolean; contact_enriched: boolean; media_downloads_queued: number; error?: string }> {
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
      return {
        messages_found: 0,
        messages_inserted: 0,
        contact_created: false,
        contact_enriched: false,
        media_downloads_queued: 0,
        error: `HTTP ${resp.status}: ${txt.slice(0, 200)}`,
      };
    }
    const data = await resp.json();
    messages = Array.isArray(data) ? data
      : Array.isArray(data?.messages) ? data.messages
      : Array.isArray(data?.data) ? data.data
      : [];
    messages = messages.filter((msg) => !isGroupMessage(msg));
  } catch (e) {
    return { messages_found: 0, messages_inserted: 0, contact_created: false, contact_enriched: false, media_downloads_queued: 0, error: (e as Error).message };
  }

  if (messages.length === 0) {
    return { messages_found: 0, messages_inserted: 0, contact_created: false, contact_enriched: false, media_downloads_queued: 0 };
  }

  // Upsert contact (only insert if new)
  let contactCreated = false;
  let contactEnriched = false;
  let contactId: string | null = null;
  const { data: existing } = await supabase
    .from('chat_contacts')
    .select('id, is_group, remote_jid')
    .eq('client_id', job.client_id)
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    if (existing.is_group || isGroupChatId(existing.remote_jid)) {
      return { messages_found: messages.length, messages_inserted: 0, contact_created: false, contact_enriched: false, media_downloads_queued: 0 };
    }
    contactId = existing.id;
  } else {
    // Fetch real lead profile via shared multi-provider helper
    const profile = await fetchWhatsappProfile(
      { channel_type: 'uazapi', evo_url: job.evo_url, evo_apikey: job.evo_token },
      phone,
    );
    const firstName = resolveContactName(profile.name, messages[0], phone);
    if ((profile.name || profile.avatar) && firstName !== phone) contactEnriched = true;

    const avatar = profile.avatar;
    const isGroup = profile.isGroup;
    const remoteJid = profile.remoteJid || chatId;
    const enrichedCols = profileToContactColumns(profile);

    if (isGroup || isGroupChatId(remoteJid)) {
      return { messages_found: messages.length, messages_inserted: 0, contact_created: false, contact_enriched: false, media_downloads_queued: 0 };
    }

    const { data: created, error: cErr } = await supabase
      .from('chat_contacts')
      .insert({
        client_id: job.client_id,
        cod_agent: job.cod_agent,
        name: firstName,
        phone,
        avatar,
        is_group: isGroup,
        remote_jid: remoteJid,
        channel_type: 'whatsapp',
        channel_source: job.queue_id || 'uazapi',
        history_backfilled: true,
        unread_count: 0,
        ...enrichedCols,
      })
      .select('id')
      .single();
    if (cErr || !created) {
      return { messages_found: messages.length, messages_inserted: 0, contact_created: false, contact_enriched: false, media_downloads_queued: 0, error: `contact insert: ${cErr?.message}` };
    }
    contactId = created.id;
    contactCreated = true;
  }

  // Ensure a conversation exists for this contact so it shows up in /chat (Pendentes)
  let conversationId: string | null = null;
  const { data: existingConv } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('client_id', job.client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convErr } = await supabase
      .from('chat_conversations')
      .insert({
        client_id: job.client_id,
        cod_agent: job.cod_agent,
        contact_id: contactId,
        channel: 'whatsapp',
        status: 'pending',
        priority: 'normal',
        protocol: '',
        queue_id: job.queue_id || null,
        metadata: { backfilled: true, sync_job_id: job.id },
      })
      .select('id')
      .single();
    if (convErr) {
      console.warn(`[uazapi-history-import] conversation insert failed phone=${phone} err=${convErr.message}`);
    } else {
      conversationId = newConv?.id || null;
    }
  }

  // Insert messages with idempotency on message_id
  let inserted = 0;
  let mediaQueued = 0;
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

      // Scope backfill dedup to the current contact to avoid global message_id collisions
      const backfillExtId = `backfill:${messageId}`;
      const backfillMessageId = `backfill:${contactId}:${messageId}`;

      const { data: existingByMessage, error: existingByMessageErr } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('contact_id', contactId)
        .in('message_id', [messageId, backfillMessageId])
        .limit(1)
        .maybeSingle();

      if (existingByMessageErr) {
        console.warn(`[uazapi-history-import] existing message lookup failed phone=${phone} msg=${messageId} err=${existingByMessageErr.message}`);
      }

      if (existingByMessage) {
        continue;
      }

      const { data: existingByExternal, error: existingByExternalErr } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('contact_id', contactId)
        .in('external_id', [messageId, backfillExtId])
        .limit(1)
        .maybeSingle();

      if (existingByExternalErr) {
        console.warn(`[uazapi-history-import] existing external lookup failed phone=${phone} msg=${messageId} err=${existingByExternalErr.message}`);
      }

      if (existingByExternal) {
        continue;
      }

      // 2) Real insert (no upsert, so we surface real errors)
      const { data: insertedRow, error: insErr } = await supabase
        .from('chat_messages')
        .insert({
          contact_id: contactId,
          conversation_id: conversationId,
          client_id: job.client_id,
          message_id: backfillMessageId,
          external_id: backfillExtId,
          text,
          type,
          from_me: fromMe,
          status: 'read',
          media_url: mediaUrl || null,
          timestamp: isoTs,
          channel_type: 'whatsapp_uazapi',
          sender_name: fromMe ? null : pushName || null,
          raw_payload: msg,
          metadata: { backfilled: true, sync_job_id: job.id, original_message_id: messageId },
        })
        .select('id')
        .single();

      if (insErr) {
        console.warn(`[uazapi-history-import] insert failed phone=${phone} msg=${messageId} err=${insErr.message}`);
        continue;
      }
      inserted++;

      // Queue media download in background (fire-and-forget)
      if (mediaUrl && MEDIA_TYPES.has(type) && insertedRow?.id) {
        mediaQueued++;
        supabase.functions.invoke('chat-media-download', {
          body: { messageId: insertedRow.id, queueId: job.queue_id },
        }).catch((e: any) =>
          console.warn(`[uazapi-history-import] media download enqueue failed msg=${messageId} err=${e?.message || e}`)
        );
      }
    } catch (e) {
      console.warn('[uazapi-history-import] msg insert error:', e);
    }
  }

  // Force unread_count = 0 and mark as backfilled (covers concurrent webhooks)
  await supabase
    .from('chat_contacts')
    .update({ history_backfilled: true, unread_count: 0 })
    .eq('id', contactId);

  return { messages_found: messages.length, messages_inserted: inserted, contact_created: contactCreated, contact_enriched: contactEnriched, media_downloads_queued: mediaQueued };
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

  const phones: string[] = (job.numbers as string[])
    .filter((n) => !isGroupChatId(n))
    .map(normalizePhone)
    .filter((n) => n.length >= 8);
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
  let totalContactsEnriched = 0;
  let totalMediaQueued = 0;
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
      if (r.contact_enriched) totalContactsEnriched++;
      totalMediaQueued += r.media_downloads_queued || 0;

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

  console.log(`[uazapi-history-import] Job ${jobId} ${finalStatus}: messages=${totalInsertedMessages} contacts=${totalInsertedContacts} enriched=${totalContactsEnriched} media_queued=${totalMediaQueued} errors=${totalErrors}`);
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