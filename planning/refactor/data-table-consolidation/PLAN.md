---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Active - phased implementation plan
AUTHOR: Ed (via Claude)
SCOPE: Implementation sequence, precedents, and cross-cutting risks for
  the DataTable consolidation refactor.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/refactor/data-table-consolidation/phases/phase-00-frontend-subtraction.md
  - planning/refactor/data-table-consolidation/phases/phase-01-backend-validation-hardening.md
  - planning/refactor/data-table-consolidation/phases/phase-02-shared-column-builders.md
  - planning/refactor/data-table-consolidation/phases/phase-03-shared-row-modal-and-links.md
  - planning/refactor/data-table-consolidation/phases/phase-04-data-shape-and-backend-symmetry.md
  - planning/refactor/data-table-consolidation/phases/phase-05-heat-pumps-on-shared-abstraction.md
  - planning/refactor/data-table-consolidation/phases/phase-06-verification-docs-closeout.md
---

# DataTable Consolidation - Plan

## Existing Precedents

- The shared system lives in `frontend/src/shared/ui/data-table/`:
  `DataTable.tsx` (headless grid), `index.ts` (public surface),
  `feature/` (`useSliceTableController` + `<SliceTableShell>`), `fields/`
  (registry + `linkedRecord` + `lookup`), and per-field cells under
  `components/` (`SingleSelectCell`, `LinkedRecordCell`, `LookupCell`,
  `ColorCell`).
- The render-dispatch contract is in
  `frontend/src/shared/ui/data-table/components/GridBody.tsx:523-549`:
  the grid renders `color` / `single_select` / `lookup` / `linked_record`
  through the shared cell **before** the column's custom `render`
  fallback. This is why per-table single-select renders are dead code.
- The canonical conformant page is Rooms:
  `frontend/src/features/equipment/components/RoomsTable.tsx`
  (`computedFieldColumnDef` identifier at `:96`), `RoomsTableSlot.tsx`,
  `lib/roomsController.ts`, `lib/useRoomsSliceWiring.ts`.
- The 7 equipment tabs share one shell + one controller-per-table owned
  by `frontend/src/features/equipment/routes/EquipmentPageBody.tsx`
  (controllers `:250-:367`, shell `:549`).
- Heat Pumps is the outlier:
  `frontend/src/features/equipment/heat-pumps/` (the four `*Table.tsx`,
  `*-columns.tsx`, `*RowModal.tsx`, `useHeatPumpTableViewState.ts`,
  `OptionPicker.tsx`, `link-fields.ts`, `routes/HeatPumpsPanel.tsx`).
- Backend generic tables: `backend/features/project_document/` -
  one document validator (`document.py`,
  `validate_document_references`), one generic slice replace
  (`drafts.py`), one schema-mutation path (`mutations/dispatcher.py`),
  driven by `tables/registry.py` `TableContract`s. Inverse-link engine in
  `inverse_view.py`.
- Backend Heat Pumps: a separate feature
  `backend/features/heat_pumps/` with JSON-Patch routes and a service
  that collapses model/service layers.
- Asset policy is declared in `backend/features/assets/registry.py`
  (`ATTACHMENT_FIELDS`) but is not enforced when ids land in the
  document.
- The spaces-refactor packet
  (`planning/features/spaces-refactor/`) is the structural template for
  this folder and a live example of adding a generic table contract +
  linked-record field.

## Implementation Strategy

Sequence by **risk and dependency**, lowest-risk first, so each phase is
independently verifiable and the largest item (Heat Pumps) lands only
after every shared building block it needs exists.

1. **Phase 00 - Frontend subtraction.** Behavior-preserving. Export the
   shared single-select cell, delete the 9 dead `optionPill` renders and
   copies, and fix the safe defects (dead className, typo, Pumps
   datasheet header, the `setCustomValue` shadow). This proves the shared
   cell is the single source of truth and shrinks the surface before any
   structural change.
2. **Phase 01 - Backend validation hardening.** Independent of the
   frontend phases; high severity. Validate attachment asset-id
   references, heat-pump option-id references, and numeric ranges. Can
   run in parallel with Phase 00/02.
3. **Phase 02 - Shared column builders.** Extract `LinkCell`/`shortenUrl`,
   the attachment-column builder, the identifier-column helper, named
   width constants, and number-input helpers; adopt across the equipment
   tables and Thermal Bridges.
