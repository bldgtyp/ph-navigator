---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Complete (2026-06-17) - all phases landed; see STATUS.md
AUTHOR: Ed (via Claude)
SCOPE: Implementation sequence, precedents, and risks for the record
  identity model refactor.
RELATED:
  - planning/archive/record-identity-model/PRD.md
  - planning/archive/record-identity-model/phases/phase-00-backend-identity-guarantee.md
  - planning/archive/record-identity-model/phases/phase-01-swap-identity-columns.md
  - planning/archive/record-identity-model/phases/phase-02-verification-docs-closeout.md
  - planning/refactor/data-table-consolidation/PRD.md
---

# Record Identity Model - Plan

## Existing Precedents

- Hidden-id uniqueness helper: `validate_unique_ids`
  (`backend/features/project_document/_validators.py:62`), currently
  called for space-types (`document.py:324`) and assembly
  segments/layers (`envelope_models.py:180,205`). Space-Types is the
  newest table and already wires this guard by hand at the document level
  - precedent that the universal guard should be driven generically from
  `iter_table_contracts()` so future tables inherit it without a
  per-table stanza.
- The pinned identifier is hardcoded to `RECORD_ID_FIELD_KEY = "record_id"`
  (`frontend/src/shared/ui/data-table/lib/identifier/recordId.ts:4`),
  pinned by field_key in `components/GridBody.tsx`, with `__record_id__`
  whitelisted in `sanitizeViewStateForSchema`
  (`lib/view/sanitize.ts`). The identifier system already supports
  field-based identifiers, which is what Rooms effectively uses.
- Non-blocking duplicate warning chip already exists:
  `computeIdentifierDuplicates` / `describeDuplicateRows`
  (`recordId.ts`), rendered in `components/GridBody.tsx:382,455`, covered
  by `__tests__/identifierColumn.test.tsx`.
- Field seeds live per table in
  `backend/features/project_document/tables/*.py`. Nine tables seed a
  `name` field (`field_key="name"`, display "Name"); Pumps does not.
  `record_id` is labeled "Tag" on eight tables and is a formula labeled
  "Record-ID" on Rooms (`rooms.py:85,120`).
