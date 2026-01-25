import { useState, useEffect, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchedClient {
  id: number;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
}

export function useClientSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchedClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedTerm = useDebounce(searchTerm, 300);

  const search = useCallback(async (term: string) => {
    if (term.length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await externalDb.searchClients<SearchedClient>(term);
      setResults(data);
    } catch (err) {
      console.error('Error searching clients:', err);
      setError('Erro ao buscar clientes');
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
