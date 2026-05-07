import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

const APP_VERSION = Date.now().toString();

const versionFilePlugin = () => ({
  name: "write-version-json",
  apply: "build" as const,
  closeBundle() {
    try {
      const out = path.resolve(__dirname, "dist", "version.json");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify({ version: APP_VERSION }));
    } catch (e) {
      console.warn("Failed to write version.json", e);
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), versionFilePlugin()].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
