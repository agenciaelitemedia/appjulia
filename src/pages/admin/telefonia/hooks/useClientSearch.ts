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

  const debounced = useDebounce(searchTerm, 300);

  const search = useCallback(async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await externalDb.searchClients<SearchedClient>(term.trim());
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[useClientSearch] error', e);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debounced);
  }, [debounced, search]);

  return { searchTerm, setSearchTerm, results, isLoading };
}