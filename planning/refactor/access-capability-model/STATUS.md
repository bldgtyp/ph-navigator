---
DATE: 2026-06-27
TIME: 19:15 ET
STATUS: Active — Phases 1–3 landed (schema + resolver + backend beta deltas).
        Phase 4 (frontend) next; Phase 5 deferred to the RBC trigger.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: State tracker for the access-capability-model refactor.
RELATED:
  - README.md, PRD.md, decisions.md, PLAN.md
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md
---

# STATUS — Access Capability Model

**State:** Active. Phases 1–3 are implemented and green. Phases 1–2 (schema +
resolver) were behavior-neutral; Phase 3 (backend beta deltas) is the first
*observable* change — anonymous exports are gated, `client` viewers get redacted
project metadata, and catalog writes require `catalog.edit`. The
model/schema/decisions were agreed with Ed on 2026-06-27 and the phase sequence
lives in `PLAN.md`.

## Where things stand

- Current-state access review complete (`code-reviews/2026-06-27/editor-vs-viewer-access-model-review.md`).
- Page-by-page walkthrough complete — all 12 surfaces decided with Ed
  (`code-reviews/2026-06-27/access-capability-model-decisions.md`, §4).
- Model agreed: capability resolver; 5 principals + token; `certifier ⊇ client`;
  CP-1..CP-9; fine-grained `user_grants`; reserved tenancy + shares schema.
- This refactor folder authored (README/PRD/decisions/PLAN/STATUS).
- The detailed phase sequence lives in `PLAN.md` (the per-phase `phases/` docs
  referenced in earlier drafts were never written; `PLAN.md` is the build plan).

## Phase progress

- **Phase 1 — schema foundation: DONE.** Migration `20260627_0003` adds
  `projects.team_id` (nullable, FK held), `users.is_staff`, and the `user_grants`
  table + active-grant unique index. New `features/access/` (models + grants
  repository), `auth.set_user_is_staff`, the `scripts/manage_user_access.py` CLI
  (grant/revoke/set-staff), held Phase-5 DDL in `backend/alembic/held/`, and
  `tests/test_access_user_grants.py`. Behavior-neutral: nothing reads the new
  columns yet. `ty`/`ruff`/`pytest`/boundary-check green; up/down/up clean.
- **Phase 2 — capability resolver: DONE.** `features/access/principals.py`
  (`ViewerPrincipal`/`UserPrincipal`) + `capabilities.py` (`PROJECT_VIEW`/
  `PROJECT_EDIT`/`CATALOG_EDIT`, `CLIENT_CAPS`/`MEMBER_CAPS`, `capabilities_for`).
  The seam (`features/projects/access.py`) resolves a principal, derives
  `capabilities`/`is_editor`, and gates via `require_capability`; `require_editor_user`
  and the MCP path (`project_access_for_user`) flow through it. Beta reproduces
  today's allow/deny exactly (anonymous→`client`, session→`member`) — full suite
  (1155) green, behavior-neutral. Grant resolution is scope-filtered to global
  grants (scope-aware resolution deferred to Phase 5).
- **Phase 3 — backend beta deltas: DONE.** Capability constants + bundles
  (`EXPORT_CAPS`, `PROJECT_VIEW_PRIVATE`, per-surface export keys). (1) Metadata
  redaction: `get_project_detail` redacts `client` + `phius_dropbox_url` from
  `client` viewers (`phius_number` stays public). (2) Export gating: the 8
  anon-readable export/download routes (apertures/envelope/equipment/model HBJSON-
  PHPP-Phius + the two project-document JSON downloads) now require their export
  capability — editor-only in beta. (3) Catalog writes: a `CatalogEditor`
  dependency on the ~23 write routes requires `catalog.edit` (grant or `is_staff`);
  `features/access/user_capabilities.py` resolves the non-project capability and
  `features/catalogs/access.py` is the gate. Tests: `test_access_phase3_deltas.py`
  (redaction + an export coverage-guard + catalog gating) plus reconciled catalog
  tests via `tests/catalog_helpers.create_catalog_admin`. Full suite (1161) green.
- **Phase 4 (frontend): not started. Phase 5: deferred (RBC trigger).**

## Decided (locked)

- D1 capability model over binary · D2 principals · D3/D6 certifier ⊇ client +
  version persona-split · D4 CP-1..CP-9 · D5 per-surface rulings · D7 catalog
  global library + grantable catalog-admin · **D8 fine-grained `user_grants`
  table** · D9 reserve-schema-now/phase-enforcement · D10 beta deltas.

## Blockers / dependencies

- **Phase 5 (tenancy + certifier shares)** is gated on the RBC partnership firming
  up (see `planning/features_v2.0/multi-tenant-teams/STATUS.md`). Phases 1–4 have
  no external blocker.
- No decision blockers remain for Phases 1–4.

## Next step

**Phase 4 — frontend beta deltas** (PLAN.md §Phase 4): make the viewer UI match
the decided model. Pin `client` to the latest committed version (hide the version
switcher/history/diff), hide bulk-export/download buttons + the Project Settings
entry from viewers, and verify CP-5 (canvas inspect click isn't `canEdit`-gated).
**Note:** this worktree has no frontend `node_modules`, so `make ci-frontend`
can't run here — Phase 4 needs an environment with the frontend toolchain
installed. P5 stays deferred to the RBC trigger.

## Verification

- Phase 1: `make ci` gate green; `tests/test_access_user_grants.py` covers the
  migration columns, grant insert/list/revoke, active-grant uniqueness, and the
  global-scope CHECK; alembic up/down/up roundtrip clean.
- Phase 2: backend CI green; `tests/test_access_resolver.py` pins the beta
  bundles + the 401-viewer/403-user contract; full suite (1155) unchanged →
  behavior-neutral.
- Phase 3: backend CI green (ruff/format/boundary/ty + full suite, 1161);
  `tests/test_access_phase3_deltas.py` locks redaction, the export coverage-guard
  (every export/download route 401s anonymous), and catalog gating; catalog tests
  reconciled to sign in as a staff catalog-admin. Later phase gates in PLAN.md.
