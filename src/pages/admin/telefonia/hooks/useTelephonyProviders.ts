import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TelephonyProvider {
  id: string;
  name: string;
  provider: 'api4com' | '3cplus';
  api4com_domain: string | null;
  api4com_token: string | null;
  sip_domain: string | null;
  threecplus_token: string | null;
  threecplus_base_url: string | null;
  threecplus_ws_url: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useTelephonyProviders() {
  return useQuery<TelephonyProvider[]>({
    queryKey: ['telephony-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telephony_providers' as never)
        .select('*')
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false }) as any;
      if (error) throw error;
      return (data ?? []) as TelephonyProvider[];
    },
  });
}

export function useUpsertTelephonyProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TelephonyProvider> & { provider: TelephonyProvider['provider']; name: string }) => {
      const { id, ...rest } = input;
      // Se está marcando como default, desmarca outros do mesmo provider
      if (rest.is_default) {
        await (supabase as any).from('telephony_providers')
          .update({ is_default: false })
          .eq('provider', rest.provider)
          .neq('id', id ?? '00000000-0000-0000-0000-000000000000');
      }
      if (id) {
        const { error } = await (supabase as any).from('telephony_providers').update(rest).eq('id', id);
        if (error) throw error;
        return { id };
      }
      const { data, error } = await (supabase as any).from('telephony_providers').insert(rest).select('id').single();
      if (error) throw error;
      return { id: data.id };
    },
    onSuccess: () => {
      toast.success('Provedor salvo');
      qc.invalidateQueries({ queryKey: ['telephony-providers'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useDeleteTelephonyProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('telephony_providers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Provedor removido');
      qc.invalidateQueries({ queryKey: ['telephony-providers'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}
