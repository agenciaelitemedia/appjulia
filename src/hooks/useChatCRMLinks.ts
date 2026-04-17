import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CRMLink {
  id: string;
  client_id: string;
  cod_agent?: string | null;
  conversation_id: string;
  contact_id?: string | null;
  external_system: string;
  external_id: string;
  external_url?: string | null;
  sync_direction: string;
  last_synced_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useChatCRMLinks(conversationId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = String(user?.cod_agent || user?.id || 'default');

  const list = useQuery({
    queryKey: ['chat-crm-links', clientId, conversationId],
    queryFn: async () => {
      let q = supabase.from('chat_crm_links').select('*').eq('client_id', clientId);
      if (conversationId) q = q.eq('conversation_id', conversationId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CRMLink[];
    },
    enabled: !!clientId,
  });

  const link = useMutation({
    mutationFn: async (input: Partial<CRMLink>) => {
      const { error } = await supabase.from('chat_crm_links').insert({
        ...input,
        client_id: clientId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat-crm-links'] }); toast.success('Vínculo criado'); },
    onError: (e: any) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_crm_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat-crm-links'] }); toast.success('Vínculo removido'); },
  });

  return { list, link, unlink };
}
