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

# Phase 02 - Verification, Docs, And Closeout

## Goal

Prove the identity model holds across every table and capture it as the
durable contract future table work inherits.

## Preconditions

- Phases 00-01 complete and individually verified.

## Tasks

1. Run the mandatory closeout gate from the repo root:
   - `make format`
   - `make ci`
   - If `make format` changes files, inspect the diff and rerun
     `make ci`.
2. Browser smoke on `http://localhost:5173` (backend
   `http://localhost:8000`, signed in as `codex@example.com`): on Rooms,
   each Equipment tab, and Thermal Bridges confirm the pinned column reads
   **Display Name** (the descriptive name), duplicate Display Names warn
   but do not block, the **Tag** column is an ordinary editable field, and
   no column is labeled **Name**. Confirm Rooms still shows Number, Pumps
   shows an (empty) Display Name, and Heat Pumps no longer rejects
   duplicate tags.
3. Run `graphify update .` after the code changes.
4. Update `context/technical-requirements/data-table.md`:
   - replace the "header is always Record-ID" rule with **Display Name**;
   - state the two-layer identity model: hidden unique `row.id` vs the
     non-unique **Display Name** label, which is the descriptive name and
     the pinned identifier;
   - state that the user-facing label is never unique-constrained on any
     table (warning chip only) and that the hidden-id guard is universal;
   - state that **Tag** is an ordinary field (the former identifier),
     and that **Name** is retired as a label.
5. Update `context/technical-requirements/data-model.md` for the universal
   hidden-id guarantee, the Display Name / Tag field roles, and the
   Honeybee `identifier` / `display_name` mapping as forward context.
6. Update `context/CODING_STANDARDS.md` if it references identifier
   labeling, so new tables default to a "Display Name" identifier (the
   descriptive name) plus an ordinary Tag, never a "Name" label.
7. Update the data-table-consolidation refactor: amend its Phase 02
   (identifier-column helper) and Phase 04 (uniqueness reconciliation, B3)
   to reference this settled model as the baseline, and mark B3 resolved.
8. Update this folder's `STATUS.md` to final state; route the packet
   toward `planning/archive/` per `planning/.instructions.md` once merged.

## Acceptance Criteria

- `make format` and `make ci` are green.
- Browser smoke confirms Display Name labeling (the descriptive name),
  non-blocking duplicate behavior, the ordinary Tag field, and no "Name"
  label, across all tables.
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
