import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['x-julia', 'sessions'] });
    queryClient.invalidateQueries({ queryKey: ['x-julia', 'session'] });
    queryClient.invalidateQueries({ queryKey: ['x-julia', 'session-events'] });
  };
}

export interface XJSessionFieldsPatch {
  qualification?: string | null;
  qualification_reason?: string | null;
  case_type?: string | null;
  case_id?: string | null;
  slots?: Record<string, unknown>;
}

/** Ações administrativas de sessão: pausar, reativar, editar, excluir e forçar etapa. */
export function useXJSessionAdmin() {
  const invalidate = useInvalidate();

  const pause = useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const { error } = await supabase
        .from('xj_sessions')
        .update({ is_active: false, paused_reason: 'pausado manualmente' })
        .in('id', sessionIds);
      if (error) throw error;
      await supabase
        .from('xj_followups')
        .update({ status: 'cancelled' })
        .in('session_id', sessionIds)
        .eq('status', 'pending');
    },
    onSuccess: (_d, ids) => {
      invalidate();
      toast.success(ids.length > 1 ? `${ids.length} sessões pausadas` : 'Agente pausado nesta sessão');
    },
    onError: (e: any) => toast.error(`Falha ao pausar: ${e.message}`),
  });

  const resume = useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const { error } = await supabase
        .from('xj_sessions')
        .update({ is_active: true, paused_reason: null })
        .in('id', sessionIds);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      invalidate();
      toast.success(ids.length > 1 ? `${ids.length} sessões reativadas` : 'Agente reativado');
    },
    onError: (e: any) => toast.error(`Falha ao reativar: ${e.message}`),
  });

  const updateFields = useMutation({
    mutationFn: async ({ sessionId, patch }: { sessionId: string; patch: XJSessionFieldsPatch }) => {
      const { error } = await supabase.from('xj_sessions').update(patch as any).eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Sessão atualizada');
    },
    onError: (e: any) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  /** Exclusão completa: eventos + followups + sessão (lead volta ao estado inicial). */
  const remove = useMutation({
    mutationFn: async (sessionIds: string[]) => {
      await supabase.from('xj_session_events').delete().in('session_id', sessionIds);
      await supabase.from('xj_followups').delete().in('session_id', sessionIds);
      const { error } = await supabase.from('xj_sessions').delete().in('id', sessionIds);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      invalidate();
      toast.success(ids.length > 1 ? `${ids.length} sessões excluídas` : 'Sessão excluída');
    },
    onError: (e: any) => toast.error(`Falha ao excluir: ${e.message}`),
  });

  /** Muda a etapa e o agente age na hora, conduzindo aquela etapa. */
  const advanceStage = useMutation({
    mutationFn: async ({ sessionId, stage }: { sessionId: string; stage: string }) => {
      const { data, error } = await supabase.functions.invoke('x-julia-engine', {
        body: { action: 'advance_stage', data: { session_id: sessionId, stage } },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { replied?: boolean; skipped?: string };
    },
    onSuccess: (result) => {
      invalidate();
      if (result?.replied) toast.success('Etapa alterada — agente já respondeu ao lead');
      else toast.success(`Etapa alterada${result?.skipped ? ` (sem envio: ${result.skipped})` : ' (sem envio)'}`);
    },
    onError: (e: any) => toast.error(`Falha ao mudar etapa: ${e.message}`),
  });

  /** Força um turno do agente mantendo a etapa atual (continuar agora). */
  const continueNow = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke('x-julia-engine', {
        body: { action: 'continue_now', data: { session_id: sessionId } },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { replied?: boolean; skipped?: string };
    },
    onSuccess: (result) => {
      invalidate();
      if (result?.replied) toast.success('Agente continuou o atendimento');
      else toast.warning(`Sem envio${result?.skipped ? `: ${result.skipped}` : ''}`);
    },
    onError: (e: any) => toast.error(`Falha ao continuar: ${e.message}`),
  });

  return { pause, resume, updateFields, remove, advanceStage, continueNow };
}