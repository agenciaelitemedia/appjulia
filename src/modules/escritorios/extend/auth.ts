/**
 * extend/auth — adaptador de autenticação/permissão do módulo Escritórios.
 */
import { useAuth } from '@/contexts/AuthContext';
import { isOwnerUser } from '@/lib/auth/isOwner';
import { ESCRITORIOS_MODULE } from '../module';
import type { OfficePermissions } from '../types';

export { isOwnerUser };

export function useEscritoriosIdentity() {
  const { user } = useAuth();
  return {
    user,
    userId: Number(user?.id) || null,
    clientId: user?.client_id ? Number(user.client_id) : null,
    codAgent: user?.cod_agent ? Number(user.cod_agent) : null,
    isAdmin: user?.role === 'admin',
    isOwner: isOwnerUser(user),
  };
}

/** Somente admin gerencia escritórios (mesma regra do módulo de agentes). */
export function useEscritoriosPermissions(): OfficePermissions {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'admin';
  const code = ESCRITORIOS_MODULE.code;
  return {
    canView: isAdmin || hasPermission(code as any, 'view'),
    canCreate: isAdmin || hasPermission(code as any, 'create'),
    canEdit: isAdmin || hasPermission(code as any, 'edit'),
    canDelete: isAdmin || hasPermission(code as any, 'delete'),
  };
}