---
DATE: 2026-06-29
TIME: 21:20 EDT
STATUS: Active — phased plan, not started. Prerequisite (table-views batch) SHIPPED; this is the remaining higher-risk half.
AUTHOR: Claude (Opus 4.8)
SCOPE: Phased implementation plan for collapsing the draft-tables initial-mount
  fan-out via a batch/whole-draft read + per-table cache seeding.
RELATED:
  - planning/refactor/batch-draft-table-reads/README.md
  - planning/archive/dated/2026-06-29/equipment-draft-etag-coordination/
---

# Implementation Plan — Batch-seed the draft-tables read

Read `README.md` first — especially the **load-bearing / wasteful split** and
the PR #18 protocol this must preserve. The single hardest constraint: the
`table-draft-etag-coordination.spec.ts` regression test must stay green at every
gate. If a phase can't keep it green, stop and reassess the design.

This file is the execution **overview**; the detailed, implementation-ready
steps live in `phases/`:

- `phases/phase-00-preflight-and-spike.md` — shape lock, #18 invariant capture,
  and the **seed-without-refetch spike** (the gating unknown; no production code)
- `phases/phase-01-backend-batch-read.md` — `GET …/draft/tables?names=…` from one
  whole-draft load + tests
- `phases/phase-02-frontend-batch-seed.md` — seed per-table caches, preserve #18
- `phases/phase-03-verification.md` — e2e gate + perf re-run + server-load check
- `phases/phase-04-closeout.md` — closeout gate + fold-back

The sections below summarize each. **Two corrections from the deeper code read
(2026-06-29), reflected in the phase files:** (1) the endpoint shape is `{ tables:
dict[str, RegisteredTableResponse] }` (each value the full per-table response, so
seeding is 1:1) — not a separate-meta envelope; (2) the per-table draft read
**422s** on an invalid draft and has **no** read-safe-envelope path, so the batch
matches that — disregard the earlier "handle the read-safe envelope" note below.

## Prerequisite — SATISFIED

**`batch-table-views-endpoint` has shipped** (archived
`planning/archive/dated/2026-06-29/batch-table-views-endpoint/`). It proved the
page-level prefetch shape on the safe (read-only, non-etag) view-state surface.
Carry forward two concrete facts from it:

- **Backend route convention** to mirror: a `GET …?names=…` collection route
  declared **before** the `{single}` item route, with a bounded list param
  (table-views used `keys`, 1..64). Reuse this for `?names=…`.
- **Seam difference (important):** table-views wired the read-through through a
  React **context** because `useProjectTableViewState` is a hand-rolled hook.
  Draft-table slices are TanStack Query, so this refactor seeds via
  `queryClient.setQueryData` instead — see Phase 2. Do not copy the context
  pattern onto the slice queries.
- **Mount point:** table-views mounted its provider at `EquipmentPage.tsx`
  (where the 7 slice queries fire); the draft seed must mount there too, not in
  `EquipmentPageBody.tsx`.

## Phase 0 — Pre-flight + design lock (no code; ~0.5 day)

Higher-investment than a usual Phase 0, because the design choice gates risk.

1. **Re-derive the #18 protocol from the test**, not just the code: read
   `frontend/tests/e2e/table-regression/table-draft-etag-coordination.spec.ts`
   and `useSliceTableController.test.tsx`. Write down, in this file's Phase 0
   findings, the exact invariant the collapse must not break (cache key shape,
   when `resolveSliceForWrite` refetches, what `If-Match` carries).
