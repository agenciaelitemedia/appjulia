import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChatCampaign {
  id: string;
  client_id: string;
  name: string;
  message_text: string;
  media_url: string | null;
  media_type: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed';
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  filter_tags: string[];
  filter_channel: string | null;
  contacts_total: number;
  contacts_sent: number;
  contacts_failed: number;
  throttle_seconds: number;
  created_at: string;
  updated_at: string;
}

export function useChatCampaigns() {
  const { user } = useAuth();
  const clientId = user?.id ?? '';
  const [campaigns, setCampaigns] = useState<ChatCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setCampaigns((data || []) as ChatCampaign[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const create = async (input: Partial<ChatCampaign>) => {
    const { data, error } = await supabase
      .from('chat_campaigns')
      .insert({ ...input, client_id: clientId } as any)
      .select()
      .single();
    if (error) { toast.error('Erro ao criar campanha'); return null; }
    toast.success('Campanha criada');
    await load();
    return data as ChatCampaign;
  };

  const dispatch = async (campaignId: string) => {
    const { error } = await supabase.functions.invoke('chat-campaign-dispatcher', {
      body: { campaign_id: campaignId },
    });
    if (error) { toast.error('Erro ao disparar'); return; }
    toast.success('Disparo iniciado');
    await load();
  };

  const cancel = async (id: string) => {
    await supabase.from('chat_campaigns').update({ status: 'cancelled' }).eq('id', id);
    toast.success('Campanha cancelada');
    await load();
  };

  return { campaigns, loading, create, dispatch, cancel, reload: load };
}
