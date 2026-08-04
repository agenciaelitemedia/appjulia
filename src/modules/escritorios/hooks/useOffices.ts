import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { OfficeRecord } from '../types';

const KEY = ['escritorios', 'offices'];

export function useOffices(search = '') {
  return useQuery<OfficeRecord[]>({
    queryKey: [...KEY, search],
    queryFn: async () => {
      let query = supabase
        .from('offices')
        .select('*')
        .order('created_at', { ascending: false });

      const term = search.trim();
      if (term) {
        query = query.or(
          `office_name.ilike.%${term}%,business_name.ilike.%${term}%,owner_email.ilike.%${term}%,federal_id.ilike.%${term}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as OfficeRecord[];
    },
    staleTime: 30_000,
  });
}

export function useOffice(officeId?: string) {
  return useQuery<OfficeRecord | null>({
    queryKey: [...KEY, 'detail', officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .eq('id', officeId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as OfficeRecord) || null;
    },
  });
}

/** Escritório vinculado ao client_id logado — usado para direcionar o painel de atendimento. */
export function useOfficeByClient(clientId?: number | null) {
  return useQuery<OfficeRecord | null>({
    queryKey: [...KEY, 'by-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .eq('client_id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as OfficeRecord) || null;
    },
    staleTime: 5 * 60_000,
  });
}

export function useOfficeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const updateOffice = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OfficeRecord> }) => {
      const { error } = await supabase.from('offices').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Escritório atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar escritório'),
  });

  const deleteOffice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('offices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Escritório removido da listagem');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover escritório'),
  });

  return { updateOffice, deleteOffice };
}