---
DATE: 2026-06-27
TIME: 18:30 ET
STATUS: Active — Phases 1–2 landed (schema + resolver, behavior-neutral).
        Phases 3–5 not started.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: State tracker for the access-capability-model refactor.
RELATED:
  - README.md, PRD.md, decisions.md, PLAN.md
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md
---

# STATUS — Access Capability Model

**State:** Active. Phases 1–2 (schema foundation + capability resolver) are
implemented and green — both behavior-neutral (the binary check now flows through
the resolver). The model/schema/decisions were agreed with Ed on 2026-06-27 and
the phase sequence lives in `PLAN.md`.

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
- **Phases 3–5: not started.**

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

**Phase 3 — backend beta deltas** (PLAN.md §Phase 3): the first *observable*
changes. Add export/private capabilities (not in `CLIENT_CAPS`) and migrate the
specific routes onto `require_capability`: gate the anon-readable exports
(apertures/envelope/equipment/model/document downloads), redact
`phius_dropbox_url` + `client` from `client` viewers, and gate catalog writes on
`catalog.edit`. P4 is the frontend match; P5 stays deferred to the RBC trigger.

## Verification

- Phase 1: `make ci` gate green; `tests/test_access_user_grants.py` covers the
  migration columns, grant insert/list/revoke, active-grant uniqueness, and the
  global-scope CHECK; alembic up/down/up roundtrip clean.
- Phase 2: backend CI green; `tests/test_access_resolver.py` pins the beta
  bundles + the 401-viewer/403-user contract; full suite (1155) unchanged →
  behavior-neutral. Later phase gates are defined in PLAN.md.
