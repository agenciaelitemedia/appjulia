import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import type { ModuleCode } from '@/types/permissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: ModuleCode;
  action?: 'view' | 'create' | 'edit' | 'delete';
  fallbackPath?: string;
}

/**
 * ProtectedRoute component that checks user permissions for a specific module.
 * 
 * Usage:
 * <ProtectedRoute module="crm_leads">
 *   <LeadsPage />
 * </ProtectedRoute>
 * 
 * For admin-only routes (backwards compatibility):
 * <ProtectedRoute module="admin_agents">
 *   <AdminPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({ 
  children, 
  module, 
  action = 'view',
  fallbackPath = '/dashboard' 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, permissionsLoading } = useAuth();
  const { canView, canCreate, canEdit, canDelete, isAdmin } = usePermission();

  // Show loading while checking auth/permissions
  if (isLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If no module specified, just check authentication
  if (!module) {
    return <>{children}</>;
  }

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check permission based on action
  let hasAccess = false;
  switch (action) {
    case 'view':
      hasAccess = canView(module);
      break;
    case 'create':
      hasAccess = canCreate(module);
      break;
    case 'edit':
      hasAccess = canEdit(module);
      break;
    case 'delete':
      hasAccess = canDelete(module);
      break;
  }

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
