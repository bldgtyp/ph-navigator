---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Open — doc/context half done 2026-07-20; adapter retirement blocked on the observation window
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

## Progress (2026-07-20)

Done now, because none of it depends on the observation window:

- Step 6 (context reconciliation) is complete. Synced across Phases 02–03 and
  the production run: `technical-requirements/data-model.md`, `data-table.md`,
  `api.md`, `save-versioning.md`, `llm-mcp-schema.md`,
  `envelope-hbjson-import.md`, `envelope-hbjson-export.md`,
  `ui/pages/envelope-tab.md`, `ui/pages/status-tab.md`, `DESIGN_SYSTEM.md`, and
  `frontend/src/styles/README.md`. Three stale "schema is 6" claims that
  predated this packet were corrected in passing.
- New durable doc: `context/PRODUCTION_DEPLOYMENT.md` -> "Database Recovery"
  records the PITR window, manual-export retention, restore owner, and the
  fact that a forward-only schema migration is not undone by redeploying old
  code. This closes the packet's long-standing "actual backup/restore
  mechanism" open operator input.
- Step 5 confirmed: summary translation shims are gone (typed pass-through);
  custom option-id adapters remain.
- Steps 8–9 (`simplify`, `docs-pass`, Graphify, format, full `make ci`) have
  run at the end of Phases 02, 03, and this closeout.

### Still open — and why

**Steps 2–3, retiring the temporary client adapters.** Blocked, not forgotten:

| Precondition | State |
|---|---|
| Canonical B healthy for the observation window | **Not met** — deployed 2026-07-19 ~23:55 EDT |
| Ed and John have refreshed/reopened clients | **Not met** — John has not opened the app since deploy |
| Both production projects passed Phase 06 | Met |
| First v8 persistence + recovery mode recorded | **Not met** — no v8 body persisted yet |

The adapters still in place, both harmless and cheap to keep:

- `backend/features/envelope/specification_status_compat.py` — accepts a legacy
  `missing` on public mutation DTOs, normalizes to `needed`.
- `normalizeSpecificationStatus` / `WireSpecificationStatus` in
  `frontend/src/features/project_document/specification-status.ts` — tolerates a
  legacy `missing` on the read path.

**Removal trigger:** Ed and John have each used the app normally since the
deploy (guaranteeing fresh JS), and at least one v8 body has been persisted and
recorded. Removal is a code change plus a **second production deploy**, so it
should ride with other work rather than be deployed on its own.

**Owner:** Ed. Retaining these means the phase is not fully contracted, so this
packet stays active until they are gone.

**Also carried:** the `--report-status-missing` token alias (see the Phase 03
as-built notes) — a naming cleanup excluded from this rollout by D-8.

Step 10 (archive) is deliberately **not** done: archiving now would file the
packet away with its contraction step outstanding.
