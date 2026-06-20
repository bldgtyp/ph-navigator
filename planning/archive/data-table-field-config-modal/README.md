---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Shared DATA-TABLE Field Config modal visual refactor
RELATED: context/technical-requirements/data-table.md, context/UI_UX.md, frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx, frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx, frontend/src/shared/ui/data-table/DataTable.css
---

# DATA-TABLE Field Config Modal Refactor

## Scope

Refactor the shared DATA-TABLE field configuration modal toward Airtable
parity: remove the visible modal title and repeated uppercase labels,
replace the field-type pill array with one select-style control, and
demote the type-change preflight block into secondary information.

This is a parent-level DATA-TABLE change. No page, route, or feature table
gets to roll its own modal or styling fork.

## Read Order

1. `PRD.md` - behavior and visual contract.
2. `STATUS.md` - current state, next step, verification.
3. `PLAN.md` - phase map and sequencing.
4. `references.md` - source/test inventory and guardrails.
5. `phases/phase-01-field-type-select.md` - shared dropdown component.
6. `phases/phase-02-modal-markup-css.md` - modal DOM and CSS cleanup.
7. `phases/phase-03-tests-static-guards.md` - shared test updates.
8. `phases/phase-04-browser-closeout.md` - consumer smoke and closeout.

## Current Shared Ownership

- `frontend/src/shared/ui/data-table/DataTable.tsx` mounts both shared
  modal flows:
  - `CreateFieldConfigModal` for add-field.
  - `FieldConfigModal` for edit-field.
- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
  owns the edit modal state, type-change preflight, and field save bundle.
- `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
  owns the add modal draft state.
- `frontend/src/shared/ui/data-table/DataTable.css` owns the current modal,
  label, pill, and preflight styling.

No route-local Field Config modal implementation was found outside the
shared DATA-TABLE package. Feature consumers pass table context into
`DataTable`; the shared modal renders from there.

## Archive Status

Completed 2026-06-20 and archived after all phases passed focused tests,
static guards, browser smoke on Spaces / Rooms, `make frontend-dev-check`,
`make format`, `make ci`, and `graphify update .`.
