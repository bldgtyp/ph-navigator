---
DATE: 2026-05-26
TIME: 15:30 ET
STATUS: PHASE PLAN — depends on PRD acceptance
        (`docs/plans/2026-05-26/plan-31-customizable-fields-prd.md`).
        First phase in the rollout. Ships *no* wire-format change.
AUTHOR: Claude (Opus 4.7)
SCOPE: Introduce the per-attribute lock-list model on `FieldDef`,
       migrate every consumer from `read_only_schema` to lock-list
       checks, add the header double-click trigger that opens the
       FieldConfigModal for any field (built-in or custom), and
       reserve the `"record_id"` field_key namespace at the backend
       boundary. No `TableFieldDef`, no row-model reshape, no
       persistence change. The user-visible win: built-in fields with
       the right unlocked attributes become editable through the
       existing modal.
RELATED:
  - docs/plans/2026-05-26/plan-31-customizable-fields-prd.md (master PRD)
  - docs/plans/2026-05-26/plan-30-datatable-identifier-column.md
  - context/technical-requirements/data-table.md
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/components/ColumnHeaderMenu.tsx
  - frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx
  - frontend/src/features/equipment/lib.ts
  - frontend/src/features/equipment/lib/roomsFormulaRegistry.ts
  - frontend/src/features/equipment/routes/EquipmentPage.tsx
  - frontend/src/features/assets/components/AttachmentRowsTable.tsx
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/mutations/models.py
---

# Plan 31 — Phase 1a — Lock Model On FieldDef

## P0. Phase Intent

Replace the binary `FieldDef.read_only_schema` flag with a per-attribute
`locked: FieldLockKey[]` array. Wire every consumer (renderer, header
menu, modal sections) to consult the lock list per attribute. Let
built-in fields open the field-config modal with the appropriate
sections disabled. **Zero wire-format change.** Built-in FieldDefs
still live in feature code only; custom fields still flow through
the existing `CustomFieldDef` path.

This is the smallest user-visible step that delivers most of M1 / M2
from the PRD (one config model for built-in + custom; per-attribute
locks). It also bakes the `"record_id"` slug guard early so the Phase 2
rollout cannot trip on a custom field whose advisory slug happens to
collide.

## P1. Preconditions

- Master PRD `plan-31-customizable-fields-prd.md` accepted.
- Q-F1, Q-F4, Q-F5, Q-F7, Q-F8, Q-F9, Q-F10 confirmed (they are
  marked resolved in the PRD; no further user input needed).
- Phase 0 baseline: green test suite, no in-flight refactors of
  `useTableSchema`, `FieldConfigModal`, or the header components.

## P2. Scope

### P2.1 In scope

1. Add `locked?: ReadonlyArray<FieldLockKey>` to `FieldDef`
   (`frontend/src/shared/ui/data-table/types.ts`) plus the
   `FieldLockKey` union (`"display_name"` | `"field_type"` |
   `"options"` | `"default"` | `"description"` | `"formula"` |
   `"delete"` | `"duplicate"`).
2. Per-feature seed FieldDef lists declare their own `locked` arrays
   per PRD §P5.0 / §P5.1 / §P5.2. Notable updates:
   - Rooms (`roomsTableFieldDefs` in `features/equipment/lib.ts`).
   - Pumps (`pumpsTableFieldDefs`).
   - Pumps' `datasheet` attachment FieldDef inherits the all-locked
     attachment policy from PRD §P5.5.
   - Catalog-table FieldDefs in `EquipmentPage.tsx` and
     `AttachmentRowsTable.tsx`.
3. `useTableSchema` stops stamping `read_only_schema: true` on core
   seeds. The caller's seed is passed through verbatim; lock-list
   resolution happens in consumers.
4. Modal-opener and header-menu consumers switch from
   `fieldDef.read_only_schema` checks to lock-list checks:
   - `DataTable.tsx` (the modal `source` selector at ~line 994
     stops short-circuiting on `read_only_schema`).
   - `ColumnHeaderMenu.tsx` (`showEditField` rule).
   - `HeaderContextMenu.tsx` (`isCustomField` rule + per-action
     visibility).
   - `GridHeader.tsx` (`isCustomField` + `schemaLocked` rules).
   - `FieldConfigModal.tsx` (open-condition + per-section disable).
