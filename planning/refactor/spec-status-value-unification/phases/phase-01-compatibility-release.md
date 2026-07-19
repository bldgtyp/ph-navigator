---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned
AUTHOR: Codex with Ed May
SCOPE: Deploy a rollback-safe compatibility envelope while schema v7 remains
  canonical.
RELATED:
  - ../PLAN.md
  - ../decisions.md
---

# Phase 01 — Compatibility Release A

## Goal

Make old/new API and frontend combinations tolerate both status spellings
without creating schema-v8 data.

## Contract during Release A

- Project-document schema remains v7.
- Backend model/storage remains canonical `missing`.
- Backend request/command boundaries accept `missing | needed` and normalize
  `needed` to v7 `missing` before domain validation/persistence.
- Frontend response normalization accepts either spelling.
- Materials, Glazings, Frames, Documentation, and Status display Needed.
- Frontend built-in writes continue emitting v7 `missing`.
- Equipment/Thermal Bridges remain `opt_status_needed`.

## Ordered implementation steps

1. Add one named backend compatibility normalizer used by every public built-in
   status mutation DTO; do not add aliases to the persisted row model.
2. Cover material, glazing, frame, Documentation-originated, REST, and MCP
   mutation entry points. Reject unrelated strings.
3. Add a frontend API-boundary normalizer that accepts `missing | needed` and
   presents one internal Release-A view to components.
4. Update Apertures' visible label/filter/select copy from Missing to Needed.
5. Keep Release-A serializers explicit: built-in writes still send `missing`.
6. Add cross-version contract tests:
   - old value to A backend;
   - future value to A backend, persisted as `missing`;
   - A frontend reading either spelling;
   - A frontend displaying Needed and writing legacy `missing`.
7. Prove no schema constant, upgrader, seed value, or saved fixture changed.
8. Run focused backend/frontend gates, then full `make ci`.
9. After review/merge, Ed deploys Release A. Verify both production projects
   load and edit normally; record deployed API/web SHAs.

## Required tests

- backend command/request validation for all three built-in row families;
- Materials and Aperture report controls;
- Documentation built-in status write;
- Equipment/TB option-id non-regression;
- no schema fingerprint change.

## Exit gate

- Release A is deployed to both services and both projects pass smoke.
- Schema remains v7 everywhere.
- Either deployment order and either spelling are tolerated at mutation/read
  boundaries.
- Release A can be rolled back by code deploy alone because no v8 data exists.

## Stop conditions

- Any Release-A path persists `needed` into a v7 body.
- A component still visibly labels specification status Missing.
- Any compatibility logic leaks into generic non-status `missing` handling.
- Production smoke requires a schema/data mutation.

## Evidence to record

- focused/full CI results;
- merged/deployed SHAs;
- project-by-project read/edit smoke result;
- confirmation that production corpus remains schema ≤7.
