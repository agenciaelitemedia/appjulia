import { useState, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';

export function useAgentCode() {
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextCode = await externalDb.getNextAgentCode();
      setCode(nextCode);
      return nextCode;
    } catch (err) {
      console.error('Error generating agent code:', err);
      setError('Erro ao gerar código do agente');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCode = useCallback(() => {
    setCode('');
    setError(null);
  }, []);

  return {
    code,
    isLoading,
    error,
    generateCode,
    clearCode,
  };
}
