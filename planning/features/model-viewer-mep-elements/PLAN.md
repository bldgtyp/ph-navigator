---
DATE: 2026-07-01
TIME: 16:20 EDT
STATUS: Complete; all phases implemented and verified.
AUTHOR: Claude (for Ed)
SCOPE: Implementation phase sequence for MEP element selection/length
  reporting. Each phase is one PR-sized, independently verifiable
  slice, written as a self-contained subagent handoff (required
  reading, work breakdown with file paths, contracts, verification
  gate, exit criteria) — mirroring
  planning/archive/dated/2026-06-13/model-viewer/PLAN.md's format.
RELATED:
  - PRD.md (product/behavior contract — read first, always)
  - STATUS.md
  - phases/phase-01-backend-total-length.md
  - phases/phase-02-element-selection-highlight.md
  - phases/phase-03-row-segment-focus-linking.md
  - phases/phase-04-dimension-lines.md
  - phases/phase-05-verification-closeout.md
---

# Model Viewer — MEP Elements — Implementation Plan

Detailed per-phase handoff docs:

1. `phases/phase-01-backend-total-length.md`
2. `phases/phase-02-element-selection-highlight.md`
3. `phases/phase-03-row-segment-focus-linking.md`
4. `phases/phase-04-dimension-lines.md`
5. `phases/phase-05-verification-closeout.md`

Dependency order: **backend data → element selection/highlight/card →
row/segment focus linking → dimension lines (optional) → full
verification & closeout.** Each phase ends green on its own focused
tests plus `make format`; `make ci` runs at minimum at the end of
Phase 2 (the first user-visible behavior change) and again at the end
of every phase after it.

**Every phase (including Phase 1) must start by reading `PRD.md` in
full** — it contains the design reasoning, the exact file:line
grounding, and the decisions (D-1..D-7) each phase implements. Phase
docs below cite PRD sections but do not repeat their content.

## Phase 1 — Backend: element & segment total length — COMPLETE

Implements PRD §7. Adds `length` as a computed field to
`PhHvacDuctSegmentSchema`/`PhHvacDuctElementSchema` (local
vector-magnitude computation, D-7/§7a) and as a declared field to
`PhHvacPipeElementSchema` (wiring through already-existing upstream
data, D-5) at every tree depth (trunk/branch/fixture/recirc). Adds the
matching TS fields to `types.ts`. Backend-only + type-only frontend
change — no rendering or interaction behavior changes yet. Fully
independent of Phases 2-5; can be verified and merged on its own.

**Verify:** backend pytest golden-fixture length assertions (canonical
+ Hillandale, all pipe tree depths); `uv run ty check`; `tsc -b`
green on the type-only frontend change; `make format` + `make ci`.

Completed 2026-07-01. Backend Ruff, `uv run ty check`, canonical
extraction smoke, frontend Prettier/`tsc -b`/focused Vitest,
`make format`, `make ci`, and `graphify update .` are green. Full CI
evidence: backend 1250 passed / 7 skipped; frontend 216 test files
passed / 1989 tests passed; production build completed.

## Phase 2 — Frontend: element-level selection, highlight, camera,
## base inspector card — COMPLETE

Implements PRD §4, §5 (base card only — no row/segment focus yet),
§8, D-1, D-2, D-3, D-4. Clicking any segment selects+highlights the
whole element (every segment gets today's existing full-highlight
treatment — see PRD §10's sequencing note, the soft/full split is
Phase 3's job, not this phase's). Hover promotes to whole-element
preview. Camera zoom-to and copy-ID resolve elements, not just
segments. New `ElementInspectorPanel` renders the header + Total
Length + an ordered, non-interactive segment table with click-to-expand
detail rows (reusing the existing `pipeSegmentLine`/`ductSegmentLine`
field configs verbatim inside each row). This phase alone ships the
user's core ask and is a coherent, shippable state on its own.

**Verify:** Vitest for the segment→element grouping/lookup and the
`elementsById` construction; updated Playwright specs for click-selects-
whole-element in both lenses (all four pipe roles); `make format` +
`make ci`; browser walkthrough.

Completed 2026-07-01. Implemented `elementIdForSegmentId`,
`BuildingModel.elementsById`, element-scoped selection/hover
resolution, union-bounds zoom-to, copy-ID fallback, debug-hook element
selection, and the base `ElementInspectorPanel` with Total Length plus
ordered expandable segment rows. Focused verification is green:
frontend `tsc -b`, focused Vitest for viewer core/elements,
`pnpm run check:all`, and the Chromium model-viewer lens e2e smoke.
Full repo `make format` / `make ci` / `graphify update .` run as the
phase closeout gate.

## Phase 3 — Frontend: row ↔ 3D focus linking — COMPLETE