5. Each `FieldConfigSection*` component (`FieldConfigSectionTypeChange`,
   `FieldConfigSectionOptions`, `FieldConfigSectionFormula`,
   `FieldConfigSectionNumber`) reads the relevant lock keys and
   disables its inputs accordingly. Locked sections render with the
   uniform "Field Locked" tooltip per Q-F5.
6. Add the header double-click trigger that opens the same modal as
   the right-click "Edit field" item. The double-click target is the
   header cell, not the resize handle.
7. Reserve `"record_id"` as a forbidden custom-field `field_key` slug:
   backend `CustomFieldDef` validator + `AddFieldMutation` /
   `DuplicateFieldMutation` reject incoming writes whose
   `field_key` (or advisory slug) is `"record_id"`. This guard ships
   even though Phase 2 has not yet added the reserved field.
8. Delete `FieldDef.read_only_schema` and every reference. This is a
   full cleanup, not a deprecation period.

### P2.2 Out of scope (deferred to later phases)

- Persisting built-in FieldDefs in the document → Phase 1b.
- `TableFieldDef` Pydantic model → Phase 1b.
- Schema-version bump → Phase 1b.
- Row-model reshape (`RoomRow.num_people` → `custom_values`) → Phase 1b.
- Adding `record_id` as an actual FieldDef on Rooms / Pumps → Phase 2.
- Deleting `IdentifierConfig`, `IDENTIFIER_COLUMN_ID`,
  `IDENTIFIER_HEADER_LABEL`, `resolve.ts` synthetic branch → Phase 2.
- User-driven `field_type` changes on built-in fields → Phase 3
  (locked everywhere in Phase 1a regardless of lock-list contents,
  since the wire format hasn't been reshaped yet).
- Conversion-matrix extension for `formula` → Phase 3.

## P3. Rules & Constraints

1. **No wire-format change.** `ProjectDocumentV1` JSON shape, the
   `custom_fields` envelope, and every row model are byte-identical
   before and after Phase 1a (apart from the `record_id`-slug
   rejection rule, which is a stricter validator on a previously-
   loose field).
2. **`FieldDef.locked` is not persisted.** It's a frontend-only
   field, layered onto each FieldDef by the seed code or by
   `useTableSchema`. The backend never sees `locked` on the wire.
3. **All built-in `field_type` changes remain blocked in Phase 1a.**
   Even if a seed declares `field_type` unlocked, the modal's type
   picker stays disabled in Phase 1a — because the value-storage
   path (typed Pydantic columns vs `custom_values`) has not yet
   been reshaped. The phase implementation enforces this with a
   hard rule in the type-picker component: "Phase 1a — type-change
   on built-in fields disabled regardless of lock-list." Phase 3
   removes this rule.
4. **Header label rendering rules are unchanged.** Pinned identifier
   column still goes through the Plan-30 `IdentifierConfig` path;
   the universal `"Record-ID"` label and the synthetic
   `__record_id__` column still exist. Phase 2 retires them.
5. **No new audit-log kinds.** Built-in fields cannot yet take
   schema mutations through the existing pipeline (Phase 1b /
   Phase 3); the audit-log naming reshape lands with those phases.
6. **`FieldDef.read_only` is untouched.** That's a cell-value
   read-only flag, not a schema-lock flag. Don't conflate.
7. **Attachment FieldDefs ship the all-locked array** per PRD §P5.5.
   The modal opens for attachment fields but every section is
   disabled; the type picker excludes `"attachment"` / `"argb_color"`.
8. **The custom-field add / duplicate / change-type paths cannot
   land a `field_key: "record_id"` even when the user types it as
   the display name's slug equivalent.** The backend rejects on
   write; the frontend rejects on submit with a uniform error.

## P4. Workstreams

### P4.1 Type-level changes

- Add `FieldLockKey` union + `FieldDef.locked` slot in
  `data-table/types.ts`.
- Export `FieldLockKey` from `data-table/index.ts`.
- Add a small helper module (e.g. `data-table/lib/locks.ts`) with
  `isAttributeLocked(fieldDef, key) → boolean` to keep the
  per-consumer check noise-free.

### P4.2 Seed updates

- Rewrite `roomsTableFieldDefs` to declare per-field `locked` arrays
  matching PRD §P5.1 (even though Phase 1a enforces no `field_type`
  changes, the seed shape should be the final shape — Phase 3 just
  removes the type-picker hard rule).
- Same for `pumpsTableFieldDefs`.
- Same for the catalog stub FieldDefs in `EquipmentPage.tsx` and
  `AttachmentRowsTable.tsx`.
- Built-in seeds default to `["delete", "duplicate"]` per PRD §P5.0
  unless the field has stronger locks.

### P4.3 Consumer migration (each switches from
        `read_only_schema` to lock-list)

