---
DATE: 2026-06-24
TIME: 22:32 EDT
STATUS: Complete - archived after Phases 0-4.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Router for the frontend performance eval — a durable, repeatable method
  for finding re-render / payload / runtime low-hanging fruit across every page.
RELATED:
  - ./PLAN.md (the methodology — the meat)
  - ./STATUS.md (state, next step)
  - frontend/.instructions.md (run/verify rules; sign-in)
  - context/ENVIRONMENT.md (dev server, ports, seed users)
  - context/UI_UX.md §1.7 + context/technical-requirements/data-table.md (DataTable)
  - planning/refactor/table-write-architecture-unification/ (sibling; rewires
    equipment/heat-pumps frontend — coordinate render-sweep findings there)
---

# Frontend Performance Eval — Router

A **durable, methodical** way to measure the frontend's performance — page by
page — so we can find and fix the *low-hanging fruit* (wasted re-renders,
oversized payloads, obvious runtime stalls) without missing any screen and
without large re-architectures.

This folder preserves the completed first performance audit pass. Decided
2026-06-24 (Ed): write the plan first, then execute. Phase 0 installed the
approved dev-only tooling (`rollup-plugin-visualizer` + `react-scan`), wired the
opt-in analyze / scan commands, added a skipped-by-default Playwright perf
matrix, and seeded a separate `PERF-STRESS` project for stress-tier table runs.

## What this is NOT

- Not a perf *refactor*. Fixes are scoped to low-hanging fruit (memoize a hot
  component, stabilize a callback, narrow a store selector, lazy-load a route,
  split a chunk). Anything that's a genuine re-architecture is **logged and
  deferred**, not done here.
- Not a one-shot poke. The point is a re-runnable matrix + scorecard that any
  future agent can execute and diff against.

## Read order

1. `PLAN.md` — the methodology: the three measurement layers, the fixed
   page × scenario × dataset matrix, the tooling, the scorecard, thresholds,
   phasing, and the a-priori suspect list.
2. `STATUS.md` — current state, what's done, the next concrete step.
3. `scorecard-2026-06-24.md` — measured Layer A/B/C evidence.
4. `scorecard-2026-06-24-phase-04a.md` — Phase 04A before/after delta.
5. `scorecard-2026-06-24-phase-04b.md` — Phase 04B route-split bundle/browser evidence.
6. `scorecard-2026-06-24-phase-04c.md` — Phase 04C Model payload evidence.
7. `scorecard-2026-06-24-phase-04d.md` — Phase 04D secondary-runtime evidence.
8. `phases/phase-04-ranking.md` — ranked Phase 4 findings and implementation sequence.
9. `phases/phase-04a-datatable-edit-churn.md` — P0 shared DataTable edit plan.
10. `phases/phase-04b-route-payload-splits.md` — P1 route/project-tab payload plan.
11. `phases/phase-04c-model-payload.md` — P2 Model lazy-chunk payload plan.
12. `phases/phase-04d-secondary-runtime.md` — P3 trace-first secondary runtime plan.

## One-paragraph summary

Performance splits into three measurable layers — **payload** (bundle/build),
**runtime** (per-page load + long tasks), and **render** (wasted re-renders
under interaction). Durability comes from a **fixed matrix**: every page × a
scripted Playwright scenario × a realistic-plus-stress dataset, captured into a
per-page **scorecard** that we re-run and diff. Tooling is mostly already in the
repo (Playwright, Chrome DevTools MCP for traces + Lighthouse); we add only two
dev-only helpers for the gaps — a bundle treemap and a live re-render overlay.
