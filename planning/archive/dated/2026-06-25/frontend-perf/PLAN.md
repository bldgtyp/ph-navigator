---
DATE: 2026-06-24
TIME: 22:32 EDT
STATUS: Complete — methodology executed; archived.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: The durable frontend performance testing methodology — layers, matrix,
  tooling, scorecard, thresholds, phasing, suspects, triage rubric.
RELATED: ./README.md, ./STATUS.md, context/ENVIRONMENT.md, frontend/.instructions.md
---

# Frontend Performance Eval — Methodology

## 0. Goal & non-goals

**Goal.** A repeatable process that measures every page's performance along the
axes that actually bite a React + Vite SPA, surfaces concrete low-hanging fruit
ranked by impact × ease, and leaves behind a scorecard we can re-run to catch
regressions.

**Non-goals.** No re-architecture. No new state-management paradigm. No
rewriting the DataTable, the model viewer, or the envelope canvas. Findings that
require those are **logged + deferred**, never executed under this effort.

**Definition of "low-hanging fruit"** (the bar a fix must clear to be done here):
- Touches a small, well-bounded surface (one component / hook / route / chunk).
- Is mechanically safe (memoization, callback stabilization, selector narrowing,
  `React.lazy`, manual chunk split) — no behavior change.
- Has a *measured* before/after delta on the scorecard.

---

## 1. The three measurement layers

Every frontend perf issue lands in exactly one of these. Each has distinct
tooling and a distinct class of cheap fix. We measure all three because they're
captured in the same scripted run.

### Layer A — Payload (build-time, measured once per build)
What it catches: oversized initial bundle, heavy deps shipped to pages that
don't use them, missing route-level code-splitting, duplicate deps.
Tool: Rollup build output + **bundle treemap** (`rollup-plugin-visualizer`).
Cheap fixes: `React.lazy` a route; lazy-import three/leaflet/recharts/Konva
where they're not on the critical path; manual chunk a vendor; dedupe a dep.

### Layer B — Runtime / load (per page, measured on cold load)
What it catches: slow first contentful/largest paint, long main-thread tasks,
oversized or chatty API responses, layout thrash.
Tool: **Chrome DevTools MCP** — `performance_start_trace` /
`performance_stop_trace` and `lighthouse_audit` (no install; already available).
Cheap fixes: defer non-critical work, paginate/trim a payload, remove a
render-blocking import, fix an N+1 query fan-out on mount.

### Layer C — Render (interaction, measured during scripted interactions)
What it catches: wasted re-renders on keystroke / hover / scroll / pan, render
work that scales with *total* rows instead of *visible* rows, broad store
subscriptions, unstable props defeating memo.
Tool: **React DevTools Profiler** (commit count + duration) and **`react-scan`**
(live overlay flagging re-rendering components); optionally a dev-only
`<Profiler onRender>` harness to log commit counts during a Playwright scenario.
Cheap fixes: `React.memo` a hot row/cell, `useCallback`/`useMemo` to stabilize a
prop, narrow a Zustand selector (`useStore(s => s.x)` not whole-store), split a
context.

Your stated priorities — **re-render frequency** and **payload** — are Layers C
and A. Layer B rides along for free in the same run.

---

## 2. The durability mechanism — a fixed test matrix

"Don't miss any" is solved structurally: a **fixed matrix** we run unchanged
each pass. The matrix *is* the checklist; the scorecard *is* the record.

```
matrix = PAGES (rows) × SCENARIO (per-page interactions) × DATASET (size tiers)
```

- **PAGES** — the closed set of 10 (see §3). Adding a page = adding a matrix row;
  nothing else gets skipped.
- **SCENARIO** — a Playwright script per page: cold load → settle → page-specific
  interactions (§3). Same script every run → comparable numbers.
- **DATASET** — two tiers: *realistic* (typical project) and *stress*
  (worst-case sizes, §4). Low-hanging fruit hides under tiny dev data; the stress
  tier is what exposes O(n) render pipelines and unsplit payloads.

Each cell produces one **scorecard row** (§5). A pass = fill the whole scorecard.
Re-running diffs old vs new — that's the regression guard.

---

## 3. Pages & per-page scenarios

Routes from `frontend/src/app/router.tsx`. The scenario column is the scripted
interaction set; the "heavy element" column says which layer to weight.

