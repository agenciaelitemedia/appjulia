/**
 * Owner/titular do escritório (frontend).
 *
 * Regra: `role ∈ {'admin', 'user', 'colaborador'}`.
 *
 * Espelha o critério "papel privilegiado do escritório" já replicado em
 * várias telas do sistema:
 *   - `PRIVILEGED_ROLES` em `src/components/chat/ChatList.tsx`
 *   - `ALLOWED_FULL_LIST_ROLES` em `src/pages/tarefas/components/AddRankedTasksDialog.tsx`
 *   - `DELETE_ALLOWED_ROLES` em `src/pages/agente/filas/components/QueueCard.tsx`
 *   - `canManage` em `src/pages/crm-builder/{CRMBuilderPage,BoardPage}.tsx`
 *
 * Observação: a action backend `get_principal_users` cobre apenas
 * `admin` + `user` (o que é retornado como "principal" na gestão de equipe).
 * `colaborador` é privilegiado no cliente mas não figura como principal na
 * gestão de equipe — comportamento intencional.
 */
import { useAuth } from '@/contexts/AuthContext';

export const OWNER_ROLES = ['admin', 'user', 'colaborador'] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export function isOwnerUser(user: unknown): boolean {
  const role = (user as { role?: string } | null)?.role;
  if (!role) return false;
  return (OWNER_ROLES as readonly string[]).includes(role);
}

export function useIsOwner(): boolean {
  const { user } = useAuth();
  return isOwnerUser(user);
}