- `DataTable.tsx` (modal source filter).
- `ColumnHeaderMenu.tsx`.
- `HeaderContextMenu.tsx`.
- `GridHeader.tsx`.
- `FieldConfigModal.tsx` (open-condition; the existing R-S1 / R-S2 /
  R-S3 concurrency guards continue to work — they key off `fieldDef`
  identity, not the lock list).
- Every `FieldConfigSection*` component for per-section disable.
- `buildRoomsFormulaRegistry` (`features/equipment/lib/roomsFormulaRegistry.ts`)
  drops the `origin: "core"` short-circuit; built-in vs custom is
  derived from where the FieldDef came from (a feature-author hint),
  not from `read_only_schema`. Concretely: the registry still tags
  entries as `"core" | "custom"` but the input becomes the seed-level
  intent (e.g. a `built_in: true` boolean on the FieldDef, *or* a
  caller-side filter), not the absent `read_only_schema` flag.

### P4.4 Header double-click trigger

- Wire double-click on the header cell (excluding the resize handle,
  which already has fit-to-content behavior) to open the same modal
  the right-click "Edit field" action opens.
- Preserve focus-restoration on close (existing `returnFocusTo`
  contract).

### P4.5 Backend `"record_id"` slug guard

- Update `CustomFieldDef` validator (or the wrapping mutations'
  validators) to reject `field_key == "record_id"` on
  `AddFieldMutation` / `DuplicateFieldMutation` / any other path
  that lets the caller specify `field_key`.
- Tests cover REST + MCP write paths.
- Add the same guard on the advisory slug (`CustomFieldDef.field_key`)
  even though no UI sets it today — defensive depth.

### P4.6 Deletion / cleanup pass

Files to scrub for `read_only_schema`:
- `frontend/src/shared/ui/data-table/types.ts` — slot removed.
- `frontend/src/shared/ui/data-table/hooks/useTableSchema.ts` —
  remove the `read_only_schema: true` stamping pass.
