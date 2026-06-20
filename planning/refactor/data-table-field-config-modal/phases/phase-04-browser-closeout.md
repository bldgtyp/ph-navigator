---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Pending
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

