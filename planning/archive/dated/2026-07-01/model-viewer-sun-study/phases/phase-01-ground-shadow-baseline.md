---
DATE: 2026-07-01
TIME: 18:05 (completed 21:15)
STATUS: Complete
AUTHOR: Claude (for Ed)
SCOPE: Phase 01 — ground-shadow baseline fix (PRD D-12; imported from
  planning/features/model-viewer-ground-shadows/, now Superseded).
RELATED:
  - ../PRD.md §2, §5.3, D-12
  - ../../model-viewer-ground-shadows/PRD.md (imported behavior contract)
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
---

# Phase 01 — Ground-Shadow Baseline Fix

## Problem (verified)

`ViewerCanvas.tsx` renders drei `ContactShadows` with
`rotation={[Math.PI / 2, 0, 0]}` — which is drei's *default* Y-up
orientation (the component's internal group is `rotation-x={Math.PI/2}`;
the prop overrides it with the same value). In PHN's Z-up scene that
plane is vertical, so from some orbit angles it reads as a giant
free-standing gray sheet.

## Steps

1. Reproduce on the local seed model; capture a before screenshot
   (`assets/phase-01-before.png`).
2. Read the installed drei `ContactShadows` source to confirm the group
   orientation convention, then correct the rotation for Z-up (ground =
   XY plane, normal +Z). Expected fix: `rotation={[-Math.PI / 2, 0, 0]}`
   composed so the internal bake camera looks down world −Z — verify
   empirically, don't trust the sign on paper.
3. Keep everything else about the helper: baked `frames={1}`, not keyed
   by lens (CR3), non-interactive, positioned just below `z = 0`.
   If orientation alone cannot make the plane visually inert, fall back
   per the imported PLAN: custom horizontal receiver, then AO/grid-only.
4. Verify across Building, Site & Sun, one line lens, and with a section
   plane; click through the former plane area (no pick, no block);
   capture after screenshots.
5. `make frontend-dev-check`.

## Exit criteria

Imported acceptance criteria hold: no vertical/free-standing helper
plane from any orbit angle; soft grounding cue below the building in
every lens; helper never intercepts picking/measure/section; before/
after screenshots recorded.

## Ledger

- **Root cause confirmed** by reading the installed drei source
  (`node_modules/@react-three/drei/core/ContactShadows.js`): the
  component's internal group default is `rotation-x={Math.PI / 2}` with
  `{...props}` spread *after* it — so the old
  `rotation={[Math.PI / 2, 0, 0]}` prop replaced the default with the
  **same value**, i.e. the stock Y-up orientation. In this Z-up scene
  the receiver plane stood vertical (the gray sheet).
- **Fix**: wrap the stock component in
  `<group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]}>` —
  a rigid rotation of the whole assembly (receiver plane *and* internal
  bake camera stay in sync by construction): plane onto world XY, bake
  camera looking world +Z. No `rotation`/`position` props on
  `ContactShadows` itself.
- **Verified in browser** (Playwright, AGENT-BROWSER fixture project,
  ph_nav_v2_example.hbjson): before/after screenshots in `../assets/`
  (`phase-01-before-building.png` shows the sheet filling half the
  canvas; `phase-01-after-building.png` clean with a soft blob at the
  base). Orbit sweep including below-horizon and ~180° swing: no sheet
  from any angle. Site & Sun (dome + shades), Ventilation (line lens),
  and an X section plane all clean (`phase-01-after-sitesun.png`,
  `phase-01-after-section.png`); section clips model geometry only.
  Clicks in the former plane area select nothing and building picks
  still work (a wall face pick verified during the sweep).
- `make frontend-dev-check` green.
- **Workflow lesson** (browser): a `beforeunload` dialog raised during
  `page.reload()` left the Playwright MCP tab with permanently dead
  *input* (evaluate/screenshot still worked; locator clicks and raw
  mouse events silently no-oped). Fix: open a fresh tab and close the
  wedged one. Logged here for future browser phases.
