/**
 * extend/clients — busca de escritórios (clients) para o admin escolher o tenant.
 */
import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { unmask } from '@/lib/inputMasks';
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

export interface XJNewClientInput {
  name: string;
  business_name?: string;
  federal_id?: string;
  email?: string;
  phone?: string;
}

/**
 * Cria um escritório (cliente) na base externa — mesmas regras do wizard
 * de /admin/agentes-novo (CPF/CNPJ validado contra duplicidade).
 */
export async function createXJClient(input: XJNewClientInput): Promise<XJSearchedClient> {
  const federalId = unmask(input.federal_id || '');
  if (federalId) {
    const check = await externalDb.checkFederalIdExists(federalId);
    if (check.exists) throw new Error('CPF/CNPJ já cadastrado no sistema');
  }

  const created = await externalDb.insertClient({
    name: input.name,
    business_name: input.business_name || null,
    federal_id: federalId || null,
    email: input.email || null,
    phone: unmask(input.phone || '') || null,
  } as any);

  return {
    id: created.id,
    name: created.name,
    business_name: created.business_name ?? null,
    email: created.email ?? null,
    phone: created.phone ?? null,
  };
}