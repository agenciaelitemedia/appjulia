import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgentPromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  snapshot: any;
  changed_by: string | null;
  change_summary: string | null;
  created_at: string;
}

export function useAgentPromptVersions() {
  const [versions, setVersions] = useState<AgentPromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchVersions = useCallback(async (promptId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_agent_prompt_versions')
      .select('*')
      .eq('prompt_id', promptId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Erro ao buscar versões:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar histórico', variant: 'destructive' });
    } else {
      setVersions((data as any[]) || []);
    }
    setIsLoading(false);
  }, [toast]);

  return { versions, isLoading, fetchVersions };
}
