---
DATE: 2026-06-12
TIME: -
STATUS: In review — implementation started 2026-06-13. Final MVP
  phase; focused TypeScript/Vitest/e2e/browser checks green, simplify
  and docs-pass complete, make format + make ci green. John test
  requires Ed/John coordination.
  The Site & Sun sun path itself remains blocked on the separate
  `project-location` feature; the lens ships with a location hint.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Model Viewer Phase 6 — Measure mode,
  Site & Sun lens (building + shades + hint), keyboard map, a11y pass,
  full e2e suite, and the PRD §8 acceptance run.
RELATED:
  - planning/features/model-viewer/UI_SPEC.md (§7 measure, §3 Site &
    Sun row, §9 keyboard map)
  - planning/features/model-viewer/PRD.md (§4.5 sun path deferral —
    D-07; §8 acceptance gate)
  - context/user-stories/40-model-viewer.md (US-VIEW-4 measure
    semantics)
  - research/v1-3d-model-viewer-reference.md (§12.3 measure handler,
    §9.7 shades, §14.8 label-scoping bug, §16 checklist)
  - planning/features/project-location/README.md (the blocking
    feature's requirements stub)
---

# Phase 6 — Measure, Site & Sun, polish + acceptance

## 0. Implementation checkpoint — 2026-06-13

Landed so far:

- [x] Measure store lifecycle: active flag, snap target, pending
  point, accumulated lines; entering Measure clears hover/selection;
  exit/file switch/lens switch clears measurement artifacts.
- [x] Measure rendering: screen-space nearest-vertex snap, snap
  marker, two-click dimension lines, canvas-scoped drei `<Html>`
  labels, and `m` / feet-inches formatting.
- [x] Site & Sun segment enabled when building geometry exists.
- [x] Site & Sun scene renders selectable building faces/apertures,
  flat grey non-selectable merged shade groups, a small north marker,
  the D-07 location hint, and a `sun_path != null` renderer stub for
  future project-location wiring.
- [x] Keyboard map: `1`–`6`, `F`, `H`, `M`, Esc cascade, and
  `Cmd/Ctrl+C` with selection.
- [x] A11y polish: canvas aria description names active file + lens;
  icon-heavy floating controls gained labels/titles.
- [x] Focused tests:
  `viewerCore.test.ts`, `viewerThemes.test.ts`,
  `viewerMeasure.test.ts`, and `units.test.ts` green (32 tests);
  `tsc -b --pretty false` green.
- [x] Playwright e2e:
  `model-viewer-files.spec.ts`, `model-viewer-lenses.spec.ts`,
  `model-viewer-themes.spec.ts`, `model-viewer-measure.spec.ts`,
  and `model-viewer-site-sun.spec.ts` green (5 specs).
- [x] Browser walkthrough: in-app browser on `localhost:5173` as
  `codex@example.com`; Site & Sun deep link rendered active, location
  hint visible, scene aria description present. Screenshots:
  `assets/phase-06-site-sun.png`, `assets/phase-06-measure.png`.
- [x] `graphify update .` run after code/docs changes.
- [x] `$ simplify` completed; follow-up fixes landed for shade group
  flattening, shared feet-inches formatting, popover Escape handling,
  dev/test-only debug hook subscriptions, and Measure pointer
  invalidation/coalescing.
- [x] `$ docs-pass` completed; no context/ADR updates needed.
- [x] `make format` green.
- [x] `make ci` green: backend Ruff format/lint, Ty, Alembic, pytest
  (780 passed, 2 skipped); frontend Prettier check, ESLint (3 known
  aperture fast-refresh warnings), structural checks, Vitest (1575
  passed), and production build.

Still pending:

- [ ] §16 parity checklist / PRD §8 acceptance notes, including the
  John test outcome or explicit deferral note if Ed must coordinate it
  outside this coding pass.
- [ ] Full `make e2e` is red outside the model-viewer slice:
  all 5 model-viewer specs passed, but 12 unrelated specs failed
  across custom-fields, row-context-menu, windows/catalog drift, and
  record-linking/health flows. Do not treat those failures as Phase 06
  regressions without a separate investigation.

## 1. Goal

Measure mode works end-to-end (snap → two-click dimension lines →
unit-aware labels → clean lifecycle). The Site & Sun lens shows the
building + merged grey shade groups + a quiet "Set project location
to see the sun path" hint. The full keyboard map and a11y behaviors
land. The §16 no-regression checklist and the PRD §8 acceptance gate
(including the "John test") are walked and recorded. This closes the
Model Viewer MVP.

## 2. Required reading (in order)

1. `planning/features/model-viewer/UI_SPEC.md` §7 (measure), §3
   (Site & Sun lens row), §9 (keyboard map + a11y).
2. `context/user-stories/40-model-viewer.md` — US-VIEW-4 (measure
   semantics + lifecycle; the Select-tool parts are superseded by
   D-04, already shipped in Phase 3).
3. `decisions.md` D-07 (sun path deferral) + the OQ-1 resolution.
4. `research/v1-3d-model-viewer-reference.md` §12.3 (vertex snap
   math), §9.7 (shade rendering), §14.8 (the document.body label
   leak to avoid), §16 (the checklist this phase closes out).
5. `planning/features/model-viewer/reviews/2026-06-12-v1-parity-audit.md`
   (the mapping table doubles as the §16 walk key).

## 3. Work breakdown

### 3.1 Measure mode (UI_SPEC §7)

The only mode in the app. Entered via the 📏 toggle (added to the
Phase 3 camera cluster, bottom-right) or `M`.

- Entering: crosshair cursor; hint chip bottom-center *"Click two
  points to measure · Esc to exit"*; hover/selection suspend (the
  open inspector closes); toggle shows active state.
