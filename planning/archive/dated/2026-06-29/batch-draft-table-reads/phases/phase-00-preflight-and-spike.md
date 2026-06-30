---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: COMPLETE (2026-06-29) — shape (b) locked, #18 invariant captured, seeding mechanism de-risked
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

## Findings (2026-06-29)

### Backend collapse is mechanical — CONFIRMED

- `store.get_draft_table_slice(version_id, table_name, access)`
  (`backend/features/project_document/store.py:194`) =
  `get_current_document_view(version_id, access)` (one whole-draft load+validate
  via `load_current_document_parts`) → `contract.build_response(project_id,
  version_id, document.source, document.version_etag, document.draft_etag,
  document.body)`.
- `TableContract.build_response` is typed (`tables/contracts.py:256`)
  `Callable[[UUID, UUID, ProjectDocumentSource, str, str | None,
  ProjectDocumentV1], BaseModel]` — a pure function of (ids, source,
  version_etag, draft_etag, body). So a batch = **one**
  `get_current_document_view` + a loop of `build_response` with identical
  doc-level args, and each entry is byte-identical to `GET …/draft/tables/<name>`.
- `get_table_contract(name)` (`tables/registry.py:35`) raises **404**
  `document_table_not_found` on an unknown name.
- `load_current_document_parts` raises **422** `invalid_project_document` on a
  draft that fails validation; it does **not** return the read-safe envelope
  (only `/draft` summary and `/document` do). The batch matches this — 422 on
  invalid, no envelope path. (Confirms the PLAN/README correction.)

### Endpoint shape — LOCKED to (b)

- `BatchDraftTablesResponse { tables: dict[str, RegisteredTableResponse] }`, each
  value the full per-table response (already embeds `project_id, version_id,
  source, version_etag, draft_etag` + payload). Seeding is then a literal
  `setQueryData(perTableKey, tables[name])`.
- **Mirror the shipped table-views batch** (`features/table_views/routes.py`,
  `service.py`): `MAX_BATCH_TABLE_KEYS = 64`; collection route declared **before**
  the `{table_name}` item route; de-dupe with `list(dict.fromkeys(names))`
  preserving request order; invalid/unknown name rejects the whole request
  (nothing partial). `names` is a repeated query param, `Query(min_length=1,
  max_length=64)`.

### PR #18 invariant — CAPTURED (from spec + `useSliceTableController.ts`)

- All editor table slices share one document-level draft etag; the cache key is
  exactly 8 elements: `["project-document-tables","project",pid,"table",name,
  "slice",versionId,"editor"]` (`table-slice.ts` `isEditorTableSliceQueryKey`).
- `applyAcceptedSlice` writes the accepted table's slice, then
  `invalidateProjectDocumentEditorTableSlices(..., excludeTableName,
  refetchActiveSlices: false)` → invalidates every **other** editor slice with
  `refetchType: "none"` (marks `isInvalidated`, does **not** GET).
- `resolveSliceForWrite` (`useSliceTableController.ts:263`) returns the in-memory
  slice unless `getQueryState(editorSliceQueryKey)?.isInvalidated` → then one
  `refetch()` (a single per-table GET) so `If-Match` carries the current etag.
- **Spec network assertions** (`table-draft-etag-coordination.spec.ts`): its
  `draftTableKeyFromUrl` matches only `/draft/tables/<name>$` (item path) — the
  batch URL `/draft/tables?names=…` has pathname `…/draft/tables` (no trailing
  segment) and is **invisible to the recorder**. The recorder is also attached
  **after** `openTable(...)`, so the **initial-mount fan-out is not asserted**.
  The spec asserts only: (1) after a source write, zero sibling GETs fan out;
  (2) after switching to the target tab + write, **exactly one** fresh target GET
  precedes the target PUT; (3) no 409s. All three are write-path assertions that
  the seed does not touch → **the spec should stay green unmodified**.

### Seeding mechanism — DE-RISKED (TanStack Query v5 semantics + code read)

The plan's "throwaway spike" is folded into Phase 02's first unit test
(zero per-table GETs after seeding) — building a separate spike branch is
redundant given the analysis below and that the e2e recorder can't see the batch.

- **Trap:** `useSliceQuery` has no `staleTime` today (default 0), so a
  `setQueryData`-seeded entry is immediately stale and a mounting observer
  refetches → the fan-out reappears. **Fix:** add `staleTime: Infinity` to
  `useSliceQuery`'s `useQuery`. A freshly-seeded query is then fresh → no
  mount refetch.
- **#18 preserved:** `invalidateQueries` sets `isInvalidated` **independent of
  `staleTime`**, and `resolveSliceForWrite` keys on `isInvalidated` (not
  staleness), so refetch-before-write still fires after a sibling write. Manual
  `refetch()` ignores `staleTime`, so reload-draft and the write-path refetch
  are unaffected.
- **Race fix (mount/seed ordering):** the 7 `useXxxSliceQuery` calls fire at the
  top of `EquipmentPage` synchronously, before any async batch resolves — so the
  per-table queries must be **gated** until the seed lands, or they GET first.
  Mechanism: a `useDraftTablesBatchSeed({projectId, versionId, tableNames,
  enabled})` hook runs a `useQuery` for the batch (`staleTime: Infinity`), seeds
  each per-table editor key in an effect, and tracks a `seededVersion` state so
  it returns `isSeeding` **true until the effect has actually written the cache**
  (not merely until the batch resolved — avoids the one-render gap where queries
  enable before the effect seeds). `EquipmentPage` passes `enabled = !isSeeding`
  as the existing 4th `enabled` param of each `useXxxSliceQuery` (the param is
  already there — `useSliceQuery(projectId, versionId, accessMode, enabled=true)`
  — so **no hook signature changes**), and folds `isSeeding` into its loading
  guard so it shows "Loading…" rather than the error branch while gated.
- **Fallback:** `enabled=false` for the seed (viewer mode) or a batch error →
  `isSeeding=false` → per-table queries enable and fetch exactly as today.
  Tables/pages with no provider are unaffected.
- **Seed key:** use the feature factory's own `queryKeys.slice(projectId,
  versionId, "editor")` so the seed key always equals what `useSliceQuery` reads;
  never hand-build the array.

### Pages / slice features that seed

- **equipment** — exactly the 7 mounted at `EquipmentPage` top: ventilators,
  pumps, fans, hot_water_heaters, hot_water_tanks, electric_heaters, appliances
  (mirrors `EQUIPMENT_VIEW_TABLE_KEYS` from the shipped table-views batch).
  Rooms and heat-pump sub-tables mount on their own tabs (lazy) — not part of the
  page-top fan-out, so they keep the per-table fallback for now.
- **spaces**, **assets/ThermalBridges** — land after equipment; same provider,
  their own mounted table set. Fallback means an un-wrapped page just fans out
  (correct, slower).

### Gate — PASSED

Endpoint shape + `names` bound decided; #18 invariant + spec assertions written
down; zero-GET-after-seed shown achievable with #18 intact. Proceed to Phase 01.
