---
DATE: 2026-07-01
TIME: 18:05
STATUS: Pending (blocked by phase 05)
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

- (fill on completion)
