import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import type { XJContract } from '../types';

export function useXJContracts(status?: string) {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJContract[]>({
    queryKey: ['x-julia', 'contracts', clientId, status ?? 'all'],
    enabled: !!clientId,
    queryFn: async () => {
      let query = supabase
        .from('xj_contracts')
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false })
        .limit(300);
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as XJContract[];
    },
  });
}

export function useXJContractActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'contracts'] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, any> = { status };
      if (status === 'signed') patch.signed_at = new Date().toISOString();
      const { error } = await supabase.from('xj_contracts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Contrato atualizado');
    },
    onError: (e: any) => toast.error(`Falha ao atualizar contrato: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Contrato removido');
    },
    onError: (e: any) => toast.error(`Falha ao remover contrato: ${e.message}`),
  });

  return { setStatus, remove };
}