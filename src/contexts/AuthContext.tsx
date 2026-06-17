import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { externalDb } from '@/lib/externalDb';
import type { UserPermission, PermissionMap, ModuleCode, AppRole } from '@/types/permissions';
import { createPermissionMap } from '@/types/permissions';
import { STORAGE_KEYS } from '@/lib/constants';
import { logUserActivity } from '@/lib/userActivityLog';
import { collectClientEnvironment, logUserDevice } from '@/lib/clientEnvironment';
import { supabase } from '@/integrations/supabase/client';

/** Remove a presença do usuário no painel da equipe imediatamente. */
function clearPresence(userId: number | null | undefined) {
  if (!userId) return;
  try {
    void (supabase as any).rpc('clear_user_presence', { p_user_id: Number(userId) });
  } catch { /* ignore */ }
}

declare const __APP_VERSION__: string;

// 30min de inatividade → logout automático
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Throttle para escrita de "última atividade" no localStorage
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
// Frequência da checagem de inatividade
const INACTIVITY_CHECK_INTERVAL_MS = 30_000;

const isPreviewHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host.includes('lovableproject.com') || host.includes('id-preview--');
};

// Força reload na nova versão limpando SW e caches
const forceReloadForNewVersion = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  window.location.replace(
    window.location.pathname + window.location.search + window.location.hash,
  );
};

