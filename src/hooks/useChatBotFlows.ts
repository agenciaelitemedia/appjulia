import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FlowNode {
  id: string;
  type: 'message' | 'question' | 'condition' | 'handoff' | 'tag' | 'end';
  position: { x: number; y: number };
  data: {
    label?: string;
    text?: string;
    field?: string;
    options?: string[];
    tag?: string;
    operator?: string;
    value?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface BotFlow {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_keywords: string[];
  trigger_type: string;
  match_mode: string;
  only_business_hours: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  start_node_id: string | null;
  execution_count: number;
  last_executed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useChatBotFlows() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = String(user?.cod_agent || user?.id || 'default');

  const list = useQuery({
    queryKey: ['chat-bot-flows', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_bot_flows')
        .select('*')
        .eq('client_id', clientId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BotFlow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (flow: Partial<BotFlow>) => {
      if (!flow.name) throw new Error('Nome é obrigatório');
      const payload = {
        ...flow,
        client_id: clientId,
        cod_agent: user?.cod_agent ? String(user.cod_agent) : null,
      };
      const { data, error } = flow.id
        ? await supabase.from('chat_bot_flows').update(payload as never).eq('id', flow.id).select().single()
        : await supabase.from('chat_bot_flows').insert(payload as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-bot-flows', clientId] });
      toast.success('Fluxo salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_bot_flows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-bot-flows', clientId] });
      toast.success('Fluxo removido');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('chat_bot_flows').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-bot-flows', clientId] }),
  });

  return { list, upsert, remove, toggleActive };
}
