import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { getMessagePreview } from '@/lib/chat/messagePreview';

export interface NoResponsePreviewItem {
  conversationId: string;
  leadName: string;
  leadPhone: string;
  lastCustomerMessageAt: string;
  dueAt: string;
  eligible: boolean;
  lastMessagePreview: string;
  lastMessageFromMe: boolean;
  lastMessageAt: string | null;
}

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Prévia do gatilho "Cliente parou de responder" — usa exatamente os mesmos
 * filtros do alert-notifications-cron para mostrar quando cada lead vence.
 */
export function useNoResponsePreview(codAgent: string | null, minutes: number) {
  const safeMinutes = Math.max(1, Number(minutes) || 30);

  return useQuery({
    queryKey: ['alerts', 'no-response-preview', codAgent, safeMinutes],
    enabled: !!codAgent,
    staleTime: 30_000,
    queryFn: async (): Promise<NoResponsePreviewItem[]> => {
      const now = Date.now();
      const floor = new Date(now - WINDOW_MS).toISOString();

      const { data: convs, error } = await (supabase as any)
        .from('chat_conversations')
        .select('id, contact_id, last_customer_message_at, last_message_from_me, status')
        .eq('cod_agent', codAgent)
        .eq('last_message_from_me', true)
        .not('last_customer_message_at', 'is', null)
        .gte('last_customer_message_at', floor)
        .neq('status', 'closed')
        .order('last_customer_message_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (convs ?? []) as any[];
      if (rows.length === 0) return [];

      const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))];
      const { data: contacts } = await (supabase as any)
        .from('chat_contacts')
        .select('id, phone, name')
        .in('id', contactIds);
      const byId = new Map((contacts ?? []).map((c: any) => [c.id, c]));

      // Última mensagem (não interna) de cada conversa — chat_conversations não
      // guarda o texto da última mensagem.
      const convIds = rows.map((r) => r.id);
      const { data: msgs } = await (supabase as any)
        .from('chat_messages')
        .select('conversation_id, text, caption, file_name, type, from_me, timestamp, internal_note')
        .in('conversation_id', convIds)
        .order('timestamp', { ascending: false })
        .limit(Math.max(convIds.length * 10, 200));

      const lastMsg = new Map<string, any>();
      for (const m of (msgs ?? []) as any[]) {
        if (m.internal_note) continue;
        if (!lastMsg.has(m.conversation_id)) lastMsg.set(m.conversation_id, m);
      }

      const out: NoResponsePreviewItem[] = [];
      const seen = new Set<string>();
      for (const conv of rows) {
        const contact = byId.get(conv.contact_id) as any;
        const phone = String(contact?.phone ?? '').replace(/\D/g, '');
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);

        const lastCustomer = String(conv.last_customer_message_at);
        const dueMs = new Date(lastCustomer).getTime() + safeMinutes * 60_000;
        const m = lastMsg.get(conv.id);

        out.push({
          conversationId: conv.id,
          leadName: String(contact?.name ?? '') || 'Sem nome',
          leadPhone: phone,
          lastCustomerMessageAt: lastCustomer,
          dueAt: new Date(dueMs).toISOString(),
          eligible: dueMs <= now,
          lastMessagePreview: m
            ? getMessagePreview({ type: m.type, text: m.text, caption: m.caption, file_name: m.file_name })
            : '—',
          lastMessageFromMe: !!m?.from_me,
          lastMessageAt: m?.timestamp ?? null,
        });
      }

      out.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      return out;
    },
  });
}
