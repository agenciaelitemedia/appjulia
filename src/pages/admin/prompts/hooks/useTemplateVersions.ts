import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  name: string;
  description: string | null;
  prompt_text: string;
  changed_by: string | null;
  change_summary: string | null;
  created_at: string;
}

export function useTemplateVersions() {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchVersions = useCallback(async (templateId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_template_versions')
      .select('*')
      .eq('template_id', templateId)
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
    templateId: string,
    currentData: { name: string; description: string | null; prompt_text: string },
    changedBy: string | null,
    changeSummary: string
  ) => {
    // Get next version number
    const { data: lastVersion } = await supabase
      .from('generation_template_versions')
      .select('version_number')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = ((lastVersion as any[])?.[0]?.version_number || 0) + 1;

    const { error } = await supabase
      .from('generation_template_versions')
      .insert({
        template_id: templateId,
        version_number: nextVersion,
        name: currentData.name,
        description: currentData.description,
        prompt_text: currentData.prompt_text,
        changed_by: changedBy,
        change_summary: changeSummary,
      } as any);

    if (error) {
      console.error('Erro ao salvar versão:', error);
    }
  };

  return { versions, isLoading, fetchVersions, saveVersion };
}
