/**
 * extend/auth — adaptador de autenticação/permissão para o módulo Flow Builder.
 */
import { useAuth } from '@/contexts/AuthContext';
import { isOwnerUser } from '@/lib/auth/isOwner';
import { FLOW_BUILDER_MODULE } from '../module';
import type { FlowPermissions } from '../types';

export { isOwnerUser };

export function useFlowBuilderIdentity() {
  const { user } = useAuth();
  const clientId = String(user?.cod_agent || user?.id || 'default');
  return {
    user,
    clientId,
    codAgent: user?.cod_agent ? String(user.cod_agent) : null,
    isOwner: isOwnerUser(user),
    isAdmin: user?.role === 'admin',
  };
}

export function useFlowBuilderPermissions(): FlowPermissions {
  const { user, hasPermission } = useAuth();
  const bypass = isOwnerUser(user);
  const code = FLOW_BUILDER_MODULE.code;
  return {
    canView: bypass || hasPermission(code, 'view'),
    canCreate: bypass || hasPermission(code, 'create'),
    canEdit: bypass || hasPermission(code, 'edit'),
    canDelete: bypass || hasPermission(code, 'delete'),
  };
}