---
DATE: 2026-07-09
TIME: -
STATUS: Planned — measure-gated; run only if post-phase-02 metrics say
  server time still matters. May legitimately conclude "measured; not
  worth it."
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 5 — instrument the document
  write path, then trim the redundant whole-document work (duplicate
  Pydantic parses) behind an etag-keyed cache. Backend only; zero API,
  schema, or document-shape change (PRD NG-1).
RELATED:
  - ../PRD.md §2 (F-7), §6 (D-10), §7 (A-7), §8 (R-5)
  - backend/features/project_document/write_spine.py (load_draft_context :53-125, apply_document_write :165-201)
  - backend/features/project_document/validation.py (validate_document :84-93, serialize_document :35-45)
  - backend/features/project_document/repository.py (_log_saved :295-296 — existing db_ms)
  - backend/features/auth/service.py:197-236 (per-request session cost — context)
  - context/LOGGING.md (structlog conventions)
  - memory: 2026-06-24 backend data-architecture review (JSONB blob REAFFIRMED)
---

# Phase 5 — Backend write-path trims (measure-gated)

## 1. Goal

Reduce server time per table write without changing the document model,
the API, or any behavior — or produce the measurement that says it
isn't worth doing. Success is either A-7 (≥30% p50 reduction on the
largest seeded project) or a documented "stop" decision.

## 2. Stage A — Instrument first (always do this stage)

Extend the existing `project_document.saved` structlog event (which has
`db_ms`) with per-write timings:

- `version_parse_ms` — `validate_document(version body)` (write_spine.py:84)
- `draft_parse_ms` — `upgrade_document_with_errors(draft body)` (write_spine.py:107)
- `serialize_ms` — `serialize_document` dump+sha256 (validation.py:35-45)
- `asset_check_ms` — `validate_document_asset_references`
- `body_bytes` — canonical doc size
- (keep `db_ms`)

Zero-risk, ships regardless. Then capture a baseline: run the
production-scale fixture (see the prod perf fixture runbook memory) or
the largest local seed, drive ~50 single-cell writes, record p50/p95
per component. **Decision gate:** if (parse+serialize) p50 is < ~30% of
total request time, STOP after Stage A — write the numbers into this
file and STATUS.md, close the phase as "measured; declined."

## 3. Stage B — Etag-keyed validated-document cache (if gate passes)

### 3.1 The redundancy being removed

Per write today: the **saved version body** — immutable per
`version_etag` — is fully Pydantic-parsed+migrated on every write
(write_spine.py:84), and the **draft body** we're about to overwrite is
parsed too (write_spine.py:107) even though we wrote it ourselves one
keystroke ago.

### 3.2 The cache

Small process-local LRU (hand-rolled or `cachetools`-free dict+deque —
no new dependency without checking `pyproject.toml` policy), keyed by
the body's content hash (the etag IS a content hash — validation.py's
sha256 canonical dump), value = the validated `ProjectDocumentV1`.

- Immutability per key makes this safe by construction; no TTL needed,
  only size-bound eviction.
- **Budget (R-5):** parsed docs, cap ~4 entries default via a
  `Settings` field (no .env overlays — Settings field per repo rules).
  Worst case ≈ 4 × in-memory doc size; document the estimate in code.
- **Mutation hazard — the real risk:** a cached `ProjectDocumentV1`
  must NEVER be mutated by callers. Audit every consumer of
  `validate_document`'s return; if any mutates (rather than
  `model_copy`), either fix it to copy (preferred — check
  `replace_table_envelope` already uses `model_copy`,
  contracts.py:235-249) or have the cache return a defensive copy and
  re-measure whether that copy eats the win.
- Uvicorn workers each hold their own cache; that's fine (Render
  single-service, small worker count — confirm worker count in
  `render.yaml` for the budget math).

### 3.3 Application points

- write_spine.py:84 (version body) — highest value: version bodies are
  long-lived and shared across every write to the version.
- write_spine.py:107 (draft body) — hit on every keystroke N+1 for the
  body written at keystroke N; requires the upsert path to prime the
  cache with the just-validated doc + new etag (it has both in hand —
  free priming).
- Read paths (`get_draft_table` etc.) use the same validators — apply
  the cache there too if it falls out naturally; don't force it.

### 3.4 Explicitly out of scope

- Skipping serialization/hashing of the outgoing doc (it defines the
  etag — required).
- Session/auth restructuring (F-7's ~3 transactions) — note findings if
  measured, don't touch.
- Any change to locks, etag semantics, draft model, or JSONB layout.
- Per-table document decomposition — rejected by NG-1/NG-2.

## 4. Step-by-step

1. Stage A instrumentation + unit-test that the event fields emit
   (structlog capture), `make ci`.
2. Baseline capture + gate decision recorded in STATUS.md (+ this
   file). STOP here if gate fails.
3. LRU module + immutability audit + cache wiring (version body first,
   draft body second, each behind its own commit for bisectability).
4. Re-measure the same drill; record before/after table.
5. Correctness suite: existing document/draft test battery green;
   add a test that a cache hit and a cache miss produce identical
   write results (property: cache is invisible).
6. Closeout gate (`make ci` mandatory — this is production-write-path
   code).

## 5. Acceptance

- A-7, or the documented Stage-A stop decision. Either outcome must
  leave the new instrumentation in place (it's the regression alarm
  for future document growth).

## 6. Notes

- Do this phase LAST. After phases 1+2 the user never waits on this
  latency directly; the remaining motivations are burst throughput
  (queue drain rate), MCP agent write loops, and headroom as documents
  grow toward the 8 MiB cap.
- If Stage A reveals a surprise dominator (e.g. `asset_check_ms` or
  GZip on large table responses), write it up in STATUS.md as a
  candidate follow-up rather than expanding this phase's scope.
