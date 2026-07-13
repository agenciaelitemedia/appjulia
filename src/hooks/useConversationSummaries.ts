import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ConversationSummary {
  id: string;
  conversation_id: string;
  contact_id: string;
  client_id: string;
  sentiment: string | null;
  summary: string;
  atendimento: string | null;
  first_message_ts: string | null;
  last_message_ts: string | null;
  message_count: number;
  triggered_by: string;
  created_at: string;
}

export function useConversationSummaries(
  conversationId: string | null,
  contactId?: string | null,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['conv-summaries', contactId ?? conversationId, contactId ? 'by-contact' : 'by-conv'],
    enabled: !!(contactId || conversationId),
    queryFn: async () => {
      let q = supabase
        .from('chat_conversation_summaries')
        .select('*')
        .order('created_at', { ascending: false });
      if (contactId) {
        q = q.eq('contact_id', contactId);
      } else {
        q = q.eq('conversation_id', conversationId!);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ConversationSummary[];
    },
  });

  // Realtime: refresh when a summary is inserted server-side (auto-resumo)
  useEffect(() => {
    const filterKey = contactId ? 'contact_id' : 'conversation_id';
    const filterVal = contactId || conversationId;
    if (!filterVal) return;
    const invalidateKey = ['conv-summaries', contactId ?? conversationId, contactId ? 'by-contact' : 'by-conv'];
    const channel = supabase
      .channel(`conv-summaries-${filterKey}-${filterVal}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversation_summaries',
          filter: `${filterKey}=eq.${filterVal}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: invalidateKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, contactId, queryClient]);

  const generateSummary = useCallback(async (
    convId: string,
    contactId: string,
    afterTs?: string,
    triggeredBy: 'manual' | 'auto' = 'manual'
  ) => {
    const { data, error } = await supabase.functions.invoke('chat-ai-assist', {
      body: {
        mode: 'full_summary',
        conversation_id: convId,
        after_ts: afterTs,
        client_id: user?.client_id ? String(user.client_id) : undefined,
      },
    });
    if (error) throw error;

    const clientId = user?.client_id ? String(user.client_id) : '';
    const { error: insertError } = await supabase.from('chat_conversation_summaries').insert({
      conversation_id: convId,
      contact_id: contactId,
      client_id: clientId,
      sentiment: data.sentiment,
      summary: data.summary,
      atendimento: data.atendimento,
      first_message_ts: data.first_message_ts,
      last_message_ts: data.last_message_ts,
      message_count: data.message_count,
      triggered_by: triggeredBy,
    });
    if (insertError) throw insertError;

    queryClient.invalidateQueries({ queryKey: ['conv-summaries'] });
    return data;
  }, [user?.client_id, queryClient]);

  const checkAutoSummary = useCallback(async (
    convId: string,
    contactId: string,
    totalMessages: number
  ) => {
    if (summaries.length === 0) {
      if (totalMessages >= 100) {
        await generateSummary(convId, contactId, undefined, 'auto');
      }
      return;
    }
    const lastSummary = summaries[0]; // sorted desc
    const diff = totalMessages - lastSummary.message_count;
    if (diff >= 100) {
      await generateSummary(convId, contactId, lastSummary.last_message_ts ?? undefined, 'auto');
    }
  }, [summaries, generateSummary]);

  const getAfterTsForNext = useCallback((): string | undefined => {
    if (summaries.length === 0) return undefined;
    return summaries[0].last_message_ts ?? undefined;
  }, [summaries]);

  return { summaries, isLoading, generateSummary, checkAutoSummary, getAfterTsForNext };
}
