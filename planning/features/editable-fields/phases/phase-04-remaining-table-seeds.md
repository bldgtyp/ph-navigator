---
DATE: 2026-05-26
TIME: 15:30 ET
STATUS: PHASE PLAN — depends on Phase 3 complete + PRD acceptance
        (`planning/features/editable-fields/PRD.md`).
        Per-table rollout phase; each table is independent.
AUTHOR: Claude (Opus 4.7)
SCOPE: Author seed FieldDef lists for every project-document table
       not yet covered by Phases 1–3 — Fans, ERVs, Thermal Bridges,
       Window-Types — and for the three catalog tables (Materials,
       Window-Frame Elements, Window-Glazing). Each table declares
       its own `record_id`, its own lock policy, and (for catalog
       tables) its tighter `"field_type"` locks. Coordinates with the
       catalog rollout PRD when that lands.
RELATED:
  - planning/features/editable-fields/PRD.md (master PRD, §P5.3, §P5.4)
  - planning/features/editable-fields/archive/complete/plan-31-phase-3-built-in-type-changes.md (predecessor)
  - context/technical-requirements/data-model.md §6.6, §7.0
  - context/user-stories/30-tables-equipment.md
  - context/user-stories/20-envelope.md (Window Types, Thermal Bridges)
  - backend/features/project_document/tables/ (per-table contract modules)
---

# Plan 31 — Phase 4 — Per-Table Seeding For Remaining Tables

## P0. Phase Intent

Phases 1–3 ship the unified field-config model on Rooms and Pumps.
Phase 4 rolls the same model out to every other custom-field-capable
table — both project-document tables (Fans, ERVs, Thermal Bridges,
Window-Types) and catalog tables (Materials, Window-Frame Elements,
Window-Glazing). Each table:

- Declares a `record_id` seed FieldDef (with the appropriate
  `display_name` and lock policy per domain).
- Declares its full seed FieldDef list with per-field `locked`
  arrays.
- Registers its `TableFieldRegistry` (the renamed
  `CustomFieldCapability`).
- Includes the module-load assertion that the seed contains
  `record_id` (PRD §P4.3 / Phase 2 §P3 rule 3).

Catalog tables get tighter `"field_type"` locks across the board to
keep refresh-from-catalog (US-WIN-11) coherent — a project field
whose type diverges from the catalog's typed shape silently skips the
refresh, so locking type on catalog-sourced fields is the right
default (Phase 3 enforces the skip; Phase 4 makes the lock
explicit at the seed level).

This phase is **per-table independent**. Each table can land
separately. Recommend ordering: project-document tables before
catalog tables (catalog tables coordinate with the catalog rollout
PRD whenever that ships).

## P1. Preconditions

- Phase 3 shipped: built-in type-changes work end-to-end on Rooms /
  Pumps; conversion matrix covers `formula`; refresh-from-catalog
  skips mutable-type-mismatched fields.
- The catalog rollout direction (which catalog tables ship in v1 and
  in what order) is decided. Per `context/PRD.md §7.0`, v1 ships
  Materials, Window-Frame Elements, and Window-Glazing; v1.1 ships
  the equipment catalogs.
- Each table's row Pydantic model exists or is being built as part
  of the broader feature work. Phase 4 does not invent new tables;
  it only adds the FieldDef registry to tables that already have a
  row model.

## P2. Scope

### P2.1 Project-document tables (each independent)

For each of the following, declare:

- Seed FieldDef list (per `TableFieldDef` shape from Phase 1b).
- Default lock policy: `["delete", "duplicate"]` per built-in,
  plus `"field_type"` lock on fields with hard domain constraints
  (option-list references, numeric ranges, attachment fields).
- `record_id` seed with appropriate `display_name` (per-domain
  term — not universally "Record-ID"; see Q-F11).
- Module-load assertion.

**P2.1.1 Fans**
- Fields TBD when the row model lands (parallel to Pumps).
- `record_id` `display_name`: likely `"Tag"` for parity with Pumps.
- Single-select fields (e.g. `device_type`) lock `"field_type"`.
- Attachment fields ship the all-locked array.

**P2.1.2 ERVs**
- Fields TBD when the row model lands.
- `record_id` `display_name`: likely `"Unit ID"` or `"Tag"` (Ed to
  confirm).
- Single-selects lock `"field_type"`.

**P2.1.3 Thermal Bridges**
- Fields per `context/user-stories/20-envelope.md`.
- `record_id` `display_name`: `"TB ID"` (Ed to confirm).
- Fields with PH-domain numeric constraints (psi-values: ge=0) lock
  `"field_type"`.

**P2.1.4 Window-Types**
- Existing row model already in `document.py` (`WindowTypeEntry`).
- `record_id` `display_name`: `"Name"` (the existing `name` field
  becomes `record_id`).
