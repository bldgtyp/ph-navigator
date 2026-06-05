---
DATE: 2026-06-05
TIME: 15:00 EDT
STATUS: Draft - phase map for the full Apertures Builder build-out. Phases not yet started.
AUTHOR: Codex
SCOPE: High-level sequencing, dependencies, slice strategy, and risk view for the 13 phase files under `phases/`.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/STATUS.md
  - planning/features/apertures/README.md
  - planning/archive/assembly-builder/phases/ (precedent shape)
---

# Apertures — Implementation Plan

This document is the **phase map**. It sequences the work, names the
gates between phases, and records risks visible only at the
phase-portfolio level. Each phase file under `phases/` carries its own
self-contained P0–P7 plan; do not duplicate phase detail here.

## Reading order

1. `PRD.md` — what the feature must do and why.
2. `STATUS.md` — current state, blockers, next step.
3. This file (`PLAN.md`) — the 13-phase shape and gates.
4. `phases/phase-NN-*.md` — the detail for the phase you are picking up.

## Slice strategy

The PRD identifies ten suggested phase groups (PRD §20). This plan
expands them into 13 implementation phases because the SVG canvas, the
element cards, and the catalog provenance polish each split cleanly
into separable PR-sized slices in practice (mirroring the
Assembly-Builder precedent at
`planning/archive/assembly-builder/phases/`).

Slicing rules:

- One phase = one reviewable PR target, roughly 400–800 LOC of
  production change plus tests. Phases that drift past 1200 LOC at
  implementation time should be re-split before the PR is opened.
- Phases are sequenced so each one ends with a working app — a user
  can land at the Apertures tab, drive whatever this phase added, and
  the older surfaces still work.
