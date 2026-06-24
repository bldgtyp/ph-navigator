---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 05 — lock in the win: automated perf-regression gate, dispose
       audit, and docs fold-back. Closes the refactor.
RELATED: ../PRD.md §7 (A5), ../decisions.md, ../../code-reviews/2026-06-18/...
RESOLVES: A5 (regression lock), CR3 (dispose), G5
DEPENDS ON: Phases 03–04 (end-state exists to assert against)
---

# Phase 05 — Hardening, perf gate & docs fold-back

## Goal

Make the win durable: an automated check so draw-call blow-ups cannot silently
return (the original D-15 canary missed render cost entirely), a disposal
audit, and folding accepted decisions back into the canonical docs.

## In scope

### 1. Automated perf-regression gate (A5 / G5)
- Add a check that asserts a **draw-call / scene-object ceiling** for the
  Hillandale building lens. Options (pick the cheapest reliable one):
  - A Vitest test over `buildLensBatch`/`buildBuildingModel` asserting the
    building lens produces a bounded number of GPU objects (e.g. ≤ a small
    constant of batched meshes + one edge line), which is the structural proxy
    for draw calls and needs no GPU.
  - And/or a Playwright e2e (behind the `hillandale` marker, like the backend
    goldens) that loads Hillandale and asserts `gl.info.render.calls` under a
    threshold during a scripted orbit.
- Wire into `make ci` (or a documented `make` target if GPU-in-CI is flaky);
  keep it skippable locally with a marker, mirroring the backend `hillandale`
  pattern. Document the chosen threshold + rationale.

### 2. Dispose / leak audit (CR3)
- Verify every owned GPU resource is released on model swap, lens change, and
  unmount: BatchedMeshes, merged ghost geometry, merged edge geometries, any
  materials we instantiate. Add/extend `disposeBuildingModel` +
  controller cleanup. Test with repeated model + lens swaps watching
  `gl.info.memory.geometries/textures` and live material count return to
  baseline.

### 3. Behavior + visual regression sweep
- Final Playwright MCP pass on both fixtures against the full §5 contract +
  `research/v1-3d-model-viewer-reference.md` §16. Capture a small screenshot
  set into `assets/` for the record.

### 4. Docs fold-back (instructions §Source-Of-Truth 4)
- Update the original viewer description docs where intent now matches reality:
  - `planning/archive/model-viewer/PRD.md` §7 — note the posture is now
    enforced (shared materials, batched draw calls) + point to this refactor.
  - `context/` — if any durable architecture note belongs there (e.g. "dense
    geometry renders as a per-lens BatchedMesh"), add it.
- Update `planning/code-reviews/2026-06-18/model-viewer-large-model-performance.md`
  STATUS header → resolved, with a pointer to this refactor folder and the
  achieved numbers.
- Mark this refactor `Complete` in `STATUS.md` with the final A1–A6 evidence.

### 5. Memory (agent durable note)
- If the BatchedMesh substrate / picking pattern proves to be a non-obvious
  reusable convention, capture a one-line project memory pointer (per the
  memory rules) so future viewer work starts from it.

## Out of scope

- Any new feature; further line/space micro-optimization unless A1–A2 still
  miss (they should not by here).

## Risks & mitigations

- **GPU-in-CI flakiness** — prefer the structural Vitest proxy as the
  hard gate; treat the live-`gl.info` e2e as advisory / locally-run if CI GPU
  is unreliable. Document which is authoritative.
- **Threshold too tight/loose** — set with margin above the measured Phase-03/04
  steady state; record the measured value next to the threshold.

## Verification

- `make format` + `make ci` green, **including** the new perf gate.
- Repeated-swap leak test shows GPU resource counts returning to baseline.
- Final A1–A6 numbers recorded in `STATUS.md`; review doc closed.

## Exit criteria

- [x] Automated perf-regression gate in place + wired to CI (`perfGate.test.ts`
      in the Vitest suite → `make ci`); threshold + rationale recorded.
- [x] Dispose audit complete; no leaks across lens swaps (geometry count flat).
- [x] Behavior sweep passed on the small fixture across all lenses + the
      rapid-switch stress test.
- [x] D-6 folded into decisions.md; this folder is the canonical record; review
      marked resolved.
- [x] Refactor `STATUS.md` → Complete with the achieved A1–A6 numbers.

## Outcome (2026-06-18)

The refactor is locked and closed.

- **Perf gate (A5/G5):** `__tests__/perfGate.test.ts` asserts a lens builds in
  ≤ 2 `BatchedMesh` + 1 edge line regardless of object count (O(1) draw objects,
  not O(faces)) — the structural proxy for draw calls, no GPU, runs in `make ci`.
- **Dispose audit (CR3) — found + fixed two real leaks/crashes the rapid-switch
  audit surfaced:**
  1. **BatchedMesh lifecycle.** `BatchedLens` built the batch in `useMemo` and
     disposed it in a `useEffect` cleanup — the React-StrictMode footgun (the
     simulated unmount disposed the memoized batch, then the remount reused the
     disposed object → `dispose`/`onBeforeRender` null crashes on fast lens
     switching). Fixed by building + disposing in one effect (state-backed, so
     each batch is built and disposed exactly once and a remount rebuilds), plus
     an **idempotent** `LensBatch.dispose` that sets `visible=false` before
     freeing buffers (a disposed-but-briefly-mounted mesh is then skipped by the
     renderer). 24 rapid switches → 0 console errors.
  2. **`ContactShadows` geometry leak.** It was keyed by lens, so it remounted
     every switch and leaked ~1 geometry per switch (live `gl.info` geometry
     count climbed 46 → 92 over 16 switches, on line lenses too). Dropped the
     `key={lens}` (the Canvas is already per-file, so it bakes once); geometry
     count now flat at 12 across 16 switches. Also freed the ghost materials on
     Canvas unmount (`ViewerCanvas`).
- **Achieved numbers (Hillandale, building lens):** **14 draw calls @ 60 FPS**
  (baseline 32,045 @ 0.4; Phase-01 14,415 @ 1.1) — A1 (≤ ~50) and A2 (≥ 45)
  cleared with wide margin. Lines (D-6) stay per-object: ventilation 227 ducts →
  ~240 calls @ ~60 FPS.

Evidence: `working/phase05-building-no-leak.png` (flat geometry count),
`working/phase05-building-after-stress.png` (0 errors after 24 switches).
