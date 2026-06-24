---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 00 — perf instrumentation + baseline capture. Measurement only;
       no rendering behavior changes.
RELATED: ../PRD.md §7, ../decisions.md D-3, ../STATUS.md
RESOLVES: (none directly — unblocks before/after evidence for F1–F9)
DEPENDS ON: (none)
---

# Phase 00 — Perf harness & baseline

## Goal

Make viewer render cost **observable and recordable** so every later phase
proves itself with a before/after number on the Hillandale fixture. Without
this, "it feels faster" is not acceptance evidence (and the original D-15
canary already shows why — it measured the wrong layer).

## In scope

1. **Dev-only metrics overlay.** Surface, per frame:
   - `gl.info.render.calls` (draw calls — the headline metric for A1),
   - `gl.info.render.triangles`,
   - rolling frame time / FPS,
   - live material + geometry counts (`gl.info.memory`),
   - active lens + object count (`model.objectCounts`).
   Prefer **extending the existing `lib/debugHook.ts`
   (`ModelViewerDebugBridge`)** to read `useThree().gl.info` and expose it,
   gated behind the existing debug-hook flag, so it never ships in production
   (D-3). A small fixed-corner panel is enough; `r3f-perf` may be used instead
   but only as a **devDependency** behind the same flag (respect pnpm
   supply-chain settings).
2. **`gl.info.autoReset` handling.** R3F resets `gl.info` per frame; read it in
   a `useFrame`/after-render hook so numbers reflect the last rendered frame
   (note: with `frameloop="demand"` the counters only update on rendered
   frames — record during an active orbit).
3. **Documented capture procedure.** A short runbook (in this phase doc's
   "Procedure" section + a pointer from `AGENT_BROWSER_NOTES.md`) for loading
   Hillandale via Playwright MCP and reading the overlay during a scripted
   orbit.
4. **Baseline record.** Capture current numbers for: building lens (idle +
   orbit), spaces lens, site-sun lens, on Hillandale and on the small fixture.
   Store in `working/` (gitignored) and copy the headline figures into
   `STATUS.md` Changelog + this doc.

## Out of scope

- Any change to materials, geometry, passes, or DPR (that is Phase 01).
- An automated CI perf gate (that is Phase 05 — here it is manual capture).

## What shipped

- **`lib/perf.ts`** — `ModelViewerPerfSample` type, a small dedicated Zustand
  store (`useModelViewerPerfStore`) for the overlay, and the
  `window.__phnModelViewerPerf` global declaration used for automated capture.
- **`scene/PerfProbe.tsx`** — `ModelViewerPerfProbe`, a render-nothing component
  mounted inside `<Canvas>` (gated on `isModelViewerDebugHookEnabled()`). It
  reads `gl.info` once per rendered frame and publishes draw calls, triangles,
  geometries, textures, programs, and a smoothed frame-time/FPS. It owns the
  `window.__phnModelViewerPerf` mirror for its lifetime, mutating a single
  sample object in place each frame (no per-frame allocation, per PRD §7 A6).
- **`components/PerfOverlay.tsx`** — `ModelViewerPerfOverlay`, a fixed
  bottom-left DOM panel (gated, mounted in `ModelViewerStage`) showing the live
  numbers plus active lens + visible object count.

**Draw-call accuracy detail.** R3F's `gl.info.autoReset` resets the counters on
*every* `gl.render` call. With a multi-pass `EffectComposer` that means a naive
read sees only the final pass (`render.calls` ≈ 1). The probe sets
`autoReset = false` and resets once per frame itself (read-then-reset in
`useFrame`), so `calls` reflects the whole frame across all passes. This is the
fix that turned a misleading "1" into the real 32k.

## Procedure (runbook)

Manual overlay read:

1. `make dev`; start frontend on strict port 5173; backend on 8000.
2. Seed + sign in as `codex@example.com` (`make seed-agent-user`).
3. Upload / select a fixture; the bottom-left perf overlay appears (dev only).
4. Orbit the model; read steady `calls` and `ms`/`fps` off the overlay. With
   `frameloop="demand"` the numbers freeze when idle — read during an orbit.

