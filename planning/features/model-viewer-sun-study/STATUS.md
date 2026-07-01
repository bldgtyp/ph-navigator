---
DATE: 2026-07-01
TIME: 16:31 (updated ~16:50 after Ed's review)
STATUS: Active — PRD reviewed by Ed; ready for implementation planning.
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the model-viewer sun-study feature.
RELATED:
  - README.md, PRD.md (this folder)
  - ../model-viewer-ground-shadows/ (Superseded — folded in as the
    baseline phase, PRD D-12)
---

# Status — Model Viewer Sun Study

- **State:** Active. PRD drafted and reviewed by Ed 2026-07-01. All
  four open questions resolved (PRD §11): default = today @ 12:00
  noon; azimuth ground line deferred; no playback (manual scrub only,
  SketchUp style); four preset chips (both equinoxes). The
  `model-viewer-ground-shadows` fix packet (Codex, 2026-07-01) is
  folded in as this feature's baseline phase (D-12); that folder is
  marked Superseded and its PRD/PLAN are imported as-is.
- **Next step:** implement per `PLAN.md` (authored 2026-07-01 18:05,
  with `phases/phase-01…06`). Work on branch
  `feature/model-viewer-sun-study`.
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
  - Phase 05 (sun bar UI): next.
- **Blockers:** none.
- **Verification so far:** codebase baseline in PRD §2 verified
  against source 2026-07-01 (backend `sun_path.py` dome builder;
  `SiteSunLayer`/`ViewerCanvas` rendering + lighting; no existing
  per-datetime solar position anywhere on the wire; ContactShadows
  vertical-plane artifact per the imported packet).
- **Docs to amend at closeout:** `context/user-stories/40-model-viewer.md`
  Q-VIEW-6 (currently "defer to v1.1+" — this feature un-defers it).
