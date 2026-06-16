---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Product, architecture, and data-shape contract for consolidating
  all project DataTable pages onto the shared data-table system.
RELATED:
  - planning/refactor/data-table-consolidation/README.md
  - planning/refactor/data-table-consolidation/PLAN.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
  - context/CODING_STANDARDS.md
---

# DataTable Consolidation - PRD

## Problem

The app has grown a family of editable data-table pages - Rooms,
seven Equipment types, four Heat-Pump tables, and Thermal Bridges - on
top of a strong shared `data-table` system. But consistency has drifted.
The same elements (single-select pills, link/linked-record fields,
attachment cells, row-edit modals, identifier columns) render and behave
differently from table to table, and the backend validates each table's
data-shape unevenly.

The 2026-06-16 consistency review
(`planning/code-reviews/2026-06-16/data-table-consistency-review.md`)
catalogued the divergence with `file:line` evidence and traced it to two
root causes plus sibling copy-paste drift:

- **Heat Pumps forked the whole stack.** It reuses only the leaf
  `<DataTable>` and rebuilds the controller, view-state hook
  (`useHeatPumpTableViewState`), single-select editor (`OptionPicker`),
  row modals, inverse-link column, and a bespoke JSON-Patch backend. It
  therefore renders single-selects/links/modals differently and cannot
  participate in custom fields, locks, or formulas.
- **Shared cells are not exported.** `SingleSelectCell`, link rendering,
  the attachment-column builder, and number-input wrappers are not on the
  public surface of `shared/ui/data-table`, so ~9 tables copy-paste them.
  Several copies are dead code, because the grid dispatches
  `single_select` / `linked_record` / `lookup` / `color` to the shared
  cell before the column's custom `render` runs
  (`components/GridBody.tsx:523-549`).

The cost is real: inconsistent UX, a wide surface for bugs to differ per
table, a backend that lets invalid data-shapes through on some tables but
not others (including cross-project asset references on a public repo),
and a Heat-Pump family locked out of the shared feature set.

## Goal State

One way to build a project DataTable page, one way to render each field
type, one row-edit modal, and one backend validation path - applied to
every table.

Concretely:

- Every field type renders through exactly one shared cell. No table
  re-implements single-select pills, link cells, attachment cells, or
  identifier columns.
- Every editable table composes the shared
  `useSliceTableController` + `<SliceTableShell>` + `<DataTable>` stack,
  including Heat Pumps.
- One shared row-edit modal / form hook backs every per-row editor.
- The backend validates every table's data-shape (asset references,
  option references, linked records, numerics, identifiers) through one
  consistent path, with no table looser or stricter than its siblings
  without a documented reason.
- The same semantic field has one storage location and one field type
  across all tables.

## Product Contract

This refactor is behavior-preserving for the user wherever possible. The
intended user-visible changes are convergences, not new features:

1. **Single-select fields** render identically everywhere (the shared
   `SingleSelectCell` pill + popover), in grid cells **and** in modals.
2. **Link / linked-record / inverse-link fields** render identically
   (shared `LinkedRecordCell` + `Picker`), with one pill-label policy and
   one click behavior (open-in-page-modal is the contract per
   `data-table.md`; cross-route deep links remain only for explicit
   navigation flows).
3. **Attachment cells** render identically via one shared attachment
   column builder.
4. **Identifier ("Record-ID" / "Tag") columns** are built one way across
   all tables.
5. **Row-edit modals** share one chrome, one save/error scaffold, and one
   `setCustomValue` convention.
6. **Heat Pumps** gains custom fields, locks, and formula support by
   joining the shared abstraction, and its single-selects/links/modals
   stop diverging from the rest of the app.
7. **Invalid writes are rejected uniformly.** Attachment and option
   references that do not exist (or belong to another project) are
   rejected on every table; numeric and identifier rules are consistent.

## Target Data-Shape Decisions

These resolve the data-shape drift the review found (review F8, B3, B4).
Final values are confirmed per phase, but the planning defaults are:

