// ============================================
// chat-resync-timestamps
// Busca o histórico real do chat na UaZapi (POST /message/find) e corrige
// APENAS as datas (timestamp/created_at) das mensagens já persistidas,
// além de recalcular os agregados da conversa/contato.
// Nunca cria, apaga ou reescreve conteúdo de mensagens.
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

    // ── Busca histórico real na UaZapi ──
    const chatid = `${onlyDigits(contact.phone)}@s.whatsapp.net`;
    const res = await fetch(`${String(queue.evo_url).replace(/\/$/, '')}/message/find`, {
      method: 'POST',
      headers: { token: queue.evo_apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatid, limit }),
    });
    if (!res.ok) {
      const body = await res.text();
      return json({ error: `UaZapi respondeu ${res.status}`, details: body.slice(0, 400) }, 502);
    }
    const raw = await res.json();
    const remote: any[] = Array.isArray(raw) ? raw : (raw?.messages ?? raw?.data ?? []);
    if (!Array.isArray(remote)) return json({ error: 'Resposta inesperada da UaZapi' }, 502);

    const remoteById = new Map<string, string>();
    for (const m of remote) {
      const id = m?.id || m?.messageid || m?.messageId || m?.key?.id;
      const iso = tsToIso(m?.messageTimestamp ?? m?.timestamp);
      if (id && iso) remoteById.set(String(id), iso);
    }

    // ── Mensagens locais ──
    const { data: localMsgs } = await supabase
      .from('chat_messages')
      .select('id, message_id, timestamp, created_at, from_me, type, text, conversation_id')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: true })
      .limit(2000);

    const fixes: any[] = [];
    for (const m of localMsgs ?? []) {
      const externalId = m.message_id;
      if (!externalId) continue;
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

    // ── Recalcula agregados da conversa/contato ──
    let aggregates: any = null;
    if (!dryRun && fixes.length > 0) {
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
            last_message_at: lastAt,
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
      aggregates,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
