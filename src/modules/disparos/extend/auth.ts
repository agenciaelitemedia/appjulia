/**
 * extend/auth — identidade, permissões e resolução de tenant.
 */
export { useAuth } from '@/contexts/AuthContext';
export { isOwnerUser, useIsOwner } from '@/lib/auth/isOwner';
export { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';
