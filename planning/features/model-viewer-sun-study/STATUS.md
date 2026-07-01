---
DATE: 2026-07-01
TIME: 16:31 (updated ~16:50 after Ed's review)
STATUS: Implemented on branch `feature/model-viewer-sun-study` —
  phases 01–05 complete 2026-07-01; phase 06 closeout in progress.
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the model-viewer sun-study feature.
RELATED:
  - README.md, PRD.md (this folder)
  - ../model-viewer-ground-shadows/ (Superseded — folded in as the
    baseline phase, PRD D-12)
---

# Status — Model Viewer Sun Study

- **State:** Implemented on branch `feature/model-viewer-sun-study`
  (phases 01–05 complete 2026-07-01; phase 06 closeout in progress).
  PRD reviewed by Ed 2026-07-01 with all four open questions resolved
  (PRD §11): default = today @ 12:00 noon; azimuth ground line
  deferred; no playback (manual scrub only, SketchUp style); four
  preset chips (both equinoxes). The `model-viewer-ground-shadows` fix
  packet is folded in as the baseline phase (D-12, shipped in
  phase 01); that folder stays Superseded. Three as-built amendments
  are recorded at the top of `PRD.md` (PCF not PCFSoft; section
  disables the sun shadow pass; `true_north_deg` on the grid).
- **Next step:** finish phase 06 (`make ci` green + acceptance ledger),
  then Ed merges `feature/model-viewer-sun-study` → `main` (main
  deploys production). Phase record:
  - Phase 01 (ground-shadow baseline fix, D-12): **Complete**
    2026-07-01 — the old `rotation` prop was drei's stock Y-up default,
    so the receiver plane stood vertical in the Z-up scene; fixed by
    wrapping stock `ContactShadows` in a rigidly-rotated group. Before/
    after screenshots in `assets/`; `make frontend-dev-check` green.
    Ledger in `phases/phase-01-ground-shadow-baseline.md`.
  - Phase 02 (BatchedMesh × shadow spike): **Complete** 2026-07-01 —
    GO. BatchedMesh casts/receives; ShadowMaterial catcher works;
    `Canvas shadows` flag alone is free; Hillandale shadow-pass cost is
    inside orbit noise (+6 draw calls). One amendment: **D-11 doesn't
    work with the section tool's renderer-global clipping planes**
    (three never clips the shadow pass against them) — v1 will disable
    the sun shadow pass while a section is active. Findings in
    `phases/phase-02-shadow-spike.md`.
  - Phase 03 (backend solar grid): **Complete** 2026-07-01 —
    `sun_positions` grid (365×24 unit vectors + per-day
    sunrise/sunset) on the `/sun-path` payload, built from the dome's
    own `Sunpath`; 7 new tests incl. frame-consistency; ~70 ms compute;
    ledger in `phases/phase-03-backend-solar-grid.md`.
  - Phase 04 (scene: marker/light/catcher): **Complete** 2026-07-01 —
    store slice + pure derivation lib (13 unit tests), amber marker on
    the dome, key light becomes the sun with bounds-fitted shadow
    camera, ShadowMaterial catcher, horizon ramp, section→shadows-off
    (amended D-11), lens-switch state memory. Browser-verified
    (assets/phase-04-*.png). Note: three deprecated PCFSoft → plain
    PCF. Ledger in `phases/phase-04-scene-sun-light.md`.
  - Phase 05 (sun bar UI): **Complete** 2026-07-01 — pill → full bar
    (date scrubber + month rail, 4 preset chips on the canonical chip
    pattern, daylight-band time scrubber, readouts, Esc/✕ exits).
    Fixed a latent Stage bug: viewer shortcuts now work while
    range/checkbox inputs hold focus. Screenshots in `assets/`.
    Ledger in `phases/phase-05-sun-bar-ui.md`.
  - Phase 06 (tests/perf/closeout): **Complete** 2026-07-01 — e2e
    extension green (pill/engage/scrub/chips/Esc/lens round-trip +
    geometry-count perf gate); Hillandale site-sun perf recorded
    (136→147 calls engaged, frame time inside orbit noise); Q-VIEW-6
    amended; simplify + docs-pass applied; **`make ci` green**.
- **Blockers:** none.
- **Verification so far:** per-phase ledgers in `phases/` (browser
  screenshots in `assets/`); backend 16/16 sun-path tests incl. golden
  + frame-consistency; frontend 2020 unit tests; extended
  `model-viewer-site-sun.spec.ts` e2e 2/2.
- **Docs amended at closeout:** `context/user-stories/40-model-viewer.md`
  Q-VIEW-6 updated 2026-07-01 (un-deferred → shipped as Sun study;
  criterion 8 + resolved-questions entries rewritten in place).