| Concept | Current drift | Target |
|---|---|---|
| `inside_outside` | Ventilators: top-level + `single_select`; HotWaterTanks: `custom_values` + `short_text` | One field type (`single_select`) and one storage tier across both tables. |
| `phase` | Typed column with `{1,3}` on Pumps/Fans/HWH; unconstrained `number` custom field on HWT/Appliances/ElectricHeaters | One storage tier; `{1,3}` validation applied wherever `phase` exists. |
| Identifier uniqueness | 9 generic tables: never unique (per spec); Heat Pumps: per-table case-insensitive tag uniqueness | One rule for all tables, recorded in `data-table.md`. Default: follow the spec (non-unique, warning chip), unless HP has a hard requirement that is then added to the spec. |
| Numeric quantities (volts, wattage, quantity, etc.) | No range checks on generic tables; HP uses `NonNegativeFloat`/`PositiveFloat` | Apply consistent non-negativity / domain ranges across equipment tables. |
| Attachment field defs | Modeled as `long_text` FieldDefs | Treated consistently as attachment fields with reference validation. |

## Non-Goals

- No new product capabilities on any table beyond removing divergence.
- No redesign of the shared grid, view-state model, or schema-mutation
  contract.
- No migration of Climate's static report table or catalog pages onto
  the interactive DataTable.
- No V1 repo changes.

## Acceptance Criteria

1. `SingleSelectCell` (and its pill) is exported from
   `shared/ui/data-table` and is the only single-select renderer used by
   any table; all per-table `optionPill` copies and dead `render:`
   entries on single-select columns are removed.
2. Shared link-cell, attachment-column, identifier-column, and
   number-input helpers exist and are adopted; the per-table copies of
   `shortenUrl`, the URL/attachment column blocks, and number-input
   parsers/wrappers are removed.
3. One shared row-edit modal / form hook backs Rooms, Ventilators, and
   the four Heat-Pump modals; the local `setCustomValue` shadow is gone.
4. Linked-record and inverse-link columns use one shared implementation
   across Pumps, Ventilators, and Heat Pumps, with one pill-label policy
   and one click behavior.
5. Heat Pumps composes `useSliceTableController` + a `HeatPumpsTableSlot`
   + `<SliceTableShell>`; `useHeatPumpTableViewState` and `OptionPicker`
   are removed; the bespoke per-table `handleWrite` switches are gone.
6. Heat-Pump tables support user custom fields, locks, and formulas
   through `tableSchema`, or the divergence is explicitly documented if a
   blocker is found.
7. The backend validates attachment asset-id references (existence +
   project ownership + kind/count) on every write path; the dead/no-op
   and orphaned attachment configs are removed or wired.
8. The backend validates heat-pump single-select option-id references
   against their option lists, matching the generic tables.
9. The identifier-uniqueness rule is consistent across all tables and is
   recorded in `data-table.md`.
10. `inside_outside` and `phase` each have one storage tier and one field
    type across all tables, with a migration for existing documents if
    the storage changes.
11. The dual `equipment_*` attachment contracts are removed or
    consolidated so each table path has one writable surface.
12. No table renders a field type with a bespoke component where a shared
    cell exists; no table CSS overrides shared `.data-table-*` styling;
    the `hp-` modal-form classes are renamed to a neutral namespace.
13. `make format` and `make ci` pass; focused frontend and backend tests
    cover each converged behavior; `graphify update .` is run after code
    changes.
14. Durable decisions (identifier-uniqueness rule, data-shape choices,
    the canonical table-page recipe) are folded into `context/` docs.

## Open Questions For Implementation

1. **Identifier uniqueness.** Does Heat Pumps have a real requirement for
   unique tags, or can it adopt the non-unique + warning-chip behavior
   the other tables use? Resolve in Phase 04 before changing validators.
2. **`inside_outside` / `phase` storage tier.** Should the convergence
   move these to `custom_values` (matching the user-extensible model) or
   keep built-in selects top-level (the current house pattern Rooms
   uses)? Default: keep built-in selects top-level, fix only the
   field_type and the divergent table. Confirm against migration cost in
   Phase 04.
3. **Heat-Pump slice on one controller.** The heat-pump slice holds four
   row-types + option lists together, unlike one-row-type Rooms. Does the
   shared `useSliceTableController` need a multi-row-type variant, or
   should each heat-pump sub-table be its own slice? Resolve in the
   Phase 05 design spike before implementation.
4. **Heat-Pump custom fields.** Confirm the document/storage path can
   carry `field_defs` / `custom_values` / `custom_links` for heat-pump
   rows (the rows are currently flat models). If a storage reshape is
   required, scope it as part of Phase 05 or defer custom-field support
   with a documented gap.
5. **Asset-reference enforcement strictness.** Reject-on-write vs
   strip-and-warn for invalid asset ids. Default: reject on write to
   match the existing linked-record cascade behavior; confirm in
   Phase 01.
