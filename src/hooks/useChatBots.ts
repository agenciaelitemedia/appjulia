import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChatBot {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: 'keyword' | 'first_message' | 'any';
  trigger_keywords: string[];
  match_mode: 'contains' | 'exact' | 'starts_with';
  response_text: string;
  handoff_to_human: boolean;
  only_business_hours: boolean;
  execution_count: number;
  last_executed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useChatBots() {
  const { user } = useAuth();
  const clientId = user?.id ?? '';
  const [bots, setBots] = useState<ChatBot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_bots')
      .select('*')
      .eq('client_id', clientId)
      .order('position', { ascending: true });
    if (error) toast.error('Erro ao carregar bots');
    setBots((data || []) as ChatBot[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const upsert = async (bot: Partial<ChatBot> & { id?: string }) => {
    const payload = { ...bot, client_id: clientId } as any;
    const { error } = bot.id
      ? await supabase.from('chat_bots').update(payload).eq('id', bot.id)
      : await supabase.from('chat_bots').insert(payload);
    if (error) { toast.error('Erro ao salvar bot'); return false; }
    toast.success('Bot salvo');
    await load();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('chat_bots').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Bot removido');
    await load();
  };

  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from('chat_bots').update({ is_active }).eq('id', id);
    await load();
  };

  return { bots, loading, upsert, remove, toggle, reload: load };
}
