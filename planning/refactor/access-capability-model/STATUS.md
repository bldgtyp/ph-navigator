---
DATE: 2026-06-27
TIME: 21:40 ET
STATUS: Active — Phases 1–4 landed (schema + resolver + backend beta deltas +
        frontend beta deltas). Phase 4b (CP-5 read-only canvas-inspect modal)
        and Phase 5 (tenancy) are the remaining work; Phase 5 deferred to the
        RBC trigger.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: State tracker for the access-capability-model refactor.
RELATED:
  - README.md, PRD.md, decisions.md, PLAN.md
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md
---

# STATUS — Access Capability Model

**State:** Active. Phases 1–4 are implemented and green. Phases 1–2 (schema +
resolver) were behavior-neutral; Phase 3 (backend beta deltas) and Phase 4
(frontend beta deltas) are the *observable* changes — anonymous/`client`
exports are gated front and back, `client` viewers get redacted project
metadata, are pinned to the latest version with no version/Settings UI, and lose
every bulk-export/download affordance (HBJSON/PHPP/Phius/model/CSV/project-JSON);
catalog writes require `catalog.edit`. The model/schema/decisions were agreed
with Ed on 2026-06-27 and the phase sequence lives in `PLAN.md`.

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
- **Phase 4 — frontend beta deltas: DONE.** The viewer UI now matches the
  decided `client` surface. (1) Version pin: `ProjectShell` ignores `?version=`
  for viewers (auto-follows `active_version`); the `VersionControls` viewer
  branch renders no path controls/switcher/diff; the read-safe recovery panel
  hides its version list from viewers (CP-8). (2) Bulk-export hiding (CP-7), all
  gated on `!isViewer`/`isEditor` (the access class, NOT `canEdit`, so a
  locked-version editor keeps export): envelope HBJSON+PHPP menu, heat-pump
  Phius export, model `.hbjson` download, project-JSON download, and per-table
  **CSV** via a new `canDownloadCsv` prop threaded
  DataTable→GridToolbar→ViewMenuOverflow and carried to every slice table
  through the `customFieldActionsForController` seam (`controller.isEditor`).
  (3) Project Settings entry removed from the viewer chrome (§4.9). Tests:
  `csvDownload.test.tsx` (the gate + locked-editor-keeps-CSV), reconciled
  envelope/model viewer tests; full frontend suite (1410) green; `tsc`/`eslint`/
  DataTable-contract-checker clean. **CP-5 (read-only canvas-inspect modal) was
  split to Phase 4b** — see below.
- **Phase 4b — CP-5 read-only canvas-inspect modal: not started.** **Phase 5
  (tenancy): deferred (RBC trigger).**

## Decided (locked)

- D1 capability model over binary · D2 principals · D3/D6 certifier ⊇ client +
  version persona-split · D4 CP-1..CP-9 · D5 per-surface rulings · D7 catalog
  global library + grantable catalog-admin · **D8 fine-grained `user_grants`
  table** · D9 reserve-schema-now/phase-enforcement · D10 beta deltas.

## Blockers / dependencies

- **Phase 5 (tenancy + certifier shares)** is gated on the RBC partnership firming
  up (see `planning/features_v2.0/multi-tenant-teams/STATUS.md`). Phases 1–4b have
  no external blocker.
- No decision blockers remain for Phases 1–4b.

## Next step

**Phase 4b — CP-5 read-only canvas-inspect modal** (PLAN.md §Phase 4b): let a
viewer click an envelope/aperture canvas element to open a *read-only* detail
(material + width + stud spacing + layer). *Verified during Phase 4:* the
envelope segment hit-target is `disabled={!canEdit}` and its overlay is
`aria-hidden={!canEdit}`, so viewers can't click-inspect; material + width are
already viewer-visible via the segment `title` tooltip + the read-only Materials
sidebar, so the gap is a dedicated inspect modal (net-new canvas UI), not a
missing capability. Then Phase 5 stays deferred to the RBC trigger.

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
  reconciled to sign in as a staff catalog-admin.
- Phase 4: frontend `tsc` + `eslint` + `node scripts/check-data-table-contract.mjs`
  + full vitest suite (1410) green. `csvDownload.test.tsx` locks the CSV gate
  (hidden when `canDownloadCsv=false`) and the locked-editor-keeps-CSV contract;
  envelope + model-viewer viewer tests assert the export menus are gone for
  viewers. Browser logged-out walkthrough + Playwright smoke recommended before
  deploy. Later phase gates in PLAN.md.
