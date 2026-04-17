import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SavedViewFilters {
  status?: string[];
  channel?: string[];
  priority?: string[];
  assigned_to?: string;
  tags?: string[];
  unread_only?: boolean;
  snoozed?: boolean;
  search?: string;
}

export interface SavedView {
  id: string;
  client_id: string;
  cod_agent: string | null;
  owner_identifier: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_shared: boolean;
  filters: SavedViewFilters;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useChatSavedViews() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = String(user?.cod_agent || user?.id || 'default');
  const ownerId = user?.id ? String(user.id) : null;

  const list = useQuery({
    queryKey: ['chat-saved-views', clientId, ownerId],
    queryFn: async () => {
      let q = supabase.from('chat_saved_views').select('*').eq('client_id', clientId);
      if (ownerId) q = q.or(`owner_identifier.eq.${ownerId},is_shared.eq.true`);
      const { data, error } = await q.order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SavedView[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (view: Partial<SavedView>) => {
      if (!view.name) throw new Error('Nome é obrigatório');
      const payload = {
        ...view,
        client_id: clientId,
        owner_identifier: view.owner_identifier ?? ownerId,
        cod_agent: user?.cod_agent ? String(user.cod_agent) : null,
      };
      const { error } = view.id
        ? await supabase.from('chat_saved_views').update(payload as never).eq('id', view.id)
        : await supabase.from('chat_saved_views').insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-saved-views', clientId, ownerId] });
      toast.success('Visão salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_saved_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-saved-views', clientId, ownerId] });
      toast.success('Visão removida');
    },
  });

  return { list, upsert, remove };
}
