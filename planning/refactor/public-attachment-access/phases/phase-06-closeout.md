---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Not started
AUTHOR: Claude with Ed May
SCOPE: Fold accepted decisions into context/, run the repo closeout gate, and
  record follow-ups.
RELATED:
  - ../PRD.md
  - ../STATUS.md
  - ../../../../CLAUDE.md
---

# Phase 06 — Closeout

## Goal

The reference-gate policy is documented where it belongs, the repo closeout gate
is satisfied, and the deferred follow-up is recorded rather than forgotten.

## Depends on

Phases 01–05 green.

## Documentation

**1. `context/DATA_STORAGE.md`** — add the anonymous reference gate as an
explicit, stated policy:

> A signed-out viewer may fetch an asset only if it is referenced by an
> attachment column of the project's saved active document (plus the separate
> location/weather allowance). The resolver is
> `list_asset_references` / `iter_rows_for_raw_tables`, and it is also what the
> orphan sweeper, write-time reference validation, bulk download, and
> attach/detach use to decide whether an asset belongs to the project.

That last clause is the load-bearing part. The bug was survivable-looking
because nobody documented that one resolver defines project membership for five
subsystems at once.

**2. `context/DATA_STORAGE.md` or `backend/.instructions.md`** — state the
invariant Phase 01 encodes in a comment: *tables migrate between a bare list and
a `{field_defs, rows}` envelope as they gain FieldDefs; any code walking table
rows must tolerate both.*

**3. `context/ui/pages/thermal-bridges.md`** — note that PDF Report is an
attachment column subject to the same anonymous gate as datasheets and photos,
if the page doc describes the column at all.

**4. Do not** add a memory or context note that merely restates the fix. The
durable lesson is the invariant and the five-subsystem coupling, not the diff.

## Repo closeout gate

Per the root `CLAUDE.md`, in order, waiting for each to finish:

1. `simplify` **skill** on the diff.
2. `docs-pass` **skill** on the diff.
3. `make format` from the repo root.
4. `make ci` — this is a substantial change, so it is required.
5. If `make format` changed files, re-inspect the diff and rerun `make ci`.
6. Nothing is done while any `make ci` step is red.

## Status hygiene

- Update `../STATUS.md`: current state, what shipped, Phase 00 findings
  retained.
- If any decision was made that the packet did not anticipate — notably the
  PDF-only vs `DATASHEET_CONTENT_TYPES` call from Phase 00 — record it in a
  `decisions.md` in this folder.
- When the work is deployed and verified, archive the packet per
  `planning/.instructions.md` §5 and add a line to `planning/archive/README.md`.

## Follow-up to record, not to do

**Derive the table→rows mapping from the table contract registry.**
`iter_rows_for_raw_tables` is a hand-written if-chain that must be kept in sync
with the document schema by hand. Phase 01 makes it shape-tolerant and Phase 03
guards it, but the structural fix is to stop hand-maintaining the mapping at all
— build it from `backend/features/project_document/tables/registry.py`, the same
source the document is built from. Deliberately out of scope for a bug fix.

Record it where the team will find it when someone next touches that file — a
brief note in `context/DATA_STORAGE.md` or a `planning/refactor/` stub, at the
implementer's discretion. Do not open it as work in this packet.

## Deploy

**Deploying is Ed's call, never an agent's.** Merging to `main` does not deploy.
The deploy event is the "Deploy Production" GitHub Actions workflow. Leave
`main` deployable and stop.

## Done when

- The context updates above are merged.
- The closeout gate is fully green.
- `STATUS.md` reflects reality and the follow-up is recorded.
