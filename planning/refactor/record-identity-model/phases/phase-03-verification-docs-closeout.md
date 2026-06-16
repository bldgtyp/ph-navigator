---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Gates, browser smoke, and folding the identity model into the
  contract and standards; hand the baseline to the consolidation refactor.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
  - planning/refactor/data-table-consolidation/PRD.md
---

# Phase 03 - Verification, Docs, And Closeout

## Goal

Prove the identity model holds across every table and capture it as the
durable contract future table work inherits.

## Preconditions

- Phases 00-02 complete and individually verified.

## Tasks

1. Run the mandatory closeout gate from the repo root:
   - `make format`
   - `make ci`
   - If `make format` changes files, inspect the diff and rerun
     `make ci`.
2. Browser smoke on `http://localhost:5173` (backend
   `http://localhost:8000`, signed in as `codex@example.com`): confirm on
   Rooms, each Equipment tab, and Thermal Bridges that the pinned column
   reads "Display Name", duplicate Display Names warn but do not block,
   and the equipment Tag field is present and editable. Spot-check Heat
   Pumps no longer rejects duplicate tags.
3. Run `graphify update .` after the code changes.
4. Update `context/technical-requirements/data-table.md`:
   - replace the "header is always Record-ID" rule with "Display Name";
   - state the two-layer identity model (hidden unique `row.id` vs
     non-unique Display Name label);
   - state that the user-facing label is never unique-constrained on any
     table (warning chip only) and that the hidden-id guard is universal;
   - note Tag is an ordinary field, not the identifier.
5. Update `context/technical-requirements/data-model.md` for the
   universal hidden-id uniqueness guarantee and the Tag field, and note
   the Honeybee `identifier` / `display_name` mapping as forward context.
6. Update `context/CODING_STANDARDS.md` if it references identifier
   labeling, so new tables default to "Display Name" + ordinary Tag.
7. Update the data-table-consolidation refactor: amend its Phase 02
   (identifier-column helper) and Phase 04 (uniqueness reconciliation) to
   reference this settled model as the baseline, and mark the B3
   uniqueness item resolved.
8. Update this folder's `STATUS.md` to final state; route the packet
   toward `planning/archive/` per `planning/.instructions.md` once
   merged.

## Acceptance Criteria

- `make format` and `make ci` are green.
- Browser smoke confirms "Display Name" labeling, non-blocking duplicate
  behavior, and the editable Tag field across all tables.
- `graphify update .` has been run.
- `data-table.md`, `data-model.md`, and `CODING_STANDARDS.md` capture the
  identity model.
- The consolidation refactor references this model; its B3 item is marked
  resolved.

## Stop Conditions

- Stop if `make ci` is red; fix locally and rerun before declaring
  closeout.
- Do not archive the packet while any shipped phase is unverified or the
  contract docs are not yet updated.

## File Entry Points

- `context/technical-requirements/data-table.md`
- `context/technical-requirements/data-model.md`
- `context/CODING_STANDARDS.md`
- `planning/refactor/data-table-consolidation/phases/phase-02-shared-column-builders.md`
- `planning/refactor/data-table-consolidation/phases/phase-04-data-shape-and-backend-symmetry.md`
- `planning/refactor/record-identity-model/STATUS.md`
