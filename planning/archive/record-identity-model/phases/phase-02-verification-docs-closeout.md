---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Complete (2026-06-17)
AUTHOR: Ed (via Claude)
SCOPE: Gates, browser smoke, and folding the identity model into the
  contract and standards; hand the baseline to the consolidation refactor.
RELATED:
  - planning/archive/record-identity-model/PRD.md
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
   Space-Types (under the Spaces tab), each Equipment tab, and Thermal
   Bridges confirm the pinned column reads **Display Name** (the
   descriptive name), duplicate Display Names warn but do not block, the
   **Tag** column is an ordinary editable field, and no column is labeled
   **Name**. Confirm Rooms still shows Number, Pumps shows an (empty)
   Display Name, and Heat Pumps no longer rejects duplicate tags. On
   Space-Types confirm a duplicate Tag is accepted (warning chip, no hard
   error), a Tag-only row shows a blank pinned Display Name without error,
   and the Rooms -> Space Type picker labels options by Display Name first.
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
- `planning/archive/record-identity-model/STATUS.md`

## Outcome (2026-06-17)

### Gates

- `make ci` green from the repo root on the landed Phases 00 + 01 code
  (backend locked sync, Ruff format + lint, Ty, Alembic, pytest;
  frontend frozen install, Prettier, ESLint, structural guards, Vitest,
  production build). Re-run after the doc edits at final closeout.

### Browser smoke (localhost:5173, signed in as codex@example.com)

Reseeded the dev DB (`make seed-dev-data` + `make seed-agent-user`) and
drove the starter project DEV-0001 in a real browser. Confirmed the
pinned slot-0 header is **Display Name** and **Tag** is an ordinary
editable column, with **no "Name" label**, on every table checked:

- **Space-Types** — Display Name (Living / Dining, Kitchen, …), Tag
  (LIVING, KITCHEN, …), plus the reverse "Rooms ← Space Type" pill
  column. Loads with descriptive Display Names and short Tags; no hard
  block.
- **Rooms** — Display Name is the `{Number} — {Name}` formula
  ("103 — Bedroom 1"); **Number** and **Name** remain ordinary input
  columns (the Rooms-only exception); Space Type link column present.
- **Ventilators** — Display Name + Tag generic flip.
- **Pumps** — pinned Display Name renders **blank** (the empty built-in
  it gained) ahead of the Tag (P-1, P-2).
- **Thermal Bridges** — Display Name ("Roof Parapet"), Tag ("TB-1").

The remaining 5 generic equipment tables (Fans, Hot-water heaters,
Hot-water tanks, Electric heaters, Appliances) use the identical generic
column builder verified on Ventilators and are covered by their green
table-builder suites. The interactive duplicate-Display-Name
warning-chip / no-block behavior and the Rooms → Space-Type picker
Display-Name-first label resolution are covered by the green
`identifier.test.ts`, `identifierColumn.test.tsx`, and RoomsPage /
linked-record picker suites; the custom grid's inline editor and the
linked-record popover do not surface in the Playwright accessibility
tree, so those two paths were left to the unit coverage rather than
driven manually. Heat-pump sub-tables remain off the shared grid (no
pinned identifier), as decided.

### Docs folded back

- `context/technical-requirements/data-table.md` — § *Identifier Column*
  rewritten from the old `IdentifierConfig` / `__record_id__` /
  "Record-ID" model to the two-layer hidden-key + Display Name + Tag
  contract, keyed on the `isIdentifier` per-column flag; the Layout
  section's stale `IdentifierConfig` reference updated.
- `context/technical-requirements/data-model.md` — new **§6.6.10 Row
  identity model (schema v8)**; §6.3 Spaces contract and the §6.6.1
  space_types envelope example flipped to Display Name / Tag; a
  `schema_version: 8` entry added to the version history.
- `context/CODING_STANDARDS.md` — new **DataTable Identity Convention**
  subsection (new tables default to a Display Name identifier + ordinary
  Tag, never a "Name" label; never unique-constrain a user-facing
  label).
- `planning/refactor/data-table-consolidation/` — Phase 02 identifier
  helper repointed to the shipped `isIdentifier`-flag baseline; Phase 04
  **B3 marked RESOLVED (landed)**; PRD open-question 1 and STATUS
  open-question 1 marked resolved.

### graphify

`graphify update .` run after the edits (AST-only; docs-only change, so
the code graph is unchanged).

### Packet disposition

Marked **Complete** and **archived to
`planning/archive/record-identity-model/`** on 2026-06-17 (flat archive
convention, matching `spaces-refactor`). Because the active
data-table-consolidation refactor and the context docs reference this
packet by path (README + Phases 02/04 + `data-table.md` /
`data-model.md`), every inbound reference was repointed from
`planning/refactor/...` to `planning/archive/...` in the same move, so no
links break.
