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

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    resolve: {
      alias: [
        // jssip (softphone) faz require('events'); sem este alias o bundle do
        // navegador recebe o stub vazio __vite-browser-external e quebra com
        // "Class extends value undefined". Aponta para o pacote npm `events`.
        { find: /^(node:)?events$/, replacement: EVENTS_SHIM },
      ],
    },
    environments: {
      client: {
        resolve: {
          alias: [{ find: /^(node:)?events$/, replacement: EVENTS_SHIM }],
        },
      },
    },
  },
});
