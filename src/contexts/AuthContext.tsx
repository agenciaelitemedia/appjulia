import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';
import type { UserPermission, PermissionMap, ModuleCode, AppRole } from '@/types/permissions';
import { createPermissionMap } from '@/types/permissions';
import { STORAGE_KEYS } from '@/lib/constants';

interface User {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  cod_agent?: number;
  client_id?: number;
  evo_url?: string;
  evo_instance?: string;
  evo_apikey?: string;
  data_mask?: boolean;
  hub?: string;
  created_at?: string;
  avatar?: string;
  use_custom_permissions?: boolean;
  is_active?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: PermissionMap | null;
  permissionsLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshPermissions: () => Promise<void>;
  hasPermission: (moduleCode: ModuleCode, action?: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadPermissions = useCallback(async (userId: number) => {
    try {
      setPermissionsLoading(true);
      const perms = await externalDb.getUserPermissions(userId);
      setPermissions(createPermissionMap(perms));
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setPermissions(null);
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (user?.id) {
      await loadPermissions(user.id);
    }
  }, [user?.id, loadPermissions]);

  useEffect(() => {
    // Check for existing session
    const restoreSession = async () => {
      const storedUser = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // Await permissions so components never render with stale permission state
          await loadPermissions(parsedUser.id);
        } catch {
          localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
          localStorage.removeItem(STORAGE_KEYS.AUTH_PERMISSIONS);
        }
      }
      setIsLoading(false);
    };
    restoreSession();
  }, [loadPermissions]);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Use dedicated login action with bcrypt verification in edge function
      const users = await externalDb.login<User>(email, password);

      if (users.length === 0) {
        return { success: false, error: 'Credenciais inválidas' };
      }

      const authenticatedUser = users[0];

      // Check if user is active
      if (authenticatedUser.is_active === false) {
        return { success: false, error: 'Usuário inativo. Entre em contato com o administrador.' };
      }

      setUser(authenticatedUser);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(authenticatedUser));
      
      // Load permissions after login
      await loadPermissions(authenticatedUser.id);
      
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Erro ao fazer login' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setPermissions(null);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_PERMISSIONS);
  };

  const hasPermission = useCallback((moduleCode: ModuleCode, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean => {
    // Admin always has access
    if (isAdmin) return true;
    
    // No permissions loaded
    if (!permissions) return false;
    
    const permission = permissions.get(moduleCode);
    if (!permission) return false;
    
    switch (action) {
      case 'view': return permission.can_view;
      case 'create': return permission.can_create;
      case 'edit': return permission.can_edit;
      case 'delete': return permission.can_delete;
      default: return false;
    }
  }, [isAdmin, permissions]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin,
      permissions,
      permissionsLoading,
      login,
      logout,
      refreshPermissions,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
