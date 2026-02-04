import { useState, useEffect, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchedAgent {
  id: number;
  cod_agent: string;
  client_name: string;
  business_name: string | null;
}

export function useAgentSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedTerm = useDebounce(searchTerm, 300);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await externalDb.searchAgents<SearchedAgent>(term);
      setResults(data);
    } catch (err) {
      console.error('Error searching agents:', err);
      setError('Erro ao buscar agentes');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedTerm);
  }, [debouncedTerm, search]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
    setError(null);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isLoading,
    error,
    clearSearch,
  };
}
