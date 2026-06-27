---
DATE: 2026-06-27
TIME: 16:10 ET
STATUS: Active — Phase 1 (schema foundation) landed. Capability-based access
        model replacing the binary editor/viewer check, future-proofed for
        multi-tenant teams + viewer shares. Contract + schema + phased plan in
        place; behavior-neutral schema migrated.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: Router for the access-capability-model refactor.
RELATED:
  - PRD.md — the model: principals, capabilities, resolver, schema, beta/future boundary.
  - decisions.md — accepted decisions: principals, CP-1..CP-9, per-page rulings (referenced), schema choices, rationale.
  - PLAN.md — phased implementation sequence (maps the punch-list to phases); the build plan.
  - STATUS.md — current state, next step, blockers.
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md — the page-by-page decisions ledger (source of truth for per-surface exposure).
  - planning/code-reviews/2026-06-27/editor-vs-viewer-access-model-review.md — current-state map this replaces.
  - planning/features_v2.0/multi-tenant-teams/ — the tenancy story this reserves for.
---

# Access Capability Model — refactor

Replace the binary `is_editor = (user is not None)` check with a **capability
model**: every access decision answers *"does this principal have capability C on
this resource?"* Roles and viewer-audiences are code-defined bundles of
capabilities; per-user exceptions are explicit `user_grants`. The schema (teams,
team_members, user_grants, project_shares, `projects.team_id`, `users.is_staff`)
is laid down now so the future multi-tenant + certifier-share model is a
*fill-in*, not a migration of meaning.

**Beta ships binary-equivalent behavior through the new resolver** — `client` ≈
today's viewer, `member` ≈ today's editor — plus the specific deltas from the
decisions-ledger punch-list (client version-pin, export gating, metadata-leak
fix, the catalog-admin grant).

## Why a refactor folder (not a feature)

This is a cross-cutting authorization change driven by the 2026-06-27 access
review + page-by-page walkthrough, not a single product story. It touches the
seam, the schema, every project route's gate, and the frontend's affordance
gating. Per `planning/.instructions.md` rule 3, that lives in `planning/refactor/`.

## Read order

1. `PRD.md` — the contract (principals, capabilities, resolver, schema).
2. `decisions.md` — what was decided and why (CP-1..CP-9 + per-page rulings).
3. `PLAN.md` — how it gets built (phases).
4. `STATUS.md` — where it stands.

The page-by-page exposure detail (all 12 surfaces, each affordance) lives in the
**decisions ledger** under `code-reviews/2026-06-27/` and is referenced, not
duplicated, here.

## Status

**Phase 1 (schema foundation) landed** — behavior-neutral columns + `user_grants`
(migration `20260627_0003`), `features/access/`, and the `manage_user_access` CLI.
Next is Phase 2 (the capability resolver in the seam) — see STATUS.md.
