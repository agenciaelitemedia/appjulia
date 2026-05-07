import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/chunkReload";

// Unregister service workers in preview/iframe to avoid stale cache
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((err) => {
    console.warn("SW registration failed:", err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
