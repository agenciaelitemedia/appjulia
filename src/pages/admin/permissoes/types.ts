import type { AppRole, ModuleCategory, ModuleCode, UserPermission } from '@/types/permissions';

export interface PermissionRow {
  moduleCode: ModuleCode;
  moduleName: string;
  category: ModuleCategory;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isDefault?: boolean;
}

export interface UserWithPermissions {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  use_custom_permissions: boolean;
  is_active: boolean;
  parent_user_id: number | null;
  created_at: string;
}

export const categoryLabels: Record<ModuleCategory, string> = {
  principal: 'Principal',
  crm: 'CRM',
  agente: 'Agente',
  sistema: 'Sistema',
  admin: 'Administrativo',
  financeiro: 'Financeiro',
};

export const categoryColors: Record<ModuleCategory, string> = {
  principal: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  crm: 'bg-green-500/10 text-green-600 dark:text-green-400',
  agente: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  sistema: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  admin: 'bg-red-500/10 text-red-600 dark:text-red-400',
  financeiro: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
};

export const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  colaborador: 'Colaborador',
  user: 'Usuário',
  time: 'Time',
};

export function permissionToRow(p: UserPermission): PermissionRow {
  return {
    moduleCode: p.module_code,
    moduleName: p.module_name,
    category: p.category,
    canView: p.can_view,
    canCreate: p.can_create,
    canEdit: p.can_edit,
    canDelete: p.can_delete,
  };
}