// Compara versão local com /version.json. Retorna true se houve reload.
const checkVersionAndReloadIfNeeded = async (): Promise<boolean> => {
  if (isPreviewHost()) return false;
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  if (!currentVersion) return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.version && data.version !== currentVersion) {
      await forceReloadForNewVersion();
      return true;
    }
  } catch { /* ignore network errors */ }
  return false;
};

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
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Hydrate the user's avatar. We prefer the per-user photo from
  // public.user_avatars (Lovable Cloud) and fall back to clients.photo
  // (the company-wide logo on the external DB) when the user hasn't set one.
  const PHOTO_CACHE_KEY = 'auth_client_photo_cache_v1';
  const USER_PHOTO_CACHE_KEY = 'auth_user_photo_cache_v1';
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
  const readUserPhotoCache = (): Record<string, { photo: string | null; ts: number }> => {
    try { return JSON.parse(localStorage.getItem(USER_PHOTO_CACHE_KEY) || '{}'); } catch { return {}; }
  };
  const writeUserPhotoCache = (userId: number, photo: string | null) => {
    try {
      const cache = readUserPhotoCache();
      cache[String(userId)] = { photo, ts: Date.now() };
      localStorage.setItem(USER_PHOTO_CACHE_KEY, JSON.stringify(cache));
    } catch { /* ignore quota */ }
  };

  const hydrateClientPhoto = useCallback(async (u: User): Promise<User> => {
    if (!u.id && !u.client_id) return u;
    const cachedClient = u.client_id ? readPhotoCache()[String(u.client_id)] : undefined;
    const cachedUser = u.id ? readUserPhotoCache()[String(u.id)] : undefined;
    let next: User = u;
    const cachedAvatar = cachedUser?.photo || cachedClient?.photo || undefined;
    if (cachedAvatar || cachedClient?.name) {
      next = {
        ...u,
        avatar: u.avatar || cachedAvatar,
        client_name: u.client_name || cachedClient?.name || undefined,
      };
    }
    // Refresh in background — keeps the cache fresh without blocking UI.
    (async () => {
      try {
        // Per-user avatar (Lovable Cloud)
        let userPhoto: string | null = null;
        if (u.id) {
          try {
            const { data } = await supabase
              .from('user_avatars')
              .select('photo_url')
              .eq('user_id', u.id)
              .maybeSingle();
            userPhoto = data?.photo_url ?? null;
            writeUserPhotoCache(u.id, userPhoto);
          } catch (e) {
            console.warn('[AuthContext] Failed to load user avatar', e);
          }
        }

        // Company photo (fallback) + client name
        let clientPhoto: string | null = null;
        let name: string | null = null;
        if (u.client_id) {
          const client = await externalDb.getClient<{ photo?: string | null; name?: string | null }>(u.client_id);
          clientPhoto = client?.photo ?? null;
          name = client?.name ?? null;
          writePhotoCache(u.client_id, clientPhoto, name);
        }

        const photo = userPhoto || clientPhoto;
        setUser(prev => {
          if (!prev || prev.id !== u.id) return prev;
          if (prev.avatar === (photo || undefined) && prev.client_name === (name || undefined)) return prev;
          return { ...prev, avatar: photo || undefined, client_name: name || undefined };
        });
      } catch (e) {
        console.warn('[AuthContext] Failed to hydrate avatar', e);
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
        // Sessão expira por inatividade (1h)
        const lastActivityRaw = localStorage.getItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
        const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : 0;
        const expired = !lastActivity || (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS);
        if (expired) {
          // Registra logout por inatividade ao restaurar sessão expirada
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed?.id) {
              await logUserActivity({
                userId: Number(parsed.id),
                userName: parsed.name,
                clientId: parsed.client_id ?? null,
                eventType: 'logout_inactivity',
              });
              clearPresence(parsed.id);
            }
          } catch { /* ignore */ }
          localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
          localStorage.removeItem(STORAGE_KEYS.AUTH_PERMISSIONS);
          localStorage.removeItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
          setIsLoading(false);
          return;
        }
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
          localStorage.setItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY, String(Date.now()));
        } catch {
          localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
          localStorage.removeItem(STORAGE_KEYS.AUTH_PERMISSIONS);
          localStorage.removeItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
        }
      }
      setIsLoading(false);
    };
    restoreSession();
  }, [loadPermissions, hydrateClientPhoto]);

  // Snapshot de ambiente 1x por sessão de navegador (cobre usuários que já
  // estavam logados antes da telemetria existir). O disparo no `login()`
  // continua existindo para login novo.
  useEffect(() => {
    if (!user?.id) return;
    try {
      if (sessionStorage.getItem('telemetry_device_sent') === '1') return;
      sessionStorage.setItem('telemetry_device_sent', '1');
    } catch { /* sessionStorage indisponível — segue assim mesmo */ }
    collectClientEnvironment()
      .then((env) => logUserDevice({
        userId: Number(user.id),
        userName: user.name,
        clientId: user.client_id ?? null,
        env,
      }))
      .catch(() => { /* telemetria nunca quebra o app */ });
  }, [user?.id, user?.name, user?.client_id]);

  // Logout por inatividade (1h) — rastreia atividade e sincroniza entre abas
  useEffect(() => {
    if (!user) return;

    let lastWrite = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWrite = now;
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY, String(now));
      } catch { /* ignore */ }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel',
    ];
    events.forEach((evt) =>
      window.addEventListener(evt, markActivity, { passive: true } as AddEventListenerOptions),
    );
    const onVisibility = () => {
      if (document.visibilityState === 'visible') markActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const checkInactivity = () => {
      const stillLogged = !!localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (!stillLogged) {
        setUser(null);
        setPermissions(null);
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
      const last = raw ? Number(raw) : 0;
      if (!last || Date.now() - last > INACTIVITY_TIMEOUT_MS) {
        // Registra logout por inatividade
        if (user?.id) {
          logUserActivity({
            userId: Number(user.id),
            userName: user.name,
            clientId: user.client_id ?? null,
            eventType: 'logout_inactivity',
          });
          clearPresence(user.id);
        }
        setUser(null);
        setPermissions(null);
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_PERMISSIONS);
        localStorage.removeItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
        if (!window.location.pathname.startsWith('/login')) {
          window.location.replace('/login');
        }
      }
    };
    const interval = window.setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL_MS);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.AUTH_USER && e.newValue === null) {
        setUser(null);
        setPermissions(null);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [user]);

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
      localStorage.setItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY, String(Date.now()));
      
      // Load permissions after login
      await loadPermissions(authenticatedUser.id);

      // Registra evento de login
      logUserActivity({
        userId: Number(authenticatedUser.id),
        userName: authenticatedUser.name,
        clientId: authenticatedUser.client_id ?? null,
        eventType: 'login',
      });

      // Snapshot de ambiente do dispositivo (não-bloqueante; falha silenciosa)
      collectClientEnvironment()
        .then((env) => logUserDevice({
          userId: Number(authenticatedUser.id),
          userName: authenticatedUser.name,
          clientId: authenticatedUser.client_id ?? null,
          env,
        }))
        .catch(() => { /* telemetria nunca quebra o login */ });

      // Checa nova versão a cada login — se houver, força reload
      await checkVersionAndReloadIfNeeded();

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Erro ao fazer login' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Registra logout manual antes de limpar o estado
    if (user?.id) {
      logUserActivity({
        userId: Number(user.id),
        userName: user.name,
        clientId: user.client_id ?? null,
        eventType: 'logout_manual',
      });
      clearPresence(user.id);
    }
    setUser(null);
    setPermissions(null);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_PERMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
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

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch } as User;
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

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
      updateUser,
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
