import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTemplateVersions } from './useTemplateVersions';

export interface Template {
  id: string;
  name: string;
  description: string | null;
  prompt_text: string;
  closing_model_text: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { saveVersion } = useTemplateVersions();

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar templates:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar templates', variant: 'destructive' });
    } else {
      setTemplates((data as any[]) || []);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const createTemplate = async (name: string, description: string | null, prompt_text: string, closing_model_text: string | null, userName?: string) => {
    const { error } = await supabase
      .from('generation_templates')
      .insert({ name, description, prompt_text, closing_model_text, created_by: userName || null } as any);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao criar template', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Template criado com sucesso!' });
    fetchTemplates();
    return true;
  };

  const updateTemplate = async (id: string, updates: Partial<Pick<Template, 'name' | 'description' | 'prompt_text' | 'closing_model_text'>>, userName?: string) => {
    // Save current version before updating
    const current = templates.find(t => t.id === id);
    if (current) {
      const changes: string[] = [];
      if (updates.name && updates.name !== current.name) changes.push('Nome');
      if (updates.description !== undefined && updates.description !== current.description) changes.push('Descrição');
      if (updates.prompt_text && updates.prompt_text !== current.prompt_text) changes.push('Prompt');
      if (updates.closing_model_text !== undefined && updates.closing_model_text !== current.closing_model_text) changes.push('Modelo de Fechamento');
      const summary = changes.length > 0 ? `${changes.join(' e ')} alterado${changes.length > 1 ? 's' : ''}` : 'Atualização';
      await saveVersion(id, { name: current.name, description: current.description, prompt_text: current.prompt_text, closing_model_text: current.closing_model_text }, userName || null, summary);
    }

    const { error } = await supabase
      .from('generation_templates')
      .update({ ...updates, updated_at: new Date().toISOString(), updated_by: userName || null } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar template', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Template atualizado com sucesso!' });
    fetchTemplates();
    return true;
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('generation_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir template', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Template excluído com sucesso!' });
    fetchTemplates();
    return true;
  };

  return { templates, isLoading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate };
}
