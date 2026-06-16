---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Consolidate every project DataTable page (Rooms, Equipment/*,
  Heat Pumps, Thermal Bridges) onto the shared data-table system so
  rendering and behavior are consistent across all tables, and close the
  backend data-shape/validation gaps the consistency review found.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/refactor/data-table-consolidation/PLAN.md
  - planning/refactor/data-table-consolidation/STATUS.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - context/CODING_STANDARDS.md
  - frontend/src/shared/ui/data-table/
  - backend/features/project_document/
  - backend/features/heat_pumps/
---

# DataTable Consolidation - Refactor Folder

## Scope

Bring every project DataTable page onto the shared `data-table` system
so that single-select pills, link / linked-record fields, attachment
cells, row-edit modals, and identifier columns look and behave
identically across **all** tables, and so the backend validates every
table's data-shape through one path.

The driver is the 2026-06-16 consistency review
(`planning/code-reviews/2026-06-16/data-table-consistency-review.md`),
which traced the inconsistency the owner observed to two root causes:

1. **Heat Pumps forked the whole stack** (its own controller, view-state
   hook, single-select editor, row modals, inverse-link column, and a
   bespoke JSON-Patch backend), so it renders and validates differently
   and cannot get custom fields / locks / formulas.
2. **The shared cells are not exported** from `shared/ui/data-table`, so
   ~9 tables copy-paste render helpers, several of them dead code.

Everything else (duplicate modals, three inverse-link implementations,
two identifier-column shapes, data-shape drift, and the backend
god-validator) is a symptom of those two causes or of sibling
copy-paste drift.

## Depends On

This refactor is **preceded** by the record-identity-model refactor
(`planning/refactor/record-identity-model/`), which settles the
identifier model: the hidden `row.id` is the only enforced-unique
identity, the pinned user-facing column is a non-unique **Display Name**
label, and **Tag** is an ordinary field. Land that first. This refactor's
Phase 02 (identifier-column helper) and Phase 04 (uniqueness
reconciliation, review B3) **inherit** that model rather than re-deciding
it.

## Read Order

1. `PRD.md` - problem, target state, and acceptance criteria.
2. `PLAN.md` - sequencing, precedents, and cross-cutting risks.
3. `STATUS.md` - current state and next action.
4. Phase files under `phases/` when implementing.

## Phase Map

| Phase | File | Goal |
|---|---|---|
| 00 | `phases/phase-00-frontend-subtraction.md` | Export the shared single-select cell, delete dead per-table render code, and fix the safe naming/typo/shadow defects. Behavior-preserving. |
| 01 | `phases/phase-01-backend-validation-hardening.md` | Close the backend validation gaps: attachment asset-id references, heat-pump option-id references, and numeric range checks. |
| 02 | `phases/phase-02-shared-column-builders.md` | Extract shared column/cell building blocks (link cell, attachment column, identifier column, width constants, number-input helpers) and adopt them across tables. |
| 03 | `phases/phase-03-shared-row-modal-and-links.md` | Unify the row-edit modals into one shared modal/hook and unify linked-record / inverse-link rendering across Pumps, Ventilators, and Heat Pumps. |
| 04 | `phases/phase-04-data-shape-and-backend-symmetry.md` | Reconcile data-shapes (`inside_outside`, `phase`), the identifier-uniqueness rule, dual contracts, the god-method validator, and orphaned config. |
| 05 | `phases/phase-05-heat-pumps-on-shared-abstraction.md` | Bring Heat Pumps onto the shared controller / shell / `TableContract` path (design spike + implementation), unlocking custom fields and uniform validation. |
| 06 | `phases/phase-06-verification-docs-closeout.md` | Run gates, browser smoke, and fold durable decisions into context docs. |

## Current Assumptions

- The shared `data-table` package is the canonical system. The fix is to
  **use it more**, not to redesign it. Phases that touch
  `shared/ui/data-table/` only add exports or small shared helpers.
- Rooms, the 7 equipment tabs, and Thermal Bridges are structurally
  conformant today (shared shell + controller + `tableSchema`). Their
  divergence is concentrated in per-table column/render code and the
  optional row modal.
- Heat Pumps is the structural outlier and the largest single item; it
  is sequenced last (Phase 05) so all shared building blocks exist
  before it is migrated.
- Phases 00-04 are independently shippable. Phase 01 (backend) can run
  in parallel with the early frontend phases.
- No V1 (`../ph-navigator/`) changes. This is a V2-only refactor.

## Out Of Scope

- Adding new table features, columns, or field types beyond what is
  needed to remove a divergence.
- Redesigning the shared grid interaction model, view-state model, or
  the `FieldSchemaMutation` contract.
- Migrating non-table surfaces (Climate's static `.climate-table`
  report, catalog pages) onto the interactive DataTable.
- Net-new product behavior on Heat Pumps beyond reaching parity with
  the shared abstraction.
