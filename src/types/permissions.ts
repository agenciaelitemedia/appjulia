// Permission System Types

export type AppRole = 'admin' | 'colaborador' | 'user' | 'time';

export type ModuleCategory = 'principal' | 'crm' | 'agente' | 'sistema' | 'admin' | 'financeiro';

export type ModuleCode =
  | 'dashboard'
  | 'crm_leads'
  | 'crm_monitoring'
  | 'crm_statistics'
  | 'agent_management'
  | 'followup'
  | 'strategic_perf'
  | 'strategic_contract'
  | 'library'
  | 'team'
  | 'admin_agents'
  | 'admin_products'
  | 'admin_files'
  | 'finance_billing'
  | 'finance_clients'
  | 'finance_reports'
  | 'datajud'
  | 'copilot_admin'
  | 'settings';

export interface Module {
  id: number;
  code: ModuleCode;
  name: string;
  description?: string;
  category: ModuleCategory;
  is_active: boolean;
  display_order: number;
  // Menu fields
  icon?: string;
  route?: string;
  parent_module_id?: number | null;
  menu_group?: string;
  is_menu_visible?: boolean;
}

export interface UserPermission {
  module_code: ModuleCode;
  module_name: string;
  category: ModuleCategory;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface PermissionUpdate {
  moduleCode: ModuleCode;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
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
  remember_token?: string | null;
}

// Permission map for quick lookups
export type PermissionMap = Map<ModuleCode, UserPermission>;

// Helper to convert array to map
export function createPermissionMap(permissions: UserPermission[]): PermissionMap {
  return new Map(permissions.map(p => [p.module_code, p]));
}
