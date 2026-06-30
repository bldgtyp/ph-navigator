---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Lock the endpoint shape, capture the PR #18 invariant verbatim, and
  de-risk the seed-without-refetch mechanism in a throwaway spike. No production
  code.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ../../../archive/dated/2026-06-29/equipment-draft-etag-coordination/
---

# Phase 00 — Pre-flight + design lock + seeding spike

## Goal

Remove the two unknowns that make this refactor risky, **before** writing any
production code: (1) exactly what PR #18 guarantees and how, and (2) whether a
pre-mount cache seed can stop the per-table GET *without* refetching on mount and
*without* breaking #18. If the spike can't prove (2), the refactor does not
proceed.

## Confirm — backend collapse is mechanical (already verified at authoring)

1. `store.get_draft_table_slice(version_id, table_name, access)` =
   `get_current_document_view(version_id, access)` (loads + validates the whole
   draft **once**) → `contract.build_response(project_id, version_id,
   document.source, document.version_etag, document.draft_etag, document.body)`.
2. `TableContract.build_response` is typed `Callable[[UUID, UUID,
   ProjectDocumentSource, str, str | None, ProjectDocumentV1], BaseModel]` — a
   **pure function** of (ids, source, version_etag, draft_etag, body). So a batch
   = one `get_current_document_view` + a loop of `build_response` with identical
   doc-level args. Each entry is byte-identical to `GET …/draft/tables/<name>`.
3. The per-table draft read **422s** on an invalid draft (via
   `load_current_document_parts`); it does **not** return the
   `ProjectDocumentReadSafeEnvelope` (only `/draft` summary and `/document` do).
   The batch matches this — 422 on invalid, no envelope. (Corrects an earlier
   note in README/PLAN that mentioned an envelope path.)
4. Registry: `get_table_contract(name)` (404s unknown name),
   `iter_table_contracts()` for "all".

## Decide — endpoint shape

5. **Default to shape (b): `BatchDraftTablesResponse { tables: dict[str,
   RegisteredTableResponse] }`**, where each value is the *full* per-table
   response (it already embeds `project_id, version_id, source, version_etag,
   draft_etag` + the table payload). This makes frontend seeding a literal
   `setQueryData(perTableKey, tables[name])` with no reconstruction.
   - Reject shape (a) whole-draft `GET /draft/document` → `ProjectDocumentV1`:
     it would force the client to slice raw document internals, risking drift
     from what `build_response` produces. (b) reuses the contract, so there is no
     drift.
6. **`names` param:** repeated query param `?names=pumps&names=fans`
   (`list[str]`), bounded (e.g. 1..64). Document path `version_id` stays in the
   route path (URLs are `…/versions/<v>/draft/tables…`).

## Capture — the PR #18 invariant (read the test, not just the code)

7. Read `frontend/tests/e2e/table-regression/table-draft-etag-coordination.spec.ts`
   and `useSliceTableController.test.tsx`. Write the invariant into this file's
   Findings, precisely:
   - All tables share one document-level draft etag.
   - `applyAcceptedSlice` invalidates every other editor table slice with
     `refetchActiveSlices: false` (marks `isInvalidated`, does **not** refetch).
   - `resolveSliceForWrite` keys on `getQueryState(editorSliceQueryKey)
     ?.isInvalidated` → refetches only that one table before its write, so
     `If-Match` carries the current etag.
   - The spec records draft-table network entries (`DraftTableNetworkRecorder`,
     per `tableKey`). **Note which network assertions it makes** — initial-load
     GET counts vs write-path refetch — because Phase 02 changes initial-load
     GETs (7 → 1) and those expectations may need updating *without weakening the
     write-path coordination assertion*.

## Spike — seed without refetch, keep #18 (the gating unknown)

8. In a throwaway branch, prove this sequence on the equipment page:
   - `queryClient.setQueryData(editorSliceQueryKey, payload)` for each table
     before its `useSliceQuery` mounts;
   - `useSliceQuery` (currently **no `staleTime`**, so default 0) must **not**
     fire a GET on mount for a seeded, non-invalidated key.
   - Candidate levers (decide which, record why):
     - **Add `staleTime`** to `useSliceQuery` (e.g. a long page-session value or
       `Infinity`). Invalidation sets `isInvalidated` **independent of
       `staleTime`**, so `resolveSliceForWrite` still refetches before a write —
       #18 intact. This is the leading candidate.
     - **Gate `enabled`** on "batch not in-flight for this key" to avoid the
       race where a table mounts and GETs before the batch resolves.
   - Confirm: after editing table A, table B's slice is still `isInvalidated` and
     `resolveSliceForWrite` still refetches B before B's write (the #18 path is
     untouched by the seed/staleTime change).

## Acceptance / gate

Findings filled with: confirmed endpoint shape + `names` bound; the #18 invariant
and the spec's network assertions; and a **green spike** showing zero per-table
GETs after seeding with #18 behavior preserved. If the spike fails, stop and
record why — do not start Phase 01.

## Findings

_(fill in when Phase 00 runs)_
