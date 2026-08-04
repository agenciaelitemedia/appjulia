import { useCallback, useState } from 'react';
import bcrypt from 'bcryptjs';
import { useQuery } from '@tanstack/react-query';
import { externalDb } from '../extend/db';
import { generateSecurePassword } from '@/lib/crypto';

/** Senha visível (remember_token) do usuário titular do escritório. */
export function useOfficeOwnerPassword(userId?: number | string | null) {
  const id = userId ? Number(userId) : null;

  const query = useQuery<string | null>({
    queryKey: ['escritorios', 'owner-password', id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await externalDb.raw<{ remember_token: string | null }>({
        query: 'SELECT remember_token FROM users WHERE id = $1 LIMIT 1',
        params: [id],
      });
      return rows?.[0]?.remember_token ?? null;
    },
  });

  const [isResetting, setIsResetting] = useState(false);

  const resetPassword = useCallback(async (): Promise<{
    success: boolean;
    newPassword?: string;
    error?: string;
  }> => {
    if (!id) return { success: false, error: 'Usuário titular não encontrado' };
    setIsResetting(true);
    try {
      const newPassword = generateSecurePassword();
      const hashed = await bcrypt.hash(newPassword, 10);
      await externalDb.resetUserPassword(id, hashed, newPassword);
      await query.refetch();
      return { success: true, newPassword };
    } catch (error) {
      console.error('[escritorios] erro ao resetar senha', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao resetar senha',
      };
    } finally {
      setIsResetting(false);
    }
  }, [id, query]);

  return { password: query.data ?? null, isLoading: query.isLoading, resetPassword, isResetting };
}
