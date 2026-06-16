import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface QuickMessage {
  id: string;
  user_id: number;
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

export function useQuickMessages(location?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['quick-messages', location, user?.id],
    queryFn: async () => {
      let q = supabase
        .from('quick_messages')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (user?.id) {
        q = q.eq('user_id', user.id);
      }

      if (location) {
        q = q.contains('use_locations', [location]);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as QuickMessage[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const allQuery = useQuery({
    queryKey: ['quick-messages-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_messages')
        .select('*')
        .eq('user_id', user!.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as QuickMessage[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (msg: Partial<QuickMessageInsert>) => {
      const { data, error } = await supabase
        .from('quick_messages')
        .insert({ ...msg, user_id: user!.id } as any)
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
