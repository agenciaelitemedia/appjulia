import { useState, useEffect, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';

export interface Plan {
  id: number;
  name: string;
  leads_limit: number;
  price: number;
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await externalDb.getPlans<Plan>();
      setPlans(data);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Erro ao carregar planos');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    isLoading,
    error,
    refetch: fetchPlans,
  };
}
