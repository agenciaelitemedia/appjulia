import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { externalDb } from '../extend/db';

export interface OfficeSearchedClient {
  id: number;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
}

/** Busca de clientes (escritórios) existentes — espelha o padrão do wizard de agentes. */
export function useOfficeClientSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<OfficeSearchedClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedTerm = useDebounce(searchTerm, 300);

  const search = useCallback(async (term: string) => {
    if (term.length < 3) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await externalDb.searchClients<OfficeSearchedClient>(term);
      setResults(data);
    } catch (err) {
      console.error('[escritorios] erro ao buscar clientes', err);
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
