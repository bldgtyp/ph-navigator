# Plan 31 Phase 3 Handoff — 2026-05-27

This note preserves the current Plan 31 Phase 3 frontend-bundle state
before branch flattening / squashing. Treat this as the resume pointer
after the current `codex/plan-31-next-frontend-slice` branch is merged
away.

## Current Branch State

- Worktree used for this pass:
  `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2-plan31-next-frontend-slice`
- Branch:
  `codex/plan-31-next-frontend-slice`
- HEAD at handoff:
  `2ecb29f P2.6 rewrite custom fields contract fixture`
- Origin state:
  pushed to `origin/codex/plan-31-next-frontend-slice`
- Working tree at handoff:
  clean

Recent relevant commits on this branch:

- `2ecb29f` — P2.6 rewrite custom fields contract fixture
- `c69844d` — P2.6 rewrite reserved slug guard fixture
- `0ed94ae` — P2.6 rewrite equipment lib fixtures
- `4c41c41` — Simplify P2.6 schema mutation fixtures
- `a9be8dd` — P2.6 rewrite schema mutation fixtures
- Earlier Phase 3 frontend-bundle commits through P2.5 are below those
  on the same branch.

## Source-Of-Truth Docs

Resume from these docs after flattening:

- `docs/plans/2026-05-26/editable-fields/plan-31-customizable-fields-prd.md`
- `docs/plans/2026-05-26/editable-fields/plan-31-phase-3-frontend-bundle.md`
- This handoff note

The bundle plan is still the canonical implementation tracker. This
handoff only records the exact branch-local progress and next steps
before the branch history is rewritten.

## Completed Phase 3 Frontend-Bundle Slices

The branch has already landed the Phase 3 frontend-bundle slices through
P2.5, plus the first P2.6 fixture rewrites.

Completed P2.6 modules:

- `backend/tests/test_project_document_schema_mutations.py`
  - Migrated to `empty_project_document`.
  - Uses `TableFieldDef.field_key`.
  - Asserts `field_defs` / `custom_values`.
  - Verification recorded: `cd backend && uv run pytest
    tests/test_project_document_schema_mutations.py -q` (56 passed) and
    `uv run ruff check tests/test_project_document_schema_mutations.py`.
- `frontend/src/features/equipment/lib.test.ts`
  - Migrated Rooms fixtures to `field_defs` / `custom_values`.
  - Focused verification recorded: `cd frontend && pnpm exec vitest run
    src/features/equipment/lib.test.ts` (28 passed) and `pnpm exec
    eslint src/features/equipment/lib.test.ts`.
- `backend/tests/test_custom_fields_reserved_slug_guard.py`
  - Rewritten to assert `mutations.guards.reject_reserved_field_key`.
  - Keeps `TableFieldDef` model accepting built-in `record_id` seeds.
  - Verification recorded: `cd backend && uv run ruff check
    tests/test_custom_fields_reserved_slug_guard.py`, `uv run ty check
    tests/test_custom_fields_reserved_slug_guard.py`, and `uv run
    pytest tests/test_custom_fields_reserved_slug_guard.py -q`
    (4 passed).
- `backend/tests/test_project_document_custom_fields.py`
  - Rewritten to the current `field_registry` / `field_defs` contract.
  - Uses one-argument `compute_table_schema_fingerprint`.
  - Seeds documents through `empty_project_document`.
  - Verification recorded: `cd backend && uv run ruff check
    tests/test_project_document_custom_fields.py`, `uv run ty check
    tests/test_project_document_custom_fields.py`, and `uv run pytest
    tests/test_project_document_custom_fields.py -q` (6 passed).

## Current Gate Status

P2.7 is not ready yet.

`make typecheck` was run after `2ecb29f`. It still fails, but the
failure count has dropped to 29 diagnostics. Remaining diagnostics are
all stale fixture/test modules, not the already migrated modules above.

The remaining `make typecheck` blocker groups are:

- `backend/tests/test_mcp_custom_fields.py`
  - Old import: `ROOMS_CORE_FIELD_KEYS`.
  - Old two-argument `compute_table_schema_fingerprint`.
  - Still validates old `CustomFieldDef` payloads from `custom_fields`.
- `backend/tests/test_project_document_custom_fields_phase_2.py`
  - Old import: `ROOMS_CORE_FIELD_KEYS`.
  - Old two-argument fingerprint helper.
- `backend/tests/test_project_document_custom_fields_phase_4.py`
  - Old import: `ROOMS_CORE_FIELD_KEYS`.
  - Old two-argument fingerprint helper.
- `backend/tests/test_project_document_schema_mutation_endpoint.py`
  - Old import: `ROOMS_CORE_FIELD_KEYS`.
  - Old two-argument fingerprint helper.
- `backend/tests/test_project_document_default_option_fill.py`
  - Old `CustomFieldDef(id=...)`.
  - Old `RoomsTableEnvelope(custom_fields=...)`.
  - Old typed `RoomRow(number=..., name=..., num_people=...,
    num_bedrooms=..., custom=...)`.
  - Old assertions against `row.custom`.
- `backend/tests/test_project_document.py`
  - One stale assertion: `body.tables.rooms.custom_fields == []`.
- `backend/tests/test_project_document_phase_3_type_conversion.py`
  - Ty-only issue around `cast("object", mutation)` passed to
    `apply_schema_mutation`.
- `backend/tests/test_project_document_pumps.py`
  - Old typed `PumpRow.tag` assertions.

## Recommended Next Steps

Continue P2.6 fixture rewrites before attempting P2.7 again.

Recommended order:

1. Rewrite `backend/tests/test_mcp_custom_fields.py`.
   This should establish the reusable pattern for MCP custom-field
   tests using `field_defs`, `TableFieldDef.field_key`, and the current
   one-argument fingerprint.
2. Rewrite the sibling fingerprint/stale-schema modules:
   - `backend/tests/test_project_document_custom_fields_phase_2.py`
   - `backend/tests/test_project_document_custom_fields_phase_4.py`
   - `backend/tests/test_project_document_schema_mutation_endpoint.py`
3. Rewrite `backend/tests/test_project_document_default_option_fill.py`.
   Use `empty_project_document`, `RoomsTableEnvelope(field_defs=...)`,
   and `RoomRow.custom_values`.
4. Clear the small backend leftovers:
   - `backend/tests/test_project_document.py`
   - `backend/tests/test_project_document_phase_3_type_conversion.py`
   - `backend/tests/test_project_document_pumps.py`
5. Re-run `make typecheck`.
6. Once backend typecheck is clean, continue the frontend fixture modules
   still using `slice.custom_fields`, `roomsTableFieldDefs`, or typed
   `RoomRow` literals.
7. Only then attempt P2.7:
   - `make typecheck`
   - `make test`
   - `make smoke`
   - Playwright smoke for Rooms + Pumps round-trip.

## Verification Pattern For Each Fixture Rewrite

For backend test modules:

```bash
cd backend
uv run ruff check tests/<module>.py
uv run ty check tests/<module>.py
uv run pytest tests/<module>.py -q
```

For frontend test modules:

```bash
cd frontend
pnpm exec eslint <path>
pnpm exec vitest run <path>
```

Keep landing these as small module-sized commits. Do not mark P2.7
complete until the full repository gates pass.
