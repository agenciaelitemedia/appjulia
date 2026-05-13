import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

declare const __APP_VERSION__: string;

// Apenas para deduplicar rajadas síncronas (focus + visibilitychange disparados juntos).
const DEDUP_WINDOW_MS = 2000;
const VERSION_CHANNEL = "app-version";

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

    const forceReload = async () => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
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
      window.location.replace(
        window.location.pathname + window.location.search + window.location.hash,
      );
    };

    const check = async () => {
      if (notifiedRef.current || cancelled) return;
      const now = Date.now();
      // Apenas dedup de eventos quase simultâneos (focus + visibility).
      if (now - lastCheckRef.current < DEDUP_WINDOW_MS) return;
      lastCheckRef.current = now;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && data.version !== currentVersion) {
          // Avisa todas as outras abas/clientes via Realtime — sem polling em cada um.
          try {
            await channel.send({
              type: "broadcast",
              event: "new-version",
              payload: { version: data.version },
            });
          } catch {
            /* ignore */
          }
          await forceReload();
        }
      } catch {
        /* ignore network errors */
      }
    };

    // 1) Push em tempo real: ao primeiro cliente que detectar nova versão,
    //    todos os outros recebem broadcast via Supabase Realtime e recarregam
    //    instantaneamente — sem polling, sem timer, sem throttle artificial.
    const channel = supabase.channel(VERSION_CHANNEL, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "new-version" }, (msg) => {
      const v = (msg?.payload as { version?: string } | undefined)?.version;
      if (v && v !== currentVersion) forceReload();
    });
    channel.subscribe();

    // 2) Gatilhos event-driven para o primeiro detector (sem polling periódico):
    //    - aba volta a ficar visível
    //    - janela ganha foco
    //    - conexão volta
    //    - uma checagem inicial após o boot
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const onFocus = () => check();
    const onOnline = () => check();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    const t = window.setTimeout(check, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(channel);
    };
  }, [currentVersion]);
}