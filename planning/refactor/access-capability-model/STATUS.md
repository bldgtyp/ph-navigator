---
DATE: 2026-06-27
TIME: 17:30 ET
STATUS: Active — Phase 1 (schema foundation) landed. Phases 2–5 not started.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: State tracker for the access-capability-model refactor.
RELATED:
  - README.md, PRD.md, decisions.md, PLAN.md
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md
---

# STATUS — Access Capability Model

**State:** Active. Phase 1 (schema foundation) is implemented and green; the
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
- **Phases 2–5: not started.**

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

**Phase 2 — capability resolver in the seam** (PLAN.md §Phase 2). Grow
`capabilities_for` / `require_capability` in `features/projects/access.py`, with
the `CLIENT_CAPS` / `MEMBER_CAPS` bundles and capability constants in
`features/access/` (the home Phase 1 created). Resolver defaults to today's
behavior, so P1+P2 land invisibly; P3+P4 are the only observable beta changes;
P5 stays deferred to the RBC trigger.

## Verification

- Phase 1: `make ci` gate green (`ty`/`ruff`/`pytest`/boundary-check);
  `tests/test_access_user_grants.py` covers the migration columns, grant
  insert/list/revoke, active-grant uniqueness, and the global-scope CHECK;
  alembic up/down/up roundtrip clean. Later phase gates are defined in PLAN.md.
