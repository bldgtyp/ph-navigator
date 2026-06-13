---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Verification, browser smoke, documentation updates, and closeout for Equipment Custom Fields.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/STATUS.md; planning/features/equipment-custom-fields/phases/phase-01-backend-registry-pilot.md; planning/features/equipment-custom-fields/phases/phase-02-backend-registry-rollout.md; planning/features/equipment-custom-fields/phases/phase-03-frontend-affordance-wiring.md
---

# Phase 04 - Verification and Closeout

## Goal

Prove the full feature works end to end, update durable feature status,
and leave the branch ready for review or merge.

## Preconditions

- Phase 01, Phase 02, and Phase 03 are complete.
- Focused backend and frontend tests are already passing.

## Focused Verification

Run focused tests first so failures point to the phase that caused them:

1. Backend schema-mutation tests for project-document custom fields and
   target table contracts.
2. Backend tests covering equipment payload builders, attachments, and
   record-linking if touched by the implementation.
3. Frontend rendered tests for Rooms custom fields plus the new target
   table coverage.
4. E2E or Playwright smoke only if the rendered tests cannot prove the
   real add-field workflow.

## Browser Smoke

Use the repo-wide local UI baseline:

- frontend `http://localhost:5173`
- backend `http://localhost:8000`
- login `codex@example.com` / `password`

Before browser work:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Expected signed-out health response is `401` with
`not_authenticated`.

Smoke at least:

- Pumps: add a short-text field, enter a value, refetch/reload, confirm
  the field and value persist.
- Ventilators or Fans: confirm the tail button and dialog work on a
  non-Pumps Equipment table.
- Thermal Bridges: confirm the tail button and dialog work while the
  PDF report field still renders normally.
- Viewer or locked-version state: confirm schema mutation controls are
  absent.

## Repo Gate

Close with the mandatory gate from the project guide:

```bash
make format
make ci
```

If `make format` changes files, inspect the diff and rerun `make ci`.
Do not mark the feature complete while `make ci` is red.

After code changes, run:

```bash
graphify update .
```

## Documentation Closeout

Update `STATUS.md` with:

- completed phases
- focused test commands and results
- browser smoke notes, if run
- final `make format` / `make ci` result
- any deferred table or field-type limitations

If implementation creates reusable guidance beyond this feature, promote
that lesson to `planning/features/.instructions.md`, `context/`, or
`AGENTS.md` depending on scope.

## Acceptance Criteria

- All target tables support custom-field authoring in editor mode.
- Viewer / locked states do not expose schema mutation controls.
- Backend and frontend focused tests pass.
- `make format` and `make ci` pass.
- `STATUS.md` accurately records the final state and evidence.

## Stop Condition

Stop when verification evidence is recorded and the worktree is ready
for review, commit, or merge according to the user's next instruction.
