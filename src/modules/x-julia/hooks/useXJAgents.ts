import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJIdentity } from '../extend/auth';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import { getXJRolePreset, type XJAgentRole } from '../lib/agentRolePresets';
import type { XJAgent } from '../types';

const KEY = ['x-julia', 'agents'];

export function useXJAgents() {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJAgent[]>({
    queryKey: [...KEY, clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_agents')
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as XJAgent[];
    },
  });
}

export function useXJAgent(agentId?: string) {
  return useQuery<XJAgent | null>({
    queryKey: [...KEY, 'detail', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase.from('xj_agents').select('*').eq('id', agentId!).maybeSingle();
      if (error) throw error;
      return (data as unknown as XJAgent) ?? null;
    },
  });
}

export function useXJAgentMutations() {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();
  const { userName } = useXJIdentity();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: KEY });
  };

  const create = useMutation({
    mutationFn: async (input: Partial<XJAgent> & { case_name?: string | null }) => {
      if (!clientId) throw new Error('Escritório não identificado');
      const role = ((input.role ?? 'reception') as XJAgentRole);
      const preset = getXJRolePreset(role, input.case_name ?? null);
      const { data, error } = await supabase
        .from('xj_agents')
        .insert({
          client_id: String(clientId),
          name: input.name || 'X-Julia',
          role,
          case_id: role === 'specialist' ? input.case_id ?? null : null,
          persona: input.persona ?? preset.persona,
          tone: input.tone ?? preset.tone,
          system_prompt: input.system_prompt ?? preset.system_prompt,
          stage_prompts: (input.stage_prompts ?? preset.stage_prompts) as any,
          activation: preset.activation as any,
          mirror_to_crm_builder: preset.mirror_to_crm_builder,
          llm_provider: input.llm_provider ?? 'lovable',
          llm_model: input.llm_model ?? 'google/gemini-3.6-flash',
          contract_provider: input.contract_provider ?? preset.contract_provider,
          created_by: userName,
        } as any)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as XJAgent;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agente X-Julia criado');
    },
    onError: (e: any) => toast.error(`Falha ao criar agente: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJAgent> }) => {
      const { error } = await supabase.from('xj_agents').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agente atualizado');
    },
    onError: (e: any) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_agents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agente removido');
    },
    onError: (e: any) => toast.error(`Falha ao remover: ${e.message}`),
  });

  /** Salva o prompt atual como versão e aplica no agente. */
  const savePromptVersion = useMutation({
    mutationFn: async ({
      agentId,
      systemPrompt,
      stagePrompts,
      label,
    }: {
      agentId: string;
      systemPrompt: string;
      stagePrompts: Record<string, string>;
      label?: string;
    }) => {
      if (!clientId) throw new Error('Escritório não identificado');
      const { data: last } = await supabase
        .from('xj_prompt_versions')
        .select('version')
        .eq('agent_id', agentId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const version = Number(last?.version ?? 0) + 1;
      const { error } = await supabase.from('xj_prompt_versions').insert({
        client_id: String(clientId),
        agent_id: agentId,
        version,
        label: label ?? `Versão ${version}`,
        system_prompt: systemPrompt,
        stage_prompts: stagePrompts as any,
        created_by: userName,
      } as any);
      if (error) throw error;

      const { error: upErr } = await supabase
        .from('xj_agents')
        .update({ system_prompt: systemPrompt, stage_prompts: stagePrompts as any })
        .eq('id', agentId);
      if (upErr) throw upErr;
      return version;
    },
    onSuccess: (version) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['x-julia', 'prompt-versions'] });
      toast.success(`Prompt salvo como versão ${version}`);
    },
    onError: (e: any) => toast.error(`Falha ao salvar prompt: ${e.message}`),
  });

  return { create, update, remove, savePromptVersion };
}

export function useXJPromptVersions(agentId?: string) {
  return useQuery({
    queryKey: ['x-julia', 'prompt-versions', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_prompt_versions')
        .select('*')
        .eq('agent_id', agentId!)
        .order('version', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

/** Vínculo do agente com filas de atendimento. */
export function useXJAgentQueueLinks(agentId?: string) {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  const query = useQuery({
    queryKey: ['x-julia', 'agent-queues', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_agent_queue_links')
        .select('id, queue_id')
        .eq('agent_id', agentId!);
      if (error) throw error;
      return data || [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ queueId, linked }: { queueId: string; linked: boolean }) => {
      if (!agentId || !clientId) throw new Error('Agente não identificado');
      if (linked) {
        const { error } = await supabase
          .from('xj_agent_queue_links')
          .insert({ client_id: String(clientId), agent_id: agentId, queue_id: queueId } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('xj_agent_queue_links')
          .delete()
          .eq('agent_id', agentId)
          .eq('queue_id', queueId);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'agent-queues', agentId] }),
    onError: (e: any) => toast.error(`Falha no vínculo de fila: ${e.message}`),
  });

  return { ...query, toggle };
}