- `frontend/src/shared/ui/data-table/DataTable.tsx`.
- `frontend/src/shared/ui/data-table/components/ColumnHeaderMenu.tsx`.
- `frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`.
- `frontend/src/shared/ui/data-table/components/GridHeader.tsx`.
- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`.
- `frontend/src/shared/ui/data-table/lib/identifier/resolve.ts`
  (drop `read_only_schema: true` from the synthetic identifier
  FieldDef; the synthetic column itself stays until Phase 2).
- `frontend/src/features/equipment/lib.ts` (Pumps' datasheet
  FieldDef switches to a full `locked` array).
- `frontend/src/features/equipment/lib/roomsFormulaRegistry.ts`.
- `frontend/src/features/equipment/routes/EquipmentPage.tsx`.
- `frontend/src/features/assets/components/AttachmentRowsTable.tsx`.
- All `__tests__/*.test.ts(x)` files that build fixtures with
  `read_only_schema: true`.

CSS / styling tokens — `--phn-header-border-locked` in
`styles/tokens.css` should still apply when *any* lock is present on
a field. The comment in `tokens.css` is updated; the token name
stays for backward compatibility within the codebase.

## P5. Evaluation Method

- **Type check** — `make typecheck` (or `pnpm run typecheck`) clean
  after the migration.
- **Unit tests** — every existing test that previously asserted
  `read_only_schema: true` rewrites to assert the equivalent lock
  array.
- **New unit tests:**
  - `data-table.locks.test.ts`: for each `FieldLockKey`, verify the
    relevant modal section / header item / context menu respects the
    lock.
  - `data-table.headerDoubleClick.test.tsx`: double-click opens the
    modal on built-in *and* custom field headers.
  - `data-table.modalOpensForBuiltIn.test.tsx`: built-in fields with
    a non-restrictive lock list open the modal and expose the right
    enabled / disabled sections.
  - `customFields.recordIdSlugGuard.test.py`: backend rejects
    `addField` / `duplicateField` with `field_key: "record_id"`.
- **Playwright (webapp-testing MCP) smoke:**
  - Open Rooms page. Right-click on the "Name" header → "Edit
    field." Modal opens. Display name input enabled; type picker
    disabled (Phase 1a hard rule); delete button hidden.
  - Double-click on the "Name" header. Same modal opens.
  - Open a custom field's modal (the existing flow). Behaviour is
    unchanged from today.
- **Regression check:** every test that exercises the identifier
  column (`identifier.test.ts`, `columnHeaderDoubleClick.test.tsx`)
  passes without modification — Phase 1a does not touch identifier
  rendering.

## P6. Success Criteria (Gating)

Phase 1a is done when **all** of the following are true:

1. `FieldDef.read_only_schema` does not exist in any source file
   under `frontend/src/` (excluding superseded test fixtures, which
   are migrated).
2. `FieldDef.locked` is the sole signal consulted by header menus,
   modal sections, and the modal's open condition.
3. Both right-click and double-click on a header open the same
   FieldConfigModal for built-in *and* custom fields.
4. On a Rooms project, a user can:
   - Open the modal on `Number` (a built-in text field, default
     locks `["delete", "duplicate"]`).
   - Edit and save its `display_name`.
   - Re-open the modal and see the updated display name.
   - Confirm the type picker is *disabled* (Phase 1a hard rule —
     unlocks in Phase 3).
   - Confirm delete and duplicate buttons are hidden.
5. On a Rooms project, the user opens the modal on `iCFA` (locked
   `field_type`). The display-name input is enabled; the type
   picker is disabled with the "Field Locked" tooltip.
6. On a Pumps project, the modal opens on the `datasheet` attachment
   FieldDef with every section disabled.
7. Backend rejects an MCP / REST `addField` mutation whose
   `field_key == "record_id"` with a structured error.
8. The test suite passes; `make typecheck` clean; Playwright smoke
   green.
9. No new audit-log kinds, no schema-version bump, no
   `ProjectDocumentV1` change. `git diff` against `backend/features/
   project_document/document.py` shows no shape change.

## P7. Risks & Mitigations

- **Risk:** A consumer is missed in the `read_only_schema` migration
  and silently breaks (e.g. the field-config modal short-circuits
  on a flag that no longer exists, so it just opens unconditionally
  on a built-in field whose author hasn't yet declared locks).
  - **Mitigation:** delete `FieldDef.read_only_schema` from the
    type itself so the TypeScript compiler flags every site.
- **Risk:** A built-in field author forgets `"delete"` /
  `"duplicate"` in the lock array, allowing the user to delete or
  duplicate a built-in field.
  - **Mitigation:** add a runtime assertion in development mode:
    when seeding a built-in FieldDef (e.g. one that comes from
    `roomsTableFieldDefs` / `pumpsTableFieldDefs`), assert
    `"delete"` and `"duplicate"` are present. Production code path
    can skip the assertion.
- **Risk:** The header double-click conflicts with the existing
  resize-handle double-click for fit-to-content.
  - **Mitigation:** the resize handle already owns its own
    `data-resize-handle` element; the new listener fires only on
    the header label area, not the handle. Cover with a Playwright
    test that double-clicks the handle (fit-to-content) and the
    label (modal-open) separately.
- **Risk:** The R-S2 external-edit re-derivation under a redeploy
  drops user draft text.
  - **Mitigation:** locks aren't part of the seeded `source`
    snapshot the modal uses for diffing — they're a render-time
    overlay. User's draft text is unaffected by a lock-list change.
    Add a Vitest test that simulates this.

## P8. Out-Of-Band Considerations

- `context/technical-requirements/data-table.md` mentions
  `read_only_schema` in the FieldDef sketch (around line 113) and
  the lock-glyph token in "Layout, Styling, And Accessibility."
  Update those references as part of Phase 1a so the document
  matches the shipped code.
- `context/UI_UX.md §1.7` references the header context menu. The
  double-click trigger is a *new* user-facing affordance — note it
  in the UX doc as part of Phase 1a, or call out a follow-up pass
  in P9.

## P9. Follow-Ups Out Of This Phase

- `context/UI_UX.md §1.7` update (header double-click is a new
  affordance) — small, can ride with Phase 1a or defer to Phase 5.
- Lock-list documentation in the data-table technical-requirements
  doc — updates to `context/technical-requirements/data-table.md`
  to describe the lock model. Lands in Phase 1a.
