import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AIAutoreplyRule {
  id: string;
  client_id: string;
  cod_agent?: string | null;
  name: string;
  description?: string | null;
  is_active: boolean;
  match_intents: string[];
  match_keywords: string[];
  use_knowledge_base: boolean;
  kb_category_id?: string | null;
  system_prompt?: string | null;
  model: string;
  max_replies_per_conversation: number;
  handoff_after_max: boolean;
  only_business_hours: boolean;
  confidence_threshold: number;
  position: number;
  execution_count: number;
  last_executed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export function useChatAIAutoreply() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = String(user?.cod_agent || user?.id || 'default');

  const list = useQuery({
    queryKey: ['ai-autoreply-rules', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_ai_autoreply_rules')
        .select('*')
        .eq('client_id', clientId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as AIAutoreplyRule[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (rule: Partial<AIAutoreplyRule>) => {
      const payload = { ...rule, client_id: clientId } as any;
      if (rule.id) {
        const { error } = await supabase.from('chat_ai_autoreply_rules').update(payload).eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chat_ai_autoreply_rules').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-autoreply-rules', clientId] });
      toast.success('Regra salva');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_ai_autoreply_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-autoreply-rules', clientId] });
      toast.success('Regra removida');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('chat_ai_autoreply_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-autoreply-rules', clientId] }),
  });

  return { list, upsert, remove, toggleActive };
}
