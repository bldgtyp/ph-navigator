---
DATE: 2026-07-09
TIME: -
STATUS: COMPLETE — 2026-07-09. Instrumentation, inventory,
  deterministic harness, characterization tests, and PERF-STRESS
  baseline landed with zero write-behavior change.
AUTHOR: Claude (for Ed); scope per plan-review R-9 / §5.1
SCOPE: Implementation handoff for Phase 0 — instrument the full backend
  document-write path, inventory every frontend write entry point on
  current main, and build the deterministic delayed-request test
  harness the later phases reuse. Zero behavior change.
RELATED:
  - ../PRD.md §3 (F-7), §7 (D-10), §9 (R-D)
  - ../plan-review.md R-9, §5 step 1
  - backend/features/project_document/write_spine.py (aggregation point)
  - backend/features/project_document/validation.py, tables/*.py, repository.py
  - context/LOGGING.md (structlog conventions; never log bodies)
---

# Phase 0 — Observability + write-surface audit

## 1. Goal

Before touching behavior: know where write time actually goes, know
every code path that can write a draft table, and own a test harness
that can order/delay requests deterministically. Ships alone; pure
addition.

## 2. Work item A — Backend stage timings (R-9)

One structured event per document write, **aggregated at the
write-spine/service layer** (the repository's `project_document.saved`
only sees SQL and stays as-is). Fields:

- `version_parse_ms` — `validate_document(version body)` (write_spine.py:84)
- `draft_parse_ms` — draft body parse (write_spine.py:107)
- `payload_parse_ms` — request table-payload parsing
- `apply_ms` — table-contract application (splice/replace)
- `outgoing_validate_ms` — the contract's
  `validate_document(next_body.model_dump(mode="json"))` (F-7 third
  parse — e.g. tables/rooms.py:386; instrument where it's called, do
  not move it in this phase)
- `asset_check_ms` — `validate_document_asset_references`
- `serialize_ms` — canonical dump + sha256 (validation.py:35-45)
- `sql_ms` — from the existing repository timing
- `response_build_ms` — response-slice construction
- `txn_ms`, `request_ms` — total transaction / total request
- `body_bytes`, `request_bytes`, `response_bytes`

Implementation: a small timing-context helper (dataclass accumulator
passed through `apply_document_write` and the contract callable, or
contextvar) — keep it boring; no new dependency. Unit test: structlog
capture asserts the fields emit on a draft table write.

## 3. Work item B — Frontend write-surface inventory (R-D)

Re-inventory on current `main` every path that can mutate a draft
table, as a table in this file's As-built section: grid gestures
(cell/paste/fill/insert/delete/duplicate), schema mutations +
custom-field handlers, legacy option editor, `previewReplace`
preflights, RecordDetailModal / RoomModal save paths,
`runWithConflictHandling` external callers, and anything found by grep
for `mutateAsync` / `replaceSlice` / `mutateSchema` /
`previewReplace`. Each row: entry point → current transport → phase-01
routing decision. This table is the phase-01 wiring checklist.

Also record (read-only notes for later phases):

- where `useDraftLifecycle` triggers save/save-as/discard and what it
  awaits today;
- `VersionControls.tsx` beforeunload condition;
- confirmation of TanStack Query version + whether mutation
  `scope.id` is available in the installed version (PRD D-13a).

## 4. Work item C — Deterministic async test harness

Small vitest utilities (colocated under the data-table feature tests):

- a controllable fake transport: per-request deferred promises the
  test resolves/rejects in chosen order (enables "response B arrives
  before response A" and "reject with 409 body X");
- a keystroke-burst driver for controller-level tests (dispatch N ops
  without awaiting);
- strict unhandled-rejection assertion wrapper (backs PRD A-9).

Prove the harness with 2-3 characterization tests of TODAY'S behavior
(e.g. "two concurrent onWrite calls send the same If-Match" — the S-1
bug, pinned as a failing-is-passing characterization). These become
regression proof that phase-01 fixes it.

## 5. Work item D — Baseline capture

Run the largest available fixture (prod-perf fixture runbook, or
largest local seed) and record into STATUS.md: p50/p95 per stage field
for ~50 single-cell writes + ~10 row inserts; note document
`body_bytes`. This is the phase-06 gate input and the A-7 baseline.

## 6. Out of scope

Any behavior change, frontend metrics pipelines (keep frontend
observability to the existing dev logging; queue metrics land WITH the
queue in phase-01), moving the outgoing validation.

## 7. Acceptance

- Timing event emits with all §2 fields; `make ci` green; zero
  behavior diffs (characterization tests prove current semantics).
- Inventory table complete; harness merged and used by ≥2
  characterization tests; baseline numbers recorded in STATUS.md.

## 8. As-built write-surface inventory

Audited 2026-07-09 against the 14 `createTableSliceFeature` tables.
Catalog controllers, Aperture commands, and attachment tables remain
outside this packet.

| Entry point | Current transport | Phase-01 routing decision |
|---|---|---|
| Grid cell / clear / paste / fill / row insert / delete / duplicate (`DataTable` → `useGridWriteReducer` → controller `onWrite`) | `useSliceTableController.commitPayloadOrThrow` → whole-slice `replaceMutation.mutateAsync` | Route the shared controller commit through the draft coordinator; this covers all 14 tables. |
| Typed custom-field add/edit/delete/reorder (`useCustomFieldHandlers`) | `commitSchemaMutation` → `schemaMutation.mutateAsync` | Route through the same coordinator lane. |
| Legacy option editor (`schemaMutation` op with `variant !== "typed"`) | Controller builds a whole-slice replace payload. | Route through controller commit; no separate path. |
| Equipment/Space Types footer add actions (`equipmentRowActions.tsx`, `SpaceTypesPage.tsx`) | Fire-and-forget `controller.onWrite(rowInsert)`. | Covered by coordinated `onWrite`; callers observe `settled` where persistence controls feedback. |
| Heat-pump leaf modal insert/edit/delete and attachment-id edits (`heat-pumps/components/*Table.tsx`) | Helpers emit `controller.onWrite`. | Covered by each leaf controller; all four mounted leaves share one draft lane. |
| Rooms modal save/delete (`equipment/lib/roomMutationCallbacks.ts`) | Direct Rooms `replaceMutation.mutateAsync` wrapped only by `runWithConflictHandling`. | Replace the direct mutation with a coordinator task; modal close waits for `settled`. |
| Room edits launched from Space Types, Pumps, and Ventilators | Secondary Rooms controller `onWrite(cell)`. | Covered by the secondary controller sharing the draft-key coordinator. |
| Indoor-unit modal/link edits mounted from Ventilators (`VentilatorsTableSlot.tsx:145-166`) | Direct indoor-units `replaceMutation.mutateAsync`. | Route through an indoor-units controller/coordinator task; modal close waits for `settled`. |
| Linked Ventilator modal mounted from heat pumps (`LinkedVentilatorModalHost.tsx`) | Direct Ventilators `replaceMutation.mutateAsync`. | Route through a Ventilators coordinator task. |
| Heat-pump outdoor-unit delete preflight (`OutdoorUnitsTable.tsx:269`) | Direct `previewReplace` POST, then controller delete write. | Schedule preflight and dependent delete in the same draft lane so their etag basis cannot interleave. |
| External `runWithConflictHandling` callers | Only `roomMutationCallbacks.ts`; direct mutation described above. | Remove the bypass; conflict handling observes the returned `settled` promise. |
| Save / Save As / save-and-switch (`useDraftLifecycle.ts:72-99,118-123`) | Immediately calls the version endpoint. | `flush()` successfully first; abort on flush failure. |
| Discard / discard-and-switch (`useDraftLifecycle.ts:103-130`) | Immediately deletes the draft. | `cancel()` queued work and drop journals first. |
| Version lock/unlock/switch and controller unmount | No queue awareness. | Apply the simple D-12 cancel/flush semantics; never silently drop a backlog. |
| Unload guard (`VersionControls.tsx:77-86`) | Warns iff `hasDraft`. | Warn iff `hasDraft || coordinator non-idle`. |

Installed TanStack Query core is `5.100.10` and
`MutationOptions.scope` is present at
`@tanstack/query-core/src/types.ts:1144`. Phase 01 may use `scope.id`
internally only if it preserves explicit drain, cancel, flush-boundary,
and registry-lifetime semantics. `useDraftLifecycle` currently awaits
only the lifecycle mutation; `VersionControls` owns the unload listener.

## 9. Baseline (PERF-STRESS)

Local development API, 2026-07-09; `PERF-STRESS` had 1,000 Rooms rows
and a 1.657-1.660 MiB whole document. One warm Uvicorn process; 50
single-cell name toggles followed by 10 row inserts, strictly serial.
Values are milliseconds.

| Stage | Cell p50 | Cell p95 | Insert p50 | Insert p95 |
|---|---:|---:|---:|---:|
| `version_parse_ms` | 26.100 | 104.783 | 26.911 | 100.832 |
| `draft_parse_ms` | 26.210 | 112.762 | 25.621 | 109.257 |
| `payload_parse_ms` | 2.033 | 2.325 | 2.020 | 2.255 |
| `apply_ms` | 9.977 | 92.472 | 9.976 | 92.173 |
| `outgoing_validate_ms` | 25.784 | 112.570 | 25.981 | 112.520 |
| `asset_check_ms` | 10.066 | 94.035 | 9.927 | 10.190 |
| `serialize_ms` | 22.090 | 105.031 | 21.735 | 104.640 |
| `sql_ms` | 58.712 | 66.692 | 54.869 | 61.490 |
| `response_build_ms` | 16.201 | 16.980 | 15.982 | 17.719 |
| `txn_ms` | 344.650 | 415.428 | 337.242 | 419.078 |
| `request_ms` | 368.511 | 438.328 | 360.913 | 442.479 |

Byte ranges: document `1,656,727-1,660,067`; uncompressed service
request payload `336,334-339,674`; uncompressed response model
`391,982-395,892`. Phase-06 gate: no single non-SQL p50 stage exceeds
30% of request time; the three full parses plus serialization are the
largest cumulative avoidable family. Do not assume one input cache
alone can reach A-7.

## 10. Verification evidence

- `uv run pytest tests/test_project_document.py::test_rooms_replace_emits_full_write_timing_event -q`
- `pnpm exec vitest run src/shared/ui/data-table/feature/useSliceTableController.test.tsx`
- `make seed-perf-stress` plus the 50-write / 10-insert serial drill
- `make format && make ci` (phase closeout)
