import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LegalCase {
  id: string;
  case_name: string;
  category: string;
  case_info: string | null;
  qualification_script: string | null;
  fees_info: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const CASE_CATEGORIES = [
  'DIREITO PREVIDENCIÁRIO',
  'DIREITO TRABALHISTA',
  'DIREITO DO CONSUMIDOR',
  'DIREITO DE FAMÍLIA',
  'DIREITO CÍVIL',
  'DIREITO PENAL',
  'GERAL',
] as const;

export function useLegalCases() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generation_legal_cases')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar casos:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar casos jurídicos', variant: 'destructive' });
    } else {
      setCases((data as any[]) || []);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const createCase = async (caseData: Omit<LegalCase, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase
      .from('generation_legal_cases')
      .insert(caseData as any);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar caso jurídico', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Caso jurídico salvo com sucesso!' });
    fetchCases();
    return true;
  };

  const updateCase = async (id: string, updates: Partial<LegalCase>) => {
    const { error } = await supabase
      .from('generation_legal_cases')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar caso', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Caso atualizado com sucesso!' });
    fetchCases();
    return true;
  };

  const deleteCase = async (id: string) => {
    const { error } = await supabase
      .from('generation_legal_cases')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir caso', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Caso excluído com sucesso!' });
    fetchCases();
    return true;
  };

  return { cases, isLoading, fetchCases, createCase, updateCase, deleteCase };
}
