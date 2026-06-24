---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Complete (2026-06-17) - all three phases landed, verified, docs folded back
AUTHOR: Ed (via Claude)
SCOPE: Current state of the record identity model refactor planning.
RELATED:
  - planning/archive/record-identity-model/README.md
  - planning/archive/record-identity-model/PRD.md
  - planning/archive/record-identity-model/PLAN.md
---

# Record Identity Model - Status

## Current State

`Complete - all three phases landed, verified, and the identity contract
folded into context/ + CODING_STANDARDS`.

**Phase 02 (verification, docs, closeout) landed 2026-06-17.** `make ci`
green on the landed code; a real-browser smoke on DEV-0001
(`localhost:5173`, codex@example.com) confirmed the Display Name pinned
column, ordinary Tag, and absent "Name" label across Space-Types, Rooms
(formula Display Name + kept Number/Name inputs), Ventilators, Pumps
(empty Display Name), and Thermal Bridges. The contract was written into
`context/technical-requirements/data-table.md` (§ Identifier Column
rewrite), `data-model.md` (new §6.6.10 + schema-v8 history + Spaces
contract flip), and `context/CODING_STANDARDS.md` (DataTable Identity
Convention); the data-table-consolidation refactor's Phase 02/04 now
reference this model and B3 is marked resolved. `graphify update .` run.
See the phase-02 file's "Outcome" section. Packet archived to
`planning/archive/record-identity-model/` on 2026-06-17; all
consolidation-refactor and context-doc references were repointed to the
new path in the same move.

**Phase 00 (backend identity guarantee) landed 2026-06-17.** Hidden
`row.id` uniqueness is now enforced universally via
`generic_table_row_ids()` + `validate_table_row_ids()` in
`backend/features/project_document/_validators.py`; the Heat Pumps and
Space-Types user-facing-handle hard blocks were removed. See the phase-00
file's "Outcome" section.

**Phase 01 (swap identity columns) landed 2026-06-17.** The descriptive
`name` is now the pinned **Display Name** identifier on every table;
`record_id` is the ordinary "Tag" field (still the `{Number} — {Name}`
formula identifier on Rooms); Pumps gained an empty Display Name. The
pinned column + duplicate chip are now selected by a per-table
`isIdentifier` frontend column flag (was a hardcoded `record_id`
field_key). Shipped as a `schema_version` 7 → 8 bump + reseed, **no
body-migration** (owner decision: no users / no deploy). Full backend
suite green (890 passed); focused frontend suites green. See the phase-01
file's "Outcome" section. Phase 02 (verification, **context-doc rewrite**,
closeout) remains.

This packet was authored from the 2026-06-16 consistency review and owner
decisions on identifier semantics.

**Reconciled 2026-06-16 19:03 EDT** with the landed spaces-refactor (new
`space_types` table, Rooms `space_type_id` link, schema v7). Space-Types
is a second table that hard-blocks a user-facing handle today
(`document.py:332-334`); Phase 00 now removes those blocks alongside Heat
Pumps, and Phase 01 repoints the Rooms -> Space-Type picker label
resolution to the Display Name. The spaces-refactor is at Phase 04
complete / Phase 05 (verification) pending - sequence this refactor after
that closeout.

This refactor **precedes** the data-table-consolidation refactor; that
folder's Phase 02 and Phase 04 should inherit this identity model.

## Next Step

None - the refactor is complete. Future table work inherits this
identity model from `context/technical-requirements/data-table.md`
(§ Identifier Column), `data-model.md` §6.6.10, and the DataTable
Identity Convention in `context/CODING_STANDARDS.md`. The
data-table-consolidation refactor is the downstream consumer (its Phase
02 identifier helper and Phase 04 B3 inherit this baseline) and still
references this packet at its archived path
`planning/archive/record-identity-model/`.

## Disposition

Archived to `planning/archive/record-identity-model/` on 2026-06-17 (flat
archive convention, matching `spaces-refactor`). All inbound references
(context docs + the data-table-consolidation refactor) were repointed
from `planning/refactor/...` to `planning/archive/...` in the same move.

## Phase Status

| Phase | State |
|---|---|
| 00 - Backend identity guarantee (universal id guard; remove Heat Pumps **and** Space-Types hard blocks) | Complete (2026-06-17) |
| 01 - Swap identity columns (Display Name + Tag) | Complete (2026-06-17); shipped via `isIdentifier` frontend flag + schema v8 reseed, no body-migration |
| 02 - Verification, docs, closeout | Complete (2026-06-17); `make ci` green, browser smoke passed, contract folded into context/ + CODING_STANDARDS, consolidation B3 resolved |

