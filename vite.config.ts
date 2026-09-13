// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "fs";
import path from "path";
import { autoBumpVersion } from "./vite-plugin-auto-version";

// Ported from the Classic vite config: auto-bump PATCH on production builds.
// MAJOR/MINOR stay manual (package.json / public/version.json).
let APP_VERSION = "dev";
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
  APP_VERSION = pkg.version || "dev";
} catch {
  // keep "dev"
}
if (process.argv.includes("build")) {
  APP_VERSION = autoBumpVersion(process.cwd());
}

// jssip (softphone) usa require('events'); no bundle do navegador esse módulo
// virava um stub vazio e o app quebrava com
// "Class extends value undefined is not a constructor or null".
// O plugin abaixo força a resolução para o pacote npm `events` (JS puro,
// compatível com navegador) no bundle do cliente.
const EVENTS_SHIM = path.resolve(process.cwd(), "node_modules/events/events.js");

function nodeEventsShim() {
  return {
    name: "lovable-node-events-shim",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (id === "events" || id === "node:events") return EVENTS_SHIM;
      return null;
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [nodeEventsShim()],
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
  },
});
