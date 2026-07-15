---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Integrated verification, browser acceptance, graph update, and docs closeout.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
  - ./phase-01-backend-locality-candidates.md
  - ./phase-02-modal-town-search.md
---

# Phase 03 - Verification and Docs

## Goal

Prove both search modes through the mounted Climate route and reconcile durable
API/privacy documentation before feature closeout.

## Automated Verification

1. Re-run focused backend project-location tests.
2. Re-run focused frontend location-form and modal tests.
3. Run `make frontend-dev-check`.
4. After `simplify` and `docs-pass`, run `make format` and `make ci` from the
   repository root. Re-run `make ci` if formatting changes files.

## Browser Matrix

Before localhost browser work, run:

```bash
make agent-browser-ready
```

Use the printed sign-in URL and a fresh tab. Verify:

1. Full address -> candidate -> map -> save -> reopen.
2. In an authorized MapTiler-configured environment: town + state + ZIP ->
   locality candidate -> town-level map -> save -> reopen.
3. Existing full address -> town-only replacement -> old street absent.
4. Locality selection -> elevation auto-fill -> manual elevation override.
5. Locality selection -> pin refinement without adding a street; confirm the UI
   warns that the refined point is saved/shown and no longer calls it town-level.
6. Public/viewer location response and rendered page contain no street address.
7. Climate dataset/weather pickers still load from the saved town coordinates.
8. Verify street-only fallback guidance through focused backend/frontend tests.
   Do not mutate a shared local/production environment merely to remove its
   MapTiler key for browser smoke.

Do not use an old browser tab that has shown a network or internal `data:` URL
error.

If no authorized MapTiler-configured environment is available, record the live
locality smoke as blocked; mocked/fixture tests do not satisfy that acceptance
item. Do not claim the feature complete until the live provider path is checked.

## Durable Docs

- Reconcile `context/technical-requirements/api.md` with actual MapTiler + Census
  fallback behavior and the additive candidate metadata.
- Clarify locality-only address composition if needed in
  `context/technical-requirements/data-model.md`.
- Keep provider-specific implementation details out of stable product docs
  unless they are operationally required.
- Update this packet's `STATUS.md`, `PLAN.md`, and phase ledger with actual
  commands/results.
- Update `planning/STATUS.md`.

## Closeout

1. Run `graphify update .` after code changes.
2. Run the `simplify` skill and fix in-scope issues.
3. Run the `docs-pass` skill and fold durable decisions into `context/`.
4. Record browser evidence and exact focused/full gate results.
5. Archive only after implementation is landed and verified.

## Exit Criteria

- Both address and locality flows pass automated and live-route verification.
- The Phase 01 automated public/viewer locality regression is re-run and remains
  green.
- Public/viewer privacy behavior is verified.
- Census fallback limitations are documented honestly.
- Graphify, simplify, docs-pass, and the final repository gate are complete.
- Planning status accurately distinguishes implemented, merged, and complete.
