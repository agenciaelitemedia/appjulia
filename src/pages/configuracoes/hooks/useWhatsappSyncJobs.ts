import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsappSyncJob {
  id: string;
  client_id: string;
  client_name: string | null;
  queue_id: string | null;
  queue_name: string | null;
  cod_agent: string | null;
  agent_name: string | null;
  phase: 'history_sync' | 'message_find';
  status: 'running' | 'done' | 'error' | 'partial' | 'cancelled';
  date_from: string | null;
  date_to: string | null;
  total_numbers: number;
  processed_numbers: number;
  inserted_messages: number;
  inserted_contacts: number;
  cancel_requested: boolean;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  created_at: string;
}

export interface WhatsappSyncJobLog {
  id: string;
  job_id: string;
  phone: string;
  status: 'pending' | 'ok' | 'error' | 'skipped';
  messages_found: number;
  messages_inserted: number;
  contact_created: boolean;
  error: string | null;
  processed_at: string | null;
}

export function useWhatsappSyncJobs() {
  return useQuery<WhatsappSyncJob[]>({
    queryKey: ['whatsapp-sync-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_sync_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as WhatsappSyncJob[];
    },
    refetchInterval: (query) => {
      const jobs = query.state.data as WhatsappSyncJob[] | undefined;
      const hasRunning = jobs?.some((j) => j.status === 'running');
      return hasRunning ? 5000 : false;
    },
  });
}

export function useWhatsappSyncJobLogs(jobId: string | null) {
  return useQuery<WhatsappSyncJobLog[]>({
    queryKey: ['whatsapp-sync-job-logs', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_sync_job_logs')
        .select('*')
        .eq('job_id', jobId!)
        .order('processed_at', { ascending: false, nullsFirst: false })
        .order('phone', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WhatsappSyncJobLog[];
    },
    refetchInterval: 5000,
  });
}

export function useCancelSyncJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.functions.invoke('uazapi-history-cancel', {
        body: { job_id: jobId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cancelamento solicitado');
      qc.invalidateQueries({ queryKey: ['whatsapp-sync-jobs'] });
    },
    onError: (e: Error) => toast.error('Falha ao cancelar: ' + e.message),
  });
}

export function useRestartSyncJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      // Load original job
      const { data: original, error: loadErr } = await supabase
        .from('whatsapp_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (loadErr || !original) throw new Error(loadErr?.message || 'Job original não encontrado');

      // Create new job reusing parameters
      const { data: created, error: insErr } = await supabase
        .from('whatsapp_sync_jobs')
        .insert({
          client_id: original.client_id,
          client_name: original.client_name,
          queue_id: original.queue_id,
          queue_name: original.queue_name,
          cod_agent: original.cod_agent,
          agent_name: original.agent_name,
          phase: 'message_find',
          status: 'running',
          date_from: original.date_from,
          date_to: original.date_to,
          evo_url: original.evo_url,
          evo_token: original.evo_token,
          numbers: original.numbers,
          created_by: original.created_by,
        } as never)
        .select('id')
        .single();
      if (insErr || !created) throw new Error(insErr?.message || 'Falha ao criar novo job');

      const { error: invokeErr } = await supabase.functions.invoke('uazapi-history-import', {
        body: { job_id: (created as { id: string }).id },
      });
      if (invokeErr) throw invokeErr;

      return (created as { id: string }).id;
    },
    onSuccess: () => {
      toast.success('Sincronização reiniciada');
      qc.invalidateQueries({ queryKey: ['whatsapp-sync-jobs'] });
    },
    onError: (e: Error) => toast.error('Falha ao reiniciar: ' + e.message),
  });
}