Scripted capture (what produced the baseline below): a temporary Playwright
spec drives sign-in → create project → upload → per-lens orbit, sampling
`window.__phnModelViewerPerf` once per animation frame and writing
`working/perf-baseline.json`. The throwaway spec is preserved at
`working/perf-baseline.spec.ts` (gitignored); drop it back into
`frontend/tests/e2e/` and run
`pnpm exec playwright test perf-baseline.spec.ts --project=chromium` against a
live `make dev` stack to re-capture. It is intentionally **not** kept in the
committed e2e suite (it is a ~5-minute measurement, not a regression test — the
automated gate is Phase 05).

## Baseline (captured 2026-06-18, Ed's laptop / Apple Silicon, headless Chromium)

Draw calls + frame time are the headline metrics. The scripted orbit drives
frames through a rAF loop, so **frame-time on the small fixture is bound by the
driver cadence, not the GPU** — read small-model `ms`/`fps` as "cheap, well
under budget", not as a literal free-running rate. Hillandale frame times are
GPU-bound (render dominates driver overhead ~40×) and are the real signal.

| Fixture | Lens | Draw calls | Geometries | Triangles | ms/frame | FPS |
|---|---|---|---|---|---|---|
| Hillandale | building | **32,045** | 14,411 | 579,980 | 2,297 | 0.4 |
| Hillandale | spaces | **61,785** | 27,915 | 1,072,824 | 3,627 | 0.3 |
| Hillandale | floor-areas | 35,752 | 22,329 | 674,057 | 2,619 | 0.4 |
| Hillandale | site-sun | 32,055 | 21,749 | 610,749 | 2,268 | 0.4 |
| Hillandale | ventilation | 32,467 | 21,974 | 579,776 | 2,198 | 0.5 |
| Hillandale | hot-water | 32,214 | 21,864 | 578,258 | 1,969 | 0.5 |
| Small | building | 402 | 117 | 7,809 | (driver-bound) | — |
| Small | spaces | 906 | 220 | 17,055 | (driver-bound) | — |

Findings confirmed:

- **A1 baseline far worse than the review's ~10–14k estimate**: the building
  lens is **32k draw calls** (one `<mesh>` + one `<Edges>` per face ≈ 2 calls ×
  ~7,200 renderables, plus passes). Target is ≤ ~50.
- **F5 (ghost-building explosion) is the dominant non-building cost**: every
  non-building lens carries the full building as ghost context, so they all sit
  at ~32k+ calls regardless of their own object count (e.g. hot-water renders
  117 objects but pays 32,214 calls). The **spaces** lens is worst at **61,785**
  (ghost building + transparent space volumes).
- **Sub-1 FPS on every Hillandale lens** (~2.0–3.6 s per frame), matching the
  reported "single-digit/laggy" symptom and far below the §7 A2 target of
  ≥ 45 FPS.
- Small fixture is cheap everywhere (≤ ~900 calls); this is why the regression
  hid until a large model loaded.

Raw per-sample data: `working/perf-baseline.json`.

## Risks & mitigations

- **Overlay perturbs the measurement.** Keep it text-only, update at most a few
  Hz, and read counters that the renderer already maintains (no extra GPU work).
- **`frameloop="demand"` shows 0 calls at idle.** Expected; measure during
  orbit. Document this so a later reader doesn't misread idle as "fixed".

## Verification

- `make ci` green (overlay is dev-gated; production build unaffected — verify
  it is tree-shaken / flag-gated out).
- Overlay shows plausible numbers on both fixtures.
- Baseline table filled in (expect Hillandale building-lens `render.calls`
  ≈ 10k–14k, confirming the review's estimate).

## Exit criteria

- [x] Dev overlay reports draw calls + frame time, dev-only.
- [x] Capture runbook written + linked from `AGENT_BROWSER_NOTES.md`.
- [x] Baseline numbers recorded for both fixtures, all primary lenses.
- [x] Headline baseline copied into `STATUS.md`.
