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
  user_id?: number;
  evo_url?: string;
  evo_instance?: string;
  evo_apikey?: string;
  data_mask?: boolean;
  hub?: string;
  created_at?: string;
  avatar?: string;
  client_name?: string;
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

  // Hydrate the user's avatar from `clients.photo`. Cached per client_id in
  // localStorage so subsequent navigations / reloads don't refetch.
  const PHOTO_CACHE_KEY = 'auth_client_photo_cache_v1';
  const readPhotoCache = (): Record<string, { photo: string | null; name?: string | null; ts: number }> => {
    try { return JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}'); } catch { return {}; }
  };
  const writePhotoCache = (clientId: number, photo: string | null, name?: string | null) => {
    try {
      const cache = readPhotoCache();
      cache[String(clientId)] = { photo, name: name ?? null, ts: Date.now() };
      localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(cache));
    } catch { /* ignore quota */ }
  };

  const hydrateClientPhoto = useCallback(async (u: User): Promise<User> => {
    if (!u.client_id) return u;
    const cached = readPhotoCache()[String(u.client_id)];
    let next: User = u;
    if (cached) {
      next = {
        ...u,
        avatar: u.avatar || cached.photo || undefined,
        client_name: u.client_name || cached.name || undefined,
      };
    }
    // Refresh in background — keeps the cache fresh without blocking UI.
    (async () => {
      try {
        const client = await externalDb.getClient<{ photo?: string | null; name?: string | null }>(u.client_id!);
        const photo = client?.photo ?? null;
        const name = client?.name ?? null;
        writePhotoCache(u.client_id!, photo, name);
        setUser(prev => {
          if (!prev || prev.id !== u.id) return prev;
          if (prev.avatar === (photo || undefined) && prev.client_name === (name || undefined)) return prev;
          return { ...prev, avatar: photo || undefined, client_name: name || undefined };
        });
      } catch (e) {
        console.warn('[AuthContext] Failed to hydrate client photo', e);
      }
    })();
    return next;
  }, []);

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
          // Hydrate inherited client_id for sub-users (no own client_id but linked via user_id)
          let effectiveUser = parsedUser;
          if (!parsedUser.client_id && parsedUser.id) {
            try {
              const inherited = await externalDb.getEffectiveClientId(Number(parsedUser.id));
              if (inherited) {
                effectiveUser = { ...parsedUser, client_id: Number(inherited) };
                localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(effectiveUser));
              }
            } catch (e) {
              console.warn('[AuthContext] Failed to hydrate effective client_id', e);
            }
          }
          const withPhoto = await hydrateClientPhoto(effectiveUser);
          setUser(withPhoto);
          // Await permissions so components never render with stale permission state
          await loadPermissions(effectiveUser.id);
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

      const withPhoto = await hydrateClientPhoto(authenticatedUser);
      setUser(withPhoto);
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
