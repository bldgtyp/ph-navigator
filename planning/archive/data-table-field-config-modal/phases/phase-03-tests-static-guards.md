---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Shared tests and static guardrails
RELATED: planning/archive/data-table-field-config-modal/references.md
---

# Phase 03 - Tests And Static Guards

## Goal

Update regression coverage so it protects the shared dropdown behavior and
prevents the old pill/label modal from creeping back in.

## Unit Test Updates

### `FieldConfigModal.test.tsx`

Replace radiogroup/radio assertions with combobox/select assertions:

- type picker hidden when `sourceCustomFieldType` is omitted;
- type picker renders with current type selected;
- forbidden conversion target cannot be selected;
- selecting an allowed target mounts the type-change preflight;
- reverting to the source type unmounts preflight;
- clean type-change save emits the same payload as before;
- incompatible type-change save still requires acknowledgement;
- single-select, number, formula, and linked-record type-specific sections
  still mount correctly.

### `FieldConfigModal.locks.test.tsx`

Update lock tests from `querySelectorAll("button")` to the new select
contract:

- `field_type` lock disables the type control;
- other locks do not disable unrelated controls;
- locked options/config sections still behave as before.

### `CreateFieldConfigModal.test.tsx`

Replace `clickPill(...)` with a helper such as `chooseFieldType(...)`.

Keep existing payload coverage:

- default `short_text`;
- long text and URL;
- number precision;
- optional description;
- single-select options/defaults;
- formula config;
- linked-record target/cardinality.

## Static Guard Commands

Run after implementation:

```bash
rg -n "data-table-field-config-modal-title|data-table-add-field-label|data-table-add-field-type-row|data-table-add-field-type-pill" frontend/src
```

Expected: no matches.

```bash
rg -n "role=\"radiogroup\"|role=\"radio\"|clickPill|data-table-add-field-type-pill" frontend/src/shared/ui/data-table frontend/src/features --glob '*test*'
```

Expected: no old type-picker tests.

```bash
rg -n "FieldConfigModal|CreateFieldConfigModal" frontend/src --glob '!**/__tests__/**'
```

Expected: shared DATA-TABLE definitions/imports only; no feature route
instantiates either modal.

## Focused Test Command

```bash
cd frontend && pnpm exec vitest run \
  src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx \
  src/shared/ui/data-table/__tests__/FieldConfigModal.locks.test.tsx \
  src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx
```

## Acceptance Criteria

- Focused shared DATA-TABLE modal tests pass.
- Static guards prove retired class names and old pill tests are gone.
- Feature-local tests are only changed if they assert shared modal internals.

## Completion Notes

Completed 2026-06-20 08:47 EDT.

- Confirmed Phase 01 test updates cover the shared dropdown behavior for Add
  Field and Edit Field flows.
- Confirmed Phase 02 cleanup removed the retired visible-title, label, and
  type-pill class hooks.
- Tightened one feature-local Rooms comment so the modal ownership guard
  reports only shared DATA-TABLE files.

## Verification

```bash
rg -n "data-table-field-config-modal-title|data-table-add-field-label|data-table-add-field-type-row|data-table-add-field-type-pill" frontend/src
rg -n "role=\"radiogroup\"|role=\"radio\"|clickPill|data-table-add-field-type-pill" frontend/src/shared/ui/data-table frontend/src/features --glob '*test*'
rg -n "FieldConfigModal|CreateFieldConfigModal" frontend/src --glob '!**/__tests__/**'
cd frontend && pnpm exec vitest run \
  src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx \
  src/shared/ui/data-table/__tests__/FieldConfigModal.locks.test.tsx \
  src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx \
  src/features/equipment/__tests__/RoomsTable.customFieldsPhase4.test.tsx
```

Result:

- Retired class search: no matches.
- Old pill/radio test search: no matches.
- Modal ownership search: shared DATA-TABLE imports, mounts, definitions, and
  one shared type-change-section comment only.
- Focused modal plus affected Rooms consumer tests: 4 files passed, 67 tests
  passed.
