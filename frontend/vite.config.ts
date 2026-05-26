import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET || process.env.VITE_API_BASE_URL || "http://localhost:8000";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: mode === "test" ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("") } : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Shared cross-language fixtures (formula corpora, etc.). The
      // Python suite reads the same JSON files; CI fails on the first
      // parity divergence.
      "@fixtures": path.resolve(__dirname, "../backend/tests/fixtures"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", "build", "tests/e2e/**"],
  },
}));
