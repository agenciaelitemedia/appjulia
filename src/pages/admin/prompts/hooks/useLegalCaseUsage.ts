import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CaseUsageEntry {
  cod_agent: string | null;
  agent_name: string | null;
  business_name: string | null;
}

export type CaseUsageMap = Map<string, CaseUsageEntry[]>;

export function useLegalCaseUsage() {
  const [usage, setUsage] = useState<CaseUsageMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_agent_prompt_cases')
      .select('case_id, generation_agent_prompts!inner(cod_agent, agent_name, business_name)');

    const map: CaseUsageMap = new Map();
    if (!error && data) {
      for (const row of data as any[]) {
        const caseId = row.case_id as string;
        const ap = row.generation_agent_prompts;
        if (!caseId || !ap) continue;
        const entry: CaseUsageEntry = {
          cod_agent: ap.cod_agent ?? null,
          agent_name: ap.agent_name ?? null,
          business_name: ap.business_name ?? null,
        };
        const list = map.get(caseId) || [];
        list.push(entry);
        map.set(caseId, list);
      }
      // Sort each list by cod_agent
      map.forEach((list) => {
        list.sort((a, b) => (a.cod_agent || '').localeCompare(b.cod_agent || ''));
      });
    }
    setUsage(map);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  return { usage, isLoading, refetch: fetchUsage };
}