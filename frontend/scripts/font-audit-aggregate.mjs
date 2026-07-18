#!/usr/bin/env node
/**
 * font-audit-aggregate.mjs — merge per-state font-audit JSONs into one
 * site-wide typography report (markdown).
 *
 * Usage (from `frontend/`, after font-audit-sweep.mjs):
 *   node scripts/font-audit-aggregate.mjs [--dir working/font-audit] [--out REPORT.md]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argValue, formatExtras, formatWeight, isOffScale, top } from "./font-audit-lib.mjs";

const dir = resolve(argValue("--dir", "working/font-audit"));
const outPath = argValue("--out", null);

const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const states = files
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
  .sort((a, b) => a.label.localeCompare(b.label));

const merged = new Map();
for (const state of states) {
  for (const v of state.variants) {
    let m = merged.get(v.key);
    if (!m) {
      m = {
        ...v,
        roles: {},
        colors: {},
        lineHeights: {},
        selectors: {},
        samples: [],
        count: 0,
        pages: [],
      };
      merged.set(v.key, m);
    }
    m.count += v.count;
    m.pages.push(state.label);
    for (const [k, c] of Object.entries(v.roles)) m.roles[k] = (m.roles[k] ?? 0) + c;
    for (const [k, c] of Object.entries(v.colors)) m.colors[k] = (m.colors[k] ?? 0) + c;
    for (const [k, c] of Object.entries(v.lineHeights))
      m.lineHeights[k] = (m.lineHeights[k] ?? 0) + c;
    for (const [k, c] of Object.entries(v.selectors)) m.selectors[k] = (m.selectors[k] ?? 0) + c;
    for (const s of v.samples) if (m.samples.length < 3 && !m.samples.includes(s)) m.samples.push(s);
  }
}

const variants = Array.from(merged.values()).sort(
  (a, b) => b.pages.length - a.pages.length || b.count - a.count,
);

const lines = [];
const uniq = (fn) => [...new Set(variants.map(fn))];

lines.push(`# Site-wide rendered-typography report`);
lines.push("");
lines.push(
  `States collected: ${states.length} (pages + modal states) · ` +
    `elements sampled: ${states.reduce((n, s) => n + s.elementsScanned, 0)}`,
);
lines.push("");
lines.push(`**${variants.length} unique typography variants site-wide.**`);
lines.push(`- Families: ${uniq((v) => v.family).join(", ")}`);
lines.push(
  `- Sizes (${uniq((v) => v.size).length}): ` +
    uniq((v) => `${v.size} (${v.sizeToken})`)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .join(", "),
);
lines.push(`- Weights: ${uniq((v) => v.weight).sort().join(", ")}`);
lines.push("");

// ---- master table --------------------------------------------------------
lines.push(`## All variants (by page reach)`);
lines.push("");
lines.push(
  "| # | family | size (token) | weight | transform/spacing | pages | n | colors | top roles | top selectors | sample |",
);
lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
variants.forEach((v, i) => {
  lines.push(
    `| ${i + 1} | ${v.family} | ${v.size} (${v.sizeToken}) | ${formatWeight(v.weight)} | ${formatExtras(v)} | ` +
      `${v.pages.length} | ${v.count} | ${Object.keys(v.colors).length} | ${top(v.roles, 3)} | ` +
      `${top(v.selectors, 2)} | ${v.samples[0] ?? ""} |`,
  );
});
lines.push("");

// ---- anomalies -----------------------------------------------------------
const offScale = variants.filter(isOffScale);
lines.push(`## Off-scale variants (${offScale.length})`);
lines.push("");
for (const v of offScale) {
  lines.push(
    `- ${v.family} ${v.size} w${v.weight} — pages: ${v.pages.join(", ")} — ` +
      `selectors: ${top(v.selectors, 3)} — sample: "${v.samples[0] ?? ""}"`,
  );
}
lines.push("");

// ---- role consistency ----------------------------------------------------
lines.push(`## Role consistency (variants per use-case)`);
lines.push("");
lines.push("For each inferred use-case: how many distinct variants render it.");
lines.push("");
const byRole = new Map();
for (const v of variants) {
  for (const [role, c] of Object.entries(v.roles)) {
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push({ v, c });
  }
}
const roleRows = [...byRole.entries()].sort((a, b) => b[1].length - a[1].length);
lines.push("| use-case | variants | top variants (family size/weight — count) |");
lines.push("|---|---|---|");
for (const [role, list] of roleRows) {
  list.sort((a, b) => b.c - a.c);
  const tops = list
    .slice(0, 4)
    .map(({ v, c }) => `${v.family} ${v.size}/${v.weight} (${c})`)
    .join("; ");
  lines.push(`| ${role} | ${list.length} | ${tops} |`);
}
lines.push("");

// ---- per-state stats -----------------------------------------------------
lines.push(`## Per-state coverage`);
lines.push("");
lines.push("| state | route | elements | variants |");
lines.push("|---|---|---|---|");
for (const s of states) {
  lines.push(`| ${s.label} | ${s.route} | ${s.elementsScanned} | ${s.variants.length} |`);
}
lines.push("");

const report = lines.join("\n");
if (outPath) {
  writeFileSync(resolve(outPath), report);
  console.log(`WROTE ${resolve(outPath)}`);
} else {
  console.log(report);
}
