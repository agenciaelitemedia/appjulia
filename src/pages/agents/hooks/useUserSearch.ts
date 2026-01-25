import { useState, useEffect, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchedUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function useUserSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
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
      const data = await externalDb.searchUsers<SearchedUser>(term);
      setResults(data);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Erro ao buscar usuários');
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
