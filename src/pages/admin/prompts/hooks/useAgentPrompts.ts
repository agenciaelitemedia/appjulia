import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgentPrompt {
  id: string;
  cod_agent: string;
  agent_name: string | null;
  business_name: string | null;
  template_id: string | null;
  ai_name: string | null;
  practice_areas: string | null;
  working_hours: string | null;
  office_info: string | null;
  welcome_message: string | null;
  generated_prompt: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentPromptCase {
  id: string;
  agent_prompt_id: string;
  case_id: string;
  case_name: string | null;
  ctas: string[];
  semantic_words: string | null;
  case_info: string | null;
  qualification_script: string | null;
  zapsign_token: string | null;
  zapsign_doc_token: string | null;
  contract_fields: any;
  fees_text: string | null;
  closing_model_text: string | null;
  negotiation_text: string | null;
  position: number;
  created_at: string;
}

export function useAgentPrompts() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_agent_prompts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar prompts:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar prompts', variant: 'destructive' });
    } else {
      setPrompts((data as any[]) || []);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const fetchCases = async (promptId: string): Promise<AgentPromptCase[]> => {
    const { data, error } = await supabase
      .from('generation_agent_prompt_cases')
      .select('*')
      .eq('agent_prompt_id', promptId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Erro ao buscar casos:', error);
      return [];
    }
    return (data as any[]) || [];
  };

  const createPrompt = async (
    promptData: Omit<AgentPrompt, 'id' | 'is_active' | 'created_at' | 'updated_at'>,
    cases: Omit<AgentPromptCase, 'id' | 'agent_prompt_id' | 'created_at'>[]
  ) => {
    const { data, error } = await supabase
      .from('generation_agent_prompts')
      .insert(promptData as any)
      .select('id')
      .single();

    if (error || !data) {
      toast({ title: 'Erro', description: 'Falha ao criar prompt', variant: 'destructive' });
      return false;
    }

    const promptId = (data as any).id;

    if (cases.length > 0) {
      const casesWithPromptId = cases.map(c => ({ ...c, agent_prompt_id: promptId }));
      const { error: casesError } = await supabase
        .from('generation_agent_prompt_cases')
        .insert(casesWithPromptId as any[]);

      if (casesError) {
        console.error('Erro ao salvar casos:', casesError);
        toast({ title: 'Aviso', description: 'Prompt criado mas houve erro ao salvar os casos', variant: 'destructive' });
      }
    }

    toast({ title: 'Sucesso', description: 'Prompt criado com sucesso!' });
    fetchPrompts();
    return true;
  };

  const updatePrompt = async (
    id: string,
    updates: Partial<AgentPrompt>,
    cases?: Omit<AgentPromptCase, 'id' | 'agent_prompt_id' | 'created_at'>[],
    userName?: string
  ) => {
    // Save version before updating
    const current = prompts.find(p => p.id === id);
    if (current) {
      const currentCases = await fetchCases(id);
      const { data: lastVersion } = await supabase
        .from('generation_agent_prompt_versions')
        .select('version_number')
        .eq('prompt_id', id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = ((lastVersion as any[])?.[0]?.version_number || 0) + 1;

      await supabase.from('generation_agent_prompt_versions').insert({
        prompt_id: id,
        version_number: nextVersion,
        snapshot: { prompt: current, cases: currentCases },
        changed_by: userName || null,
        change_summary: 'Atualização',
      } as any);
    }

    const { error } = await supabase
      .from('generation_agent_prompts')
      .update({ ...updates, updated_at: new Date().toISOString(), updated_by: userName || null } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar prompt', variant: 'destructive' });
      return false;
    }

    if (cases !== undefined) {
      // Delete old cases and insert new
      await supabase.from('generation_agent_prompt_cases').delete().eq('agent_prompt_id', id);
      if (cases.length > 0) {
        const casesWithPromptId = cases.map(c => ({ ...c, agent_prompt_id: id }));
        await supabase.from('generation_agent_prompt_cases').insert(casesWithPromptId as any[]);
      }
    }

    toast({ title: 'Sucesso', description: 'Prompt atualizado com sucesso!' });
    fetchPrompts();
    return true;
  };

  const deletePrompt = async (id: string) => {
    const { error } = await supabase
      .from('generation_agent_prompts')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir prompt', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Prompt excluído com sucesso!' });
    fetchPrompts();
    return true;
  };

  return { prompts, isLoading, fetchPrompts, fetchCases, createPrompt, updatePrompt, deletePrompt };
}
