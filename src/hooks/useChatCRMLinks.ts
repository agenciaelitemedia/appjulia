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
      // Join conversation → queue so we can hide links whose queue was soft-deleted.
      let q = supabase
        .from('chat_crm_links')
        .select('*, chat_conversations:conversation_id(queue_id, queues:queue_id(is_deleted))')
        .eq('client_id', clientId);
      if (conversationId) q = q.eq('conversation_id', conversationId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      const filtered = (data || []).filter((row: any) => {
        const conv = row?.chat_conversations;
        if (!conv) return true; // legacy link without conversation — keep
        const queue = conv.queues;
        // If the conversation has a queue and that queue is deleted, hide the link
        if (queue && queue.is_deleted === true) return false;
        return true;
      });
      // Strip the join shape before returning
      return filtered.map((row: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { chat_conversations: _c, ...rest } = row;
        return rest;
      }) as CRMLink[];
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
