---
DATE: 2026-06-03
TIME: 22:30 EDT
STATUS: Phase 1 complete (no-op after match-key review). Phases 2–4
        pending.
AUTHOR: Claude (Opus 4.7)
SCOPE: Implementation sequence for Materials Catalog JSON
       import/export.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
  - phases/phase-01-backend-external-id.md
  - phases/phase-02-backend-import-pipeline.md
  - phases/phase-03-frontend-overflow-menu.md
  - phases/phase-04-verification-docs.md
---

# PLAN — Materials Catalog Import / Export

## Sequencing rationale

Phase 1 turned out to be a no-op after schema review: the existing
`catalog_materials.id` column is already a stable, opaque, portable
`rec`-prefixed base62 string (see `_shared.py:new_catalog_record_id`),
so it serves as the import match key with no schema change needed.
Phase 1's deliverable is a documentation revision recording that
decision.

Order:

1. **Match-key decision (Phase 1).** Doc-only: PRD + PLAN + phase
   files revised so the import pipeline keys off `id` rather than
   a parallel `external_id`. No code changes; no migration.
2. **Backend import pipeline (Phase 2).** File-format types,
   upgrade chain, coerce/validate/dedup-by-`id`, `preview` +
   `commit` endpoints with the token cache. Reusable from a future
   MCP / CLI caller.
3. **Frontend overflow-menu wiring (Phase 3).** Export item
   (client-side serialize) and Import item (upload modal driven by
   the backend preview report).
4. **Verification + docs (Phase 4).** Round-trip test against a
   JSON file derived from `research/Material Data-Grid view.csv`;
   Playwright MCP smoke; fold-back into `context/`.

Each remaining phase is self-contained and shippable. If review
pauses between phases, `main` stays coherent: Phase 2 adds endpoints
with no UI; Phase 3 wires UI to endpoints that already exist.

## Branching

Single feature branch off `main`:
`feat/materials-catalog-import-export`. Phases land as separate
commits on that branch. No worktree cohort — there is no
downstream-cascade pattern here (Materials Catalog DataTable is
already merged).

## Phase map

| Phase | File | Scope |
|-------|------|-------|
| 1 | `phases/phase-01-match-key-decision.md` | Doc-only: dedup on existing `id` PK; no schema change. Marked Complete. |
| 2 | `phases/phase-02-backend-import-pipeline.md` | File-format Pydantic models, schema-version upgrade chain (v1 baseline), per-row coerce/validate, dedup-by-`id`, `POST /import/preview` + `POST /import/commit` with in-memory token cache. Unit + route tests. |
| 3 | `phases/phase-03-frontend-overflow-menu.md` | Add Export and Import items to `MaterialsCatalogPage`'s `overflowMenuActions` slot. Client-side JSON serialize for export. Upload modal: file picker → preview dialog driven by `/import/preview` response → commit button calls `/import/commit`. |
| 4 | `phases/phase-04-verification-docs.md` | `make ci` from repo root; build a seed JSON file from the reference CSV and run a full round-trip; Playwright MCP smoke; doc fold-back. |

## Risks

- **Token-cache lifetime.** The `preview → commit` token cache is
  in-memory (process-local) for MVP. With a single backend process
  in dev this is fine; document the assumption and add a TTL so a
  forgotten preview doesn't pin write-set memory.
- **Server-side parse of arbitrary user files.** The `/import/preview`
  endpoint accepts user-uploaded JSON. Enforce a max body size
  (FastAPI / Uvicorn limit) so a 500 MB blob doesn't OOM the
  server. Document the limit in the PRD-aligned route docstring.
- **Coercion surface area.** Type coercion (string → number,
  legacy color tuple → `#rrggbb`, category label → option id) is
  where bugs live. Each coercion rule needs a unit test asserting
  both the success and the "leave blank + warning" path.
- **Round-trip determinism.** Export must produce a key order /
  formatting that is stable across runs so diffs are usable.
  Pydantic's `model_dump(mode="json")` is deterministic by field
  order; rely on that and don't sort.

## Out of scope (cross-phase reminder)

- Frame / Glazing catalogs.
- CSV adapter.
- Update-matches / add-all-as-new conflict policies (deferred).
- Selection-based export.
- Field-definition import.
- Background or scheduled imports.
