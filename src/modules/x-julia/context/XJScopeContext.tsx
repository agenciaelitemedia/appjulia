/**
 * Escopo de escritório (clientID) do módulo X-Julia.
 *
 * Usuários comuns operam sempre no client_id efetivo deles.
 * Admin pode escolher outro escritório e gerenciar os agentes dele.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useXJClientId, useXJIdentity } from '../extend/auth';

const STORAGE_KEY = 'x-julia:scope-client';

interface XJScopeValue {
  clientId: string | null;
  clientLabel: string | null;
  ownClientId: string | null;
  isOverridden: boolean;
  canSwitch: boolean;
  isLoading: boolean;
  setScope: (clientId: string, label?: string | null) => void;
  resetScope: () => void;
}

const XJScopeContext = createContext<XJScopeValue | null>(null);

export function XJScopeProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useXJIdentity();
  const { data: ownClientId, isLoading } = useXJClientId();
  const [override, setOverride] = useState<{ id: string; label: string | null } | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Somente admin pode manter escopo diferente do próprio escritório.
  useEffect(() => {
    if (!isAdmin && override) {
      setOverride(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isAdmin, override]);

  const setScope = useCallback((clientId: string, label?: string | null) => {
    const next = { id: String(clientId), label: label ?? null };
    setOverride(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const resetScope = useCallback(() => {
    setOverride(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<XJScopeValue>(
    () => ({
      clientId: isAdmin && override ? override.id : (ownClientId ?? null),
      clientLabel: isAdmin && override ? override.label : null,
      ownClientId: ownClientId ?? null,
      isOverridden: !!(isAdmin && override),
      canSwitch: isAdmin,
      isLoading,
      setScope,
      resetScope,
    }),
    [isAdmin, override, ownClientId, isLoading, setScope, resetScope],
  );

  return <XJScopeContext.Provider value={value}>{children}</XJScopeContext.Provider>;
}

export function useXJScope(): XJScopeValue {
  const ctx = useContext(XJScopeContext);
  if (ctx) return ctx;
  throw new Error('useXJScope deve ser usado dentro de XJScopeProvider');
}

/**
 * client_id efetivo do módulo. Dentro do provider respeita a troca de
 * escritório do admin; fora dele (ex.: lista Meus Agentes) usa o próprio tenant.
 */
export function useXJEffectiveClientId(): { clientId: string | null; isLoading: boolean } {
  const ctx = useContext(XJScopeContext);
  const own = useXJClientId();
  if (ctx) return { clientId: ctx.clientId, isLoading: ctx.isLoading };
  return { clientId: own.data ?? null, isLoading: own.isLoading };
}