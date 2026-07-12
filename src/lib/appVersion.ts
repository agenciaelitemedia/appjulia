// Checagem de versão do app publicada em /version.json (gerado no build).
// Compara com a versão embutida no bundle (__APP_VERSION__) e força reload
// completo do navegador — limpando Service Workers e Cache Storage — quando
// houver uma nova versão publicada.

import { STORAGE_KEYS } from '@/lib/constants';

declare const __APP_VERSION__: string;

const isPreviewHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host.includes('lovableproject.com') ||
    host.includes('id-preview--')
  );
};

async function forceReloadForNewVersion() {
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

  // Preserva a sessão do usuário; limpa demais chaves para descartar caches
  // de dados servidos pela versão antiga.
  try {
    const preserved: Record<string, string | null> = {
      [STORAGE_KEYS.AUTH_USER]: localStorage.getItem(STORAGE_KEYS.AUTH_USER),
      [STORAGE_KEYS.AUTH_LAST_ACTIVITY]: localStorage.getItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY),
    };
    sessionStorage.clear();
    localStorage.clear();
    for (const [k, v] of Object.entries(preserved)) {
      if (v !== null) localStorage.setItem(k, v);
    }
  } catch { /* ignore quota / privacy mode */ }

  // Bust HTTP/proxy caches com querystring de versão.
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Checa /version.json e, se a versão publicada for diferente da embutida no
 * bundle, chama `onUpdateFound` (para feedback ao usuário) e força reload.
 * Retorna `true` se um reload foi disparado.
 */
export async function checkVersionAndReloadIfNeeded(
  onUpdateFound?: () => void,
): Promise<boolean> {
  if (isPreviewHost()) return false;
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  if (!currentVersion) return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.version && data.version !== currentVersion) {
      try { onUpdateFound?.(); } catch { /* ignore */ }
      await forceReloadForNewVersion();
      return true;
    }
  } catch { /* ignore network errors */ }
  return false;
}