import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface HelpStudioEditor {
  id: string;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  added_by: number | null;
  created_at: string;
}

/** Lista de usuários vinculados como editores do Studio */
export function useHelpStudioEditors() {
  return useQuery({
    queryKey: ['help-studio-editors'],
    queryFn: async (): Promise<HelpStudioEditor[]> => {
      const { data, error } = await supabase
        .from('help_studio_editors')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as HelpStudioEditor[];
    },
  });
}

/** Acesso ao Studio: admin OU usuário vinculado em help_studio_editors */
export function useHelpStudioAccess() {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ? Number(user.id) : undefined;

  const { data: isEditor = false, isLoading } = useQuery({
    queryKey: ['help-studio-access', userId],
    queryFn: async (): Promise<boolean> => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from('help_studio_editors')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId && !isAdmin,
  });

  return {
    canAccessStudio: isAdmin || isEditor,
    isLoading: isAdmin ? false : isLoading,
    isAdmin,
  };
}

export function useAddHelpStudioEditor() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (u: { id: number; name: string; email: string }) => {
      const { error } = await supabase.from('help_studio_editors').insert({
        user_id: u.id,
        user_name: u.name,
        user_email: u.email,
        added_by: user?.id ? Number(user.id) : null,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Usuário já está vinculado');
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-studio-editors'] });
      qc.invalidateQueries({ queryKey: ['help-studio-access'] });
      toast.success('Usuário vinculado ao Studio');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveHelpStudioEditor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('help_studio_editors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-studio-editors'] });
      qc.invalidateQueries({ queryKey: ['help-studio-access'] });
      toast.success('Vínculo removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}