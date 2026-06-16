---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - phased implementation plan
AUTHOR: Ed (via Claude)
SCOPE: Implementation sequence, precedents, and risks for the record
  identity model refactor.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - planning/refactor/record-identity-model/phases/phase-00-backend-identity-guarantee.md
  - planning/refactor/record-identity-model/phases/phase-01-display-name-rename.md
  - planning/refactor/record-identity-model/phases/phase-02-tag-as-ordinary-field.md
  - planning/refactor/record-identity-model/phases/phase-03-verification-docs-closeout.md
  - planning/refactor/data-table-consolidation/PRD.md
---

# Record Identity Model - Plan

## Existing Precedents

- Hidden-id uniqueness helper: `validate_unique_ids`
  (`backend/features/project_document/_validators.py:62`), currently
  called for space-types (`document.py:320`) and assembly
  segments/layers (`envelope_models.py:180,205`).
- The user-facing label is the `record_id` FieldDef; its key is
  `RECORD_ID_FIELD_KEY = "record_id"`
  (`frontend/src/shared/ui/data-table/lib/identifier/recordId.ts:4`).
- Non-blocking duplicate warning chip already exists:
  `computeIdentifierDuplicates` / `describeDuplicateRows`
  (`recordId.ts`), rendered in `components/GridBody.tsx:382,455` with the
  `data-table-identifier-duplicate` class, covered by
  `__tests__/identifierColumn.test.tsx`.
- Identifier label seeds live per table in
  `backend/features/project_document/tables/*.py` ("Tag" on appliances,
  electric_heaters, fans, hot_water_heaters, hot_water_tanks, pumps,
  ventilators, thermal_bridges, space_types; "Record-ID" on rooms.py:120).
- Heat-pump label hard-block: `heat_pumps/service.py:225`
  ("Duplicate tag within table"); its hidden-id + tag validation is in
  `_validate_slice` and `document.py`'s heat-pump validator.
- Built-in FieldDefs are persisted, not overlaid: `read_field_defs`
  returns `envelope.field_defs`
  (`tables/_registry_helpers.py:71-73`); only `locked` arrays overlay at
  render time (`custom_fields.py:196`); `display_name` is stored
  (`custom_fields.py:204`).
- Migration precedent and the "persisted FieldDefs need forward-fill"
  pattern are documented in the spaces-refactor plan
  (`planning/features/spaces-refactor/PLAN.md`, cross-cutting risk 1-2).

## Implementation Strategy

Backend identity guarantee first, then the user-visible rename with its
migration, then the Tag field, then docs/closeout. Keep the hidden-id
guard and the HP de-constraint (Phase 00) separate from the rename
(Phase 01) so the correctness change can be verified without entangling
the migration.

The rename is the only phase with real migration risk; isolate it so its
forward-fill can be designed and tested against real saved documents
before anything else depends on it.

This whole packet precedes the data-table-consolidation refactor. When it
lands, update that refactor's Phase 02 (identifier-column helper) and
Phase 04 (uniqueness reconciliation) to build on the settled model rather
than re-deciding it.

## Cross-Cutting Risks

1. **Persisted display_name migration.** The rename needs a conditional
   forward-fill over `project_versions` and `project_version_drafts`
   that rewrites only default labels ("Tag"/"Record-ID") and preserves
   user-renamed ones. A blind rewrite would clobber intentional user
   renames, because built-in `display_name` is editable.
2. **Schema-version policy.** Decide whether the guard + Tag seed +
   label migration warrant a `schema_version` bump or can ride as a
   non-breaking forward-fill (PRD open question 3). Follow the existing
   versioning policy and the spaces-refactor precedent.
3. **Tightening the hidden-id guard can reject existing documents.**
   Making `validate_unique_ids` universal could flag a pre-existing
   duplicate `row.id` if any slipped in. Verify against real saved
   documents; if duplicates exist, decide repair-on-read vs reject and
   document it.
4. **Heat Pumps interim state.** Removing HP's backend hard block before
   HP joins the shared grid (consolidation Phase 05) means HP shows no
   warning chip in the interim (its bespoke grid does not render it).
   That is acceptable (no worse than today, and the over-constraint is
   gone), but confirm the HP UI still reads sensibly.
5. **"Display Name" + "Name" coexistence.** Rooms and Thermal Bridges
   keep a separate `name` field. Confirm the two labels read clearly
   together, or revisit per-table labeling (PRD open question 2).
6. **Tag redundancy.** On equipment, Tag and Display Name will often hold
   the same value. That is the owner's accepted choice (seed Tag on
   equipment); just ensure neither is required, so users are not forced
   to fill both.
7. **Consolidation coupling.** The shared identifier-column helper is
   built in the other refactor. Avoid building a second helper here -
   this packet changes seeds, validation, and labels, not the shared
   column component.

## Verification Summary

Each phase runs focused tests for the layers it touches. Frontend
label-only changes may use `make frontend-dev-check`; any change to
parsing/state/queries also runs the focused
`cd frontend && pnpm exec vitest run <file>`. Backend phases run focused
`uv run pytest` on the touched test modules. Final closeout (Phase 03)
requires:

1. `make format`
2. `make ci`
3. Browser smoke on `http://localhost:5173` (backend
   `http://localhost:8000`, signed in as `codex@example.com`): confirm
   the pinned column reads "Display Name", duplicates warn (do not
   block) on every table, and the equipment Tag field is present and
   editable.
4. `graphify update .` after code changes.
5. Context docs updated only after behavior is verified.
