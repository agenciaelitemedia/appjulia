// ============================================
// UaZapi History Resume Worker
// Cron-driven worker that drains uazapi_history_items with status='pending'
// in small batches, avoiding EdgeRuntime saturation that occurs when many
// `messages:replay` events arrive at once.
//
// Each pending item carries its own `payload` (jsonb array of raw messages),
// stored at enqueue time by the webhook. The worker reprocesses one item at
// a time and updates the parent run aggregates.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchWhatsappProfile, profileToContactColumns } from "../_shared/whatsapp-profile.ts";
import { normalizeBrPhone } from "../_shared/phone-normalize.ts";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/@.*/, '').replace(/[^\d]/g, '');
}
function isGroupJid(v: unknown): boolean { return typeof v === 'string' && v.includes('@g.us'); }
function isLidJid(v: unknown): boolean { return typeof v === 'string' && v.includes('@lid'); }

function resolvePeerPhone(msg: any): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const fromMe: boolean = msg.key?.fromMe ?? msg.fromMe ?? msg.from_me ?? false;
  const ordered: unknown[] = [
    msg.sender_pn, msg.PhoneNumber, msg.phone,
    msg.chatid, msg.chatId, msg.key?.remoteJid, msg.remoteJid, msg.wa_chatid,
    fromMe ? msg.to : msg.from, msg.sender, msg.recipient,
  ];
  for (const cand of ordered) {
    if (!cand) continue;
    const raw = String(cand);
    if (isLidJid(raw) || isGroupJid(raw)) continue;
    const n = normalizePhone(raw);
    if (n && n.length >= 8 && n.length <= 13) return n;
  }
  return null;
}

function isGroupMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  const jids = [msg.key?.remoteJid, msg.remoteJid, msg.chatId, msg.chatid, msg.wa_chatid, msg.from, msg.to];
  return jids.some(isGroupJid);
}

function toSafeString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as any;
    const c = o.body ?? o.text ?? o.caption ?? o.message ?? o.conversation;
    if (typeof c === 'string') return c;
  }
  return '';
}
function extractText(msg: any): string | undefined {
  const candidates = [
    msg.content?.caption, msg.text, msg.body, msg.caption,
    msg.message?.conversation,
    msg.message?.extendedTextMessage?.text,
    msg.message?.imageMessage?.caption,
    msg.message?.videoMessage?.caption,
    msg.message?.documentMessage?.caption,
  ];
  for (const c of candidates) {
    const s = toSafeString(c).trim();
    if (s && !s.startsWith('{') && !s.startsWith('[') && s !== '[object Object]') return s;
  }
  return undefined;
}
function extractType(msg: any): string {
  const mt = (msg.mediaType || msg.messageType || msg.type || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt || msg.isPtt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg.message?.contactMessage) return 'contact';
  if (mt.includes('reaction') || msg.message?.reactionMessage) return 'reaction';
  if (mt.includes('revoked') || mt.includes('protocol')) return 'revoked';
  if ((msg.type === 'media' || mt === 'media') && msg.content?.URL) return 'image';
  return 'text';
}
function extractMediaUrl(msg: any): string | undefined {
  return msg.content?.URL || msg.content?.url
    || msg.fileURL || msg.file_url || msg.mediaUrl || msg.media?.url
    || msg.message?.imageMessage?.url
    || msg.message?.videoMessage?.url
    || msg.message?.audioMessage?.url
    || msg.message?.documentMessage?.url
    || msg.message?.stickerMessage?.url
    || undefined;
}
function toIso(rawTs: unknown): string | null {
  if (rawTs == null || rawTs === '') return null;
  const n = typeof rawTs === 'number' ? rawTs : Number(rawTs);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return d.getFullYear() > 2000 && d.getFullYear() < 2100 ? d.toISOString() : null;
}
function buildPreview(text: unknown, type: string, fileName?: string): string {
  const labels: Record<string, string> = {
    image: '📷 Imagem', video: '🎥 Vídeo', audio: '🎵 Áudio', ptt: '🎵 Áudio',
    sticker: '🏷️ Sticker', location: '📍 Localização', contact: '👤 Contato',
    reaction: '💬 Reação', revoked: '🚫 Mensagem apagada',
  };
  const t = toSafeString(text).trim();
  const safe = (t.startsWith('{') || t.startsWith('[') || t === '[object Object]') ? '' : t;
  if (type === 'document') return `📎 ${fileName || 'Documento'}`;
  if (labels[type]) return safe ? `${labels[type]}: ${safe.slice(0, 80)}` : labels[type];
  if (safe) return safe.slice(0, 120);
  return '📎 Mídia';
}