2. **Confirm `build_response` purity:** verify `contract.build_response(project,
   version, source, version_etag, draft_etag, document_body)` is a pure function
   of (doc-level meta + that table's slice of the body), so a batch loop over one
   loaded draft body yields per-table payloads byte-identical to today's
   `get_draft_table_slice`. Quote the contract code.
3. **Pick endpoint shape (a) whole-draft vs (b) batch draft-tables.** Default to
   (b) (per-table `build_response` payloads keyed by name) per the README; record
   the decision and why.
4. **Prove the seeding mechanics in a spike** (throwaway): can
   `queryClient.setQueryData(<editor slice key>, payload)` before mount make
   `useSliceQuery` read the seed and NOT fire a GET? Determine the exact
   `staleTime` / `dataUpdatedAt` needed. This is the riskiest unknown — de-risk
   it before committing to Phase 2.
5. **Enumerate every page + slice feature** that would seed: equipment (+ rooms,
   heat-pump sub-tables), spaces, assets/ThermalBridges. Note which mount
   together (shared seed) vs separately.

Gate: Phase 0 findings appended below; endpoint shape and seeding mechanism
decided; spike confirms zero-GET-after-seed is achievable.

## Phase 1 — Backend batch/whole-draft read (~0.5–1 day incl. tests)

Under `backend/features/project_document/`. `uv`, raw SQL, strict typing,
Pydantic v2.

1. **Model** (shape (b)): `BatchDraftTablesResponse { tables: dict[str,
   RegisteredTableResponse] }` — each value the **full** per-table response
   (already embeds source + etags), so seeding is a literal 1:1 map.
2. **Service** in `store.py`: `get_draft_tables_batch(version_id, table_names,
   access)` — call `get_current_document_view` **once**, then loop the requested
   contracts' `build_response` over that single `document` view. One load+validate
   total. Reuse `ProjectEditAccess` / `require_editor_user`. Validate each name
   via `get_table_contract` (404s unknown names, as the per-table route does).
3. **Route** in `routes.py`: `GET …/draft/tables?names=…` →
   `BatchDraftTablesResponse`. Sibling of the existing per-name routes; **leave
   `GET/PUT/POST …/draft/tables/{table_name}` untouched** — the per-table read is
   still used by `resolveSliceForWrite`'s refetch and by un-seeded mounts. Declare
   the collection route before `{table_name}`. **No read-safe envelope:** the
   per-table draft read 422s on an invalid draft (via `load_current_document_parts`)
   and has no envelope path; the batch matches that.

**Tests:** batch returns one entry per requested name with payloads equal to the
per-name endpoint for the same draft; unknown name → 404; invalid draft → 422;
duplicate names collapse; non-editor rejected; **one** document load (assert via
a load counter/log or service-level test). See `phases/phase-01-backend-batch-read.md`.

Gate: `make ci` backend lane green; equality-with-per-name test passing.

## Phase 2 — Frontend batch-seed (~1–1.5 days incl. e2e)

The careful phase. **Do not change `useSliceQuery`, `applyAcceptedSlice`,
`invalidateProjectDocumentEditorTableSlices`, or `resolveSliceForWrite`** — the
collapse is additive seeding around them.

1. Add `fetchDraftTablesBatch(projectId, versionId, names, signal)` to the
   document API layer.
2. Add a page-scoped prefetch (hook or small provider) the equipment / spaces /
   thermal-bridges pages mount once with their table set. On resolve, for each
   name: `queryClient.setQueryData(<per-table editor slice key>, payload)` with
   the freshness tuning from Phase 0 so the per-table `useSliceQuery` reads the
   seed and does not refetch.
3. **Fallback preserved:** any table whose key was not seeded (deep-link, page
   that doesn't mount the prefetch) still fetches per-table exactly as today.
4. Confirm the seeded `source`/etags equal what a per-table fetch would set, so
   the first write's `If-Match` is correct without a pre-write refetch.

**Tests:**
- Unit/integration: after seeding, mounting the per-table query yields data with
  **zero** per-table GETs (the trap from Phase 0).
- **e2e regression — hard gate:** `table-draft-etag-coordination.spec.ts` passes
  unchanged. Edit table A → navigate to B → edit B succeeds (no stale-draft
  block). Add an assertion that the cross-table write still works *after* a
  seeded load specifically.

Gate: `make frontend-dev-check` + the e2e coordination spec green.

## Phase 3 — Verification

1. Re-run the read-only production perf matrix. Confirm `equipment` draft-tables
   GETs drop from 7 → 1 (route API# falls to ~13 with table-views still
   per-table, or ~7 if both refactors have landed). Confirm `spaces` /
   thermal-bridges fall correspondingly.
2. Confirm server-side: one whole-draft load per page mount instead of seven
   (log/metric inspection).
3. Manual: full editor smoke on equipment, spaces, thermal-bridges — load, edit
   across tables, save, reload-draft, version-locked path. The cross-table edit
   bug (#18) must not reappear.
4. `make ci` full lane green.

## Phase 4 — Closeout

1. `simplify` then `docs-pass` skills on the diff.
2. `make format`; if it changes files, re-inspect and re-run `make ci`.
3. Update `STATUS.md` with evidence (perf delta + server load-count delta + e2e
   green). Fold the result into the parent packet's triage card Finding 2 and
   close `step-2-equipment-fanout-investigation.md`.

## Risk / rollback

- Backend additive (new read route + model + service fn); per-table routes
  untouched, so revert = delete the additions.
- Frontend seed is additive: if the prefetch is removed or a key isn't seeded,
  the page falls back to today's per-table fan-out — correct, just slower. So
  Phase 2 can land page-by-page (equipment first).
- **Hard stop:** if the e2e coordination spec cannot stay green with seeding,
  abandon the collapse rather than weaken the protocol. The perf win is not worth
  reopening the cross-table edit bug.

## Phase 0 findings

_(append here when Phase 0 runs)_
