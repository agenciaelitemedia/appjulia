import { useEffect, useRef } from "react";

declare const __APP_VERSION__: string;

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

export function useAppVersionCheck() {
  const notifiedRef = useRef(false);
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

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // initial check after a short delay
    const t = window.setTimeout(check, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentVersion]);
}