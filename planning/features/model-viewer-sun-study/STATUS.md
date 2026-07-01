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
- **Next step:** author `PLAN.md` + `phases/`. Expected sequence:
  ground-shadow baseline fix (imported packet) → BatchedMesh ×
  shadow-map spike on the heavy fixture (PRD §14) → backend solar
  grid → scene (marker/light/catcher) → sun bar UI → tests/perf
  verification.
- **Blockers:** none.
- **Verification so far:** codebase baseline in PRD §2 verified
  against source 2026-07-01 (backend `sun_path.py` dome builder;
  `SiteSunLayer`/`ViewerCanvas` rendering + lighting; no existing
  per-datetime solar position anywhere on the wire; ContactShadows
  vertical-plane artifact per the imported packet).
- **Docs to amend at closeout:** `context/user-stories/40-model-viewer.md`
  Q-VIEW-6 (currently "defer to v1.1+" — this feature un-defers it).
