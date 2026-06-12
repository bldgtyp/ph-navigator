---
DATE: 2026-06-12
TIME: -
STATUS: Active — decisions accepted; Phase 1 ready to start
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the Model Viewer feature.
RELATED: planning/features/model-viewer/README.md
---

# Model Viewer — Status

## Current state

`Active — planning.` Feature folder authored 2026-06-12: PRD,
UI_SPEC (redesigned non-CAD composition), decisions ledger, 6-phase
plan. No implementation code exists yet (no three/R3F frontend deps,
no honeybee backend deps, no `project_hbjson_files` table, no
`model_viewer` feature modules).

Test fixtures (both in this folder, both copied to
`backend/tests/fixtures/` in Phase 2; coverage maps + remaining
synthetic-only gaps in PLAN.md):
- `ph_nav_v2_example.hbjson` (459 KB, Ed 2026-06-12) — primary
  canonical fixture. (Supersedes `my_example_project.hbjson`.)
- `Hillandale_Gateway_NAR_260402.hbjson` (51.99 MB, Ed 2026-06-12,
  review round 3) — scale fixture and D-15 perf canary: 583 rooms,
  6,178 faces, 1,024 apertures, 71 named constructions, 253 shades
  → 1 merged group, units **Inches**. Its size triggered D-17
  (100 MB cap).

Pre-existing groundwork already on main:
- `project_assets` backbone supports `asset_kind='hbjson'`
  (`backend/features/assets/registry.py`).
- Behavior contract complete in
  `context/user-stories/40-model-viewer.md` (all Q-VIEWs resolved).
- V1 reference complete in `research/v1-3d-model-viewer-reference.md`.

2026-06-12: V1 frontend parity audit completed from V1 source
(`reviews/2026-06-12-v1-parity-audit.md`) — full capability parity
confirmed; 3 findings folded back.

2026-06-12 (Ed review round 2): **D-02..D-12 confirmed by Ed.** All
decisions now accepted; none open. Same-pass docs sync completed:
`decisions.md` marked accepted; PRD/UI_SPEC/README status flipped;
`context/user-stories/40-model-viewer.md` gained a "V2 composition
amendments — accepted 2026-06-12" block and the amended US-VIEW-6
crit. 7 + crit. 5 construction rows (D-12); `context/UI_UX.md` §2.9
now points at UI_SPEC.md and UX-Q9 is resolved (D-05);
`context/GLOSSARY.md` gained the "Thermal performance" section
("-Factor = with films, -Value = without"; the section US-VIEW-6
cited had never actually been created — it exists now).

2026-06-12 (phase handoffs): detailed implementation plans for all
six phases authored under `phases/` (phase-01 … phase-06). Each is a
self-contained subagent handoff: required reading, work breakdown
with file paths, contracts, fixture golden counts, verification
gates, exit criteria. Notable corrections baked in from codebase
verification: `users.id` and `projects.id` are UUID and
`project_assets.id` is TEXT (US-VIEW-1's DDL sketch said INTEGER /
implied UUID — phase-01 §3.1 records the corrected column types);
the `model` tab already exists as a placeholder in `PROJECT_TABS`;
the asset upload-intent flow already captures `content_hash_sha256`
(dedup enforced at the hbjson-files link step); zustand ^5.0.2 is
already a frontend dep, three/R3F are not (added in Phase 3).

2026-06-12 (Ed review round 1): OQ-1 resolved — project location
becomes its own deferred feature
(`planning/features/project-location/`, requirements stub written);
Site & Sun sun path blocked on it. OQ-2 resolved → D-13 (schema
Phase 1, job Phase 2, Airtightness consumer marked FUTURE). OQ-4
researched (LBT forum #11790 + honeybee-energy source) → D-12
proposed: LBT-verbatim terminology, show U-Factor (films incl.) AND
U-Value (films excl.) rows. OQ-3 resolved → D-14: selection uses the
BLDGTYP branding `--highlight` token family (already loaded app-wide
from bldgtyp.github.io/bt-branding). No open questions remain.

2026-06-12 (review round 3 — plan-readiness critique): a
completeness review surfaced three decision items; Ed accepted all
three same-day, plus one follow-on:
- **D-15** `/model_data` precomputed at upload, served as an
  immutable R2 artifact (amends US-VIEW-7 crit. 9 — the prior
  "re-parse per request" plan had conflated caching the raw bytes
  with caching the derived payload).
- **D-16** broken-file lifecycle: "Failed to parse" badge driven by
  `extraction_status` + permanent/transient error taxonomy on
  `/model_data` (Retry is transient-only).
- **Scale fixture pulled forward**: Ed provided
  `Hillandale_Gateway_NAR_260402.hbjson` (51.99 MB multifamily);
  exercised from Phase 2 on, not deferred to Phase 6 acceptance.
- **D-17** upload cap 50 → 100 MB (the fixture itself exceeded the
  old cap).
Same-pass docs sync: decisions.md (D-15/D-16/D-17), PRD (§2 matrix,
§3, new §4.6, §5, §7, §8), UI_SPEC (§2 badge + cap, §8 typed
errors), PLAN (Phases 1–3 + fixture section), phase-01/02/03/06
handoffs, and `context/user-stories/40-model-viewer.md` (amendments
block + crit. 3 cap + crit. 9 in place). The round-3 editorial
items (implementer-level, no decision needed) were applied same-day:
`window.__phnModelViewer` scene-ready test-hook contract defined in
phase-03 §4.8 and referenced from phases 4–5; WebGL/SwiftShader CI
caveat (phase-03 §6.2); GPU-memory/disposal acceptance check
(phase-03 §4.9); dedup made race-proof via a denormalized
`content_hash_sha256` column + partial unique index (phase-01
§3.1/§3.3); phase-04 §1 Site & Sun goal paragraph rewritten to
state the §3.1 rule plainly; drei Z-up caveat broadened to all
scene helpers (phase-03 §4.1).

## Next step

**Start Phase 1** — handoff doc:
`phases/phase-01-hbjson-file-management.md` (migration + backend
CRUD + file chip/popover + upload flow). All decision gates are
cleared; the docs sync that acceptance required is done (see
2026-06-12 round-2 entry above).

## Blockers

None. Phase 6's sun path remains blocked on the deferred
`project-location` feature (the lens itself still ships with a
location hint) — it does not gate Phases 1–5. The scale fixture is
in hand (round 3); the former "waiting on multifamily HBJSON"
blocker is cleared.

## Verification ledger

| Phase | State | Evidence |
|---|---|---|
| Planning docs | Done 2026-06-12 | this folder |
| Phase handoff plans (01–06) | Done 2026-06-12 | `phases/` |
| Phase 1 — file management | Not started | — |
| Phase 2 — extraction backend | Not started | — |
| Phase 3 — canvas + Building lens | Not started | — |
| Phase 4 — remaining lenses | Not started | — |
| Phase 5 — themes + legend | Not started | — |
| Phase 6 — measure, Site & Sun, polish | Not started | — |
