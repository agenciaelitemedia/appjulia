// ============================================
// chat-resync-timestamps
// Busca o histórico real do chat na UaZapi (POST /message/find), corrige as
// datas (timestamp/created_at) das mensagens já persistidas E importa as
// mensagens que existem no provedor mas não existem localmente.
// Nunca apaga nem reescreve conteúdo de mensagens existentes.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResyncRequest {
  queue_id?: string;
  contact_id?: string;
  phone?: string;
  client_id?: number | string;
  limit?: number;
  dry_run?: boolean;
  tolerance_seconds?: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tsToIso(raw: any): string | null {
  if (!raw) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  if (!(d.getFullYear() > 2000 && d.getFullYear() < 2100)) return null;
  return d.toISOString();
}

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '');
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
  if (typeof msg.content === 'string' && msg.content) return msg.content;
  if (msg.body) return msg.body;
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  return undefined;
}

function extractType(msg: any): string {
  const mt = String(msg.messageType || msg.mediaType || msg.type || '').toLowerCase();
  if (mt.includes('image') || msg.message?.imageMessage) return 'image';
  if (mt.includes('video') || msg.message?.videoMessage) return 'video';
  if (mt.includes('ptt') || msg.message?.audioMessage?.ptt) return 'ptt';
  if (mt.includes('audio') || msg.message?.audioMessage) return 'audio';
  if (mt.includes('document') || msg.message?.documentMessage) return 'document';
  if (mt.includes('sticker') || msg.message?.stickerMessage) return 'sticker';
  if (mt.includes('location') || msg.message?.locationMessage) return 'location';
  if (mt.includes('contact') || msg.message?.contactMessage) return 'contact';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as ResyncRequest;
    const limit = Math.min(Math.max(Number(payload.limit) || 300, 1), 1000);
    const dryRun = payload.dry_run === true;
    const toleranceMs = Math.max(Number(payload.tolerance_seconds) || 60, 5) * 1000;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Resolve contato ──
    let contact: any = null;
    if (payload.contact_id) {
      const { data } = await supabase
        .from('chat_contacts')
        .select('id, phone, client_id, name')
        .eq('id', payload.contact_id)
        .maybeSingle();
      contact = data;
    } else if (payload.phone) {
      const phone = onlyDigits(payload.phone);
      let q = supabase.from('chat_contacts').select('id, phone, client_id, name').eq('phone', phone);
      if (payload.client_id) q = q.eq('client_id', Number(payload.client_id));
      const { data } = await q.limit(1);
      contact = data?.[0] ?? null;
    }
    if (!contact) return json({ error: 'Contato não encontrado' }, 404);

    // ── Resolve fila (credenciais UaZapi) ──
    let queueId = payload.queue_id || null;
    if (!queueId) {
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('id, queue_id')
        .eq('contact_id', contact.id)
        .not('queue_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1);
      queueId = conv?.[0]?.queue_id ?? null;
    }
    if (!queueId) return json({ error: 'Fila não encontrada para este contato' }, 404);

    const { data: queue } = await supabase
      .from('queues')
      .select('id, name, channel_type, evo_url, evo_apikey')
      .eq('id', queueId)
      .maybeSingle();

    if (!queue) return json({ error: 'Fila não encontrada' }, 404);
    if (queue.channel_type !== 'uazapi' || !queue.evo_url || !queue.evo_apikey) {
      return json({ error: 'Ressincronização disponível apenas para filas UaZapi conectadas' }, 400);
    }

    // ── Busca histórico real na UaZapi (paginado) ──
    const chatid = `${onlyDigits(contact.phone)}@s.whatsapp.net`;
    const endpoint = `${String(queue.evo_url).replace(/\/$/, '')}/message/find`;
    const pageSize = Math.min(limit, 200);
    const remote: any[] = [];
    const seenRemoteIds = new Set<string>();

    for (let offset = 0; remote.length < limit; offset += pageSize) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { token: queue.evo_apikey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatid, limit: pageSize, offset }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (offset === 0) {
          return json({ error: `UaZapi respondeu ${res.status}`, details: body.slice(0, 400) }, 502);
        }
        break;
      }
      const raw = await res.json();
      const page: any[] = Array.isArray(raw) ? raw : (raw?.messages ?? raw?.data ?? []);
      if (!Array.isArray(page)) {
        if (offset === 0) return json({ error: 'Resposta inesperada da UaZapi' }, 502);
        break;
      }
      let added = 0;
      for (const m of page) {
        const id = m?.id || m?.messageid || m?.messageId || m?.key?.id;
        if (!id || seenRemoteIds.has(String(id))) continue;
        seenRemoteIds.add(String(id));
        remote.push(m);
        added++;
      }
      if (page.length < pageSize || added === 0) break;
    }

    const remoteById = new Map<string, string>();
    const remoteMsgById = new Map<string, any>();
    for (const m of remote) {
      const id = m?.id || m?.messageid || m?.messageId || m?.key?.id;
      const iso = tsToIso(m?.messageTimestamp ?? m?.timestamp);
      if (!id) continue;
      remoteMsgById.set(String(id), m);
      if (iso) remoteById.set(String(id), iso);
    }

    // ── Mensagens locais ──
    const { data: localMsgs } = await supabase
      .from('chat_messages')
      .select('id, message_id, timestamp, created_at, from_me, type, text, conversation_id')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: true })
      .limit(2000);

    const fixes: any[] = [];
    const localIds = new Set<string>();
    for (const m of localMsgs ?? []) {
      const externalId = m.message_id;
      if (!externalId) continue;
      localIds.add(String(externalId));
      const shortId = String(externalId).split(':').pop();
      if (shortId) localIds.add(shortId);
      const realIso = remoteById.get(String(externalId)) ?? remoteById.get(String(externalId).split(':').pop() || '');
      if (!realIso) continue;
      const current = m.timestamp || m.created_at;
      const diff = Math.abs(new Date(realIso).getTime() - new Date(current).getTime());
      if (diff <= toleranceMs) continue;
      fixes.push({
        id: m.id,
        message_id: externalId,
        from: current,
        to: realIso,
        diff_seconds: Math.round(diff / 1000),
        preview: (m.text || m.type || '').toString().slice(0, 60),
      });
    }

    if (!dryRun) {
      for (const f of fixes) {
        await supabase
          .from('chat_messages')
          .update({ timestamp: f.to, created_at: f.to })
          .eq('id', f.id);
      }
    }

    // ── Detecta e importa mensagens que existem no provedor mas não localmente ──
    let conversationId: string | null = null;
    {
      const { data: openConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .in('status', ['pending', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openConv) conversationId = openConv.id;
      if (!conversationId) {
        const { data: anyConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        conversationId = anyConv?.id ?? null;
      }
    }

    const missing: any[] = [];
    for (const [id, msg] of remoteMsgById.entries()) {
      if (localIds.has(id) || localIds.has(id.split(':').pop() || '')) continue;
      if (isGroupMessage(msg)) continue; // chat individual: descarta vazamento de grupo
      const iso = tsToIso(msg?.messageTimestamp ?? msg?.timestamp);
      if (!iso) continue;
      const fromMe = msg.from_me ?? msg.fromMe ?? msg.key?.fromMe ?? false;
      const text = extractText(msg);
      const type = extractType(msg);
      missing.push({
        message_id: id,
        timestamp: iso,
        from_me: !!fromMe,
        type,
        preview: (text || type || '').toString().slice(0, 60),
        row: {
          contact_id: contact.id,
          client_id: contact.client_id,
          message_id: id,
          external_id: id,
          text: text ?? null,
          type,
          from_me: !!fromMe,
          status: 'read',
          media_url: extractMediaUrl(msg) || null,
          timestamp: iso,
          created_at: iso,
          channel_type: 'whatsapp_uazapi',
          conversation_id: conversationId,
          sender_name: fromMe ? null : (msg.senderName || msg.pushName || msg.wa_contactName || null),
          raw_payload: msg,
          metadata: { resynced: true },
        },
      });
    }

    let imported = 0;
    if (!dryRun && missing.length > 0) {
      for (let i = 0; i < missing.length; i += 50) {
        const chunk = missing.slice(i, i + 50).map((m) => m.row);
        const { error } = await supabase
          .from('chat_messages')
          .upsert(chunk, { onConflict: 'message_id', ignoreDuplicates: true });
        if (!error) imported += chunk.length;
        else console.warn('[chat-resync-timestamps] import chunk error:', error.message);
      }
    }

    // ── Recalcula agregados da conversa/contato ──
    let aggregates: any = null;
    if (!dryRun && (fixes.length > 0 || imported > 0)) {
      const { data: latest } = await supabase
        .from('chat_messages')
        .select('id, timestamp, created_at, from_me, text, type, conversation_id')
        .eq('contact_id', contact.id)
        .order('timestamp', { ascending: false })
        .limit(1);
      const last = latest?.[0];

      const { data: lastCustomer } = await supabase
        .from('chat_messages')
        .select('timestamp, created_at')
        .eq('contact_id', contact.id)
        .eq('from_me', false)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (last) {
        const lastAt = last.timestamp || last.created_at;
        await supabase
          .from('chat_contacts')
          .update({ last_message_at: lastAt })
          .eq('id', contact.id);

        const { data: convs } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const convId = last.conversation_id || convs?.[0]?.id;
        if (convId) {
          const update: Record<string, any> = {
            last_message_from_me: last.from_me,
            updated_at: lastAt,
          };
          const lc = lastCustomer?.[0];
          if (lc) update.last_customer_message_at = lc.timestamp || lc.created_at;
          await supabase.from('chat_conversations').update(update).eq('id', convId);
          aggregates = { conversation_id: convId, ...update };
        }
      }
    }

    return json({
      success: true,
      dry_run: dryRun,
      contact: { id: contact.id, phone: contact.phone, name: contact.name },
      queue: { id: queue.id, name: queue.name },
      remote_messages: remote.length,
      local_messages: (localMsgs ?? []).length,
      corrected: fixes.length,
      fixes,
      imported: dryRun ? missing.length : imported,
      imported_messages: missing.map(({ message_id, timestamp, from_me, type, preview }) => ({
        message_id, timestamp, from_me, type, preview,
      })),
      aggregates,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