- Pointer-move: snap marker (small dot) on the nearest face-corner
  vertex within ~20 px **screen** distance — project the Phase 3
  vertex positions to screen space; V1 §12.3 has the math. With
  `frameloop="demand"`, invalidate on pointer-move while measuring.
- Two clicks = one dimension line: thin line between vertices +
  pill label at the midpoint via drei `<Html>` **scoped to the
  canvas wrapper** (never `document.body` — V1 ref §14.8 leak),
  `pointer-events: none`. Label uses the existing length formatters
  (`formatLengthFromMm` family — note the wire is meters; convert
  m→mm or add a meters-in formatter consistent with
  `frontend/src/lib/units/` conventions) and re-renders on IP/SI
  toggle. Lines accumulate while the mode is active.
- Exit (`Esc`, toggle, or lens switch): clears all lines + snap
  marker, restores selection behavior. Lens switch already clears
  selection (Phase 4); extend it to exit measure.

### 3.2 Site & Sun lens

- Scene set per UI_SPEC §3: full building (faces + apertures,
  selectable as in Building lens) + merged shade groups in flat
  grey (NOT selectable — Q-VIEW-3) + compass/north indicator if
  cheap, + a quiet in-canvas hint: *"Set project location to see
  the sun path."*
- The hint is informational only (no link target exists yet). When
  `project-location` ships, the sun path activates via backend
  `Sunpath.from_location` and the `sun_path` wire key going
  non-null — no Model-tab rework expected (D-07). Leave the
  renderer keyed off `sun_path != null` with the dashed-line
  styling stubbed for that integration.
- Shade loader: backend ships one merged mesh per group (Phase 2);
  the loader is a thin mesh mapper. Enable the lens-bar segment if
  Phase 4 shipped it disabled.

### 3.3 Keyboard map + a11y (UI_SPEC §9)

- `1`–`6` lenses · `F` fit · `H` home · `M` measure · `Esc`
  cascade: exit Measure → clear selection → close popovers, in that
  order · `⌘/Ctrl+C` with selection copies object ID. Keys are
  inert while focus is in an input/textarea.
- All floating controls: real buttons, focusable, `aria-label`,
  tooltips on hover AND focus. Canvas gets a short aria description
  naming the active file and lens (live-updated).
- Quick pass with the a11y debugging skill/axe on the Model tab;
  fix what's ours (don't chase upstream drei internals).

### 3.4 Acceptance run (PRD §8)

1. Every US-VIEW-1..7 criterion as amended by PRD §4 deltas —
   confirm each phase's exit ledger is green.
2. Walk `research/v1-3d-model-viewer-reference.md` §16 item-by-item
   using the parity audit's mapping table as the key; check each
   off in STATUS.md with a one-line evidence note.
3. Full e2e suite green (`make e2e`) including the new
   `model-viewer-measure.spec.ts` (measured distance matches a
   known fixture dimension in BOTH unit systems — pick a wall edge
   with a hand-verifiable length; lifecycle: lines clear on exit
   and on lens switch) and `model-viewer-site-sun.spec.ts` (shades
   render, hint visible, shades not selectable).
4. Scripted Playwright-MCP walkthrough as the acceptance run,
   screenshots into `planning/features/model-viewer/assets/`.
5. **Scale check** (confirmation only — the 52 MB Hillandale
   fixture has been exercised since Phase 2, per the round-3
   resequencing): re-confirm load time acceptable with the progress
   chip visible and orbit smooth across all lenses (PRD §7 posture —
   defer workers unless this actually hurts; if it hurts, record
   findings in STATUS.md and stop, don't improvise architecture).
   Also confirm the Ventilation / Hot Water segments render
   disabled for it (the file has no duct/pipe geometry).
6. **The John test** (PRD §8.4): a non-technical user opens a
   project URL logged-out, orbits, clicks a wall, reads its
   construction — zero instruction. Coordinate with Ed; record the
   outcome.

## 4. Out of scope

Sun-path rendering (blocked on `project-location`; the location
*data* comes from that feature's Phase 1, but the wiring + rendering
stay owned by model-viewer and are scheduled separately once
project-location Phase 1 has landed — see project-location PRD §10 and
decisions.md D-PL-2), sun scrubber, legend-as-filter
(NEW-VIEW-2, first post-MVP), clipping planes, HBJSON↔document
cross-check, comments.

## 5. Verification gate

1. **Vitest**: snap-target selection math (nearest-vertex within
   threshold, screen-space), distance formatting both unit systems,
   Esc-cascade ordering, measure-state lifecycle reducer.
2. **Playwright e2e**: the two new specs (§3.4.3) plus keyboard-map
   coverage folded into existing specs (lens keys, F/H/M, Esc
   cascade, copy-ID).
3. **Closeout**: `make format` + `make ci` + `make e2e` green.
   `graphify update .`.

## 6. Exit criteria

PRD §8 acceptance gate fully recorded in STATUS.md (incl. §16
checklist walk + John test outcome); feature STATUS moves to the
appropriate `planning/.instructions.md` vocabulary state; docs pass
syncs any drift discovered during the walk back into
`context/user-stories/40-model-viewer.md` / `context/UI_UX.md` §2.9
per the planning rules. Post-MVP queue (NEW-VIEW-2 first) noted in
STATUS.md as next planning work.
