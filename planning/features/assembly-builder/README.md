---
DATE: 2026-06-04
TIME: 12:00
STATUS: Active
AUTHOR: Ed May
SCOPE: Assembly Canvas refactor (Envelope > Assemblies sub-tab) — to-scale SVG rendering + direct edit affordances
RELATED:
  - context/user-stories/20-envelope.md (US-ENV-2..US-ENV-10)
  - context/UI_UX.md
  - research/v1-assembly-builder-reference.md (§9 canvas, §11 header)
  - planning/archive/assembly-builder/ (superseded precedent)
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

Locked 2026-06-04. Each phase lands as one mergeable PR; each
ends with the app in a working state. Phases must execute in
order — Phase 02 depends on Phase 01's substrate, Phase 03 on
Phase 02's overlay (only the orchestrator import), Phase 04 on
Phase 03's toolbar wires.

- **Phase 01 — SVG canvas substrate** (`phases/phase-01-svg-canvas-substrate.md`).
  New `AssemblySvgCanvas.tsx`. Drop the three clamps in
  `canvas-constants.ts`. Add pure geometry helpers in
  `lib.ts`. Existing chrome stays in place (kludge — gets
  replaced in Phase 02). Visual fidelity target:
  `assets/v1-reference-to-scale.png`.

- **Phase 02 — Overlay chrome** (`phases/phase-02-overlay-chrome.md`).
  New `AssemblyCanvasOverlay.tsx` with the dimension column
  (click-to-edit inline editor + any-unit length parser),
  orientation labels, magenta hover-`+` buttons for segments
  and layers, hover highlight on segments. Removes the
  Phase-01 kludge chrome. Click segment → opens
  `SegmentDialog`. No hover trash / edit icons. Visual fidelity
  target: `assets/v1-segment-hover-plus-buttons.png`.

- **Phase 03 — Assembly header toolbar** (`phases/phase-03-assembly-header-toolbar.md`).
  Toolbar cluster in `AssemblyHeader.tsx`: flip orientation,
  flip layers, **flip segments (NEW)**, zoom cluster
  `[−] % [+] [Fit]`, eyedropper / paint-bucket / undo
  entry buttons. Persists zoom to `userPreferencesStore`.
  Pure JSON-Patch generators for the three flips. Toolbar
  buttons wire to no-op placeholders for pick / paste; the
  actual state machine lands in Phase 04.

- **Phase 04 — Pick / paste state machine** (`phases/phase-04-pick-paste-state-machine.md`).
  `usePickPasteMode` hook owning the state machine + bounded
  per-assembly undo stack (20 entries). Mode-aware SVG
  rendering (green outline picking, yellow tint pasting,
  600 ms pulse on paste). ESC / outside-mousedown / assembly
  switch cancel. ⌘Z keybinding wired. Closes out US-ENV-9
  on the canvas surface.

When all four phases are merged, the canvas-rebuild feature is
complete; this folder rolls to `STATUS: Complete` and routes
back to `context/user-stories/20-envelope.md` as the durable
behavioral source.

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

## Relationship to the archived planning

`planning/archive/assembly-builder/` contains the prior 16-phase
plan (Phase 01–16). It is **superseded by this folder**: the prior
plan targeted a different rendering approach (HTML + per-segment
SVG, Option B) and a broader scope (specifications, drift,
HBJSON). Keep it as precedent reading; do not implement against
it without explicit promotion back to current.
