import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import type { XJFollowupCadence, XJFollowupStep } from '../types';

export function useXJCadences(agentId?: string) {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  const query = useQuery<XJFollowupCadence[]>({
    queryKey: ['x-julia', 'cadences', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_followup_cadences')
        .select('*, xj_followup_steps(*)')
        .eq('agent_id', agentId!)
        .order('created_at');
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        steps: (c.xj_followup_steps || []).sort((a: any, b: any) => a.position - b.position),
      })) as XJFollowupCadence[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'cadences', agentId] });

  const createCadence = useMutation({
    mutationFn: async (input: { name: string; stage?: string | null; case_id?: string | null }) => {
      if (!agentId || !clientId) throw new Error('Agente não identificado');
      const { data, error } = await supabase
        .from('xj_followup_cadences')
        .insert({
          client_id: String(clientId),
          agent_id: agentId,
          name: input.name,
          stage: input.stage || null,
          case_id: input.case_id || null,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Cadência criada');
    },
    onError: (e: any) => toast.error(`Falha ao criar cadência: ${e.message}`),
  });

  const updateCadence = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJFollowupCadence> }) => {
      const { error } = await supabase.from('xj_followup_cadences').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(`Falha ao salvar cadência: ${e.message}`),
  });

  const removeCadence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_followup_cadences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Cadência removida');
    },
  });

  const addStep = useMutation({
    mutationFn: async ({ cadenceId, position }: { cadenceId: string; position: number }) => {
      if (!clientId) throw new Error('Escritório não identificado');
      const { error } = await supabase.from('xj_followup_steps').insert({
        client_id: String(clientId),
        cadence_id: cadenceId,
        position,
        delay_minutes: position === 0 ? 60 : 24 * 60,
        content_mode: 'fixed',
        content_type: 'text',
        text_content: '',
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(`Falha ao adicionar passo: ${e.message}`),
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJFollowupStep> }) => {
      const { error } = await supabase.from('xj_followup_steps').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(`Falha ao salvar passo: ${e.message}`),
  });

  const removeStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_followup_steps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, createCadence, updateCadence, removeCadence, addStep, updateStep, removeStep };
}

/** Followups agendados/enviados (monitoramento). */
export function useXJFollowupQueue(limit = 100) {
  const { clientId } = useXJEffectiveClientId();
  return useQuery({
    queryKey: ['x-julia', 'followup-queue', clientId, limit],
    enabled: !!clientId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_followups')
        .select('*, xj_sessions(contact_name, phone, stage)')
        .eq('client_id', String(clientId))
        .order('run_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}