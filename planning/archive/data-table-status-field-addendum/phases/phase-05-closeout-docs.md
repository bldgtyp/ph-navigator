---
DATE: 2026-06-24
TIME: 11:00 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Phase 05 — closeout gate, graph/docs, and contract folding.
RELATED: planning/archive/data-table-status-field-addendum/PLAN.md
---

# Phase 05 — Closeout and Docs

## Goal

The addendum is landed, verified, and its durable rule folded back into the
canonical contract so the Datasheet⇒status invariant survives future work.

## Steps

1. **Repo closeout gate** (CLAUDE.md):
   - Run the `simplify` skill on the diff; wait for it to finish.
   - Run the `docs-pass` skill on the diff; wait for it to finish.
   - `make format` from repo root.
   - `make ci` (full local CI mirror) — must be green; if `make format` changed
     files, re-inspect the diff and re-run `make ci`.
2. `graphify update .` after code changes.
3. **Fold the contract** into `context/technical-requirements/data-table.md`
   (§ Backend Data Shapes, where the original status contract lives): record that
   the status table list is **Datasheet-driven** — every DataTable-backed table
   with a `Datasheet` field carries `status`; `STATUS_TABLE_NAMES` now lists 12
   tables and the drift-guard test enforces the set. Note Thermal Bridges as the
   single status-without-Datasheet dashboard-accounting exception.
4. Update this packet:
   - `STATUS.md` → Complete, with exact commands and outcomes.
   - README phase map → all Done.
   - `planning/STATUS.md` → add the addendum row pointing here (or to its archive).
5. Archive the packet under `planning/archive/data-table-status-field-addendum/`
   once landed and verified, per the planning archive convention.

## Verification / evidence to record

- `make ci` exit 0 with backend/frontend pass counts.
- `graphify update .` node/edge counts.
- The data-table contract diff capturing the Datasheet-driven rule.

## Done when

`make ci` is green, the Datasheet⇒status rule is in the canonical contract, the
graph is rebuilt, and all ledgers reflect actual landed state.
