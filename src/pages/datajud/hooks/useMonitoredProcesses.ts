import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { MonitoredProcess } from '../types';

export function useMonitoredProcesses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['datajud', 'monitored', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('datajud_monitored_processes')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MonitoredProcess[];
    },
    enabled: !!user?.id,
  });

  const addProcess = useMutation({
    mutationFn: async (process: {
      process_number: string;
      process_number_formatted: string;
      name: string;
      client_phone?: string;
      tribunal?: string;
      last_known_movements?: any[];
    }) => {
      const { data, error } = await supabase
        .from('datajud_monitored_processes')
        .insert({
          user_id: user!.id,
          process_number: process.process_number,
          process_number_formatted: process.process_number_formatted,
          name: process.name,
          client_phone: process.client_phone || null,
          tribunal: process.tribunal || null,
          last_known_movements: process.last_known_movements || [],
          status: 'active',
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'monitored'] });
      toast.success('Processo adicionado ao monitoramento');
    },
    onError: (err: any) => {
      toast.error('Erro ao adicionar processo', { description: err.message });
    },
  });

  const addBulk = useMutation({
    mutationFn: async (processes: Array<{
      process_number: string;
      process_number_formatted: string;
      name: string;
      client_phone?: string;
    }>) => {
      const rows = processes.map(p => ({
        user_id: user!.id,
        process_number: p.process_number,
        process_number_formatted: p.process_number_formatted,
        name: p.name,
        client_phone: p.client_phone || null,
        status: 'active',
      }));
      const { data, error } = await supabase
        .from('datajud_monitored_processes')
        .insert(rows as any[])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'monitored'] });
      toast.success(`${(data as any[]).length} processos adicionados`);
    },
    onError: (err: any) => {
      toast.error('Erro na importação', { description: err.message });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'paused' }) => {
      const { error } = await supabase
        .from('datajud_monitored_processes')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'monitored'] });
    },
  });

  const removeProcess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('datajud_monitored_processes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'monitored'] });
      toast.success('Processo removido');
    },
  });

  return {
    processes: query.data || [],
    isLoading: query.isLoading,
    addProcess,
    addBulk,
    toggleStatus,
    removeProcess,
  };
}
