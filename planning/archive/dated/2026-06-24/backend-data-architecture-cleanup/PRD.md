---
DATE: 2026-06-24
TIME: 22:35 EDT
STATUS: Complete / archived.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Product/behavior contract for the backend data-architecture cleanup.
RELATED: ./README.md, ./PLAN.md, ./decisions.md,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md
---

# PRD — Backend Data-Architecture Cleanup

## 1. Goal

Bring the backend's data shapes, persistence patterns, and module structure to
a clean, uniform, extensible baseline while the cost of doing so is near-zero —
i.e. **before** the system has real users, a real database, or a deploy, and
therefore before backwards compatibility is a constraint.

This is the executable follow-through to
`planning/code-reviews/2026-06-24/backend-data-architecture-review.md`. That
review's verdict — *the JSONB-document + thin-relational architecture is right;
keep it* — is the premise here. The work is cleanup **inside** that
architecture.

## 2. Why now (the no-backcompat window)

The review found the architecture sound but carrying accreted dev churn:
`schema_version` has climbed to 12 through reseed-and-bump cycles; there are
five in-Alembic body-rewrite migrations and two partial read-time shims; one
table (heat-pumps) re-implements its own write path outside the otherwise-clean
registry; a few SQL-in-service leaks and naming drifts have crept in; 43
migrations include rename/flatten/revert churn.

Every one of these is cheap to fix *now* and expensive to fix *later*:

- **No saved bodies** → we can delete the migration shims and reset
  `schema_version`, instead of building and forever-maintaining a shim chain.
- **No deployed DB** → we can squash 43 migrations into one clean baseline,
  instead of layering corrective migrations on top.
- **No users** → we can change relational columns, FK semantics, and document
  shapes by clean cut + reseed, instead of writing data migrations.

The principle: **delete cruft and make clean cuts now; build the
data-dependent machinery only when data exists** (see §7, deferred items).

## 3. Priorities (Ed, 2026-06-24)

In strict order:

1. **Consistency** — one way to do each thing (one write path, one repo-return
   convention, one error pattern, one naming convention).
2. **Cleanliness** — no dead code, no accreted shims, no churn migrations, no
   oversized modules.
3. **Maintainability** — predictable structure; a new contributor (human or
   LLM) can find and change things without surprise.
4. **Extensibility** — adding the next table / catalog / equipment type is a
   uniform, documented, one-place change.

Performance and observability are explicitly **secondary** and live in a
separate operational track (Phase 6) that can run independently.

## 4. In scope

- Repository/service/route layer hygiene: move all SQL into repositories;
  unify the repo-return convention; unify the boundary-file name (`models.py`).
- Module splits for the 5 oversized files.
- Document-model cleanup: delete the accreted read-time migration shims;
  collapse to a single current-schema validator; add a body-size guard; single
  canonical serialization for etag+size; extract the cross-table validator.
- Write-architecture unification: fold heat-pumps onto the registered
  table-contract surface so there is exactly one CRUD write path; extract the
  shared draft/ETag/size plumbing used by the legitimately-distinct semantic
  command paths (apertures, envelope).
- Relational clean baseline: squash migrations to one baseline with a
  `naming_convention`, explicit constraint names, the missing FK
  (`epw_asset_id`), justified indexes added, dead index dropped, no app-code
  imports in migrations.
- Guardrails: feature-shape lint + import-boundary lint to keep the above from
  regressing; fold all decisions back into `context/CODING_STANDARDS.md` and
  the other context docs (clearing the review's §8 [PENDING] register).

## 5. Out of scope

- Any move away from the JSONB-document model (rejected by the review).
- New query infrastructure (GIN indexes, generated columns, sidecar/search
  tables) — still unjustified at current sizes (`data-model.md` §6.4).
- Frontend changes beyond those forced by a backend wire-shape change (e.g. if
  the `assets` boundary models are renamed, update the generated client).
- New features or user-visible behavior.
- The aperture glazings/frames work currently in flight (the v12 WIP) — this
  refactor sequences *around* it, it does not absorb it.

## 6. Success criteria

- **One write path** for editable document tables (heat-pumps no longer
  bespoke); semantic command paths share one draft/ETag/size helper.
- **Repositories own all SQL.** A grep for `conn.execute`/`cursor` outside
  `repository.py` (and the documented `_shared` repo-equivalents) returns
  nothing. An import-boundary lint enforces it in CI.
- **One repo-return convention**, documented and applied everywhere
  (`assets` included).
- **No module > ~600 lines** in the split set (hard ceiling stays 1000 with a
  written exception; `mcp/server.py` keeps its declarative exemption).
- **`schema_version` is meaningful again**: a single current-schema validator,
  no dead shims; the integer reflects a real, documented baseline (see
  `decisions.md` D2).
- **One clean migration**: `alembic upgrade head` on an empty DB reproduces the
  current end-state schema exactly (verified by schema dump diff), with a
  `naming_convention` and the `epw_asset_id` FK present.
- **Green gates** after every phase: `make ci` passes; dev seed + fixtures
  rebuild cleanly.
- **Context docs match code**: the review's §8 [PENDING] items are cleared;
  `CODING_STANDARDS.md` documents the unified conventions.

## 7. Deferred (data-dependent — do NOT build now)

These are real obligations, but their value depends on data existing. Building
them now is premature; they are gated to **before the first real save / first
deploy**, after all clean-cut work above is done:

- **The schema-migration mechanism** (read-time forward-only shim chain +
  golden-file corpus + production-corpus drill — `llm-mcp-schema.md` §10.5).
  Until then, "bump `schema_version`" stays a gated, reseed-based operation.
  Tracked as Phase 7.
- **Observability beyond the cheap pre-deploy wins** (Sentry/APM, log drains) —
  `LOGGING.md` already scopes these as later.

## 8. Risks & mitigations

- **Aperture v12 dependency.** Phase 3 (and the promoted write-unification
  refactor) touch `document.py`, the registries, and write paths that aperture
  v12 changed. Mitigation: aperture v12 has landed on `main`; Phase 3 and the
  sibling refactor must work against that final shape (see `PLAN.md`).
- **Migration squash must reproduce the schema exactly.** Mitigation: verify by
  diffing a `pg_dump --schema-only` of `upgrade head` against the current head
  before deleting the old migrations; keep the old chain in git history.
- **Heat-pumps unification is the hardest change** (4 sub-tables + delete
  cascade + dry-run preview). Mitigation: it is its own phase with its own
  acceptance tests; the cascade/preview semantics must be preserved, only their
  *home* moves.
- **Deleting the read-time shims** could mask a still-needed transform.
  Mitigation: with no data, the only consumers are dev seed + fixtures; reseed
  and regenerate at the new baseline and let CI prove the corpus validates.
