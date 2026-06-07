---
DATE: 2026-06-07
TIME: (compiled)
STATUS: Active — queued behind Phase C-02
AUTHOR: Claude
SCOPE: Fix the N+1 catalog-read pattern in drift detection,
       consolidate the duplicated `_LiveCatalogReader` across REST
       and MCP, extract a shared `load_document_body` helper used
       by every aperture-derived route, hoist the per-call Pydantic
       model rebuild inside `apertures_mcp/tools.py`, resolve the
       FIFO/LRU docstring mismatch in `aperture_u_value/cache.py`,
       and align `Collision.model_dump` with the Pydantic
       convention used everywhere else. Includes the frontend
       counterpart: drift-query invalidation after
       `refreshRefFromCatalog` and an exported query-key factory.
RELATED:
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
    (sections "Backend §9–§15" + Frontend §12)
  - planning/features/apertures-cleanup/PRD.md §C.1 (drift
    report cache key — separate concern, not this phase)
  - context/CODING_STANDARDS.md
---

# Phase C-03 — Drift correctness + cross-cutting cleanup

## P0. Why this phase

This is the only phase in the cleanup backlog with user-visible
performance impact. Drift detection is N+1 today: the live
catalog reader opens a fresh database connection per
`get_frame_type` / `get_glazing_type` call, and the detector
loops every element × every side. A 20-aperture-type document
with three elements per type is up to **300 DB round-trips per
drift-report request**. Worse, the same `_LiveCatalogReader`
class is duplicated across `aperture_drift/routes.py` and
`apertures_mcp/tools.py`; the MCP server has its own copy of the
same N+1.

Adjacent to the drift fix sit four mechanical consolidations that
are easier to ship together than separately because they all sit
on the same dependency edge (route → document load → catalog
read):

- The `if source == "draft": ... else: ...` document-load block
  is triplicated across `aperture_drift/`, `aperture_u_value/`,
  and `aperture_hbjson_export/` REST routes, plus a fourth copy
  inside `apertures_mcp/tools.py:_read_body`.
- `apertures_mcp/tools.py` declares a fresh Pydantic class
  (`_Wrap`) inside `tool_apply_aperture_command` on every call.
  Pydantic v2 builds the validator and JSON schema on class
  creation; for high-frequency MCP write traffic this is real
  per-call overhead.
- `aperture_u_value/cache.py` docstring says "FIFO (insertion
  order)" but `get()` calls `move_to_end`, which makes it LRU.
  Either the behavior should match the docstring or the docstring
  should match the behavior. The 256-entry sizing rationale was
  written against the FIFO claim.
- `aperture_hbjson_export/identifiers.py:Collision` is a
  `@dataclass(frozen=True)` with a hand-written `model_dump()`
  method. Every other wire-shape in the codebase is a Pydantic
  BaseModel. New fields on `Collision` silently break the
  serialisation contract.
- `apertures_mcp/tools.py:_read_body` has an `except` branch that
  calls `raise_http_exception_as_mcp_error`. That helper does
  raise, but its return is not annotated `-> NoReturn`, so the
  type checker treats the except branch as falling off the end.
  Today the declared `ProjectDocumentV1` return is a latent lie.

Phase C-03 also closes the corresponding frontend gap: after a
`refreshRefFromCatalog` mutation succeeds, the drift report is
not invalidated because `useApertureDriftReport` does not export
a query-key factory and `hooks.ts` has no entry for it. The
banner shows stale state until the user navigates away and back.

## P1. Acceptance — Phase C-03 done when

1. **Drift N+1 fixed.** A drift-report request issues O(1) catalog
   queries — one bulk fetch per catalog kind (frames + glazings)
   — not O(elements × sides). Implementation uses a
   `BulkCatalogReader` that pre-fetches every referenced
   `(catalog_kind, record_id)` before the detector walks the
   document. Measured on a 20-type / 3-element fixture: ≤ 2
   queries per request, down from up to 300.
