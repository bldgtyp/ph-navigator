# STATUS — spaces-ventilator-link

**State:** ✅ Complete — implemented, verified, and archived.

**Ask:** SPACES / ROOMS records need a **built-in link field to a VENTILATORS
record** so each room is associated with the specific ventilator that serves it.
This is a built-in relationship needed on essentially every project — not a
per-project custom column. See `README.md` for why and the open questions.

**Decisions:** single ventilator per room; built-in `linked_record` field on
Rooms targeting `["equipment", "ervs"]`; room-side picker/pills; ventilator-side
inverse room visibility; deleting a ventilator clears referencing Rooms links.

## Checklist

- [x] Document the need (this folder).
- [x] Decide cardinality: one ventilator per room vs. multiple.
- [x] Decide field type / UI: room-side picker of VENTILATORS records vs. a
      reusable cross-table reference-field pattern.
- [x] Decide directionality: one-way room→ventilator link, or ventilator-side
      rollup of served rooms (+ aggregate airflow).
- [x] Decide delete/orphan policy when a linked ventilator is removed.
- [x] Data-model change: built-in room field + reference storage.
- [x] Built-in field wiring (ships for every project).
- [x] UI / data-entry.

## Phase status

- Phase 01 — Complete.
- Phase 02 — Complete.

## Phase 01 evidence

- Backend: `cd backend && uv run pytest tests/test_project_document_space_types.py tests/test_project_document_inverse_view.py` — 23 passed.
- Backend lint/type: `cd backend && uv run ruff check features/project_document/tables/ventilators.py features/project_document/tables/rooms.py tests/test_project_document_space_types.py tests/test_project_document_inverse_view.py` — passed; `cd backend && uv run ty check features/project_document/tables/ventilators.py features/project_document/tables/rooms.py tests/test_project_document_space_types.py tests/test_project_document_inverse_view.py` — passed.
- Frontend: `cd frontend && pnpm vitest run src/features/equipment/lib.test.ts src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx` — 88 passed.
- Frontend after simplify: `cd frontend && pnpm vitest run src/features/equipment/lib.test.ts src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx src/features/spaces/__tests__/SpaceTypesTable.test.tsx` — 92 passed.
- Frontend typecheck: `cd frontend && pnpm exec tsc --noEmit` — passed.
- Whitespace: `git diff --check` — passed.
- Simplify pass: extracted shared frontend inverse-link helpers into
  `frontend/src/features/equipment/lib/inverseSource.ts`, reused them from
  Pumps/Ventilators/Space-Types, gated Ventilators inverse editing to Rooms
  sources, and extracted backend `custom_links` delete-cascade cleanup into
  `backend/features/project_document/tables/custom_link_cascade.py`.
