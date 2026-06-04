---
DATE: 2026-06-04
TIME: 12:00
STATUS: Active
AUTHOR: Ed May
SCOPE: Assembly Canvas refactor (Envelope > Assemblies sub-tab)
RELATED:
  - PRD.md
  - README.md
---

# STATUS — Assembly Canvas refactor

## Current state

**PRD locked, no implementation yet.**

- Architectural decision locked: Option C (single SVG with
  `viewBox` in mm + HTML overlay for chrome). See `PRD.md` §3.
- Scope locked: canvas substrate + direct interactions only.
  Sidebar, header name picker / labels, Specifications,
  Airtightness, Site Photos are **out of scope** for this
  feature folder and stay owned by their existing user stories.
- All six open questions resolved 2026-06-04. See `PRD.md` §8
  for the locked answers (per-assembly segment flip; dim lines
  stop at assembly left edge; active-unit display + multi-unit
  input parser; magenta `+` left/right with no hover trash/edit
  icons; click-segment opens modal; zoom max 3.0x).

## Next step

Draft `phases/phase-01-svg-canvas-substrate.md` —
substrate-only phase that delivers visual parity with
`assets/v1-reference-to-scale.png` and drops the three clamps
in `canvas-constants.ts`. Subsequent phases (overlay chrome,
direct interactions, toolbar) land after Phase 01 lands on
main.

## Blockers

None. The PRD does not depend on any external decision; all
referenced behavior already exists in
`context/user-stories/20-envelope.md`.

## Verification (when implemented)

- **Visual parity** with `assets/v1-reference-to-scale.png`
  — V1 vaulted-roof rendering reproducible at the same
  proportional fidelity in V2 on the same data.
- **No-clamp invariant** — given any assembly,
  `layer.thickness_mm * 2 ≈ rendered height in px * 2`. No
  layer renders at a clamped minimum. Test: a 0.5"-then-3.5"
  layer pair renders at exactly a 1:7 height ratio at the same
  zoom.
- **IP / SI input** — typing `"4 in"` into the dimension
  column when display unit is SI converts to ~101.6 mm in the
  document; typing `"100 mm"` when display unit is IP converts
  to ~3.94 in displayed.
- **Hover-`+` parity** with `assets/v1-add-segment-buttons.png`
  — magenta circle + "Add Segment Before" / "Add Segment
  After" shadcn tooltips on segment edges.
- **Eyedropper / paint** — pick a material from one segment,
  paste onto 3 others in the same assembly with the V1
  yellow-tint hover + 600 ms pulse animation; ESC drops state.

## Recent activity

- 2026-06-04 — Feature folder created. PRD drafted (`PRD.md`).
  README + STATUS scaffolded. Prior 16-phase plan in
  `planning/archive/assembly-builder/` flagged as superseded.
- 2026-06-04 — All six open questions (Q-AB-1..Q-AB-6) resolved.
  PRD updated; STATUS bumped to "PRD locked." Next step:
  draft Phase 01 (SVG substrate).