2. **`_LiveCatalogReader` consolidated.** A single
   `aperture_drift/reader.py` exports the canonical
   `BulkCatalogReader` class. `aperture_drift/routes.py` and
   `apertures_mcp/tools.py` both import it. No other module
   defines a `CatalogRowReader` implementation.
3. **`load_document_body` consolidated.** New helper
   `load_document_body(version_id: str, access, source: DocumentSource)
   -> ProjectDocumentV1` lives in `project_document/store.py`.
   Every aperture-derived REST route uses it. The MCP `_read_body`
   uses it. The `if source == "draft" ... else ...` literal block
   appears in exactly one place.
4. **MCP `_Wrap` hoisted.** `_Wrap` is a module-scope private
   class. `tool_apply_aperture_command` references it. Latency
   under repeated MCP write calls drops noticeably (mostly
   GC pressure / heap churn, not query latency).
5. **U-value cache FIFO/LRU resolved.** One of:
   - `aperture_u_value/cache.py` removes the `move_to_end` call
     in `get()`, making it truly FIFO and matching the docstring; OR
   - the docstring is updated to "LRU (move-to-end on access)" and
     the 256-entry sizing rationale is rewritten to explicitly
     reference LRU semantics.
   Recommendation: pick FIFO — it is what the docstring promised
   and what the sizing rationale assumed. The change is one line.
6. **`Collision` is a Pydantic model.** `aperture_hbjson_export/
   identifiers.py:Collision` becomes a `BaseModel` with the same
   fields. Callers continue to call `.model_dump()`. The
   hand-rolled dict method goes away.
7. **`_read_body` cannot return `None`.** Either
   `raise_http_exception_as_mcp_error` is annotated `-> NoReturn`,
   or `_read_body` uses `raise` directly. The mypy/ty pass
   confirms the function's declared `ProjectDocumentV1` return
   is honored on every path.
8. **Drift query invalidation wired.**
   `useApertureDriftReport` exports
   `apertureDriftReportQueryKey(projectId, versionId, source)`.
   `hooks.ts` invalidates that key after any
   `refreshRefFromCatalog` mutation succeeds (same pattern as
   the U-value invalidation).
9. **Drift staleness regression test.** A frontend integration
   test mounts the banner, mocks a successful
   `refreshRefFromCatalog`, and asserts the banner re-renders
   with the post-refresh state without a remount.
10. **`make ci` green.** No behavior change in the REST or MCP
    contracts — every existing handler / route test passes
    unmodified.

## P2. Files touched

### New files

- `backend/features/aperture_drift/reader.py` (~60 lines) —
  canonical `BulkCatalogReader` with a pre-fetched
  `dict[(kind, id), row]` map. Implements the existing
  `CatalogRowReader` protocol from `detector.py`.
- `backend/tests/aperture_drift/test_bulk_catalog_reader.py` —
  count fixture queries vs the input ref set.

### Modified — backend

- `backend/features/aperture_drift/routes.py` — drop local
  `_LiveCatalogReader`, import `BulkCatalogReader`, use
  `load_document_body`.
- `backend/features/aperture_drift/detector.py` — accept a
  pre-bulk-fetched reader; emit a list of `(kind, id)` pairs
  needed before the walk (one new helper). No behavior change to
  the detection logic itself.
- `backend/features/aperture_u_value/routes.py` — use
  `load_document_body`.
- `backend/features/aperture_u_value/cache.py` — remove
  `move_to_end` from `get()`. Docstring stays. (Or the inverse
  per P1.5 — final decision in step 5.)
- `backend/features/aperture_hbjson_export/routes.py` — use
  `load_document_body`.
- `backend/features/aperture_hbjson_export/identifiers.py` —
  `Collision` becomes `BaseModel`. Delete the hand-rolled
  `model_dump`. Callers in `service.py:86` continue calling
  `.model_dump()`.
- `backend/features/aperture_hbjson_export/service.py` — verify
  no behavior change at the call site.
- `backend/features/apertures_mcp/tools.py`:
  - Drop the local `_LiveCatalogReader`; import
    `BulkCatalogReader`.
  - Use `load_document_body` inside `_read_body`.
  - Hoist `_Wrap` to module scope.
  - Annotate `raise_http_exception_as_mcp_error -> NoReturn` (in
    its source module) or restructure `_read_body` to `raise`
    explicitly.
