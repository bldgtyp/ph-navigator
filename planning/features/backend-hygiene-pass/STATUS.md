---
DATE: 2026-06-09
TIME: evening ET
STATUS: Implemented on branch — all 8 phases complete on `chore/backend-hygiene-pass`; CI green; not yet merged.
AUTHOR: Claude (Opus 4.7)
RELATED: `README.md`, `PRD.md`, `decisions.md`
---

# Status — Backend Hygiene Pass

## Current state

All 8 phases implemented on branch `chore/backend-hygiene-pass`. Backend CI
locally green: `ruff format`, `ruff check`, `ty check`, 693 pytest passing.
Frontend tests not yet run from this branch — pending `make ci` for the
full closeout gate.

Verified line counts after the splits (2026-06-09 evening):

```
 745 backend/features/project_document/document.py    (was 1602)
 400 backend/features/project_document/rows.py        (new)
 380 backend/features/project_document/envelope_models.py  (new)
 296 backend/features/project_document/_validators.py (new)

 755 backend/features/mcp/tools.py                    (was 1046)
 321 backend/features/mcp/tools_custom_fields.py      (new)

 528 backend/features/projects/service.py             (was 697)
 178 backend/features/project_document/templates.py   (new, holds
                                                       empty_project_document)
```

## Phase ledger

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Schema housekeeping migration | Implemented on branch | Migration 0020; round-trips clean |
| 2 | Extract `empty_project_document` | Implemented on branch | `service.py` 697 → 528 lines |
| 3 | REST action-URL style | Implemented on branch | slash-verb chosen, documented in `backend/README.md` |
| 4 | Service docstring pass | Implemented on branch | 4 service files |
| 5 | `user_table_views` decision | Implemented on branch | reset-only via hard-delete, captured in migration 0010 docstring + D2 |
| 6 | Split `project_document/document.py` | Implemented on branch | 1602 → 745 lines; rows.py + envelope_models.py + _validators.py extracted |
| 7 | Split `mcp/tools.py` by family | Implemented on branch | 1046 → 755 lines; tools_custom_fields.py extracted. Still over 600 limit — additional splits flagged as Soon follow-up |
| 8 | Unify `users.is_active` → `deleted_at` | Implemented on branch | Migration 0021; auth/repository.py SELECTs alias `(deleted_at IS NULL) AS is_active`; round-trip clean |

## Decisions captured

- **D1 — REST action-URL style: slash-verb.** Documented in
  `backend/README.md` and in `decisions.md`.
- **D2 — `user_table_views` is reset-only (hard-delete).** Documented in
  migration 0010 docstring and in `decisions.md`.

## Closeout findings (`/simplify`)

`/simplify --fix` ran after implementation. Verified findings applied:

- **CRITICAL** — Migration 0020 set `ON DELETE SET NULL` on
  `project_assets.created_by` and `project_jobs.created_by`, both of which
  were `nullable=False` in migration 0011. Alembic accepted the migration
  but Postgres would raise `NotNullViolation` at the first user hard-delete.
  Fixed by adding `alter_column(... nullable=True)` for both columns in the
  same migration. Round-trip re-verified.
- Stale docstring reference in `rows.py` (`_validate_rows_custom_links`
  → `validate_rows_custom_links`).
- Unjustified lazy imports in `envelope_models.py` (Assembly / AssemblyLayer
  validators); hoisted to module level.
- `mcp/tools.py` custom-field re-exports moved from bottom-of-file
  `# noqa: E402` to top imports.

Skipped:
- 78-entry `__all__` in `document.py` (defensible — preserves caller surface).
- `mcp/tools.py` 755 lines, still over 600 soft limit (intentional staging;
  tracked as follow-up).
- Repeated `(deleted_at IS NULL) AS is_active` SELECT fragment (marginal).

## Follow-ups (out of this pass)

These are recorded as follow-ups rather than added to this PR:

- **`mcp/tools.py` second split** — at 755 lines still over the 600 limit.
  Likely seams: envelope tools (~6 funcs), asset/job tools (~7 funcs),
  document/table tools (~3 funcs). Treat as a "Phase 7b" when next in the
  file.
- **`project_document/formula/evaluator.py` (857)**,
  **`mutations/type_conversion.py` (626)**, **`tables/rooms.py` (571)** —
  all exceed the soft limit; not in the review's prioritised list.
- **Catalog list-endpoint pagination** — watch item (Materials Catalog
  PRD).
- **Auth pipeline SQL round-trip consolidation** —
  `planning/features/auth-session-perf/`.
- **`project_version_drafts` audit columns** — watch (multi-user drafts).
- **ADR routing for D1/D2** — there is no `context/decisions/` folder in
  this repo today; D1 / D2 live in this feature folder's `decisions.md`,
  in `backend/README.md` (D1), and in migration 0010's docstring (D2).
  If an ADR layout is ever introduced, these are the first two entries.

## Lesson captured for future migration work

Migration 0020 highlighted a non-obvious gotcha: **`ALTER ... ON DELETE
SET NULL` silently passes Alembic when the underlying column is
`NOT NULL`. The constraint only fires at the first CASCADE attempt.**
The defence is to inspect column nullability in the same review pass as
the FK clause, and to make any audit column that participates in `SET
NULL` explicitly nullable. The migration 0020 docstring records this so
the next audit-FK review does not repeat the mistake.

## Next step

Run `make format` + `make ci` from repo root, then reset the dev DB with
`make db-reset-dev` to land the new migrations on fresh seed data, then
commit and push.

## Verification status

- Backend `ruff format` + `ruff check`: clean (0 warnings).
- Backend `ty check`: clean.
- Backend `pytest`: 693 passed, 2 skipped (unchanged from main).
- Alembic forward + downgrade round-trip: clean across new migrations
  (0020 + 0021).
- Frontend: not yet validated locally on this branch; closeout gate via
  `make ci` is pending.