| # | Page (route) | Heavy element | Scripted scenario (after cold load + settle) | Weight |
|---|---|---|---|---|
| 1 | Dashboard (`/dashboard`) | project + catalog cards | idle; click into a project | A, B |
| 2 | Apertures (`apertures`) | DataTable + 2D builder canvas | sort col, filter, edit a cell, fill-down 50 rows, scroll 1k rows; builder pick/paste/hover | C (table), C (canvas) |
| 3 | Envelope (`envelope`) | DataTable + Konva canvas + MaterialsPanel | open assembly, add layer, drag-reorder layers, paint a layer | C (canvas) |
| 4 | Spaces (`spaces`) | DataTable | sort, filter, edit cell, fill-down, scroll 1k rows | C |
| 5 | Climate (`climate`) | DataTable + detail page | open a source detail, switch source | B, C |
| 6 | Equipment (`equipment`) | **multiple** DataTables + concurrent queries | load (watch query fan-out), edit a heat-pump row, edit across two tables | B, C |
| 7 | Model Viewer (`model-viewer`) | R3F / three.js BatchedMesh | load large Hbjson, orbit, pan, switch lens, select element, hover-while-pan | B (load), C (store) |
| 8 | Materials catalog (`/catalog/materials`) | DataTable | sort, filter, edit cell, scroll | C |
| 9 | Frame Types catalog (`/catalog/frame-types`) | DataTable | sort, filter, edit cell, scroll | C |
| 10 | Glazing Types catalog (`/catalog/glazing-types`) | DataTable | sort, filter, edit cell, scroll | C |

Notes:
- Pages 2/4/8/9/10 share the DataTable — a render fix there likely pays off
  across all five. Measure one thoroughly, confirm the others inherit it.
- Page 7's hover-while-pan is the Zustand-selector stress case (model-viewer
  store: lens/theme/selection/measure/camera). See the BatchedMesh substrate
  note in project memory — the viewer is built on ≤2 BatchedMesh + 1 edge line;
  confirm interactions don't blow that up into per-face work.
- Page 6 is the concurrency case — several tables + queries mount together; the
  sibling `table-write-architecture-unification` refactor will rewire the
  heat-pumps client, so coordinate any render fix here with that work.

---

## 4. Datasets — realistic + stress tiers

Needs a dedicated **stress seed** (the existing seed project is owned by
`ed@example.com`; don't clobber Ed's session — see project memory on the dev seed
owner and session rules). Define a separate stress fixture so realistic-tier
numbers stay stable.

| Surface | Realistic tier | Stress tier (worst-case) |
|---|---|---|
| Aperture / Space / catalog tables | typical project counts | **≥ 1000 rows** (exposes virtualization gaps + O(rows) pipelines) |
| Equipment | a few units per table | many units across all tables simultaneously |
| Model viewer | typical Hbjson | **> 1500 objects** (the AA-downgrade threshold in `ViewerCanvas`) |
| Envelope assembly | a few layers | many layers in one assembly |

Capture **both tiers** for table + viewer pages. A fix only counts if it holds at
the stress tier.

---

## 5. The scorecard (the durable artifact)

One row per (page × dataset tier), stored in this folder as
`scorecard-<YYYY-MM-DD>.md`. Re-run → new dated scorecard → diff.

| Page | Tier | Route chunk (kB gz) | LCP | INP (key interaction) | Long tasks > 50ms | Render commits / interaction | Largest API payload | Flags |
|---|---|---|---|---|---|---|---|---|

Column sources:
- **Route chunk** — visualizer treemap, the lazy chunk for that route (Layer A).
- **LCP / long tasks** — DevTools MCP trace + Lighthouse (Layer B).
- **INP** — DevTools trace measured on the page's *key* interaction (the one in
  §3 most likely to stall: cell-edit for tables, lens-switch / orbit for viewer).
- **Render commits / interaction** — Profiler commit count for a *single*
  keystroke/hover; the tell is commits in components unrelated to the change, or
  a count that scales with total rows (Layer C).
- **Largest API payload** — biggest single response on load/interaction; flag
  re-fetch-the-world-on-edit patterns.

---

## 6. Tooling

### Already in the repo (use as-is)
- **Playwright** (Chromium, single-worker — `playwright.config.ts`) — drives the
  scenarios. Single-worker matters: it also means no cross-run contention.
- **Chrome DevTools MCP** — `performance_start_trace`, `performance_stop_trace`,
  `performance_analyze_insight`, `lighthouse_audit`. Layer B with zero install.
- **React DevTools Profiler** — Layer C commit counts (manual, via browser).
- `check:sizes` guard pattern in `frontend/scripts/*.mjs` — the template for a
  future CI byte-budget check.

