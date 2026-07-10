---
DATE: 2026-07-09
TIME: -
STATUS: Planned — measure-gated on phase-00 baselines; act on the
  measured dominator, not the assumed one. May legitimately conclude
  "measured; declined."
AUTHOR: Claude (for Ed); corrections per plan-review R-8/R-9
SCOPE: Implementation handoff for Phase 6 — trim the measured dominant
  whole-document work in the write path. Backend only; zero API,
  schema, or document-shape change (PRD NG-1).
RELATED:
  - ../PRD.md §3 (F-7, F-12), §7 (D-10), §8 (A-7), §9 (R-E)
  - ../plan-review.md R-8, R-9, §5 step 7
  - phases/phase-00-observability-and-write-surface-audit.md (baseline source)
  - backend/features/project_document/write_spine.py · validation.py · tables/*.py · repository.py
  - memory: 2026-06-24 backend data-architecture review (JSONB blob REAFFIRMED)
---

# Phase 6 — Backend write-path trims (measure-gated)

## 1. Goal

Reduce server time per table write without changing the document
model, API, or behavior — or document why not. Success = A-7 (≥30% p50
reduction, largest fixture) or a recorded stop decision. Either way
the phase-00 instrumentation stays as the regression alarm.

## 2. Entry gate

Read the phase-00 baseline (per-stage p50/p95). Candidate dominators
and their remedies differ — pick from measurement:

| If dominant | Remedy sketch |
|---|---|
| `version_parse_ms` | cache validated saved-version body (§3) |
| `draft_parse_ms` | cache validated draft body, primed on write (§3) |
| `outgoing_validate_ms` (F-7 third parse) | §4 — an input cache does NOT help this |
| `serialize_ms` / `sql_ms` / auth transactions | write up as follow-up candidates; out of this phase's scope |

If no stage clears ~30% of request time, STOP: record numbers +
decision in STATUS.md and this file.

## 3. Remedy A — validated-document cache (input bodies)

Process-local LRU, value = validated `ProjectDocumentV1`.

- **Keys (R-8 — no recomputed hashes, and draft etags are NOT content
  hashes, F-12):** saved body → `(version_id, version_etag)` or
  `(version_id, updated_at)`; draft body →
  `(version_id, user_id, draft_etag)` — the draft etag is an opaque
  but strictly-rotating revision token, valid as a cache key.
- Prime on write: `apply_document_write` has the validated outgoing
  doc + new draft etag in hand — insert, don't wait for the next read.
- **Immutability audit (R-E):** cached models must never be mutated —
  verify consumers use `model_copy` (e.g. `replace_table_envelope`,
  contracts.py:235-249); otherwise return defensive copies and
  re-measure.
- Budget: capacity via a `Settings` field (default ~4), documented
  worst-case memory (≤ cap × in-memory doc size × workers — check
  worker count in render.yaml). Hand-rolled dict+deque; no new dep.

## 4. Remedy B — the outgoing validation (F-7 third parse)

Every table contract ends with
`validate_document(next_body.model_dump(mode="json"))` — a full dump +
full re-parse of a document that was just constructed from validated
parts via `model_copy`. If measurement says this dominates, evaluate in
order (behavior-preserving first):

1. **Confirm what it guards.** Likely: forward-migration idempotence +
   catching contract bugs that build structurally-invalid models. Read
   git history / tests before weakening anything.
2. Replace dump→parse with `ProjectDocumentV1.model_validate(next_body,
   from_attributes=...)`-style revalidation without the JSON round-trip,
   if equivalence holds.
3. Validate only the mutated table subtree + document-level invariants,
   keeping a full-validation debug assertion in tests.

Any change here needs the full document/draft test battery plus a
property test: for each table, replace-with-valid-payload produces
byte-identical serialized documents before/after the optimization.

## 5. Explicitly out of scope

Serialization/hash of the outgoing doc (defines the etag); locks, etag
semantics, draft model, JSONB layout; session/auth restructuring
(record findings as follow-ups); per-table document decomposition
(NG-1/NG-2); the semantic-command endpoint (recorded alternative,
NG-2).

## 6. Step-by-step

1. Entry-gate reading + remedy selection recorded in STATUS.md.
2. Implement the selected remedy (A and B are independent; land
   separately for bisectability, each behind its own commit).
3. Re-run the phase-00 drill; before/after table in STATUS.md.
4. Correctness: full battery green + cache-invisibility property test
   (hit ≡ miss) and/or §4's byte-identical property test.
5. Closeout gate (`make ci` mandatory — production write path).

## 7. Acceptance

- A-7, or the documented stop decision; instrumentation retained;
  zero API change.
