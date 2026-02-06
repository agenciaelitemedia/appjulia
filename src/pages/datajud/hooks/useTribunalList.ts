import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tribunal, TribunalCategory } from '../types';

interface TribunalsResponse {
  tribunals: Tribunal[];
}

export function useTribunalList() {
  return useQuery({
    queryKey: ['datajud', 'tribunals'],
    queryFn: async (): Promise<Tribunal[]> => {
      const { data, error } = await supabase.functions.invoke('datajud-search', {
        body: { action: 'list_tribunals' },
      });

      if (error) throw error;
      return (data as TribunalsResponse).tribunals;
    },
    staleTime: Infinity, // Tribunals list never changes
  });
}

// Group tribunals by category
export function groupTribunalsByCategory(tribunals: Tribunal[]): Record<TribunalCategory, Tribunal[]> {
  return tribunals.reduce(
    (acc, tribunal) => {
      const category = tribunal.category as TribunalCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tribunal);
      return acc;
    },
    {} as Record<TribunalCategory, Tribunal[]>
  );
}

// Category order for display
export const CATEGORY_ORDER: TribunalCategory[] = [
  'Superior',
  'Federal',
  'Estadual',
  'Trabalhista',
  'Eleitoral',
  'Militar',
];

// Category labels
export const CATEGORY_LABELS: Record<TribunalCategory, string> = {
  Superior: 'Tribunais Superiores',
  Federal: 'Justiça Federal',
  Estadual: 'Justiça Estadual',
  Trabalhista: 'Justiça do Trabalho',
  Eleitoral: 'Justiça Eleitoral',
  Militar: 'Justiça Militar',
};
