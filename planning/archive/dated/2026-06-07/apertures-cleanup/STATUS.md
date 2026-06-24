---
DATE: 2026-06-07
TIME: (compiled)
STATUS: Active — C-01 + C-02 shipped 2026-06-07; C-03 mostly
        shipped (N+1 bulk-fetch deferred); C-04 partial
        (latent-bug fixes shipped, larger refactors deferred).
AUTHOR: Claude
SCOPE: Track which cleanup items from PRD.md have shipped and which
       are still queued. C-01 maps the original PRD §A.1–A.6 (+§B.2)
       into a concrete phase plan. C-02 / C-03 / C-04 cover the
       refactor candidates surfaced by the 2026-06-07 review that
       are not in the PRD.
RELATED:
  - planning/archive/apertures-cleanup/PRD.md
  - planning/archive/apertures-cleanup/phases/
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
  - planning/archive/apertures/STATUS.md (final state of the 13-phase build)
---

# Apertures cleanup — status

Nothing in flight. The legacy backlog lives in `PRD.md`; the
2026-06-07 post-build review queued three additional phase plans
(C-02, C-03, C-04) under `phases/`. C-01 covers the PRD's §A.1–A.6
(+§B.2) rename items and also has a phase plan under `phases/`.

## Phase queue

| Phase  | Title                                | Status   | Plan |
|--------|--------------------------------------|----------|------|
| C-01   | `Window*` → `Aperture*` removal      | **Done** (2026-06-07) | `phases/phase-c01-window-to-aperture-removal.md` |
| C-02   | Backend handler consolidation        | **Done** (2026-06-07) | `phases/phase-c02-backend-handler-consolidation.md` |
| C-03   | Drift correctness + cross-cutting    | **Mostly done** (2026-06-07); N+1 bulk-fetch deferred | `phases/phase-c03-drift-cross-cutting.md` |
| C-04   | Frontend hygiene pass                | **Partial** (2026-06-07); latent bugs fixed, larger refactors deferred | `phases/phase-c04-frontend-hygiene.md` |

## C-01 close-out notes (2026-06-07)

Audit on 2026-06-07 found that the bulk of C-01 (§A.1–§A.5) had
already shipped in earlier work — likely the catalog-seed PR
(`f1098b0 Require catalog-only aperture picks`) and the
apertures/assemblies seed work around it. The remaining work
shipped in this session:

- **§A.6 `/projects/:id/windows` → `/projects/:id/apertures`
  redirect.** Added explicit redirect routes for both
  `/projects/:projectId/windows` and `/projects/:projectId/windows/*`
  in `frontend/src/app/router.tsx` (the previous catch-all routed
  unknown tabs to project status, which silently swallowed
  `/windows` bookmarks).
- **§B.2 `datasheet_url` column.** Added explicit `datasheet_url:
  str | None` to `FrameRef` / `GlazingRef` (in-document refs),
  `CatalogFrameType*` / `CatalogGlazingType*` Pydantic models,
  both repositories (`SELECT`, `INSERT`, `_UPDATABLE_FIELDS`),
  both services (create + duplicate pass-through), and the
  import/export modules (coerce, file_format, service) for both
  catalogs. New Alembic revision
  `20260607_0019_catalog_datasheet_url.py` adds the nullable
  `TEXT` column to both `catalog_frame_types` and
  `catalog_glazing_types`. Frontend `CatalogFrameType` /
  `CatalogGlazingType` types, payloads, import-file row types,
  and the empty-row placeholders all carry the field. No UI
  consumer yet — that lands when a UI surface needs it (e.g. a
  "Datasheet" badge); the schema is in place so it can be added
  without a second migration.

## C-04 close-out notes (2026-06-07)

Shipped — bug fixes + small wins:

- **`popUndoEntry` contract fix** (`store/builder-store.ts`). Now
  reads via `get()` and writes via `set()` instead of mutating a
  closure variable inside the updater. Eliminates the latent
  React-18-concurrent-batching hazard the review flagged.
- **`FramePicker` manufacturer-filter bug**. The "all rows" lookup
  (`useFrameCatalog`) at the second call site was passing
  `effectiveManufacturers` — so when the currently-assigned frame's
  manufacturer was filtered out, the picker silently dropped the
  current-value chip. Now calls `useFrameCatalog()` with no filters.
  `GlazingPicker` was already correct.
- **Canvas mirror memoization** (`ApertureCanvasContainer.tsx:185`).
  `mirrorApertureForInterior(aperture)` now wrapped in `useMemo` so
  the mirrored entry passes referential-equality across sibling
  components on unrelated re-renders.
- **`RefreshDialog` seed effect**. `seedKey` now hashes the delta
  field-keys + catalog values into the dialog re-seed signal — a
  drift-query refetch while the dialog is open updates the visible
  rows instead of silently leaving stale data.
- **Small wins**:
  - `pick-paste-machine.ts:28` ternary `current === "idle" ? "idle"
    : "idle"` collapsed to `return "idle"`.
  - `components/EdgeAddButtons.tsx` deleted (no consumers in
    `frontend/src` after grep).
