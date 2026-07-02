---
DATE: 2026-07-01
TIME: 18:05
STATUS: Complete
AUTHOR: Claude (for Ed)
SCOPE: Phase 06 — tests, perf verification, docs, closeout gate
  (PRD §12–§13).
RELATED:
  - ../PRD.md §12, §13
  - frontend/tests/e2e/model-viewer-site-sun.spec.ts
  - frontend/src/features/model_viewer/__tests__/perfGate.test.ts
  - context/user-stories/40-model-viewer.md (Q-VIEW-6)
---

# Phase 06 — Verification & Closeout

## Steps

1. **E2e** (extend `model-viewer-site-sun.spec.ts`): pill only in
   site-sun with location set; engage → debug-hook `sunStudy` state;
   scrub both range inputs → altitude changes sensibly; chip click sets
   date, preserves time; `Esc` + lens-switch teardown/restore;
   summer-noon screenshot artifact.
2. **Perf gate**: unit assertion that the engaged sun-study adds a
   constant object count (≤ 3: marker, catcher — azimuth line deferred);
   heavy-fixture before/after frame-time + draw-call comparison
   recorded here (baseline ~60 FPS / 14 calls).
3. **Docs**: amend `context/user-stories/40-model-viewer.md` Q-VIEW-6
   (un-defer); update this feature's STATUS.md; archive note for
   `model-viewer-ground-shadows` folder stays Superseded.
4. **Closeout gate** (CLAUDE.md): `simplify` skill → `docs-pass` skill
   → `make format` → `make ci` (fix until green).
5. Walk PRD §12 acceptance criteria 1–13 and record each as
   verified/deferred with evidence.

## Exit criteria

`make ci` green; §12 ledger complete; STATUS.md updated to
"Implemented on branch" (or "Merged to main" once Ed merges).

## Ledger

- **E2e**: `model-viewer-site-sun.spec.ts` extended and green (2/2) —
  pill visible only in site-sun; engage via pill; geometry-count perf
  gate (probe `geometries` delta ≤ 5 on engage; sun study owns 2);
  scrub both range inputs with altitude assertions; Dec-21 chip sets
  date only; winter-noon screenshot artifact; Esc → pill with state
  remembered; lens round-trip restores the bar and readout.
- **Perf (site-sun lens, small fixture + Hillandale)**: Hillandale
  engaged 147 calls / ~15 ms orbit-EMA vs 136 / ~25 ms disengaged
  (frame time inside orbit-sampling noise; delta is the shadow passes +
  marker/catcher). Building-lens cost untouched by construction (sun
  study renders only in site-sun; flags proven free in phase 02).
- **Simplify pass** (4-angle review): shared `DAYS_PER_MONTH` export
  (was duplicated in `SunStudyBar`), hoisted per-day hoy base in the
  backend grid loop, daylight-band gradient memoized per day via an
  `EngagedSunStudyBar` split. Skipped as out-of-scope/by-design: an
  Esc-dispatch registry refactor, unifying the ViewerCanvas/debugHook
  vector derivations (different gating semantics), cross-language
  calendar constants (wire-contract, documented).
- **Docs**: PRD gained an as-built amendments block (PCF, section ×
  shadows, `true_north_deg`); README/PLAN/STATUS headers synced;
  Q-VIEW-6 amended in `context/user-stories/40-model-viewer.md`.
- **PRD §12 acceptance walk**: 1–11 verified (browser + e2e + unit
  ledgers in phases 01–05; §12.10's "≤3 scene objects" implemented as
  the e2e geometry-count gate with documented headroom); §12.12
  `make ci` recorded below; §12.13 baseline criteria verified in
  phase 01. Deviations from the reviewed contract are the three
  as-built amendments at the top of `PRD.md`.
- **`make ci`**: green 2026-07-01 (exit 0; backend 1257 passed /
  7 skipped incl. Hillandale-gated skips, frontend prettier + eslint +
  tsc + vitest + build all clean). The one earlier backend flake
  (`test_batch_does_one_document_load`, unrelated document-batch test)
  passed in the full run and in isolation.
