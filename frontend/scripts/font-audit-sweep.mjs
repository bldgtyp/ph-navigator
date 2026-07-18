#!/usr/bin/env node
/**
 * font-audit-sweep.mjs — run font-audit.mjs over every page + modal state.
 *
 * Each state is one font-audit.mjs invocation (own browser, self-cleaning).
 * States run sequentially; a failing state is reported and skipped, never
 * aborts the sweep. JSON lands in working/font-audit/<label>.json.
 *
 * Usage (from `frontend/`, servers up via `make agent-browser-ready`):
 *   node scripts/font-audit-sweep.mjs [--only <label-substring>]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStates } from "./font-audit-states.mjs";
import { readJson } from "./lib/guard-utils.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Fixture discovery: env override > the manifest written by
// `make agent-browser-ready` (working/agent-browser/fixture.json at the repo
// root) > the historical local default. Keeps the sweep hermetic — no
// hardcoded UUID dependence in CI or after a DB reset.
const FIXTURE = readJson(path.join(REPO_ROOT, "working", "agent-browser", "fixture.json"), {});
const PROJECT_ID =
  process.env.PHN_AUDIT_PROJECT ?? FIXTURE.project_id ?? "5f9e8977-cd89-40c0-9c64-8e04272d174a";
const EMAIL = process.env.PHN_AUDIT_EMAIL ?? FIXTURE.email ?? "codex@example.com";

const STATES = buildStates(PROJECT_ID);

const only = (() => {
  const i = process.argv.indexOf("--only");
  return i === -1 ? null : process.argv[i + 1];
})();

const results = [];
for (const state of STATES) {
  if (only && !state.label.includes(only)) continue;
  const args = ["scripts/font-audit.mjs", state.route, "--label", state.label];
  if (state.noSignin) args.push("--no-signin");
  else args.push("--email", state.email ?? EMAIL);
  for (const h of state.hovers ?? []) args.push("--hover", h);
  for (const c of state.clicks ?? []) args.push("--click", c);

  process.stdout.write(`\n=== ${state.label} (${state.route}) ===\n`);
  const run = spawnSync("node", args, { stdio: "inherit", timeout: 120000 });
  results.push({ label: state.label, ok: run.status === 0 });
}

console.log("\n=== SWEEP SUMMARY ===");
for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"} ${r.label}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} states collected`);
process.exitCode = failed ? 1 : 0;
