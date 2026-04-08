import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AgentAlias {
  id: string;
  cod_agent: string;
  alias: string;
}

export function getDefaultAlias(businessName: string | null | undefined): string {
  if (!businessName) return '';
  return businessName.replace(/\[JulIAv2\]\s*/gi, '').trim();
}

export function useAgentAliases() {
  const queryClient = useQueryClient();

  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ['agent-aliases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_aliases')
        .select('id, cod_agent, alias');
      if (error) throw error;
      return (data || []) as AgentAlias[];
    },
  });

  const aliasMap = new Map(aliases.map(a => [a.cod_agent, a.alias]));

  const getAlias = (codAgent: string, fallbackBusinessName?: string | null): string => {
    const saved = aliasMap.get(codAgent);
    if (saved) return saved;
    return getDefaultAlias(fallbackBusinessName);
  };

  const upsertAlias = useMutation({
    mutationFn: async ({ codAgent, alias }: { codAgent: string; alias: string }) => {
      const { error } = await supabase
        .from('agent_aliases')
        .upsert(
          { cod_agent: codAgent, alias, updated_at: new Date().toISOString() },
          { onConflict: 'cod_agent' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-aliases'] });
    },
  });

  return { aliases, aliasMap, getAlias, upsertAlias, isLoading };
}
