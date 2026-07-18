#!/usr/bin/env node
/**
 * font-audit-eval.mjs — rendered typography-contract evaluator.
 *
 * Consumes the per-state JSON written by font-audit-sweep.mjs
 * (working/font-audit/<label>.json) and the checked-in contract
 * (scripts/typography-rendered-contract.json). The state manifest itself
 * comes from font-audit-states.mjs — the same source the sweep drives — so
 * a new state is automatically both swept and enforced. Exits non-zero on
 * any contract failure; a missing or empty state is a failure, never a
 * partial report.
 *
 * This is the rendered half of the two-layer control: check:typography
 * proves source values come from tokens; this proves the cascade output —
 * families, mapped sizes, weights, tracking, role budgets, modal-role
 * reuse, and the total variant ceiling.
 *
 * Usage (from `frontend/`, after `node scripts/font-audit-sweep.mjs`):
 *   node scripts/font-audit-eval.mjs [--dir working/font-audit]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { argValue, formatExtras } from "./font-audit-lib.mjs";
import { STATE_LABELS } from "./font-audit-states.mjs";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(FRONTEND_ROOT, "scripts", "typography-rendered-contract.json");
const SWEEP_DIR = path.resolve(FRONTEND_ROOT, argValue("--dir", "working/font-audit"));

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const failures = [];

// --- 1. Exact state-manifest coverage -----------------------------------
const stateData = [];
for (const label of STATE_LABELS) {
  const statePath = path.join(SWEEP_DIR, `${label}.json`);
  if (!existsSync(statePath)) {
    failures.push(`missing state: ${label} (${statePath} not found — did the sweep fail?)`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(statePath, "utf8"));
  } catch (error) {
    failures.push(`unreadable state: ${label} (${error.message})`);
    continue;
  }
  if (!Array.isArray(data.variants) || data.variants.length === 0) {
    failures.push(`empty state: ${label} collected no variants (broken page?)`);
    continue;
  }
  stateData.push(data);
}

// --- 2. Merge variants site-wide (same key as the audit) ----------------
const merged = new Map();
for (const data of stateData) {
  for (const variant of data.variants) {
    let entry = merged.get(variant.key);
    if (!entry) {
      entry = { ...variant, roles: {}, states: [] };
      merged.set(variant.key, entry);
    }
    for (const [role, count] of Object.entries(variant.roles)) {
      entry.roles[role] = (entry.roles[role] ?? 0) + count;
    }
    entry.states.push(data.label);
  }
}
const variants = [...merged.values()];

const describe = (v) => `${v.family} ${v.size}/${v.weight} ${formatExtras(v)} [${v.states[0]}…]`;

// --- 3. Families / weights / tracking / sizes ---------------------------
const allowedFamilies = new Set(contract.families);
const allowedWeights = new Set(contract.weights);
const allowedTracking = new Set(contract.allowedTracking);

for (const v of variants) {
  if (!allowedFamilies.has(v.family)) failures.push(`unapproved family: ${describe(v)}`);
  if (!allowedWeights.has(v.weight)) failures.push(`unapproved weight: ${describe(v)}`);
  if (!allowedTracking.has(v.letterSpacing)) failures.push(`unapproved tracking: ${describe(v)}`);
  if (v.sizeToken === "OFF-SCALE") failures.push(`off-scale size: ${describe(v)}`);
}

// --- 4. Modal roles must reuse non-modal variants -----------------------
for (const v of variants) {
  const roles = Object.keys(v.roles);
  const hasModal = roles.some((role) => role.startsWith("modal/"));
  const hasNonModal = roles.some((role) => !role.startsWith("modal/"));
  if (hasModal && !hasNonModal) {
    failures.push(`modal-only variant (no non-modal reuse): ${describe(v)}`);
  }
}

// --- 5. Role budgets (modal/ prefix and heading:h* subtype stripped) ----
const roleVariantCounts = {};
for (const v of variants) {
  const baseRoles = new Set(
    Object.keys(v.roles).map((role) => role.replace(/^modal\//, "").replace(/^heading:.*/, "heading")),
  );
  for (const role of baseRoles) {
    roleVariantCounts[role] = (roleVariantCounts[role] ?? 0) + 1;
  }
}
for (const [role, budget] of Object.entries(contract.roleBudgets)) {
  const actual = roleVariantCounts[role] ?? 0;
  if (actual > budget) {
    failures.push(`role budget exceeded: ${role} renders ${actual} variants (budget ${budget})`);
  }
}

// --- 6. Total variant ceiling -------------------------------------------
if (variants.length > contract.variantCeiling) {
  failures.push(`variant ceiling exceeded: ${variants.length} > ${contract.variantCeiling}`);
}

// --- Report -------------------------------------------------------------
console.log(
  `typography-eval: ${stateData.length}/${STATE_LABELS.length} states, ` +
    `${variants.length} site-wide variants (ceiling ${contract.variantCeiling})`,
);
for (const [role, count] of Object.entries(roleVariantCounts).sort((a, b) => b[1] - a[1])) {
  const budget = contract.roleBudgets[role];
  console.log(`  ${role}: ${count} variants${budget !== undefined ? ` (budget ${budget})` : ""}`);
}

if (failures.length > 0) {
  console.error(`\ntypography-eval FAILED — ${failures.length} contract violations:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("typography-eval ok — rendered contract holds");