- User-facing-handle hard-blocks (both removed in Phase 00):
  - Heat-pump label: `heat_pumps/service.py:225` ("Duplicate tag within
    table").
  - Space-Types Tag: `document.py:333` ("Duplicate space type Tag") plus
    the "named row requires a Tag" rejection at `document.py:332`. These
    were added by the 2026-06-16 spaces-refactor; the identity model
    drops both.
- Space-Types link-target label resolution: the Rooms -> Space-Type picker
  and reverse pills prefer Tag then Name
  (`frontend/src/features/equipment/routes/RoomsPage.tsx:147-151`,
  `getRecordId`/`getDisplayName`); these must be repointed to prefer the
  Display Name (`name`) after the swap.
- Built-in FieldDefs are persisted, not overlaid: `read_field_defs`
  returns `envelope.field_defs`
  (`tables/_registry_helpers.py:71-73`); only `locked` arrays overlay at
  render time (`custom_fields.py:196`).
- Migration precedent for adding/forward-filling built-in FieldDefs:
  the spaces-refactor plan
  (`planning/features/spaces-refactor/PLAN.md`, cross-cutting risk 1-2).

## Implementation Strategy

Backend identity guarantee first (Phase 00), then the atomic identifier
swap with its migration (Phase 01), then docs/closeout (Phase 02).

The swap is one atomic change: promoting the descriptive name to the
pinned Display Name and demoting `record_id` to an ordinary Tag must land
together, or there is an intermediate state with two (or zero) identifier
columns. Keep Phase 00 separate so the correctness change (universal
guard + dropping the HP block) is verifiable without entangling the swap.

The central design decision in Phase 01 is **repointing the identifier
role off the hardcoded `record_id` to the table-declared Display Name
field, without renaming stable field_keys**. Resolve that first; the
migration depends on it.

This whole packet precedes the data-table-consolidation refactor. When it
lands, that refactor's Phase 02 (identifier-column helper) and Phase 04
(uniqueness reconciliation, B3) build on the settled model rather than
re-deciding it.

## Cross-Cutting Risks

1. **Identifier repointing touches shared code.** Moving the pinned
   identifier off `record_id` means `recordId.ts`, the `GridBody`
   pin-by-field_key logic, and the `__record_id__` whitelist in
   `sanitizeViewStateForSchema` must follow the table-declared Display
   Name field. This is shared-system surface; verify the duplicate chip,
   pinning, and view-state round-trip all follow.
2. **Multi-field, conditional migration.** The swap relabels two fields
   per table, repoints the identifier, adds a field on Pumps, and handles
   the Rooms formula - over existing `project_versions` and
   `project_version_drafts`. Relabels must be conditional (only rewrite
   prior defaults; preserve user renames). Design and test against real
   saved documents before enabling on the load path.
3. **Rooms formula identifier (kept).** Rooms' Display Name is the
   existing `record_id` formula (`{Number} - {Name}`), relabeled only.
   The relabel must be display-only - it must not disturb the formula
   AST, the `{Number}`/`{Name}` dependency ids, or the
   `roomsFormulaRegistry`. Rooms is the one table whose identifier is NOT
   repointed, so its risk is the relabel, not a field move.
4. **Pumps has no descriptive name.** Pumps needs a new Display Name
   field; confirm no other table is similarly missing one, and that an
   empty Display Name renders sensibly as the pinned column.
5. **Schema-version policy.** Decide whether the swap warrants a
   `schema_version` bump or can ride as a non-breaking migration (PRD
   open question 4), following the existing policy and spaces-refactor
   precedent.
6. **Hidden-id guard can reject existing documents.** Making
   `validate_unique_ids` universal (Phase 00) could flag a pre-existing
   duplicate `row.id`. Verify against real saved documents; decide
   repair-on-read vs reject and document it.
7. **Heat Pumps interim.** Removing HP's backend hard block before HP
   joins the shared grid (consolidation Phase 05) means HP shows no
   warning chip in the interim. Acceptable (no worse than today, and the
   over-constraint is gone), but confirm the HP UI still reads sensibly.
8. **Consolidation coupling.** The shared identifier-column *component* is
   built in the other refactor. This packet changes seeds, validation,
   labels, and the identifier role - not that component. Avoid building a
   second helper here.
9. **Space-Types is a special generic table.** Unlike the equipment
   tables, Space-Types carries its own backend enforcement
   (`document.py:332-334`) that Phase 00 must delete, and its `name` is
   optional - so its pinned Display Name can be blank for Tag-only rows
   (acceptable, same as Pumps; empty never warns). It is also a link
   target, so the Rooms -> Space-Type picker/reverse-pill label resolution
   (`RoomsPage.tsx:147-151`) must follow the Display Name. The label-flip
   on a link target is the one frontend touch-point beyond the generic
   column swap.
10. **Sequencing vs the spaces-refactor.** The spaces-refactor is at Phase
    04 complete / Phase 05 (verification + full `make ci`) pending. Land
    this refactor after that closeout so the identity swap does not sit on
    top of unverified `space_types` work, and so the schema-version bump
    here cleanly follows the spaces-refactor's v7.

## Verification Summary

Each phase runs focused tests for the layers it touches. Backend phases
run focused `uv run pytest`; frontend changes run focused
`cd frontend && pnpm exec vitest run <file>`. Final closeout (Phase 02)
requires:

1. `make format`
2. `make ci`
3. Browser smoke on `http://localhost:5173` (backend
   `http://localhost:8000`, signed in as `codex@example.com`): confirm
   the pinned column reads "Display Name" (the descriptive name),
   duplicates warn but do not block, the Tag column is ordinary, and no
   column is labeled "Name".
4. `graphify update .` after code changes.
5. Context docs updated only after behavior is verified.