- `backend/features/project_document/store.py` — add
  `load_document_body(version_id, access, source)`.

### Modified — frontend

- `frontend/src/features/apertures/hooks/useApertureDriftReport.ts` —
  export `apertureDriftReportQueryKey(projectId, versionId, source)`.
- `frontend/src/features/apertures/hooks.ts` — invalidate the
  drift report key in the `refreshRefFromCatalog` mutation
  success path. Match the U-value invalidation shape.

### New tests

- `backend/tests/aperture_drift/test_bulk_catalog_reader.py`
- `backend/tests/aperture_drift/test_routes_n1_regression.py` —
  asserts the query count for a 5-aperture fixture is ≤ 2.
- `frontend/src/features/apertures/__tests__/useApertureDriftReport.test.ts` —
  query-key factory shape; cache invalidation after
  `refreshRefFromCatalog`.

## P3. Implementation steps

Each step is a self-contained commit. `make ci` between steps.

### Step 1 — Shared `load_document_body` helper

1. Add `load_document_body(version_id, access, source)` to
   `project_document/store.py`. Signature mirrors the existing
   `get_current_document_view` / `get_saved_document` calls plus
   the `source` discriminator.
2. Update each of `aperture_drift/routes.py`,
   `aperture_u_value/routes.py`,
   `aperture_hbjson_export/routes.py`, and
   `apertures_mcp/tools.py:_read_body` to call it.
3. Run the existing route tests for all three features.

### Step 2 — `BulkCatalogReader` + drift detector bulk-fetch seam

1. Create `aperture_drift/reader.py` with `BulkCatalogReader`.
   It implements the `CatalogRowReader` protocol but is
   constructed from a pre-fetched
   `dict[tuple[CatalogKind, str], CatalogRow | None]`.
2. Add `collect_referenced_catalog_ids(document) ->
   list[tuple[CatalogKind, str]]` to `detector.py`. Walks every
   element × side, yields each referenced `(kind, record_id)`.
3. Add `bulk_load_catalog_rows(conn, refs) ->
   dict[(kind, id), row]` to the catalog repository module.
   One `IN (...)` query per `kind`.
4. The detector's public entry point now expects a
   `BulkCatalogReader`. Existing tests that pass a stub reader
   continue to work — the protocol is unchanged.
5. `routes.py`:
   - Compute the ref list once
   - Bulk-fetch into a map
   - Construct `BulkCatalogReader(map)`
   - Pass into the detector
6. Add `test_routes_n1_regression.py`.

### Step 3 — Consolidate `_LiveCatalogReader` across REST + MCP

1. `apertures_mcp/tools.py`: replace the local `_LiveCatalogReader`
   with the shared `BulkCatalogReader` flow (collect → bulk-fetch
   → construct → detect).
2. Delete the duplicate class.

### Step 4 — Hoist MCP `_Wrap` class

1. Move `class _Wrap(BaseModel)` from inside
   `tool_apply_aperture_command` to module scope. Rename to
   `_ApplyApertureCommandWrapper` (or keep the private `_Wrap` —
   pick one and add a docstring noting why it exists at all,
   which is to normalise the `command` discriminator).
2. Confirm the MCP write smoke test still passes.

### Step 5 — `_read_body` cannot return `None`

1. Open `backend/features/mcp/...` (wherever
   `raise_http_exception_as_mcp_error` is defined). Annotate
   `-> NoReturn`.
2. Confirm `_read_body` in `tools.py` now type-checks without
   any structural change.
3. If the helper lives in a module that cannot reasonably be
   annotated (e.g., it really might return), restructure
   `_read_body` to:
   ```python
   except HTTPException as exc:
       raise raise_http_exception_as_mcp_error(exc)
   ```
   so the explicit `raise` makes the never-returns intent
   visible to the type checker.

### Step 6 — U-value cache FIFO/LRU decision

