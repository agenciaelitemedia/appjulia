import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import type { XJAppointment, XJAvailability } from '../types';

export function useXJAppointments() {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJAppointment[]>({
    queryKey: ['x-julia', 'appointments', clientId],
    enabled: !!clientId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_appointments')
        .select('*')
        .eq('client_id', String(clientId))
        .order('starts_at', { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data || []) as unknown as XJAppointment[];
    },
  });
}

export function useXJAppointmentActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'appointments'] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('xj_appointments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agendamento atualizado');
    },
    onError: (e: any) => toast.error(`Falha ao atualizar agendamento: ${e.message}`),
  });

  return { setStatus };
}

export function useXJAvailability(agentId?: string) {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  const query = useQuery<XJAvailability[]>({
    queryKey: ['x-julia', 'availability', clientId, agentId ?? 'all'],
    enabled: !!clientId,
    queryFn: async () => {
      let q = supabase
        .from('xj_availability')
        .select('*')
        .eq('client_id', String(clientId))
        .order('weekday')
        .order('start_time');
      if (agentId) q = q.eq('agent_id', agentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as XJAvailability[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'availability'] });

  const add = useMutation({
    mutationFn: async (input: Partial<XJAvailability>) => {
      if (!clientId) throw new Error('Escritório não identificado');
      const { error } = await supabase.from('xj_availability').insert({
        client_id: String(clientId),
        agent_id: input.agent_id ?? agentId ?? null,
        owner_name: input.owner_name ?? null,
        weekday: input.weekday ?? 1,
        start_time: input.start_time ?? '09:00',
        end_time: input.end_time ?? '18:00',
        slot_minutes: input.slot_minutes ?? 30,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Disponibilidade adicionada');
    },
    onError: (e: any) => toast.error(`Falha ao salvar disponibilidade: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJAvailability> }) => {
      const { error } = await supabase.from('xj_availability').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, add, update, remove };
}