Implements PRD §6, §10 (the soft/full four-tier color model), D-7.
Adds `focusedSegmentId` to the store; threads `tokens: ViewerTokens`
into `LineObject` so the soft/full split renders through the
CSS-var-aware path (matching `BatchedLens`, not a second hardcoded
constant); wires 3D-hover→row-highlight/scroll-into-view and
row-click→sticky-segment-focus+row-expand; resets focus on every path
that already resets `selectionId`.

**Verify:** Vitest for the four-tier color-resolution pure function in
isolation; Playwright case simulating hover-then-camera-orbit to prove
focus persists; `make format` + `make ci`; browser walkthrough.

Implemented 2026-07-01. Added `focusedSegmentId` and
`toggleFocusedSegment` to the model-viewer store with reset behavior
on selection/file/lens teardown; added the pure
`resolveLineHighlightTier` resolver; threaded `ViewerTokens` into the
line lens so selected-soft and focused tiers use CSS-derived
highlight tokens; replaced local segment-row expansion with sticky
store focus; added 3D-hover/table-row sync and debug-hook tier
exposure for e2e. Focused verification is green: frontend `tsc -b`,
focused Vitest for element tiers/store focus, `pnpm run lint`,
`pnpm run check:all`, and the Chromium model-viewer lens e2e smoke.
Full repo `make format`, `make ci`, and `graphify update .` are
green. Full CI evidence: backend 1250 passed / 7 skipped; frontend
218 test files passed / 2003 tests passed; production build completed.

## Phase 4 — Frontend: selection-scoped dimension lines — OPTIONAL,
## COMPLETE

Implements PRD §9, D-6. Renders offset dimension line + extension
lines + end ticks + unit-aware midpoint label for each segment of the
*selected* element only, reusing the `MeasureOverlay.tsx` line+`<Html>`
pattern. Camera-facing perpendicular offset, recomputed on camera
move. Adds a perf-gate unit test (mirroring `perfGate.test.ts`)
asserting dimension-line object count scales with the selected
element's segment count, not the lens total.

**This phase is explicitly cuttable** (PRD §9: "don't let scope creep
here block shipping §4-§7"). If cut or deferred, proceed straight to
Phase 5 — do not skip Phase 5's closeout on the assumption Phase 4
would have carried it.

**Verify:** perf-gate unit test; Vitest for offset-geometry math
(ticks/extension lines at known segment vectors); Playwright case
selecting a multi-segment element and asserting dimension-line count
== segment count, and that no dimension lines render for an
unselected element; `make format` + `make ci`; browser walkthrough.

Implemented 2026-07-01. Added the pure
`buildDimensionLineGeometry` helper with stable head-on fallback,
offset-distance tuning, and selected-segment primitive counts; mounted
`DimensionOverlay` only for selected Ventilation/Hot Water elements;
rendered extension lines, dimension lines, ticks, and unit-aware
canvas-scoped labels using the same length formatter as the inspector.
Focused verification is green: frontend `tsc -b`, dimension-line
Vitest, `pnpm run lint`, `pnpm run check:all`, and the Chromium
model-viewer lens e2e smoke. Full repo `make format` / `make ci` /
`graphify update .` are green. Full CI evidence: backend 1250 passed /
7 skipped; frontend 219 test files passed / 2007 tests passed;
production build completed.

## Phase 5 — Full verification & closeout — COMPLETE

Runs regardless of whether Phase 4 shipped. Full Ventilation + Hot
Water Playwright suite across all four pipe roles (trunk/branch/
fixture/recirc) and duct supply/exhaust; walks every PRD §14
acceptance criterion and checks it off in STATUS.md; resolves PRD §13
open question 1 (segment order — confirm against both fixtures,
correct the `#` column claim or the extraction order if it's wrong)
if not already settled in an earlier phase; `$ simplify`, `$
docs-pass`, `make format`, `make ci`; browser walkthrough with
screenshots; `graphify update .`.

Completed 2026-07-01. Segment insertion order was verified against
canonical and Hillandale fixtures and settled as stable display order
only, not physical path order. PRD §14 acceptance criteria 1-13 are
recorded pass in `STATUS.md`. Full model-viewer Chromium Playwright
sweep, screenshot walkthrough, local simplify/docs-pass, `make
format`, `make ci`, and `graphify update .` are complete.

## Sequencing notes

- Phase 1 is backend-only and can proceed independently/in parallel
  with early Phase 2 design work, but Phase 2's frontend types depend
  on Phase 1's wire fields — land Phase 1 first in practice.
- Phase 2 before Phase 3: Phase 3's row↔focus linking needs the base
  card and `elementsById` grouping from Phase 2 to exist first.
- Phase 4 is independent of Phase 3's internals but visually assumes
  an element is already selectable (Phase 2) — sequenced after Phase 3
  only so the four-tier color model (§10) is settled before dimension
  lines add a fifth visual element to the scene, not because of a hard
  technical dependency.
- Phase 5 is a hard last step regardless of which optional work (Phase
  4) landed.
