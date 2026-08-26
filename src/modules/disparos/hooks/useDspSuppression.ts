import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { normalizeBrPhone } from '../extend/phone';
import type { DspSuppression } from '../types';

export function useDspSuppression(clientId: string | null, search: string) {
  return useQuery<DspSuppression[]>({
    queryKey: ['disparos', 'suppression', clientId, search],
    enabled: !!clientId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_suppression')
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false })
        .limit(300);
      const digits = search.replace(/\D/g, '');
      if (digits.length >= 4) q = q.ilike('phone_e164', `%${digits}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DspSuppression[];
    },
  });
}

export function useAddSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; phone: string; reason: string; notes?: string; created_by?: string | null }) => {
      const phone = normalizeBrPhone(input.phone);
      if (!phone || phone.replace(/\D/g, '').length < 12) throw new Error('Telefone inválido');
      const { error } = await (supabase as any).from('dsp_suppression').insert({
        client_id: input.client_id,
        phone_e164: phone,
        reason: input.reason,
        scope: 'client',
        notes: input.notes ?? null,
        created_by: input.created_by ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'suppression'] });
      toast.success('Telefone adicionado à supressão');
    },
    onError: (e: any) => toast.error('Erro ao adicionar', { description: e?.message }),
  });
}

export function useRemoveSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('dsp_suppression').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'suppression'] });
      toast.success('Removido da supressão');
    },
    onError: (e: any) => toast.error('Erro ao remover', { description: e?.message }),
  });
}