- `make ci` green; all 1423 tests pass.

Deferred:

- §P1.3 test-fixtures extraction (`__tests__/test-fixtures.ts`).
  Five test files still redefine `makeFrameRef` / `makeGlazingRef`
  / `makeElement` / `makeEntry` locally.
- §P1.4 `ApertureCanvasContainer` decomposition into
  `useCanvasViewState` / `useDeleteDimensionOrchestrator` hooks
  (container still ~430 LOC).
- §P1.8 `ALL_SIDES` consolidation in
  `lib/aperture-constants.ts`. Three call sites still re-declare.
- §P1.9 `ViewDirection` canonical home in `types.ts`. Three sites
  declare distinct names for the same union.
- §P1.11 catalog-totals hoist (`FramePicker` / `GlazingPicker`
  still fire a second `useFrameCatalog` / `useGlazingCatalog` for
  the "total rows" count per element × side).
- §P1.12 small-win bundle remaining items (WHY comments at six
  sites, `UValueChip` → `formatUValueNumeric`, `AperturesTab`
  `*Context` indirection collapse, `RefreshDialog.stringify` dead
  branch, `LAST_ROW_REASON` / `LAST_COLUMN_REASON` moved into
  `canvas-constants.ts`, `ProjectRefsView` `useMemo`,
  `noDeleteTooltipShown` reset).
- §P1.13 coverage backfill (`VerticalDimensionStrip.test.tsx`,
  `TotalDimensionsCaption.test.tsx`,
  `useApertureDimFormat.test.ts`, `usePickPasteHandlers.test.ts`,
  `builder-store.test.ts` undo + pick-paste cases).

The deferred items are mechanical cleanup, not correctness work.
The two latent bugs (`popUndoEntry`, picker filter) are the
highest-risk items in this phase and both shipped.

## C-03 close-out notes (2026-06-07)

Shipped:

- New `project_document/store.py:load_document_body(version_id, access,
  source)` dispatches on the draft/version literal. Every caller —
  `aperture_drift/routes.py`, `aperture_u_value/routes.py`,
  `aperture_hbjson_export/routes.py`, and `apertures_mcp/tools.py:
  _read_body` — uses it. The literal `if source == "draft": ...
  else ...` block is gone from each.
- New `aperture_drift/reader.py` with `LiveCatalogReader`. Both the
  REST route and the MCP `tool_report_aperture_catalog_drift` import
  it; the duplicated `_LiveCatalogReader` class in both modules is
  gone. (Bulk-fetch optimisation deferred — see below.)
- `apertures_mcp/tools.py`: `_Wrap` hoisted to module scope as
  `_CommandEnvelope`. Pydantic class build cost no longer paid per
  `apply_aperture_command` call.
- `aperture_u_value/cache.py` is now genuinely FIFO. `get()` no
  longer `move_to_end`s; `set()` only re-orders on insert (existing
  keys keep their slot). Docstring updated from "LRU" to "FIFO".
- `aperture_hbjson_export/identifiers.py:Collision` is a Pydantic
  `BaseModel` (`frozen=True`, `extra="forbid"`); the hand-rolled
  `model_dump` is gone. Caller in `service.py` still calls
  `.model_dump()`.
- `apertures_mcp/tools.py:_read_body` already had a `-> NoReturn`
  helper at `raise_http_exception_as_mcp_error` (confirmed in
  `features/mcp/helpers.py:169`); no restructure was needed.
- Frontend: `apertureDriftReportQueryKey(projectId, versionId, source)`
  exported from `hooks/useApertureDriftReport.ts`. The
  `applyApertureCommand` mutation invalidates the drift query for
  every command kind in a new `DRIFT_AFFECTING_KINDS` set
  (refreshRefFromCatalog plus the structural / pick / paste kinds).
- `make ci` green; all 1423 frontend tests pass.

Deferred:

- **§P1.1 / Step 2 — `BulkCatalogReader` N+1 fix.** This is the only
  user-visible perf item in the plan. Requires changing the
  `detect_aperture_drift` signature to accept a pre-fetched reader
  (or pre-collecting the referenced `(kind, id)` pairs and bulk
  loading via `IN (...)`). Not shipped this pass because it touches
  the detector's contract and adds a new catalog-repository method
  (`bulk_load_catalog_rows`). The consolidation of
  `LiveCatalogReader` into `aperture_drift/reader.py` is the seam
  the bulk reader will plug into — its constructor is the only
  change required at the routes / MCP call sites.
- Step 8 unit-test backfill (`test_bulk_catalog_reader.py`,
  `test_routes_n1_regression.py`,
  `useApertureDriftReport.test.ts`). Drift-query-invalidation
  regression test is the most valuable; the other two are gated on
  the BulkCatalogReader landing.

## C-02 close-out notes (2026-06-07)

Shipped:

- New `handlers/_shared.py` with `find_entry` / `find_element` /
  `replace_aperture` / `replace_element` / `build_audit`. All eight
  handler modules import from it; local copies of those five helpers
  deleted.
- New `apertures/_ref_helpers.py` with `reset_origin` /
  `advance_origin` (semantically distinct successors of the old
  `_refresh_origin` — `reset_origin` clears `local_overrides` and pins
  `catalog_schema_version=1`; `advance_origin` preserves both for
  structural copies like split/duplicate). `bookshelf_copy_frame` /
  `bookshelf_copy_glazing` consolidated here. `factories.py`,
  `dimensions.py`, and `merge_split.py` use the appropriate variant.
  `picks.py:_stamp_synced_at` was left in place because it preserves
  the source's schema version when non-zero — a third semantic that
  does not match either of the two shared variants; its docstring
  now names the divergence.
- `refresh.py:_audit` aligned with the majority signature via
  `build_audit("refreshRefFromCatalog", ...)`.
- `_build_seeded_element` (`dimensions.py`) passes `deep=True` to
  `model_copy()` for all four frame sides + glazing. Defensive against
  future mutable fields on `FrameRef`/`GlazingRef`.
- `MergeElements.element_ids` gained `max_length=400` (matches the
  practical 20×20 grid ceiling).
- `sidebar.py` + `manufacturer_filters.py` literal status codes
  replaced with `starlette.status.*` constants.
- Dead `_ = document_etag` line + unused `document_etag` import
  removed from `aperture_commands/service.py`.
- Net handlers LOC: 1579 → 1382 (~200 lines saved).
- `make ci` green; all 1423 existing tests pass without assertion
  changes.

Deferred:

- Step 8 unit-test backfill (`test_shared_helpers.py`,
  `test_ref_helpers.py`, plus the specific gaps named in §1 of the
  review). Existing handler integration tests cover the helpers
  through their dispatcher entry points; standalone unit tests for
  the extracted helpers are nice-to-have follow-ups, not blocking.

Already-shipped C-01 acceptance items (§A.1–§A.5):

- §A.1 backend type rename: no `WindowTypeEntry` / `WindowElement`
  / `WindowElementFrames` references remain anywhere in `backend/`
  or `frontend/src/`.
- §A.2 field rename: no `tables.window_types` references in
  product code.
- §A.3 ID prefix migration shim: no `win_*` / `winel_*` ids exist;
  the read-path shim was not needed.
- §A.4 Alembic JSON munge: migration
  `20260605_0018_apertures_default_catalog_seed.py` seeds the two
  required catalog rows (`PHN-Default-Frame`,
  `PHN-Default-Glazing`). No JSON-body munge was needed because
  no persisted document carried `win_*` keys.
- §A.5 frontend `windows` folder removal: no
  `frontend/src/features/windows/` exists; tab router knows only
  `apertures`.

C-01 ships first because the rename touches files C-02 and C-04
also touch; doing it later means re-doing the rename through both
of those PRs. C-01 folds in PRD §A.1–A.6 plus §B.2 (`datasheet_url`
column) per the PRD note that it ships co-located with the rename.

C-02 and C-04 touch disjoint files and can ship in either order
or in parallel branches. C-03 sits between them on the dependency
graph — the frontend half of C-03 (drift-query invalidation) is
called out in C-04 Step 9 with a "do it here if C-03 hasn't shipped"
gate to avoid duplicate work.

## Suggested ship order

1. **Phase C-01** — `Window*` → `Aperture*` removal
   (PRD §A.1–A.6 + §B.2). Unblocks `aperture_default_refs_missing`
   503; eliminates the tracer-bullet coexistence pattern; folds in
   the `datasheet_url` ref-column add; biggest churn-cost saver if
   done before C-02 / C-04.
2. **Phase C-02** — Backend handler consolidation. Largest
   maintenance-cost payoff. Mechanical; low risk.
3. **Phase C-03** — Drift correctness + cross-cutting. Only
   phase with user-visible performance impact (drift N+1).
4. **Phase C-04** — Frontend hygiene pass. Smallest blast radius;
   can run in parallel with C-02 or C-03 if branch management
   permits.

## Blockers

- C-01's Alembic migration (PRD §A.4) is the gating step for
  PRD §A.1–A.3 — the persisted JSON has to migrate before the
  field rename's validation can run cleanly. Keep them in one PR.
- C-03 Step 5 (`_read_body` cannot return `None`) may require
  touching `raise_http_exception_as_mcp_error` in a shared MCP
  helper module outside the aperture surface area. Confirm the
  scope before opening the PR.

## How to start a phase

1. Open the relevant `phases/phase-c0N-*.md`.
2. Read P0 + P1 to scope. Read P2 to inventory file touches.
3. Branch from main (or from the unmerged C-01 base if C-01
   hasn't landed yet — see the memory note on
   `[[feedback_worktree_chain]]`).
4. Work through P3 steps in order; each step is a commit.
5. P4 verification gates the phase close; P5 risks list the
   things to watch for.