## Blockers

None. Refactor complete.

## Decisions Recorded

- One human label, **Display Name**, and it is the **descriptive name**
  field (formerly "Name"), promoted to the pinned identifier column.
- The ambiguous **"Name"** label is retired on every table.
- The short code becomes an ordinary, non-unique **Tag** field (the
  former `record_id`, already labeled "Tag" on most tables).
- "ID" rejected as a label (collides with the hidden identifier).
- The user-facing label is **never unique-constrained**; duplicates show
  the existing warning chip. Heat Pumps **and Space-Types** drop their
  hard blocks (Space-Types also drops its "named row requires a Tag"
  rejection).
- The hidden `row.id` remains the only enforced-unique identity, with a
  universal `validate_unique_ids` guard.
- Stable field_keys (`name`, `record_id`) and `row.id` minting do not
  change.
- **Rooms** Display Name defaults to a **formula** `{Number} - {Name}`
  (its existing `record_id` formula, relabeled and kept as the
  identifier, still editable); Rooms keeps Number + Name as inputs and
  has no Tag field.
- Ships as a **standalone refactor that precedes** the
  data-table-consolidation work.
- Identity model mirrors Honeybee `identifier` / `display_name`.
- **Identifier role is a frontend per-column flag** (`isIdentifier` on
  `DataTableColumnDef`), not a persisted backend `TableFieldDef` field -
  pinning + the duplicate chip are render concerns. Decided Phase 01.
- **Shipped via `schema_version` 7 → 8 + reseed, no body-migration** -
  no production data, dev DBs reseed from the seed constants. Decided
  Phase 01.
- **Space-Types** (added by the spaces-refactor) follows the generic flip
  (`name` -> pinned Display Name, `record_id` -> ordinary Tag) with **no**
  residual hard block; its `name` is optional, so a Tag-only row shows a
  blank pinned Display Name; and the Rooms -> Space-Type picker /
  reverse-pill label resolution prefers the Display Name. Decided
  2026-06-16.

## Open Questions Carried From The PRD

1. Field-key / role strategy - **DECIDED (Phase 01)**: the identifier role
   is a per-table **frontend column flag** (`isIdentifier`), not a
   persisted backend field; stable field_keys unchanged. See the phase-01
   Outcome "Identifier-role repoint" for the why-this-not-that (backend
   `is_identifier` considered and rejected as heavier than warranted).
2. Rooms formula - DECIDED: Rooms' Display Name is the existing
   `{Number} - {Name}` formula field, relabeled (not repointed); no Tag
   field. **Implemented Phase 01** - relabel was display-only; formula
   deps/registry intact.
3. Pumps missing a `name` field - **DONE (Phase 01)**: seeded an empty
   "Display Name" built-in on Pumps; no other table was missing one.
4. Schema-version bump vs non-breaking migration - **DECIDED (Phase 01)**:
   bump `schema_version` 7 → 8 + reseed, **no body-migration** (owner
   confirmed no users / no deploy / no backwards-compat).
5. Heat-Pump interim UI - HP keeps its bespoke tables and is **not** on the
   shared grid yet (joins in data-table-consolidation Phase 05), so it has
   no pinned identifier / warning chip in the interim. Unchanged by
   Phase 01; acceptable (no worse than today).
6. Space-Types - DECIDED: generic flip, no residual hard block, picker
   label resolution follows Display Name. **Implemented Phase 01** - the
   `RoomsPage` picker now labels by Display Name first; Phase 00 already
   removed the two `document.py` hard blocks.

## Verification Status

Phase 00: focused backend tests + full backend `uv run pytest` green (890
passed, 2 skipped). `make format` / `make ci` run at closeout.

Phase 01: full backend `uv run pytest` green (890 passed, 2 skipped);
focused frontend suites green (data-table identifier/pinning, all 10
table builders, Space-Types, linked-record picker). `make format` /
`make ci` run at closeout.

Phase 02: `make ci` green from the repo root on the landed code.
Real-browser smoke on DEV-0001 (`localhost:5173`, codex@example.com)
confirmed Display Name pinned / ordinary Tag / no "Name" label on
Space-Types, Rooms (formula Display Name + Number/Name inputs),
Ventilators, Pumps (empty Display Name), and Thermal Bridges; the
interactive duplicate-chip and Space-Type-picker label-order paths rest
on the green unit suites (custom inline editor / linked-record popover do
not surface in the accessibility tree). `graphify update .` run.
Final `make format` + `make ci` run at commit closeout.
