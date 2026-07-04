import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WavoipProvider {
  id: string;
  name: string;
  type: 'wavoip_multicanal' | 'wavoip_free';
  api_base: string;
  username: string;
  is_active: boolean;
  has_password: boolean;
  has_token: boolean;
  token_updated_at: string | null;
  last_login_status: string | null;
  last_login_error: string | null;
  created_at: string;
  updated_at: string;
}

async function invoke<T = any>(action: string, data?: any): Promise<T> {
  const { data: res, error } = await supabase.functions.invoke('wavoip-providers', {
    body: { action, data },
  });
  if (error) throw new Error(error.message);
  if (res?.error) throw new Error(res.error);
  return res as T;
}

export function useWavoipProviders() {
  return useQuery({
    queryKey: ['wavoip-providers'],
    queryFn: async () => {
      const res = await invoke<{ data: WavoipProvider[] }>('list');
      return res.data ?? [];
    },
  });
}

export function useCreateWavoipProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string; type: string; api_base: string; username: string; password: string;
    }) => invoke('create', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-providers'] }),
  });
}

export function useUpdateWavoipProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string; name?: string; type?: string; api_base?: string;
      username?: string; password?: string; is_active?: boolean;
    }) => invoke('update', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-providers'] }),
  });
}

export function useDeleteWavoipProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke('delete', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-providers'] }),
  });
}

export function useRefreshWavoipProviderToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke('refresh_token', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-providers'] }),
  });
}