- The grid-style window-element editor (rows/columns/spans/frames/
  glazing) is **not** in the DataTable FieldDef registry — that's a
  separate visual editor. Phase 4 covers only the top-level
  window-types table (one row per window type).

### P2.2 Catalog tables (one combined sub-rollout)

Catalog rollout is a separate workstream with its own PRD when it
lands. Phase 4's catalog responsibility is the lock-list audit on
each catalog table's seed FieldDef list:

**P2.2.1 Materials**
- `record_id` `display_name`: `"Name"` (locked).
- Every field that ever appears as a catalog-sourced value (`u_value_w_m2k`,
  `manufacturer`, `brand`, `color`, etc.) locks `"field_type"`.
- Optional / project-overridable fields (e.g. project-specific
  `notes`) may unlock `"field_type"` if the catalog rollout PRD
  agrees.

**P2.2.2 Window-Frame Elements**
- Same shape; `record_id` `display_name: "Name"` (locked).
- Catalog-sourced numerics (`width_mm`, `u_value_w_m2k`, `psi_g_w_mk`,
  `psi_install_w_mk`) lock `"field_type"`.

**P2.2.3 Window-Glazing**
- Same shape; `record_id` `display_name: "Name"` (locked).
- Catalog-sourced numerics (`u_value_w_m2k`, `g_value`) lock
  `"field_type"`.

**Catalog uniqueness relaxation** (referenced by PRD §P5.3): the
existing catalog `name` uniqueness validator is dropped in
coordination with the catalog rollout PRD. The bookshelf-picker UX
adjustment is the catalog PRD's responsibility; Phase 4's catalog
side is the seed FieldDef list authoring only.

### P2.3 Out of scope

- Catalog UX redesign (bookshelf picker, refresh-from-catalog diff
  UI, etc.) — owned by the catalog rollout PRD.
- New tables that don't exist yet (e.g. v1.1 equipment catalogs:
  Heat Pumps, Boilers, etc.). Those land when the catalogs ship.
- Linked-record fields (`erv_unit_ids` on Rooms, future relations
  between Pumps and Fans, etc.). Linked records are out of scope
  throughout this PRD.

## P3. Rules & Constraints

1. **Each table is independent.** A table can land Phase 4 changes
   without waiting on others. The phase is "rolled out" when every
   custom-field-capable table has its seed FieldDef list authored.
2. **Default lock policy applies uniformly** (PRD §P5.0): every
   built-in seed lists `["delete", "duplicate"]`. Feature authors
   add stronger locks per field per the table's domain.
3. **Catalog tables lock `"field_type"` on every catalog-sourced
   field.** Refresh-from-catalog depends on the type match; Phase 3
   already enforces the skip behavior, but the lock prevents the
   user from creating the mismatch in the first place.
4. **`record_id`'s `display_name` is per-feature**, never the
   universal `"Record-ID"` string for tables where the domain has
   a stronger term (Pumps "Tag", catalog "Name", Thermal Bridges
   "TB ID"). The renderer pins by `field_key`.
5. **Module-load assertion fires per table.** A table contract
   module that ships without `record_id` in its seed list raises
   ImportError. Tests cover the assertion path for each new table.
6. **No new schema-version bump** unless a new table's row model
   itself requires one. Phase 4 is FieldDef-registry authoring, not
   wire-format change.
7. **Catalog table FieldDef registries persist** in the catalog's
   own storage (which is relational, not in the project document).
   The shape is the same `TableFieldDef`; the storage location is
   different. Phase 4 confirms the persistence-side details with
   the catalog rollout PRD before merging.
8. **Existing project documents (already in v4 from Phase 2) get
   the new built-in FieldDef entries via the explicit upgrade
   pass (PRD §P4.2.3 / Q-F12).** Each new table that adds its
   FieldDef registry to an already-existing project body bumps the
   schema version (4 → 5 → 6 …) and ships a per-table upgrade
   function. The upgrade applies once at the service layer.

## P4. Workstreams

### P4.1 Per-table seed authoring

For each table (independent workstream):

1. Confirm the row Pydantic model exists and is stable.
2. Author the seed FieldDef list (one `TableFieldDef` per visible
   grid column, plus `record_id`).
3. Declare per-field `locked` arrays per the lock-policy rule.
4. Register the `TableFieldRegistry` with the document layer.
5. Add the module-load assertion.
6. Add the per-table upgrade function (synthesize FieldDef registry
   + copy any pre-existing typed-column values into
   `custom_values` for newly-mutable-type fields).
7. Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` for the table's
   addition.

### P4.2 Frontend per-table wiring

For each table:

1. Build the `<DataTable>` consumer page (or extend the existing
   one).
2. Pass the loaded FieldDef list straight to `useTableSchema`
   (built-in vs custom is a load-time concern, not a prop split).
3. Wire the persisted `record_id` FieldDef; the renderer's
   `field_key === "record_id"` pinning rule (from Phase 2) handles
   the rest.
4. View-state persistence flows through the existing
   `useProjectTableViewState` hook.

### P4.3 Catalog table coordination

- Confirm with the catalog rollout PRD that the FieldDef registry
  lives in the catalog's relational storage (or in the catalog
  body, if the rollout PRD opts to mirror the project-document
  shape).
- Confirm catalog uniqueness validator removal timing.
- Confirm `record_id` `display_name` conventions for catalog rows
  ("Name" for all three, by current default).

### P4.4 Docs

- `context/user-stories/30-tables-equipment.md`: acceptance criteria
  for each new table page lands here.
- `context/user-stories/20-envelope.md`: Thermal Bridges + Window
  Types pages get acceptance criteria updates.
- `context/technical-requirements/data-model.md §6.6`: enumerate
  the custom-field-capable tables and their `TableFieldRegistry`
  modules.

## P5. Evaluation Method

For each table (per-table evaluation):

- **Module-load assertion fires** on a tampered seed.
- **Validator rejects** documents with zero or many `record_id`
  entries.
- **Lock-list-driven UX:** modal opens for each built-in, with the
  right sections enabled / disabled.
- **`record_id` rendering:** header label shows the per-feature
  `display_name`; pinning works; duplicate-warning chip works.
- **Upgrade pass:** loading an existing project body without the
  new table's FieldDef registry triggers the upgrade; the resulting
  body validates under the new schema version.
- **Playwright smoke per table:** open the table, edit a cell, save,
  reload, confirm persistence.

For catalog tables (additional checks):

- **Refresh-from-catalog works** on locked-type fields.
- **Refresh-from-catalog skips** any mutable-type fields per Phase
  3's rule (should be zero such fields if the lock policy is right).

## P6. Success Criteria (Gating)

Phase 4 is "done" when **every** custom-field-capable table in v1
ships with:

1. A `TableFieldRegistry` instance with a complete seed FieldDef list.
2. A `record_id` FieldDef with `display_name`, lock policy, and (where
   applicable) a default formula.
3. A module-load assertion in the contract module.
4. A per-table upgrade function (schema-version bump) that runs
   cleanly against existing project bodies.
5. A `<DataTable>` consumer page that surfaces the table to the
   user.
6. Acceptance criteria in the relevant user-story doc.
7. Tests covering the assertion, the validator, the upgrade pass,
   and a Playwright smoke.

**Per-table sign-off** is the gate. The phase is rolled out
incrementally as each table lands; there is no single "Phase 4
done" moment.

Catalog tables specifically are blocked on the catalog rollout PRD;
Phase 4's catalog work is staged to coordinate with that PRD's merge
window.

## P7. Risks & Mitigations

- **Risk:** A new table ships without `record_id` because the
  feature author forgot.
  - **Mitigation:** module-load assertion fires at import time, not
    at first user save. Catches the omission in CI.
- **Risk:** Catalog rollout PRD merges before Phase 4's catalog
  seeds, or vice versa, leaving the catalog tables in a partial
  state.
  - **Mitigation:** Phase 4's catalog workstream merges
    *concurrently* with the catalog rollout PRD's first phase.
    Don't pre-stage the lock-list authoring on a branch that the
    catalog rollout will rebase over.
- **Risk:** Window-Types' grid-style element editor and its
  top-level FieldDef registry get conflated.
  - **Mitigation:** the FieldDef registry is for the top-level
    window-types table only (one row per type). The element editor
    stays its own component. Document the distinction in the
    Window-Types user story.
- **Risk:** Per-table upgrade functions multiply schema-version
  bumps faster than the existing schema-version-evolution machinery
  can absorb.
  - **Mitigation:** the upgrade pass is small and isolated per
    table. Batch multiple per-table upgrades into one
    schema-version bump if they land in the same merge window.
    Coordinate version numbers explicitly.

## P8. Out-Of-Band Considerations

- Phase 4 is the longest-running phase in calendar time; it stays
  open until every v1 table is on the unified model.
- Coordination with the catalog rollout PRD is the primary blocker
  for catalog tables. Phase 4's project-document tables can land
  earlier.
- Future v1.1 equipment catalogs (Heat Pumps, Boilers, etc.) reuse
  Phase 4's pattern but land with their own catalog rollouts.

## P9. Follow-Ups Out Of This Phase

- Phase 5 (optional polish) becomes relevant after Phase 4 has
  rolled out enough tables that the visual / UX polish would
  benefit many surfaces at once.
- A future plan may revisit the lock policy uniformly across tables
  once a year or so of usage shows which locks are too tight and
  which are too loose. Out of scope here.
