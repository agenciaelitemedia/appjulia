/**
 * extend/permissions — leitura/escrita das permissões de módulo para o usuário do escritório.
 */
import { useQuery } from '@tanstack/react-query';
import { externalDb } from './db';
import type { Module, PermissionUpdate } from '@/types/permissions';
import { OFFICE_MODULE_CODES } from '../module';

export function useSystemModules() {
  return useQuery<Module[]>({
    queryKey: ['escritorios', 'modules'],
    queryFn: () => externalDb.getModules(),
    staleTime: 5 * 60_000,
  });
}

/** Aplica as permissões do pacote do escritório ao usuário titular. */
export async function applyOfficePermissions(userId: number, moduleCodes: string[]) {
  const permissions: PermissionUpdate[] = moduleCodes.map((code) => ({
    moduleCode: code as any,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  }));
  await externalDb.updateUserPermissions(userId, permissions, true);
}

export async function getOfficeUserPermissions(userId: number) {
  const perms = await externalDb.getUserPermissions(userId);
  return perms.filter((p) => OFFICE_MODULE_CODES.includes(String(p.module_code)));
}