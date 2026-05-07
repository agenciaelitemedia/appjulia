import { useEffect, useRef } from "react";
import { toast } from "sonner";

declare const __APP_VERSION__: string;

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
          toast("Nova versão disponível", {
            description: "Atualize para receber as últimas melhorias.",
            duration: Infinity,
            action: {
              label: "Atualizar",
              onClick: () => window.location.reload(),
            },
          });
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