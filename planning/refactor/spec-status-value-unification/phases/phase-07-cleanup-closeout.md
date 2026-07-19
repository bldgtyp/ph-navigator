---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned
AUTHOR: Codex with Ed May
SCOPE: Remove temporary compatibility, reconcile durable docs, and archive the
  completed refactor.
RELATED:
  - ../STATUS.md
  - ../decisions.md
---

# Phase 07 — Cleanup and closeout

## Goal

End with one strict PH-Navigator internal contract, only justified permanent
compatibility adapters, truthful production evidence, and durable context docs.

## Preconditions

- Canonical B has remained healthy for the agreed observation/cache window.
- Ed and John have refreshed/reopened clients.
- Both production projects have passed Phase 06.
- First v8 persistence and recovery mode are recorded.

## Ordered steps

1. Inventory all remaining status-related `missing` hits using the Phase 00
   classification.
2. Remove the temporary Release-A frontend dual-read/legacy-write paths that no
   longer protect a real deployed client.
3. Remove the temporary cached-client backend request alias only if the agreed
   compatibility window is over and Ed approves. If retained, document owner,
   reason, and removal trigger; do not call the phase fully contracted.
4. Retain permanently:
   - v7 → v8 upgrader;
   - frozen old-schema fixtures;
   - raw historical download behavior;
   - Honeybee `needed ↔ MISSING` adapters;
   - ordinary non-status `missing` language/states.
5. Confirm summary shims are gone and custom option-id adapters remain.
6. Reconcile stable contracts in:
   - `context/technical-requirements/data-model.md`;
   - `data-table.md`;
   - `save-versioning.md` if needed;
   - `envelope-hbjson-import.md` / export docs;
   - `context/ui/pages/envelope-tab.md`;
   - `context/ui/pages/status-tab.md`;
   - design-system/token docs.
7. Update packet `STATUS.md` with exact test, production, schema, and rollback
   evidence. Distinguish logical upgrade from physically persisted v8 per
   project.
8. Run `simplify`, then `docs-pass`; record any resulting decisions.
9. Run `graphify update .`, format, focused cleanup tests, and full `make ci`.
10. Archive under `planning/archive/dated/<date>/spec-status-value-unification/`,
    update `planning/archive/README.md`, and update `planning/STATUS.md`.

## Exit gate

- Canonical PHN internal status is strict `needed`.
- Every remaining legacy `missing` use is classified and justified.
- Production evidence and rollback mode are truthful.
- Durable docs match current code.
- Simplify/docs-pass/Graphify/format/full CI are green.
- Packet is archived and routing index is current.

## Non-goal reminder

Do not use closeout to merge `StatusSelect` with DataTable status-pill CSS or to
rename unrelated missing-data concepts. Record such work separately if still
valuable.
