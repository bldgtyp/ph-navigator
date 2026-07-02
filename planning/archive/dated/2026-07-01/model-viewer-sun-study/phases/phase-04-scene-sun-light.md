---
DATE: 2026-07-01
TIME: 18:05 (completed 22:40)
STATUS: Complete
AUTHOR: Claude (for Ed)
SCOPE: Phase 04 — sun-study scene: store slice, interpolation, sun
  marker, key-light re-aim + live shadows, shadow catcher, horizon ramp,
  engage/disengage lifecycle, debug hook (PRD §5, §6.2–6.3, §7).
RELATED:
  - ../PRD.md §5, §6.2, §6.3, §7, D-3/D-4/D-5/D-10/D-11
  - frontend/src/features/model_viewer/store.ts
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
  - frontend/src/features/model_viewer/scene/SiteSunLayer.tsx
---

# Phase 04 — Scene: Marker, Sun Light, Shadow Catcher

## Steps

1. **Types**: extend `SunPathAndCompassModelData` with the
   `sun_positions` grid block.
2. **Store** (`store.ts`): `sunStudy: { engaged, day, minutes }` slice +
   `setSunStudy` per PRD §6.3. Lens switches keep the state (remembered)
   but the scene only renders sun-study in `site-sun`.
3. **Derivation lib** (`lib/sunStudy.ts`, pure + unit-testable):
   - `interpolateSunVector(grid, day, minutes)` — normalize-lerp of the
     two adjacent hour vectors, 23h tail clamp (PRD §6.2);
   - `altitudeDeg`/`azimuthDeg` from a vector (display restatement);
   - `sunIntensityFactor(altitudeDeg)` — smoothstep(0°, 4°);
   - `sunriseSunsetForDay(grid, day)`;
   - date helpers (day-of-year ↔ month/day label on the fixed 365-day
     year; preset-chip days: Dec 21 = 355, Mar 20 = 79, Jun 21 = 172,
     Sep 22 = 265).
4. **Scene — `SunStudyLayer`** (new, mounted from `SiteSunLayer` when
   engaged and grid present): amber emissive marker sphere at
   `unitVector × 1.0` in dome space via the existing
   `sunPathFitTransform` group (radius ≈ 1.5% of dome radius,
   `raycast` disabled), hidden below horizon; `ShadowMaterial` catcher
   plane at `bounds.min.z + ε`, ~2× dome fit radius,
   `receiveShadow`, non-pickable.
5. **Lighting** (`ViewerCanvas.tsx`): `Canvas shadows` (PCFSoft) at
   creation; while engaged the key directional takes the interpolated
   sun direction + `castShadow` (1024² map, ortho camera fitted once
   per engage to model bounds, tuned `normalBias`), intensity ×
   smoothstep ramp; substrate + shade meshes cast and receive while
   engaged; `clipShadows` on casting materials (D-11); ContactShadows
   `visible=false` (never unmounted) while engaged. Disengage restores
   the knob-driven key exactly.
6. **Tokens**: `VIEWER_SUN_MARKER_COLOR` (warm amber) in
   `colorTokens.ts`.
7. **Debug hook**: `sunStudy` block (engaged, day, minutes, altitude)
   + `setSunStudy` for Playwright.
8. Every state change calls `invalidate()` (demand frameloop).

## Exit criteria

Unit tests for the derivation lib green; browser verification: engage
via debug hook → marker on dome, shadows on ground + self-shading,
scrub moves both live, night ramps out cleanly, disengage restores the
baseline exactly.

## Ledger

- Landed: `lib/sunStudy.ts` (pure derivations + 13 unit tests), store
  `sunStudy` slice (`engage`/`disengage`/`setDay`/`setMinutes`,
  session-persistent across lens switches), `SunStudyLayer`
  (amber marker + `ShadowMaterial` catcher, both non-pickable),
  `ViewerCanvas` sun wiring (Canvas `shadows` at creation; the key
  directional re-aims to the interpolated grid direction around the
  model center with a bounds-fitted ortho shadow camera; horizon
  smoothstep ramp; explicit scene-graph light target so off-origin
  models aim correctly), `LensBatch` casts/receives at build,
  shade meshes cast/receive, ContactShadows hidden-not-unmounted while
  engaged, debug-hook `sunStudy` block + actions, `shadowMapSize`
  dev knob, `VIEWER_SUN_MARKER_COLOR` token, backend `true_north_deg`
  on the grid (compass-honest azimuth readout for rotated-north
  projects).
- Deviation from PRD D-5: three r0.18x deprecated `PCFSoftShadowMap`
  (falls back to PCF with a console warning), so the Canvas uses plain
  PCF — visually equivalent at 1024².
- Amended D-11 implemented: sun shadow pass disabled while a section is
  active (phase-02 finding); verified no phantom shadow with an X
  section.
- Browser-verified via debug hook (screenshots in `../assets/`):
  summer-noon altitude 71.09° = backend golden; morning/evening
  shadows swing correctly with self-shading; night hides marker +
  shadows with the model legible on fill; winter noon reads low-sun;
  disengage restores the baseline exactly and remembers scrub state;
  lens round-trip keeps state.
- Gates: 2020 frontend unit tests green; `tsc` clean; eslint clean in
  `model_viewer`; `make frontend-dev-check` green.
