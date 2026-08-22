// ============================================
// X-Julia — invocação das Edge Functions do módulo com identidade do app.
//
// A autenticação do produto é própria (não usa Supabase Auth), então as funções
// de painel exigem os headers de sessão abaixo para resolver o escritório no
// servidor. Todo hook do módulo deve usar xjInvoke em vez de
// supabase.functions.invoke para não receber 401.
// ============================================
import { supabase } from '../extend/db';
import { STORAGE_KEYS } from '@/lib/constants';

interface XJInvokeOptions {
  body?: unknown;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
}

/** Lê o usuário autenticado do armazenamento local (mesma fonte do AuthContext). */
function readAppUser(): { id?: string | number; email?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function xjIdentityHeaders(): Record<string, string> {
  const user = readAppUser();
  const headers: Record<string, string> = {};
  if (user?.id !== undefined && user?.id !== null) headers['x-app-user-id'] = String(user.id);
  if (user?.email) headers['x-app-user-email'] = String(user.email);
  return headers;
}

export async function xjInvoke<T = unknown>(fn: string, options: XJInvokeOptions = {}) {
  const { body, method, headers } = options;
  return await supabase.functions.invoke<T>(fn, {
    ...(body === undefined ? {} : { body }),
    ...(method ? { method } : {}),
    headers: { ...xjIdentityHeaders(), ...(headers ?? {}) },
  } as never);
}
