import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { execFileSync } from "node:child_process";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";
const analyzeBundle = process.env.ANALYZE === "true";

function buildGitSha(): string {
  const sha =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_SHA ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("Frontend build requires an exact 40-character git SHA.");
  }
  return sha.toLowerCase();
}

export default defineConfig(async ({ mode }) => {
  const plugins = [
    react(),
    {
      name: "phn-version-marker",
      apply: "build" as const,
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: `${JSON.stringify({ git_sha: buildGitSha() })}\n`,
        });
      },
    },
  ];
  if (analyzeBundle) {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({
        filename: "dist/bundle-stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
    );
  }
  return {
    plugins,
    define:
      mode === "test" ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("") } : undefined,
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
      globals: true,
      exclude: ["node_modules", "dist", "build", "tests/e2e/**"],
      // jsdom boot dominates suite time, and most .test.ts files are pure
      // logic. Route .ts to the node environment and .tsx to jsdom; a
      // DOM-touching .ts file opts back in with a
      // `// @vitest-environment jsdom` docblock.
      projects: [
        {
          extends: true,
          // No setupFiles: pure-logic tests need neither jest-dom matchers
          // nor the DOM shims, and skipping them saves ~60ms per file.
          test: {
            name: "logic",
            environment: "node",
            include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            environment: "jsdom",
            include: ["src/**/*.test.tsx"],
            setupFiles: ["./tests/setup.ts"],
          },
        },
      ],
    },
  };
});
