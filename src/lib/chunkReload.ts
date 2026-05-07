// Auto-reload when a lazy chunk fails to load (typical after a new deploy
// removes the previous hashed asset). Uses sessionStorage to avoid loops.

const FLAG = "chunk-reload-attempted";

const isChunkLoadError = (msg: string) => {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("loading chunk") ||
    m.includes("loading css chunk") ||
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("chunkloaderror") ||
    m.includes("failed to import")
  );
};

const triggerReload = () => {
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }
  // Small delay to avoid racing with other handlers
  setTimeout(() => window.location.reload(), 100);
};

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const msg = event?.message || (event?.error && String(event.error.message)) || "";
    if (isChunkLoadError(msg)) triggerReload();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const msg = typeof reason === "string" ? reason : reason?.message || "";
    if (isChunkLoadError(msg)) triggerReload();
  });

  // Clear flag after a successful boot
  window.addEventListener("load", () => {
    setTimeout(() => {
      try {
        sessionStorage.removeItem(FLAG);
      } catch {
        /* ignore */
      }
    }, 5000);
  });
}

export {};