interface PendingItem {
  id: string;
  run_id: string;
  remote_jid: string;
  phone: string | null;
  payload: any[] | null;
  attempts: number;
}

async function processOneItem(supabase: any, item: PendingItem, run: any, queue: any) {
  const clientId = String(run.client_id);
  const messages: any[] = Array.isArray(item.payload) ? item.payload : [];

  // No payload stored (legacy item) — cannot recover, mark as error.
  if (messages.length === 0) {
    await supabase.from('uazapi_history_items').update({
      status: 'error',
      error: 'no_payload_stored',
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return { processed: 1, inserted: 0, duplicates: 0, contactCreated: 0, error: true };
  }

  // Resolve real phone (LID-safe)
  let phone: string | null = item.phone && !isLidJid(item.remote_jid) ? item.phone : null;
  if (!phone) {
    for (const m of messages) {
      const p = resolvePeerPhone(m);
      if (p) { phone = p; break; }
    }
  }
  if (!phone) {
    await supabase.from('uazapi_history_items').update({
      status: 'error',
      error: 'no_real_phone',
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return { processed: 1, inserted: 0, duplicates: 0, contactCreated: 0, error: true };
  }

  // Canonicaliza telefone BR (insere 9º dígito quando faltar) para evitar
  // criar contato duplicado em relação ao webhook normal, que já normaliza.
  phone = normalizeBrPhone(phone) || phone;

  const remoteJid = `${phone}@s.whatsapp.net`;
  let chatInserted = 0;
  let chatDuplicates = 0;
  let contactCreated = false;
  let chatError: string | null = null;

  try {
    const { data: existingContact } = await supabase
      .from('chat_contacts')
      .select('id, last_message_at, last_message_text, history_backfilled')
      .eq('phone', phone).eq('client_id', clientId).maybeSingle();

    const sortedMsgs = messages
      .filter((m) => !isGroupMessage(m))
      .sort((a, b) => {
        const aTs = toIso(a.messageTimestamp ?? a.timestamp) ?? '';
        const bTs = toIso(b.messageTimestamp ?? b.timestamp) ?? '';
        return aTs.localeCompare(bTs);
      });
    // Dedup é feito por external_id (constraint do chat_messages) — não filtrar por timestamp,
    // senão histórico legítimo entra como skipped e o payload é descartado.
    const filteredMsgs = sortedMsgs;
    const candidateIds = filteredMsgs.map((m) => m.key?.id ?? m.id ?? m.messageId ?? '').filter(Boolean);

    const existingIds = new Set<string>();
    if (existingContact?.id && candidateIds.length > 0) {
      const { data: existing } = await supabase.from('chat_messages')
        .select('message_id').eq('contact_id', existingContact.id).in('message_id', candidateIds);
      for (const row of existing ?? []) if (row.message_id) existingIds.add(row.message_id);
    }
    const newMsgs = filteredMsgs.filter((m) => {
      const mid = m.key?.id ?? m.id ?? m.messageId ?? '';
      return mid && !existingIds.has(mid);
    });
    chatDuplicates = candidateIds.length - newMsgs.length;

    let contactId = existingContact?.id ?? '';
    if (!existingContact) {
      const { data: inserted, error: insErr } = await supabase.from('chat_contacts').insert({
        client_id: clientId, phone, name: phone, avatar: null,
        channel_type: 'whatsapp_uazapi',
        channel_source: queue?.id ?? run.queue_id,
        remote_jid: remoteJid, is_group: false,
        history_backfilled: true, unread_count: 0,
      }).select('id').single();
      if (insErr || !inserted) {
        const { data: again } = await supabase.from('chat_contacts').select('id')
          .eq('phone', phone).eq('client_id', clientId).maybeSingle();
        if (!again?.id) throw new Error(`contact insert failed: ${insErr?.message}`);
        contactId = again.id;
      } else {
        contactId = inserted.id; contactCreated = true;
        // Enrich profile in background; does not block message insertion
        if (queue?.evo_url && queue?.evo_apikey) {
          const insertedId = inserted.id;
          void (async () => {
            try {
              const profile = await fetchWhatsappProfile(queue as any, phone);
              const cols = profileToContactColumns(profile);
              const enriched: Record<string, unknown> = {};
              if (profile.name) enriched.name = profile.name;
              if (profile.avatar) enriched.avatar = profile.avatar;
              Object.assign(enriched, cols);
              if (Object.keys(enriched).length > 0) {
                await getSupabase().from('chat_contacts').update(enriched).eq('id', insertedId);
              }
            } catch { /* non-fatal */ }
          })();
        }
      }
    }

    let conversationId: string | null = null;
    const { data: activeConv } = await supabase.from('chat_conversations')
      .select('id').eq('contact_id', contactId).eq('client_id', clientId)
      .in('status', ['pending', 'open'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (activeConv) {
      conversationId = activeConv.id;
    } else if (newMsgs.length > 0) {
      const { data: newConv } = await supabase.from('chat_conversations').insert({
        contact_id: contactId, client_id: clientId,
        queue_id: queue?.id ?? run.queue_id ?? null,
        channel: 'whatsapp_uazapi', status: 'pending', priority: 'normal',
        protocol: '', metadata: { source: 'uazapi_history_resume', run_id: run.id },
      }).select('id').single();
      if (newConv) conversationId = newConv.id;
    }

    let latestTs: string | null = existingContact?.last_message_at ?? null;
    let latestPreview: string | null = existingContact?.last_message_text ?? null;
    let latestFromHistory = false;

    // Build rows first (skip reactions), then batch insert
    type MsgMeta = { row: Record<string, unknown>; isoTs: string; text: string | undefined; type: string; fileName?: string };
    const rowsToInsert: MsgMeta[] = [];
    for (const msg of newMsgs) {
      const messageId: string = msg.key?.id ?? msg.id ?? msg.messageId ?? '';
      if (!messageId) continue;
      const fromMe: boolean = msg.key?.fromMe ?? msg.fromMe ?? msg.from_me ?? false;
      const text = extractText(msg);
      const type = extractType(msg);
      if (type === 'reaction') continue;
      const mediaUrl = extractMediaUrl(msg);
      const pushName: string = msg.pushName ?? msg.senderName ?? '';
      const isoTs = toIso(msg.messageTimestamp ?? msg.timestamp) ?? new Date().toISOString();
      rowsToInsert.push({
        row: {
          contact_id: contactId, conversation_id: conversationId, client_id: clientId,
          message_id: messageId, external_id: messageId,
          text: text ? toSafeString(text) : null, type, from_me: fromMe,
          status: 'read', media_url: mediaUrl ?? null, timestamp: isoTs,
          channel_type: 'whatsapp_uazapi',
          sender_name: fromMe ? null : (pushName || null),
          raw_payload: msg,
          metadata: { source: 'uazapi_history_resume', run_id: run.id, history: true },
        },
        isoTs, text, type,
        fileName: msg.message?.documentMessage?.fileName || msg.fileName,
      });
    }

    const BATCH_SIZE = 100;
    for (let bi = 0; bi < rowsToInsert.length; bi += BATCH_SIZE) {
      const batch = rowsToInsert.slice(bi, bi + BATCH_SIZE);
      const { error: batchErr } = await supabase.from('chat_messages').insert(batch.map((b) => b.row));
      if (!batchErr) {
        chatInserted += batch.length;
        for (const { isoTs, text, type, fileName } of batch) {
          if (!latestTs || isoTs > latestTs) {
            latestTs = isoTs;
            latestPreview = buildPreview(text, type, fileName);
            latestFromHistory = true;
          }
        }
      } else if (batchErr.code === '23505' || batchErr.message?.includes('duplicate')) {
        // Fallback one-by-one to salvage non-duplicates in mixed batch
        for (const { row, isoTs, text, type, fileName } of batch) {
          const { error: e2 } = await supabase.from('chat_messages').insert(row);
          if (!e2) {
            chatInserted++;
            if (!latestTs || isoTs > latestTs) {
              latestTs = isoTs;
              latestPreview = buildPreview(text, type, fileName);
              latestFromHistory = true;
            }
          } else if (e2.code === '23505' || e2.message?.includes('duplicate')) {
            chatDuplicates++;
          } else {
            chatError = e2.message;
          }
        }
      } else {
        chatError = batchErr.message;
      }
    }

    const updates: Record<string, unknown> = { unread_count: 0 };
    if (existingContact && !existingContact.history_backfilled) updates.history_backfilled = true;
    if (latestFromHistory && latestTs && (!existingContact?.last_message_at || latestTs > existingContact.last_message_at)) {
      updates.last_message_at = latestTs;
      updates.last_message_text = latestPreview;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('chat_contacts').update(updates).eq('id', contactId);
    }

    await supabase.from('uazapi_history_items').update({
      status: chatError ? 'error' : (chatInserted > 0 ? 'ok' : 'skipped'),
      inserted_messages: chatInserted,
      duplicate_messages: chatDuplicates,
      contact_created: contactCreated,
      conversation_created: !!conversationId,
      error: chatError,
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      // só limpa payload em sucesso real (ok). Em skipped/error mantém para reprocesso/auditoria.
      payload: chatInserted > 0 && !chatError ? null : item.payload,
    }).eq('id', item.id);

    return { processed: 1, inserted: chatInserted, duplicates: chatDuplicates, contactCreated: contactCreated ? 1 : 0, error: !!chatError };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.warn(`[uazapi-history-resume] item error id=${item.id}:`, msg);
    await supabase.from('uazapi_history_items').update({
      status: 'error',
      inserted_messages: chatInserted,
      duplicate_messages: chatDuplicates,
      error: msg,
      attempts: (item.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return { processed: 1, inserted: chatInserted, duplicates: chatDuplicates, contactCreated: 0, error: true };
  }
}

async function finalizeRunIfDone(supabase: any, runId: string) {
  // If no more pending items for this run → mark run done/partial and aggregate
  const { count: stillPending } = await supabase
    .from('uazapi_history_items')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId).eq('status', 'pending');
  if ((stillPending ?? 0) > 0) return;

  const { data: items } = await supabase
    .from('uazapi_history_items')
    .select('status, inserted_messages, duplicate_messages, contact_created')
    .eq('run_id', runId);
  const list = items ?? [];
  const totalInserted = list.reduce((a: number, b: any) => a + (b.inserted_messages || 0), 0);
  const totalDuplicates = list.reduce((a: number, b: any) => a + (b.duplicate_messages || 0), 0);
  const totalContacts = list.reduce((a: number, b: any) => a + (b.contact_created ? 1 : 0), 0);
  const processed = list.length;
  const hadErrors = list.some((b: any) => b.status === 'error');

  await supabase.from('uazapi_history_runs').update({
    status: hadErrors ? 'partial' : 'done',
    processed_chats: processed,
    inserted_messages: totalInserted,
    duplicate_messages: totalDuplicates,
    inserted_contacts: totalContacts,
    finished_at: new Date().toISOString(),
  }).eq('id', runId);
}

// Coalesced finalize: single aggregate query for all touched runs.
// Only finalizes runs that have zero remaining pending items.
async function finalizeRunsCoalesced(supabase: any, runIds: string[]) {
  if (runIds.length === 0) return;
  // 1) Buscar contagem de pending por run, em uma única query
  const { data: pendingRows } = await supabase
    .from('uazapi_history_items')
    .select('run_id')
    .in('run_id', runIds)
    .eq('status', 'pending');
  const pendingByRun = new Set<string>((pendingRows ?? []).map((r: any) => r.run_id));
  const doneRuns = runIds.filter((id) => !pendingByRun.has(id));
  if (doneRuns.length === 0) return;

  // 2) Buscar agregados de todos os runs prontos em uma única query
  const { data: items } = await supabase
    .from('uazapi_history_items')
    .select('run_id, status, inserted_messages, duplicate_messages, contact_created')
    .in('run_id', doneRuns);

  const agg = new Map<string, { inserted: number; duplicates: number; contacts: number; processed: number; hadErrors: boolean }>();
  for (const it of items ?? []) {
    const cur = agg.get(it.run_id) ?? { inserted: 0, duplicates: 0, contacts: 0, processed: 0, hadErrors: false };
    cur.inserted += it.inserted_messages || 0;
    cur.duplicates += it.duplicate_messages || 0;
    if (it.contact_created) cur.contacts += 1;
    cur.processed += 1;
    if (it.status === 'error') cur.hadErrors = true;
    agg.set(it.run_id, cur);
  }

  const nowIso = new Date().toISOString();
  // 3) Update em paralelo (1 update por run, mas todos disparados ao mesmo tempo)
  await Promise.all(
    Array.from(agg.entries()).map(([runId, a]) =>
      supabase.from('uazapi_history_runs').update({
        status: a.hadErrors ? 'partial' : 'done',
        processed_chats: a.processed,
        inserted_messages: a.inserted,
        duplicate_messages: a.duplicates,
        inserted_contacts: a.contacts,
        finished_at: nowIso,
      }).eq('id', runId)
    )
  );
}

async function drainBatch(maxItems: number, workerId: number) {
  const supabase = getSupabase();

  // Tenta usar SELECT FOR UPDATE SKIP LOCKED via RPC (suporta workers paralelos sem race)
  let items: any[] | null = null;
  let rpcFailed = false;
  try {
    const rpc = await supabase.rpc('uazapi_pick_pending_items', {
      p_worker_id: workerId,
      p_limit: maxItems,
    });
    if (rpc.error) rpcFailed = true;
    else items = (rpc.data as any[]) ?? [];
  } catch {
    rpcFailed = true;
  }

  if (rpcFailed || !items) {
    const fb = await supabase
      .from('uazapi_history_items')
      .select('id, run_id, remote_jid, phone, payload, attempts')
      .eq('status', 'pending')
      .lt('attempts', 5)
      .order('created_at', { ascending: true })
      .limit(maxItems);
    if (fb.error) {
      console.error('[uazapi-history-resume] fetch pending failed:', fb.error.message);
      return { picked: 0, processed: 0, inserted: 0 };
    }
    items = fb.data ?? [];
  }

  const list = items as PendingItem[];
  if (list.length === 0) return { picked: 0, processed: 0, inserted: 0 };

  // Cache run + queue per run_id to avoid N round-trips
  const runCache = new Map<string, any>();
  const queueCache = new Map<string, any>();

  let totalInserted = 0;
  const touchedRuns = new Set<string>();

  // Pré-carrega runs e queues distintos do lote em paralelo (1 query cada)
  const distinctRunIds = Array.from(new Set(list.map((i) => i.run_id)));
  if (distinctRunIds.length > 0) {
    const { data: runs } = await supabase
      .from('uazapi_history_runs')
      .select('*')
      .in('id', distinctRunIds);
    for (const r of runs ?? []) runCache.set(r.id, r);

    const distinctQueueIds = Array.from(new Set((runs ?? []).map((r: any) => r.queue_id).filter(Boolean)));
    if (distinctQueueIds.length > 0) {
      const { data: queues } = await supabase.from('queues')
        .select('id, client_id, name, channel_type, evo_url, evo_apikey, evo_instance')
        .in('id', distinctQueueIds);
      for (const q of queues ?? []) queueCache.set(q.id, q);
    }

    // Marca em massa runs pending → running (1 update só)
    const pendingRunIds = (runs ?? []).filter((r: any) => r.status === 'pending').map((r: any) => r.id);
    if (pendingRunIds.length > 0) {
      await supabase.from('uazapi_history_runs').update({
        status: 'running', started_at: new Date().toISOString(),
      }).in('id', pendingRunIds);
      for (const id of pendingRunIds) {
        const r = runCache.get(id); if (r) r.status = 'running';
      }
    }
  }

  // Processa items em chunks paralelos (concurrency 5)
  const CONCURRENCY = 5;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (item) => {
      const run = runCache.get(item.run_id);
      if (!run) return { inserted: 0, runId: item.run_id };
      const queue = run.queue_id ? queueCache.get(run.queue_id) : null;
      try {
        const r = await processOneItem(supabase, item, run, queue);
        return { inserted: r.inserted, runId: item.run_id };
      } catch (e) {
        console.warn('[uazapi-history-resume] chunk item failed:', (e as Error).message);
        return { inserted: 0, runId: item.run_id };
      }
    }));
    for (const r of results) {
      totalInserted += r.inserted;
      touchedRuns.add(r.runId);
    }
  }

  // Finalize coalescido: 1 query agregada para TODOS os runs tocados
  await finalizeRunsCoalesced(supabase, Array.from(touchedRuns));

  console.log(`[uazapi-history-resume] picked=${list.length} inserted=${totalInserted} runs=${touchedRuns.size}`);
  return { picked: list.length, processed: list.length, inserted: totalInserted };
}

// Loop de drain: invoca drainBatch repetidamente até esgotar pendências,
// ou estourar max_total, ou estourar loop_ms. Aproveita 25s de janela do EdgeRuntime.
async function drainLoop(opts: { batchSize: number; maxTotal: number; loopMs: number; workerId: number }) {
  const { batchSize, maxTotal, loopMs, workerId } = opts;
  const t0 = Date.now();
  let totalPicked = 0;
  let totalInserted = 0;
  let iterations = 0;

  while (totalPicked < maxTotal && (Date.now() - t0) < loopMs) {
    const r = await drainBatch(batchSize, workerId);
    iterations++;
    if (r.picked === 0) break; // nada mais para fazer
    totalPicked += r.picked;
    totalInserted += r.inserted;
  }

  return { picked: totalPicked, inserted: totalInserted, iterations, ms: Date.now() - t0 };
}

// Auto-respawn: dispara nova invocação de si mesmo (fire-and-forget) se
// ainda houver itens pending. Elimina o gap entre ticks do dispatcher.
async function maybeRespawnSelf(workerId: number, batchSize: number, maxTotal: number, loopMs: number) {
  try {
    const sb = getSupabase();
    const { count } = await sb
      .from('uazapi_history_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    const pending = count ?? 0;
    if (pending === 0) return;

    // Fan-out conservador: só respawna se houver backlog real (>100) e sempre 1 worker.
    // Múltiplos respawns geravam timeouts em cascata e disputa de locks.
    if (pending <= 100) return;
    const fanOut = 1;

    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/uazapi-history-resume`;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Distribui respawns em worker_ids diferentes do atual (cobre 0..9)
    for (let k = 0; k < fanOut; k++) {
      const respawnWorkerId = (workerId + 1 + k) % 10;
      const respawn = fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
        body: JSON.stringify({ worker_id: respawnWorkerId, batch_size: batchSize, max_total: maxTotal, loop_ms: loopMs }),
      }).then((r) => r.text()).catch((e) => console.warn('[respawn] failed:', e?.message));
      try { EdgeRuntime.waitUntil(respawn as Promise<unknown>); } catch { /* ignore */ }
    }
  } catch (e) {
    console.warn('[respawn] check failed:', (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let batchSize = 50;
    let maxTotal = 500;
    let loopMs = 25000;
    let workerId = 0;
    let force = false;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (typeof body?.batch_size === 'number') batchSize = Math.max(1, Math.min(100, body.batch_size));
        if (typeof body?.max_total === 'number') maxTotal = Math.max(1, Math.min(2000, body.max_total));
        if (typeof body?.loop_ms === 'number') loopMs = Math.max(1000, Math.min(50000, body.loop_ms));
        if (typeof body?.worker_id === 'number') workerId = Math.max(0, Math.min(99, body.worker_id));
        // legacy support
        if (typeof body?.max_items === 'number') {
          batchSize = Math.max(1, Math.min(100, body.max_items));
          maxTotal = Math.max(maxTotal, body.max_items * 5);
        }
        force = !!body?.force;
      } catch { /* empty body OK */ }
    }
    if (force) {
      // Force = single big sweep, push limits para drenar manualmente
      batchSize = Math.max(batchSize, 100);
      maxTotal = Math.max(maxTotal, 1000);
    }

    const result = await drainLoop({ batchSize, maxTotal, loopMs, workerId });
    // Auto-respawn se ainda houver pending (fire-and-forget, não bloqueia response)
    await maybeRespawnSelf(workerId, batchSize, maxTotal, loopMs);
    return respond({ ok: true, ...result, force });
  } catch (err) {
    console.error('[uazapi-history-resume] error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});