### Added (dev-only; APPROVED 2026-06-24, installed at Phase 0)
Respect the supply-chain rules: `pnpm` only, 24h `minimumReleaseAge`, strict
min-age, `blockExoticSubdeps`. Both are `devDependencies`.

- **`rollup-plugin-visualizer`** — Layer A. Wire into `vite.config.ts` behind an
  `ANALYZE` env flag so normal builds are untouched; expose as `make analyze`
  (or `pnpm run analyze`) producing a treemap HTML. Optional follow-on: a
  `check:bundle` script (mirroring `check:sizes`) that fails CI if a chunk
  crosses a byte budget — the durable payload-regression gate.
- **`react-scan`** — Layer C. Dev-overlay that highlights re-rendering components
  live; no source changes (run alongside `pnpm dev`). Best for *finding* wasted
  renders fast; confirm magnitudes with the Profiler.

### Explicitly deferred (don't add now)
- Lighthouse-CI as a gate, `web-vitals` runtime reporting, Vitest `bench`. Revisit
  only if the manual passes prove a metric needs continuous enforcement.

---

## 7. Thresholds / budgets (starting points, tune after first pass)

Flags on the scorecard, not hard failures, until calibrated:
- **Route chunk** — flag if a route's lazy chunk > ~250 kB gz, **or** the treemap
  shows three/leaflet/recharts/Konva loaded on a route that never uses it.
- **LCP** — good < 2.5s, poor > 4.0s (Lighthouse desktop; expect stricter local).
- **INP** — good < 200ms, poor > 500ms on the key interaction.
- **Long tasks** — flag any single task > 50ms during an interaction; a *cluster*
  during type-edit is red.
- **Render commits** — flag if one keystroke/hover commits components unrelated
  to the edit, or commit count grows with total (not visible) row count.
- **API payload** — flag any single response > ~500 kB, or a full-dataset re-fetch
  triggered by a single-cell edit.

---

## 8. Phasing

| Phase | Work | Output |
|---|---|---|
| **0 — Harness** | install visualizer + react-scan; add `analyze` script; scaffold Playwright perf scenarios; build the stress seed | runnable harness |
| **1 — Static sweep** | `make analyze`; read the treemap | Layer-A flag list (heavy deps, unsplit routes, dupes) |
| **2 — Runtime sweep** | run the matrix, capture traces/Lighthouse | scorecard Layers A+B filled |
| **3 — Render sweep** | react-scan + Profiler on interaction-heavy pages (2,3,6,7 + one table) | scorecard Layer C filled |
| **4 — Triage & fix** | rank by impact × ease; do the fruit, defer the rest; re-run affected cells | before/after deltas + deferred-log |

Phases 1–3 are independent captures and can run in any order; 4 depends on all.

---

## 9. A-priori suspects (hypotheses to confirm — NOT findings)

From the codebase recon. Each is a *prediction* to validate with measurement;
do not "fix" before the scorecard shows the problem.

1. **DataTable re-renders per keystroke.** Only **one** `React.memo` in the whole
   app; component-level memoization is minimal (useMemo is data-pipeline-focused
   inside `DataTable.tsx`, not row/cell-level). Classic symptom: editing one cell
   re-renders every visible row. Highest-probability fruit; shared across 5 pages.
2. **No route-level code-splitting.** No manual chunks / `React.lazy` seen → the
   first-load bundle likely ships three.js + leaflet + recharts + Konva even to a
   plain table page. Probably the single biggest payload win.
3. **Non-narrow Zustand selectors** in model-viewer / aperture-builder stores →
   hover-while-pan re-renders broadly (Layer C, page 7 / page 2 canvas).
4. **Equipment page query fan-out** — multiple DataTables + concurrent queries on
   mount; watch for waterfalls and redundant fetches (Layer B, page 6).
5. **Konva envelope canvas** redraw cost under many material layers (Layer C, page 3).
6. **`features/equipment/lib.ts` (3652 LOC)** pulled wholesale into the equipment
   route — check it isn't dragging the route chunk up (Layer A).

---

## 10. Triage rubric

Score each confirmed finding:
- **Impact** (scorecard delta): High = crosses a §7 threshold or > 2× on a
  metric · Med = noticeable · Low = marginal.
- **Ease**: Easy = one bounded surface, mechanical, no behavior change · Hard =
  touches shared contracts / needs re-architecture.

**Do now:** High/Med impact × Easy. **Defer (log in STATUS):** anything Hard, or
Low × anything. Every "do now" fix must show a re-run before/after delta on the
affected scorecard cell before it's called done.