1. Recommended: remove the `move_to_end` call from
   `aperture_u_value/cache.py:get()`. Now the cache is genuinely
   FIFO. Existing tests should still pass — none assert
   eviction order.
2. Add a unit test that pins eviction order: insert 257 entries,
   confirm the first-inserted (not least-recently-accessed) is
   the one evicted.
3. If a future hot path needs LRU, the change is one line and a
   docstring update — but defer that until a workload demands it.

### Step 7 — `Collision` → BaseModel

1. Convert `aperture_hbjson_export/identifiers.py:Collision` from
   `@dataclass(frozen=True)` to
   `class Collision(BaseModel): model_config = ConfigDict(frozen=True, extra="forbid")`.
2. Delete the hand-rolled `model_dump`.
3. Confirm the call site in `service.py:86` works unchanged.

### Step 8 — Frontend drift query invalidation

1. `hooks/useApertureDriftReport.ts`:
   ```ts
   export function apertureDriftReportQueryKey(
     projectId: string, versionId: string, source: DocumentSource
   ): readonly unknown[] {
     return ["aperture-drift-report", projectId, versionId, source];
   }
   ```
   Replace the inline array literal in the hook with a call.
2. `hooks.ts`: in the success branch of the
   `refreshRefFromCatalog` mutation, invalidate the drift query.
   Mirror the U-value invalidation pattern exactly.
3. Add `__tests__/useApertureDriftReport.test.ts` covering:
   - The query key factory shape
   - The cache-invalidation hook re-fires after a successful
     `refreshRefFromCatalog` mutation

## P4. Verification

- `make ci` green after each step.
- `pnpm exec vitest run useApertureDriftReport` green.
- Manual: open a project with ≥ 10 aperture types in Playwright
  MCP, open the drift banner, count the network requests. Should
  be 1 per drift-report fetch, not N.
- Backend metric: in
  `test_routes_n1_regression.py`, assert that the count of
  catalog-fetch SQL calls observed by a test instrumentation
  layer is ≤ 2 for the fixture, regardless of fixture size.

## P5. Risks

- **R-C03-1 — `BulkCatalogReader` semantics differ from
  `_LiveCatalogReader`.** The live reader fails gracefully on a
  missing row (returns `None`); the bulk reader must do the same.
  **Mitigation:** the pre-fetched map stores `(kind, id) -> row | None`
  so a missing id resolves to `None` exactly as today. Unit test
  pins this.
- **R-C03-2 — `load_document_body` consolidation collapses an
  intentional difference.** Verify each of the four call sites
  passes the same access + source semantics. **Mitigation:** the
  three REST routes use `current_user` access; the MCP path uses
  the MCP token's effective access — same `Access` shape. Each
  call site keeps its current access object; only the dispatch is
  shared.
- **R-C03-3 — Frontend invalidation cascades into other
  unrelated queries.** Only the drift-report key is invalidated.
  **Mitigation:** explicit `queryClient.invalidateQueries({ queryKey:
  apertureDriftReportQueryKey(...) })` — not a wildcard.
- **R-C03-4 — FIFO behavior change reveals an LRU-assuming
  caller.** No caller today asserts LRU semantics. **Mitigation:**
  Step 6 adds the eviction-order test.
- **R-C03-5 — `Collision` as `BaseModel` changes the JSON shape.**
  Pydantic's `model_dump()` and the hand-rolled dict should be
  byte-equivalent for this struct, but verify. **Mitigation:**
  a serialisation-equivalence test in
  `test_aperture_hbjson_export_identifiers.py` before deleting
  the old method.

## P6. Out of scope

- The drift-report `(catalog_snapshot_id, document_hash)` cache
  key from backlog C.1 — that depends on catalog versioning work
  that has not yet landed.
- U-value 300 ms debounce (backlog C.2) — separate from the cache
  semantics fix.
- Anything in `apertures_mcp` beyond the `_LiveCatalogReader`
  consolidation, the `_Wrap` hoist, and the `_read_body` fix.
  MCP polish items D.1–D.3 stay in the existing backlog.