4. **Phase 03 - Shared row modal + unified links.** Fold Rooms,
   Ventilators, and the heat-pump modals onto one `<RowEditModal>` /
   `useRowEditForm`; make single-select-in-modal use the shared editor;
   unify the linked-record / inverse-link column across Pumps,
   Ventilators, and Heat Pumps.
5. **Phase 04 - Data-shape + backend symmetry.** Reconcile
   `inside_outside` and `phase`, settle the identifier-uniqueness rule,
   remove the dual `equipment_*` contracts, refactor the god-method
   validator to be contract-driven, dedupe the heat-pump invariants, and
   clear the orphaned attachment config.
6. **Phase 05 - Heat Pumps on the shared abstraction.** Design spike
   first (multi-row-type controller vs per-sub-table slice, and the
   custom-field storage question), then migrate frontend
   (controller + slot + shared modal + shared single-select/links) and
   backend (generic contract path), retiring `useHeatPumpTableViewState`
   and `OptionPicker`.
7. **Phase 06 - Verification, docs, closeout.** Full gates, browser
   smoke, `graphify update .`, and fold decisions into `context/`.

Do the frontend subtraction and backend hardening before the structural
extraction so the structural work starts from a smaller, correct base.
Do Heat Pumps last so it can reuse every shared piece the earlier phases
produce.

## Cross-Cutting Risks

1. **Dead code that looks live.** Several per-table `render:` callbacks on
   single-select columns never execute. Removing them is safe, but tests
   that assert on the per-table pill markup may be asserting on the
   shared cell's output already - confirm which renderer the test
   exercises before deleting, and keep coverage on the shared cell.
2. **Persisted FieldDefs and data-shape migrations.** Changing
   `inside_outside` / `phase` storage or field type, or adding custom-
   field support to heat-pump rows, touches saved `project_versions` and
   `project_version_drafts`. Any storage change needs a schema-version
   decision and a migration, exactly as flagged in the spaces-refactor
   plan. Prefer field-type-only changes (no storage move) where they
   resolve the divergence without a migration.
3. **Backend validation tightening can reject existing documents.**
   Enforcing asset-id and option-id references may flag pre-existing
   invalid data in saved drafts. Decide strip-and-warn vs reject-on-write
   (PRD open question 5) and verify against real saved documents before
   enabling on the load path.
4. **Heat-Pump slice shape.** The heat-pump slice carries four row-types
   plus option lists together. The shared controller assumes one
   row-type per slice. The Phase 05 spike must resolve this before any
   migration code is written; do not force-fit.
5. **Public-repo data hygiene.** This repo is public and must never carry
   licensed/PHI-derived data. The asset-reference validation (Phase 01)
   is partly a data-hygiene control (no cross-project asset references);
   write tests with synthetic ids only.
6. **Plan-31 intersection.** Heat Pumps gaining custom fields and locks
   intersects the Plan-31 custom-field/locks work. Confirm Phase 05's
   custom-field path against the current Plan-31 state before building,
   and coordinate so the two efforts do not reshape heat-pump storage
   twice.
7. **CSS namespace rename.** Renaming the `hp-` modal-form classes to a
   neutral namespace touches every modal that borrowed them
   (Ventilator, Room, the four heat-pump modals). Do the rename inside
   the shared-modal phase (03) so the class move and the component move
   happen together.
8. **Test churn vs behavior.** Many tables have `*.reuse.test.tsx` and
   per-table tests. Converging implementations should keep behavior;
   prefer updating tests to assert shared-component behavior rather than
   per-table markup, and keep one regression test per converged element.

## Verification Summary

Each implementation phase runs focused tests for the layers it touches.
Frontend layout-only iterations may use `make frontend-dev-check`; any
change to interaction, state, queries, parsing, or transforms also runs
the focused `cd frontend && pnpm exec vitest run <file>`. Final closeout
(Phase 06) requires:

1. `make format`
2. `make ci`
3. Browser smoke on `http://localhost:5173` with backend
   `http://localhost:8000`, signed in as `codex@example.com`, across
   Rooms, each Equipment tab, each Heat-Pump leaf, and Thermal Bridges.
4. `graphify update .` after code changes.
5. Context docs (`context/technical-requirements/data-table.md`,
   `context/CODING_STANDARDS.md`) updated only after behavior is
   verified.
