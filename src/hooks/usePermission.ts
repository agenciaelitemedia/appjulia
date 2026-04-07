import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ModuleCode } from '@/types/permissions';

/**
 * Hook for checking user permissions on modules.
 * Delegates to AuthContext.hasPermission() for centralized logic.
 */
export function usePermission() {
  const { user, hasPermission, isAdmin } = useAuth();

  const canView = useCallback((moduleCode: ModuleCode): boolean => {
    return hasPermission(moduleCode, 'view');
  }, [hasPermission]);

  const canCreate = useCallback((moduleCode: ModuleCode): boolean => {
    return hasPermission(moduleCode, 'create');
  }, [hasPermission]);

  const canEdit = useCallback((moduleCode: ModuleCode): boolean => {
    return hasPermission(moduleCode, 'edit');
  }, [hasPermission]);

  const canDelete = useCallback((moduleCode: ModuleCode): boolean => {
    return hasPermission(moduleCode, 'delete');
  }, [hasPermission]);

  const hasAnyPermission = useCallback((moduleCode: ModuleCode): boolean => {
    return hasPermission(moduleCode, 'view') || hasPermission(moduleCode, 'create') || hasPermission(moduleCode, 'edit') || hasPermission(moduleCode, 'delete');
  }, [hasPermission]);

  const getPermission = useCallback((moduleCode: ModuleCode) => {
    return {
      can_view: hasPermission(moduleCode, 'view'),
      can_create: hasPermission(moduleCode, 'create'),
      can_edit: hasPermission(moduleCode, 'edit'),
      can_delete: hasPermission(moduleCode, 'delete'),
    };
  }, [hasPermission]);

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
