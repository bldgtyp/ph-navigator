#!/usr/bin/env node
/**
 * agent-browser-cleanup.mjs — reap orphaned agent browser-tooling.
 *
 * WHY: the `@playwright/mcp` and `chrome-devtools-mcp` servers (and the Chrome
 * instances they launch against `~/Library/Caches/ms-playwright-mcp/mcp-chrome-*`)
 * are frequently left running by dead Claude Code sessions. They pile up as
 * zombies and hold the single-instance profile lock, which is what makes the
 * MCP browser tools fail with "Browser is already in use". This reaps ONLY that
 * agent tooling and clears the stale profile dirs.
 *
 * DISCIPLINE (why this script exists at all): never leave a process running that
 * YOU started. `agent-browser.mjs` already self-cleans (it closes its browser in
 * a `finally`), so it never leaks. This reaper is for the MCP servers, which the
 * harness spawns/respawns and which outlive their sessions. Run it at the START
 * of browser work (to clear leftovers from prior sessions) or when a lock blocks
 * you — NOT in the middle of active MCP browser use in another window.
 *
 * SAFETY: matches only these process signatures — `@playwright/mcp`,
 * `playwright-mcp`, `chrome-devtools-mcp`, and Chrome launched with an
 * `ms-playwright-mcp/mcp-chrome` user-data-dir. It never touches your real
 * Chrome/Vivaldi/Safari or the Claude.app native host.
 *
 * Usage (from `frontend/`):
 *   node scripts/agent-browser-cleanup.mjs            # reap + clear profiles
 *   node scripts/agent-browser-cleanup.mjs --dry-run  # show what it WOULD do
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");

// Process command-line signatures that are unambiguously agent browser tooling.
const PROC_PATTERNS = [
  "@playwright/mcp",
  "playwright-mcp",
  "chrome-devtools-mcp",
  "ms-playwright-mcp/mcp-chrome", // the Chrome instances launched by playwright-mcp
];

function findPids(pattern) {
  try {
    // -f matches the full command line; returns newline-separated pids.
    const out = execSync(`pgrep -f ${JSON.stringify(pattern)}`, { encoding: "utf8" });
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(Number)
      .filter((pid) => pid !== process.pid);
  } catch {
    return []; // pgrep exits non-zero when nothing matches.
  }
}

const pids = new Set();
for (const pattern of PROC_PATTERNS) {
  for (const pid of findPids(pattern)) pids.add(pid);
}

if (pids.size === 0) {
  console.log("No orphaned agent browser-tooling processes found.");
} else {
  console.log(
    `${DRY_RUN ? "[dry-run] would reap" : "Reaping"} ${pids.size} process(es): ${[...pids].join(", ")}`,
  );
  if (!DRY_RUN) {
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Already gone / not ours to kill — ignore.
      }
    }
  }
}

// Clear the stale shared Chrome profile dirs so the next MCP launch is clean.
const mcpCache = join(homedir(), "Library", "Caches", "ms-playwright-mcp");
if (DRY_RUN) {
  console.log(`[dry-run] would remove stale profiles under ${mcpCache}/mcp-chrome-*`);
} else {
  try {
    const dirs = execSync(`ls -d ${JSON.stringify(mcpCache)}/mcp-chrome-* 2>/dev/null || true`, {
      encoding: "utf8",
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    console.log(`Cleared ${dirs.length} stale mcp-chrome profile dir(s).`);
  } catch {
    console.log("No stale mcp-chrome profile dirs to clear.");
  }
}

console.log("Done. (Your real browsers were not touched.)");
