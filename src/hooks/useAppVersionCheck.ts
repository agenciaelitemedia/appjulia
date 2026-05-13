import { useEffect, useRef } from "react";

declare const __APP_VERSION__: string;

// Mínimo entre checagens consecutivas para evitar rajadas (ex.: focus + visibility juntos)
const MIN_CHECK_INTERVAL_MS = 30 * 1000;

export function useAppVersionCheck() {
  const notifiedRef = useRef(false);
  const lastCheckRef = useRef(0);
  const currentVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";

  useEffect(() => {
    if (!currentVersion) return;
    // Skip on dev / preview hosts
    const host = window.location.hostname;
    if (host === "localhost" || host.includes("lovableproject.com") || host.includes("id-preview--")) {
      return;
    }

    let cancelled = false;

    const check = async () => {
      if (notifiedRef.current || cancelled) return;
      const now = Date.now();
      if (now - lastCheckRef.current < MIN_CHECK_INTERVAL_MS) return;
      lastCheckRef.current = now;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && data.version !== currentVersion) {
          notifiedRef.current = true;
          // Force update: clear caches and reload without prompting the user
          try {
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
            if (typeof caches !== "undefined") {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          } catch {
            /* ignore */
          }
          // Hard reload bypassing bfcache
          window.location.replace(
            window.location.pathname + window.location.search + window.location.hash,
          );
        }
      } catch {
        /* ignore network errors */
      }
    };

    // Estratégia event-driven (sem polling):
    // - checa quando a aba volta a ficar visível
    // - checa quando a janela ganha foco
    // - checa quando a conexão volta
    // - checa uma vez logo após o boot
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const onFocus = () => check();
    const onOnline = () => check();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // checagem inicial após o boot (permite que o app carregue antes)
    const t = window.setTimeout(check, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [currentVersion]);
}