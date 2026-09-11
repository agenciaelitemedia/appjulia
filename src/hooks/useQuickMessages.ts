import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isOwnerUser } from '@/lib/auth/isOwner';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';

export interface QuickMessage {
  id: string;
  user_id: number;
  client_id: string | null;
  is_shared: boolean;
  title: string;
  message_text: string | null;
  shortcut: string | null;
  category: string;
  use_locations: string[];
  is_active: boolean;
  position: number;
  kind: 'text' | 'image' | 'video' | 'audio' | 'document' | 'link';
  media_url: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_size: number | null;
  media_filename: string | null;
  link_url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image: string | null;
  created_at: string;
  updated_at: string;
}

export type QuickMessageInsert = Omit<QuickMessage, 'id' | 'created_at' | 'updated_at'>;

/** client_id efetivo do usuário (herdado do titular quando é membro de equipe). */
export function useQuickMessagesClientId() {
  const { user } = useAuth();
  return useQuery<string | null>({
    queryKey: ['quick-messages', 'client-id', user?.id, (user as any)?.client_id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const resolved = await resolveEffectiveClientId(user as any, 'quick-messages');
      return resolved ? String(resolved) : null;
    },
  });
}

/** Filtro: minhas mensagens + mensagens compartilhadas do meu escritório. */
function scopeFilter(userId: number | string, clientId: string | null) {
  return clientId
    ? `user_id.eq.${userId},and(is_shared.eq.true,client_id.eq.${clientId})`
    : `user_id.eq.${userId}`;
}

export function useQuickMessages(location?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = isOwnerUser(user);
  const { data: clientId = null, isLoading: isLoadingClientId } = useQuickMessagesClientId();

  const query = useQuery({
    queryKey: ['quick-messages', location, user?.id, clientId],
    queryFn: async () => {
      let q = supabase
        .from('quick_messages')
        .select('*')
        .eq('is_active', true)
        .or(scopeFilter(user!.id, clientId))
        .order('position', { ascending: true });

      if (location) {
        q = q.contains('use_locations', [location]);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as QuickMessage[];
    },
    enabled: !!user?.id && !isLoadingClientId,
    staleTime: 5 * 60 * 1000,
  });

  const allQuery = useQuery({
    queryKey: ['quick-messages-all', user?.id, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_messages')
        .select('*')
        .or(scopeFilter(user!.id, clientId))
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as QuickMessage[];
    },
    enabled: !!user?.id && !isLoadingClientId,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (msg: Partial<QuickMessageInsert>) => {
      const { data, error } = await supabase
        .from('quick_messages')
        .insert({
          ...msg,
          user_id: user!.id,
          client_id: clientId,
          is_shared: isOwner ? !!msg.is_shared : false,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-messages'] });
      queryClient.invalidateQueries({ queryKey: ['quick-messages-all'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<QuickMessageInsert>) => {
      const { data, error } = await supabase
        .from('quick_messages')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-messages'] });
      queryClient.invalidateQueries({ queryKey: ['quick-messages-all'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quick_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-messages'] });
      queryClient.invalidateQueries({ queryKey: ['quick-messages-all'] });
    },
  });

  return {
    messages: query.data || [],
    allMessages: allQuery.data || [],
    isLoading: query.isLoading,
    isLoadingAll: allQuery.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
