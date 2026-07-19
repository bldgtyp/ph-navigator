---
DATE: 2026-07-19
TIME: 09:46 EDT
STATUS: Proposed sequence — not started
AUTHOR: Claude (Opus 4.8) for Ed May
---

# PLAN — Spec-status value unification

Phased so the stored-data migration is settled first (it gates everything).
Each phase ends green on `make ci`.

## Phase 0 — Decide the migration mechanism (design, no code)

Confirm how the document schema handles a value rename. Read
`backend/features/project_document/document.py` (schema version + validate) and
`context/technical-requirements/*` for the migration contract, plus the
`project_backend_data_arch_review_2026_06_24` memory ("settle the document
schema-migration mechanism before first real save").

Choose:
- **(preferred) Schema-version upgrade 7 → 8**: a forward migration function
  that, on load of a v7 body, rewrites `specification_status: "missing"` →
  `"needed"` in every material/glazing/frame row, then stamps v8. Enum becomes
  strict `needed` with no `missing`.
- **(fallback) Read-time alias**: a `field_validator(mode="before")` that maps
  `"missing"` → `"needed"` on input so old bodies parse. Simpler, but leaves the
  alias in the model indefinitely and stored bytes stay `missing`.

Deliverable: one paragraph in `decisions.md` recording the choice + why.

## Phase 1 — Backend enum + defaults + migration

- Rename the literal member in
  `backend/features/project_document/envelope_models.py:27`:
  `Literal["complete", "needed", "question", "na"]`.
- Update every default `= "missing"` → `= "needed"`:
  `envelope_models.py:252,303,365`; `commands/materials.py:125,316`;
  `project_document/apertures/_ref_helpers.py:148,158`.
- Update `hbjson_import.py:37` validation set.
- Implement the Phase-0 migration (upgrade function or before-validator) and
  bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` to 8 if going the upgrade route.
- Delete/relax the shims: `documentation_summary.py:220` and
  `status_summary.py:234` `_STATUS_BY_SPECIFICATION_STATUS` entries become
  identity (or drop the mapping and pass through). Keep the `unknown` sentinel
  handling intact.
- Update schema-corpus fixtures under
  `backend/tests/project_document_schema/fixtures/` (expected JSON currently
  encodes the status options / values).

Verify: unit tests for the migration (v7 body with `missing` → v8 body with
`needed`); `documentation_summary` / `status_summary` tests; envelope command
tests. `make ci` (backend) green.

## Phase 2 — Frontend types + report-table key

- `frontend/src/features/envelope/types.ts:7`: `SpecificationStatus` →
  `"complete" | "needed" | "question" | "na"`.
- `frontend/src/shared/ui/report-table/StatusPill.tsx:3`: `ReportStatusKey`
  `"missing"` → `"needed"`; update `.report-status-dot[data-status=...]` CSS and
  any `data-status="missing"` consumers (`ReportTable.css`).
- `MaterialsPanel.tsx`: the `STATUS_OPTIONS`/filter `value`+`status` keys move
  from `missing` → `needed` (label is already "Needed"); `statusCounts` keys.
- Decide on `--report-status-missing` token: either keep the token name (color
  only, harmless) or rename to `--report-status-needed` for full consistency and
  update all references. Record in `decisions.md`.
- Sweep for `"missing"` spec-status literals in apertures panels
  (glazings/frames) so their controls/filters use `needed`.

Verify: `pnpm exec tsc --noEmit`; envelope + apertures + documentation test
files; visual check of all four discipline pages.

## Phase 3 — Sweep, MCP, docs, closeout

- Grep the repo for remaining spec-status `"missing"` literals (exclude the
  unrelated import/export token enums in `catalogs/*/import_export/tokens.py`
  and the thermal `{"missing": True}` geometry flag — those are NOT spec status).
- MCP schema/tools: confirm any spec-status enum surfaced to MCP reflects
  `needed` (`context/technical-requirements/llm-mcp-schema.md`).
- Update `context/GLOSSARY.md` and any status docs to name the canonical set.
- Fold the accepted decisions back into `context/` per
  `planning/.instructions.md` rule 4.
- Full `make ci`; run the `simplify` + `docs-pass` skills; `make format`.

## Risk / rollback

- Highest risk: mis-migrating stored production bodies. Mitigate: migration is
  forward-only and idempotent (`missing → needed`, `needed → needed`); test
  against a copied real version body before deploy. Deploy is Ed's call
  (`context/DEVELOPMENT_WORKFLOW.md`).
- If the schema-upgrade route is too heavy for one pass, ship the Phase-0
  **read-time alias** first (unblocks the enum rename immediately), then do the
  stored-byte upgrade as a follow-up so bytes eventually match.