- Backend and frontend ship together inside one phase whenever a
  phase introduces a new contract (e.g. Phase 01's `ApertureCommand`
  seam, Phase 09's U-Value service). Pure UI phases stay frontend-
  only.
- Every phase ends green: `make format && make ci`.

## Phase map

| # | Title | Scope | Backend / Frontend |
|---|---|---|---|
| 01 | Terminology, schema, ApertureCommand boundary, default refs | Rename `window_types` → `apertures`, `win_`/`winel_` → `apt_`/`aptel_`, add `name` + `operation` to `ApertureElement`, seed default frame / glazing refs, introduce `ApertureCommand` seam, add no-holes validation, set `catalog_origin.catalog_schema_version: 1` on new copies. | Both |
| 02 | Apertures shell + sidebar | New `/projects/:id/apertures` route, layout shell (header / sidebar / main placeholder), sidebar add / rename / duplicate / delete with auto-suffix uniqueness, empty state, locked / viewer read-only. | Frontend (uses Phase 01 commands) |
| 03 | SVG canvas substrate + geometry helpers | Pure `aperture-geometry.ts`, `ApertureSvgCanvas.tsx` with 5-region per-element rendering, null-frame dashed outline, view direction + zoom (per-user). | Frontend |
| 04 | Canvas overlay, on-canvas pill, selection model | `ApertureCanvasOverlay.tsx` DOM overlay scaling with zoom, on-canvas editable name pill, hover/click affordances, single / shift / cmd-ctrl + ESC selection, no-direct-delete educational tooltip. | Frontend |
| 05 | Dimensions panel + parser + format selector | Horizontal + vertical dimension strips, tickmarks, edge-hover add buttons, delete row/col with confirmation rule, per-user / per-system display-unit format selector, V1 parser port with parens + precision preservation, total-dims caption. | Frontend (+ minor backend dim-edit command) |
| 06 | Element cards + per-side picker filtering + region-click pickers + badges | Card stack, per-side frame picker filtering by `location` / `use` / `operation`, click-on-frame-rect / glazing-rect → scoped picker, sourced-from / drift / hand-enter / datasheet badges, "You edited this" tag, hand-enter entry point. | Frontend (+ minor backend picker query) |
| 07 | Operations editor (presets + symbols + interior flip) | Fixed / Swing / Slide select + direction toggles, preset menu (Tilt-Turn, Awning, Hopper, Casement L/R, Slider L/R), SVG operation symbols (dashed hinge lines, slide arrows), L↔R flip on interior view, display label format. | Frontend |
| 08 | Merge / split + copy/paste + undo stack | Toolbar Merge / Split buttons, rectangle-validation, top-left inheritance with toast, split preserves source assignments, eyedropper / paint-bucket state machine, 20-entry bounded undo stack per aperture type. | Frontend (commands defined in 01) |
| 09 | U-Value service + display chips | Backend ISO 10077-1 port from V1 `window_u_value.py`, content-hash cache (excludes operation), per-element + window-level chips with IP/SI label, info tooltip, broken/import "unfinished" qualifier, frontend debounce + refetch triggers. | Both |
| 10 | HBJSON window-constructions export | Backend `to_hbe_aperture_construction.py` port, deterministic identifier escaping + collision detection, REST endpoint, overflow-menu action, MCP read tool, V1 shape fixture. | Both |
| 11 | Manufacturer filters | `tables.manufacturer_filters` document section, modal with two checkbox lists + bulk actions + count badges, picker integration, in-use enforcement, "Filter narrowed picker" hint. | Both |
| 12 | Catalog provenance polish (drift, refresh, refs view) | Refresh dialog wired to card badges, field-delta drift detection on current version (TB-09.a logic), Builder-level drift summary banner, project-wide drift report link, project-scoped refs view overflow action. | Both |
| 13 | Semantic MCP write tools | `list_aperture_types`, `get_aperture_type`, `report_aperture_catalog_drift`, `calculate_aperture_u_values`, `apply_aperture_command`; same draft/etag policy as browser writes; structured error envelope; audit log. | Backend |

## Dependencies and gates

```text
01 ──┬──> 02 ──> 03 ──> 04 ──> 05 ──┐
     │                              │
     └──> 09 (U-Value service)      ├──> 06 ──> 07 ──> 08
                                    │
                                    └──> 11 (manufacturer filters)

09 ──> 06 (U-Value chip on card)
09 ──> 10 (HBJSON export reads U-Value)
06 ──> 12 (drift/refresh dialog wired through card badges)
01 ──> 13 (semantic MCP wraps the same ApertureCommand seam)
```

Hard prerequisites:

- **01 unblocks everything.** Schema rename + `ApertureCommand` is the
  single source of truth every later phase consumes; do not start any
  other phase until Phase 01 lands.
- **03 → 04.** Substrate before overlay. The overlay's positioning math
  reads geometry from the same helpers Phase 03 introduces.
- **04 → 06.** Region click semantics need the overlay layer to attach
  hit targets above the SVG.
- **05 must complete before 07/08.** Operation symbols and merge/split
  preview correctly only when dimension data is editable.
- **09 unblocks 10.** HBJSON `u_factor` per construction reads the
  cached per-element U-Value. 09 must ship before 10.
- **12 depends on 06.** Card badges are where the drift dialog
  launches; the dialog is a no-op without them.

Soft parallelism:

- **09 (U-Value) can run in parallel with 02–05** because it is a
  pure backend service plus a card / header chip; the chip lands in
  06 but the service can exist earlier behind a feature flag.
- **11 (manufacturer filters) can run in parallel with 07/08** once
  06 is in.
- **13 (semantic MCP) can run any time after 01** because the
  `ApertureCommand` seam is already exercised by browser writes.
  Likely scheduled after 12 to keep the MCP surface lined up with
  the final feature set.

## Status workflow

Per `planning/.instructions.md`, every phase file's frontmatter
`STATUS` field should move through:

`Active — not yet started` → `In progress` → `Implemented on branch`
→ `Merged to main` → `Complete`

`STATUS.md` at the feature root mirrors the current head-of-line phase
and notes blockers. When a phase ships, its frontmatter status
advances to `Complete` and the next phase's status moves to
`Active — not yet started`. `STATUS.md`'s **Next Step** field is
always the next non-complete phase.

## Risk view (phase-portfolio level)

These risks are not phase-local; they live across the plan.

- **R1. Schema rename touches a live tracer-bullet UI.** Phase 01
  renames `tables.window_types[]` → `tables.apertures[]` and ports
  the existing minimal Windows tab. The dev DB will be rebuilt; the
  decision log (PRD §21 #6) commits to no production back-compat.
  Mitigation: Phase 01 ships the rename + a compatibility wrapper
  on the old route until Phase 02 cuts over the frontend.
- **R2. ApertureCommand seam is invented in 01, not validated until
  many phases later.** Adopting the command pattern before any
  high-frequency edit exists carries design risk. Mitigation: keep
  Phase 01's command set minimal (`createAperture`, `renameAperture`,
  `duplicateAperture`, `deleteAperture`, `pickFrame`, `pickGlazing`,
  `setElementOperation`, `setElementName`, `editDimension`,
  `addRow`, `addColumn`, `deleteRow`, `deleteColumn`,
  `mergeElements`, `splitElement`, `pasteAssignment`) and treat the
  command list as additive. Each later phase that introduces a new
  user gesture adds one command; do not retrofit broad operations.
- **R3. Default frame / glazing seeding is a deploy-time concern.**
  Phase 01's seeded-defaults decision assumes the catalog has known
  default rows on every environment. Mitigation: seed migration ships
  alongside Phase 01; the API surfaces a structured setup error if
  the defaults are missing rather than silently creating null refs.
- **R4. Per-side picker filtering by FrameRef `location` / `use` /
  `operation` depends on catalog rows being correctly classified.**
  Some V1 imports may have stale or missing classification.
  Mitigation: Phase 06 ships the dismissible "Showing N of M frames"
  footnote so a mis-classified row is still pickable. Phase 13
  surfaces missing-classification as a drift signal.
- **R5. HBJSON identifier escaping is a contract with the Rhino
  component side.** Changing the escape rule later breaks Grasshopper
  scripts in the wild. Mitigation: Phase 10 fixes the rule (replace
  non-`[A-Za-z0-9_]` with `_`, collapse runs, collisions are hard
  errors) and documents it in `context/technical-requirements/`. Any
  later change is a coordinated breaking release.
- **R6. U-Value calc must match V1 parity exactly to avoid spurious
  certification deltas.** Mitigation: Phase 09 ports the V1 fixtures
  one-for-one before introducing any V2 cleanup.
- **R7. The four canvas/overlay/dimensions/cards phases (03–06)
  collectively rebuild the entire Builder UI.** Risk: a regression
  in phase 04 only surfaces during phase 06 when cards start clicking
  through. Mitigation: each phase carries a focused browser check
  in `P5.Tests`, and `frontend/src/features/apertures/__tests__/`
  accumulates an integration scenario per phase that exercises the
  full stack at that point.
- **R8. The deferred V1 sub-tabs (Frame Types / Glazing Types)
  decision (PRD §6.1) may re-surface as a real workflow gap.**
  Mitigation: Phase 12 ships the project-scoped refs view; if that
  proves insufficient, a full standalone tab is a future scope
  decision, not a re-architecture event — the data model already
  carries every V1 field.

## Closeout

Per PH-Navigator V2 closeout policy (project `CLAUDE.md`):

- Each phase's last commit must end with `make format && make ci`
  green from the repo root.
- Each phase updates `STATUS.md` with the verification evidence
  (CI run id or local screenshot).
- Each phase folds accepted decisions back into `PRD.md`, this
  `PLAN.md`, or the `context/` files they belong in (per
  `planning/.instructions.md` source-of-truth rule 3).
- The full feature is `Complete` when phase 13 ships, the docs pass
  has run, and the `Windows` route either redirects to `/apertures`
  or has been removed.
