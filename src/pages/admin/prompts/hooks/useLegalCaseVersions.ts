import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LegalCaseVersion {
  id: string;
  case_id: string;
  version_number: number;
  case_name: string;
  category: string;
  case_info: string | null;
  qualification_script: string | null;
  fees_info: string | null;
  changed_by: string | null;
  change_summary: string | null;
  created_at: string;
}

export function useLegalCaseVersions() {
  const [versions, setVersions] = useState<LegalCaseVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchVersions = useCallback(async (caseId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_legal_case_versions')
      .select('*')
      .eq('case_id', caseId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Erro ao buscar versões:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar histórico', variant: 'destructive' });
    } else {
      setVersions((data as any[]) || []);
    }
    setIsLoading(false);
  }, [toast]);

  const saveVersion = async (
    caseId: string,
    currentData: {
      case_name: string;
      category: string;
      case_info: string | null;
      qualification_script: string | null;
      fees_info: string | null;
    },
    changedBy: string | null,
    changeSummary: string
  ) => {
    const { data: lastVersion } = await supabase
      .from('generation_legal_case_versions')
      .select('version_number')
      .eq('case_id', caseId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = ((lastVersion as any[])?.[0]?.version_number || 0) + 1;

    const { error } = await supabase
      .from('generation_legal_case_versions')
      .insert({
        case_id: caseId,
        version_number: nextVersion,
        case_name: currentData.case_name,
        category: currentData.category,
        case_info: currentData.case_info,
        qualification_script: currentData.qualification_script,
        fees_info: currentData.fees_info,
        changed_by: changedBy,
        change_summary: changeSummary,
      } as any);

    if (error) {
      console.error('Erro ao salvar versão:', error);
    }
  };

  return { versions, isLoading, fetchVersions, saveVersion };
}
