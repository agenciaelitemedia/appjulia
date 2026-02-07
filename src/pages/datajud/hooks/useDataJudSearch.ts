import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SearchType, TribunalResult, ProcessData } from '../types';
import { toast } from 'sonner';

interface SearchParams {
  type: SearchType;
  query: string;
  tribunals?: string[];
  size?: number;
}

interface SearchResponse {
  results: TribunalResult[];
  totalResults: number;
  searchedTribunals: number;
  responseTime: number;
}

interface SearchHistory {
  id: string;
  type: SearchType;
  query: string;
  tribunals?: string[];
  results: TribunalResult[];
  totalResults: number;
  timestamp: number;
}

const STORAGE_KEY = 'datajud_search_history';
const MAX_HISTORY = 20;

// Helper functions for localStorage
function loadSearchHistory(): SearchHistory[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history: SearchHistory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

function addToSearchHistory(search: SearchParams, results: TribunalResult[], totalResults: number): void {
  const history = loadSearchHistory();
  const newEntry: SearchHistory = {
    id: `${Date.now()}-${Math.random()}`,
    type: search.type,
    query: search.query,
    tribunals: search.tribunals,
    results,
    totalResults,
    timestamp: Date.now(),
  };
  
  // Remove duplicates (same query, type, tribunals)
  const filtered = history.filter(
    (h) => !(h.type === search.type && h.query === search.query && 
      JSON.stringify(h.tribunals) === JSON.stringify(search.tribunals))
  );
  
  saveSearchHistory([newEntry, ...filtered]);
}

export function useDataJudSearch() {
  const [results, setResults] = useState<TribunalResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchedTribunals, setSearchedTribunals] = useState(0);
  const [responseTime, setResponseTime] = useState(0);

  // Load search history
  const { data: searchHistory = [] } = useQuery({
    queryKey: ['datajud', 'search-history'],
    queryFn: () => loadSearchHistory(),
    staleTime: Infinity,
  });

  const searchMutation = useMutation({
    mutationFn: async ({ type, query, tribunals, size = 10 }: SearchParams): Promise<SearchResponse> => {
      const actionMap: Record<SearchType, string> = {
        process_number: 'search_by_number',
        document: 'search_by_document',
        lawyer: 'search_by_lawyer',
      };

      const { data, error } = await supabase.functions.invoke('datajud-search', {
        body: {
          action: actionMap[type],
          query,
          tribunals,
          size,
        },
      });

      if (error) throw error;
      return data as SearchResponse;
    },
    onSuccess: (data, variables) => {
      setResults(data.results);
      setTotalResults(data.totalResults);
      setSearchedTribunals(data.searchedTribunals);
      setResponseTime(data.responseTime);
      
      // Add to search history
      addToSearchHistory(variables, data.results, data.totalResults);
      
      if (data.totalResults === 0) {
        toast.info('Nenhum processo encontrado', {
          description: 'Tente ajustar os termos de busca ou selecionar tribunais específicos',
        });
      } else {
        toast.success(`${data.totalResults} processo(s) encontrado(s)`, {
          description: `Busca em ${data.searchedTribunals} tribunais (${(data.responseTime / 1000).toFixed(1)}s)`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Search error:', error);
      // Handle LGPD restriction errors
      if (error?.message?.includes('not_supported') || error?.error === 'not_supported') {
        toast.error('Busca não disponível', {
          description: error.message || 'Este tipo de busca não está disponível na API pública.',
        });
      } else {
        toast.error('Erro na busca', {
          description: error instanceof Error ? error.message : 'Tente novamente',
        });
      }
    },
  });

  const search = useCallback(
    (params: SearchParams) => {
      if (!params.query.trim()) {
        toast.warning('Digite um termo para buscar');
        return;
      }
      searchMutation.mutate(params);
    },
    [searchMutation]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setTotalResults(0);
    setSearchedTribunals(0);
    setResponseTime(0);
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Refetch history
      window.dispatchEvent(new Event('storage'));
      toast.success('Histórico limpo');
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, []);

  return {
    search,
    clearResults,
    clearHistory,
    results,
    totalResults,
    searchedTribunals,
    responseTime,
    isSearching: searchMutation.isPending,
    error: searchMutation.error,
    searchHistory,
  };
}

// Hook for getting process movements with caching
export function useProcessMovements() {
  return useMutation({
    mutationFn: async ({ processNumber, tribunal }: { processNumber: string; tribunal: string }) => {
      const { data, error } = await supabase.functions.invoke('datajud-search', {
        body: {
          action: 'get_movements',
          processNumber,
          tribunals: [tribunal],
        },
      });

      if (error) throw error;
      return data as { movements: ProcessData['movimentos']; process: ProcessData | null };
    },
  });
}

// Hook to restore search from history
export function useRestoreSearchFromHistory(historyId: string) {
  const history = loadSearchHistory();
  return history.find((h) => h.id === historyId) || null;
}
