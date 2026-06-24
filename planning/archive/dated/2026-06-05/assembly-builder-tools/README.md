---
DATE: 2026-06-04
TIME: 12:00
STATUS: Complete
AUTHOR: Ed May
SCOPE: Assembly Canvas refactor (Envelope > Assemblies sub-tab) — to-scale SVG rendering + direct edit affordances
RELATED:
  - context/user-stories/20-envelope.md (US-ENV-2..US-ENV-10)
  - context/UI_UX.md
  - research/v1-assembly-builder-reference.md (§9 canvas, §11 header)
  - planning/archive/assembly-builder-foundation/ (superseded precedent)
---

# Assembly Builder — Canvas refactor

## What this feature folder is

A focused execution surface for the V2 **Assembly Canvas** rebuild:
the to-scale, CAD-like cross-section drawing on the
`/projects/{id}/envelope/assemblies` page, plus the direct
interactions on it (hover, click, +/edit buttons, dimension lines,
flip, eyedropper / paint).

This is a **rendering + direct-interaction PRD**. It does NOT
re-spec the Envelope tab structure, the assembly sidebar, the
Specifications sub-tab, Airtightness, or Site Photos — those live
in `context/user-stories/20-envelope.md` (US-ENV-1, US-ENV-2,
US-ENV-13, US-ENV-14, US-ENV-15) and stay authoritative there.

## Read order

1. `PRD.md` — the architectural decision (Option C: one SVG, one
   `viewBox` in mm, HTML overlay for chrome) plus the user stories
   and acceptance criteria for the canvas + its direct affordances.
2. `STATUS.md` — current state, next step, blockers.
3. `assets/` — reference screenshots:
   - `v1-reference-to-scale.png` — the V1 vaulted-roof example
     (yellow batt + orange studs + green gypsum at correct
     proportions). The visual fidelity target.
   - `v1-segment-hover-plus-buttons.png` — the V1 hover state on
     a single segment showing the two magenta `+` circles
     centered near the segment's inside edges, plus the
     "Add Segment Before" shadcn tooltip on the left button.
     The Q-AB-4 resolved treatment.
   - `v2-current-state.png` — the current V2 page (diagrammatic,
     not to-scale; clamps in `canvas-constants.ts` break aspect
     ratio).

## Phase map

- Phase 01 — SVG canvas substrate (single `<svg viewBox>`, drop
  the three clamps in `canvas-constants.ts`). Implemented in the
  current workspace; see `phases/phase-01-svg-canvas-substrate.md`.
- Phase 02 — HTML overlay chrome (dimension column with
  click-to-edit, hover-`+` buttons, hover highlighting). Implemented
  in the current workspace; see
  `phases/phase-02-html-overlay-chrome.md`.
- Phase 03 — Direct interactions (click segment → modal, eyedropper /
  paint state machine wired to canvas). Implemented in the current
  workspace; see `phases/phase-03-direct-interactions.md`.
- Phase 04 — Remaining toolbar parity, especially the new all-layers
  Flip Segments command from PRD §5.7. Implemented in the current
  workspace; see `phases/phase-04-toolbar-parity.md`.

This feature is complete and archived. Future visual QA or
maintenance cleanup should start from the durable behavior in
`context/user-stories/20-envelope.md` and open a new planning slice.

## Out of scope (explicit non-goals)

Carried forward from the originating chat — do **not** plan or
build these as part of this feature:

- Real CAD drawing tools (pencil, polyline, polygon).
- Non-rectangular segment polygons (sloped layers, curved
  insulation, etc.). V2 v1 ships axis-aligned rectangles only.
- Mouse-wheel-zoom (Cmd/Ctrl + scroll). Discrete zoom-button cluster
  only.
- Interactive push/pull rectangles (drag a segment edge to resize).
  Width / thickness edits go through modals only.

## Relationship to the archived foundation planning

`planning/archive/assembly-builder-foundation/` contains the prior
16-phase plan (Phase 01–16). It is **superseded by this folder**:
the prior plan targeted a different rendering approach (HTML +
per-segment SVG, Option B) and a broader scope (specifications,
drift, HBJSON). Keep it as precedent reading; do not implement
against it without explicit promotion back to current.
