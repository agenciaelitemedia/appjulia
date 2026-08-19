import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useJuliaAgents } from '../extend/agents';
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

export type NoResponseScope = 'agent' | 'office' | 'none';

export interface NoResponsePreviewResult {
  items: NoResponsePreviewItem[];
  scope: NoResponseScope;
}

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Prévia do gatilho "Cliente parou de responder" — usa exatamente os mesmos
 * filtros do alert-notifications-cron para mostrar quando cada lead vence.
 */
export function useNoResponsePreview(codAgent: string | null, minutes: number) {
  const safeMinutes = Math.max(1, Number(minutes) || 30);
  const { data: agents = [] } = useJuliaAgents();
  const clientId = (agents as any[]).find((a) => String(a.cod_agent) === String(codAgent))?.client_id;

  return useQuery({
    queryKey: ['alerts', 'no-response-preview', codAgent, String(clientId ?? ''), safeMinutes],
    enabled: !!codAgent,
    staleTime: 30_000,
    queryFn: async (): Promise<NoResponsePreviewResult> => {
      const now = Date.now();
      const floor = new Date(now - WINDOW_MS).toISOString();

      // chat_conversations.cod_agent não é preenchido. Reúne os contatos
      // vinculados ao agente e os contatos sem agente do mesmo escritório.
      const { data: agentContacts, error: agentContactsError } = await (supabase as any)
        .from('chat_contacts')
        .select('id, phone, name')
        .eq('cod_agent', codAgent)
        .limit(500);
      if (agentContactsError) throw agentContactsError;
      let contactRows = (agentContacts ?? []) as any[];
      let scope: NoResponseScope = contactRows.length > 0 ? 'agent' : 'none';

      if (clientId) {
        const { data: officeContacts, error: officeContactsError } = await (supabase as any)
          .from('chat_contacts')
          .select('id, phone, name')
          .eq('client_id', String(clientId))
          .is('cod_agent', null)
          .order('last_message_at', { ascending: false })
          .limit(500);
        if (officeContactsError) throw officeContactsError;
        const merged = new Map(contactRows.map((contact: any) => [contact.id, contact]));
        for (const contact of (officeContacts ?? []) as any[]) merged.set(contact.id, contact);
        contactRows = Array.from(merged.values());
        if ((officeContacts ?? []).length > 0) scope = 'office';
      }

      if (contactRows.length === 0) return { items: [], scope: 'none' };
      const byId = new Map(contactRows.map((c: any) => [c.id, c]));

      const { data: convs, error } = await (supabase as any)
        .from('chat_conversations')
        .select('id, contact_id, last_customer_message_at, last_message_from_me, status')
        .in('contact_id', contactRows.map((c: any) => c.id))
        .eq('last_message_from_me', true)
        .in('status', ['pending', 'open'])
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (convs ?? []) as any[];
      if (rows.length === 0) return { items: [], scope };

      // Última mensagem (não interna) de cada conversa — chat_conversations não
      // guarda o texto da última mensagem.
      const convIds = rows.map((r) => r.id);
      const { data: msgs } = await (supabase as any)
        .from('chat_messages')
        .select('conversation_id, text, caption, file_name, type, from_me, timestamp, internal_note')
        .in('conversation_id', convIds)
        .order('timestamp', { ascending: false })
        .limit(Math.max(convIds.length * 20, 500));

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
        const m = lastMsg.get(conv.id);
        const lastMessageMs = m?.timestamp ? new Date(m.timestamp).getTime() : Number.NaN;
        if (!m?.from_me || !Number.isFinite(lastMessageMs)) continue;
        if (lastMessageMs < now - WINDOW_MS) continue;
        const dueMs = lastMessageMs + safeMinutes * 60_000;
        if (dueMs > now) continue;
        seen.add(phone);

        out.push({
          conversationId: conv.id,
          leadName: String(contact?.name ?? '') || 'Sem nome',
          leadPhone: phone,
          lastCustomerMessageAt: conv.last_customer_message_at ?? m.timestamp,
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
      return { items: out, scope };
    },
  });
}
