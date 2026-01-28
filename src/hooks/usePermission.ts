import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ModuleCode } from '@/types/permissions';

/**
 * Hook for checking user permissions on modules.
 * 
 * Usage:
 * const { canView, canEdit, canCreate, canDelete, hasAnyPermission } = usePermission();
 * 
 * if (canView('crm_leads')) { ... }
 * if (canEdit('agent_management')) { ... }
 */
export function usePermission() {
  const { user, permissions, isAdmin } = useAuth();

  const canView = useCallback((moduleCode: ModuleCode): boolean => {
    // Admin always has access
    if (isAdmin) return true;
    
    // No permissions loaded yet
    if (!permissions) return false;
    
    const permission = permissions.get(moduleCode);
    return permission?.can_view ?? false;
  }, [isAdmin, permissions]);

  const canCreate = useCallback((moduleCode: ModuleCode): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    
    const permission = permissions.get(moduleCode);
    return permission?.can_create ?? false;
  }, [isAdmin, permissions]);

  const canEdit = useCallback((moduleCode: ModuleCode): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    
    const permission = permissions.get(moduleCode);
    return permission?.can_edit ?? false;
  }, [isAdmin, permissions]);

  const canDelete = useCallback((moduleCode: ModuleCode): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    
    const permission = permissions.get(moduleCode);
    return permission?.can_delete ?? false;
  }, [isAdmin, permissions]);

  const hasAnyPermission = useCallback((moduleCode: ModuleCode): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    
    const permission = permissions.get(moduleCode);
    if (!permission) return false;
    
    return permission.can_view || permission.can_create || permission.can_edit || permission.can_delete;
  }, [isAdmin, permissions]);

  const getPermission = useCallback((moduleCode: ModuleCode) => {
    if (isAdmin) {
      return {
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      };
    }
    
    if (!permissions) {
      return {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
    }
    
    const permission = permissions.get(moduleCode);
    return {
      can_view: permission?.can_view ?? false,
      can_create: permission?.can_create ?? false,
      can_edit: permission?.can_edit ?? false,
      can_delete: permission?.can_delete ?? false,
    };
  }, [isAdmin, permissions]);

  return {
    canView,
    canCreate,
    canEdit,
    canDelete,
    hasAnyPermission,
    getPermission,
    isAdmin,
    isAuthenticated: !!user,
  };
}
