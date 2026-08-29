/** Compila o histórico do lead selecionado (últimas 100 mensagens). */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';
import { buildLeadContext, type CompiledContext, type MvpLead, type MvpMessage } from '../lib/buildLeadContext';

const MESSAGE_LIMIT = 100;

export function useMvpLeadContext(lead: MvpLead | null) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<CompiledContext>({
    queryKey: ['mvp-copiloto', 'context', clientId, lead?.contactId, lead?.conversationId],
    enabled: !!clientId && !!lead?.contactId,
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from('chat_messages')
        .select(
          'id, text, caption, type, from_me, internal_note, sender_name, file_name, timestamp, metadata',
        )
        .eq('client_id', clientId)
        .eq('contact_id', lead!.contactId)
        .order('timestamp', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (lead!.conversationId) query = query.eq('conversation_id', lead!.conversationId);

      const { data, error } = await query;
      if (error) throw error;

      return buildLeadContext(lead!, (data || []) as unknown as MvpMessage[]);
    },
  });
}
