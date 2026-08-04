/**
 * extend/chat — etiquetas, mensagens rápidas e atendentes usados nos nós de Chat.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';
import { useFlowBuilderIdentity, useFlowClientId } from './auth';

export interface FlowTagOption {
  id: string;
  name: string;
  color: string | null;
}

export function useFlowTags() {
  const { data: clientId } = useFlowClientId();
  return useQuery<FlowTagOption[]>({
    queryKey: ['flow-builder', 'tags', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_tags')
        .select('id, name, color')
        .eq('client_id', String(clientId))
        .order('name');
      if (error) throw error;
      return (data || []) as FlowTagOption[];
    },
    staleTime: 60_000,
  });
}

export interface FlowQuickMessageOption {
  id: string;
  title: string;
  message_text: string | null;
}

export function useFlowQuickMessages() {
  const { user } = useFlowBuilderIdentity();
  const userId = Number(user?.id) || 0;
  return useQuery<FlowQuickMessageOption[]>({
    queryKey: ['flow-builder', 'quick-messages', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_messages')
        .select('id, title, message_text')
        .eq('user_id', userId)
        .order('title');
      if (error) throw error;
      return (data || []) as unknown as FlowQuickMessageOption[];
    },
    enabled: userId > 0,
    staleTime: 60_000,
  });
}