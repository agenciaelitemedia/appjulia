/**
 * extend/clients — busca de escritórios (clients) para o admin escolher o tenant.
 */
import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { externalDb } from './db';

export interface XJSearchedClient {
  id: number;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
}

export function useXJClientSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<XJSearchedClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedTerm = useDebounce(searchTerm, 300);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 3) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await externalDb.searchClients<XJSearchedClient>(term.trim());
      setResults(data || []);
    } catch (error) {
      console.error('[x-julia] erro ao buscar escritórios', error);
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
  }, []);

  return { searchTerm, setSearchTerm, results, isLoading, clearSearch };
}