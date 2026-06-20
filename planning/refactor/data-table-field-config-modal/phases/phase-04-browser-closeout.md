---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Live consumer verification and closeout
RELATED: planning/refactor/data-table-field-config-modal/phases/phase-03-tests-static-guards.md
---

# Phase 04 - Browser Verification And Closeout

## Goal

Prove the shared DATA-TABLE modal change rolls out through parent-level
ownership to actual table consumers.

## Preflight

Use the repo browser baseline:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Login: `codex@example.com` / `password`

Before browser work:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Expected signed-out health response: `401` with `not_authenticated`.

If the frontend is not running, start it from `frontend/` with strict
port 5173:

```bash
pnpm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Do not use Vite fallback ports.

## Representative Smoke Route

Use Spaces / Rooms first because it is a known DATA-TABLE surface with
custom-field schema editing.

Smoke steps:

1. Open the project workspace.
2. Navigate to Spaces -> Rooms.
3. Open a column header menu or double-click a header to open Edit Field.
4. Confirm the modal is the shared Field Config modal.
5. Confirm visual requirements:
   - no visible title;
   - no uppercase Name / Type / Description labels;
   - one field-type dropdown/select;
   - type-change preflight appears as a secondary card.
6. Change field type to an allowed target.
7. Confirm the preflight row-preservation summary appears.
8. Revert or cancel unless the smoke needs a save.

If saving is tested:

1. Use a disposable/custom field.
2. Save a valid change.
3. Confirm the table reflects the updated schema.
4. Confirm no route-local modal code was involved.

## Gates

Run:

```bash
make frontend-dev-check
```

If implementation changed interaction/state logic beyond simple styling,
also run the focused shared tests from Phase 03.

At feature closeout, follow repo guidance:

```bash
make format
make ci
```

Run `graphify update .` after code changes so the repo graph reflects the
new shared component.

## Closeout Notes To Capture

Update `STATUS.md` with:

- final implementation summary;
- exact tests/commands run;
- browser route checked;
- any intentionally deferred UI behavior, such as collapsed Add
  description or field-type icons/search.

## Acceptance Criteria

- At least one real DATA-TABLE consumer opens the new shared modal.
- No page-specific override is needed.
- Focused tests and `make frontend-dev-check` pass.
- Full closeout commands are either passed or explicitly deferred with a
  reason.

## Completion Notes

Completed 2026-06-20 08:52 EDT.

- Verified the repo browser baseline:
  - `curl -i http://localhost:8000/api/v1/auth/session` returned `401`
    with `not_authenticated`.
  - `curl -I http://localhost:5173` returned `200 OK`.
- Logged in at `http://localhost:5173` with `codex@example.com`.
- Opened project `ts-20316385 - Table Smoke 20316385`.
- Navigated to `Spaces -> Rooms`
  (`/projects/9d22c3dd-1ab2-445c-84db-07482d52b891/spaces/rooms`).
- Opened Add Field through the table `+` control and confirmed the shared
  modal has no retired class hooks, starts with the Name input, has one
  field-type combobox, and has no visually visible top-level Name / Type /
  Description labels.
- Created disposable local-dev field `Smoke Field 07320`.
- Opened Edit Field from that column header menu and confirmed the shared
  Edit Field modal has one field-type combobox and no retired class hooks.
- Changed the field type from `Short text` to `Number` and confirmed the
  type-change preflight mounts as `.data-table-field-config-typechange`
  with heading `short_text -> number`, `role="group"`, an accessible
  type-change label, and a `0 of 0 rows will keep their value` preservation
  summary.
- Canceled the Edit Field modal without saving the type change.

The disposable field remains in the local dev project as an uncommitted
schema change from the smoke run; it was not committed to git and is useful
only as local browser-smoke residue.

## Verification

```bash
curl -i http://localhost:8000/api/v1/auth/session
curl -I http://localhost:5173
make frontend-dev-check
make format
make ci
```

Result:

- Backend/frontend local baseline passed.
- Browser smoke passed on Spaces / Rooms.
- `make frontend-dev-check`: passed with existing Fast Refresh lint warnings
  and existing Vite chunk-size warnings.
- `make format`: passed; touched code was unchanged.
- `make ci`: passed. Backend: 903 passed, 2 skipped, 1 existing
  deprecation warning. Frontend: 181 test files passed, 1737 tests passed,
  build passed with existing Vite chunk-size warnings.
