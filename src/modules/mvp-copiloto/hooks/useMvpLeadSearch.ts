/** Busca de leads (contatos + conversa mais recente) do escritório logado. */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';
import type { MvpLead } from '../lib/buildLeadContext';

export interface MvpLeadOption extends MvpLead {
  lastMessageAt: string | null;
  lastMessageText: string | null;
}

export function useMvpLeadSearch(term: string) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<MvpLeadOption[]>({
    queryKey: ['mvp-copiloto', 'leads', clientId, term],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from('chat_contacts')
        .select('id, name, phone, channel_type, cod_agent, last_message_at, last_message_text')
        .eq('client_id', clientId)
        .eq('is_group', false)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(30);

      const clean = term.trim();
      if (clean) {
        const digits = clean.replace(/\D/g, '');
        query = digits.length >= 4 ? query.ilike('phone', `%${digits}%`) : query.ilike('name', `%${clean}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const contacts = data || [];
      if (!contacts.length) return [];

      // Conversa mais recente de cada contato (para compilar o histórico certo).
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id, contact_id, queue_id, created_at')
        .eq('client_id', clientId)
        .in(
          'contact_id',
          contacts.map((c: any) => c.id),
        )
        .order('created_at', { ascending: false })
        .limit(200);

      const latestConv = new Map<string, { id: string; queue_id: string | null }>();
      for (const c of convs || []) {
        if (!latestConv.has((c as any).contact_id)) {
          latestConv.set((c as any).contact_id, { id: (c as any).id, queue_id: (c as any).queue_id ?? null });
        }
      }

      const queueIds = [...new Set([...latestConv.values()].map((c) => c.queue_id).filter(Boolean))] as string[];
      const queueNames = new Map<string, string>();
      if (queueIds.length) {
        const { data: queues } = await supabase.from('queues').select('id, name').in('id', queueIds);
        for (const q of queues || []) queueNames.set((q as any).id, (q as any).name);
      }

      return contacts.map((c: any) => {
        const conv = latestConv.get(c.id);
        return {
          contactId: c.id,
          conversationId: conv?.id ?? null,
          name: c.name,
          phone: c.phone,
          channel: c.channel_type,
          codAgent: c.cod_agent,
          queueName: conv?.queue_id ? queueNames.get(conv.queue_id) ?? null : null,
          lastMessageAt: c.last_message_at,
          lastMessageText: c.last_message_text,
        };
      });
    },
  });
}
