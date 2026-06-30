---
DATE: 2026-06-29
TIME: 21:20 EDT
STATUS: Active — proposed refactor, planned, not started. Prerequisite
  (table-views batch) now SHIPPED; this is the remaining, higher-risk half.
AUTHOR: Claude (Opus 4.8)
SCOPE: Collapse the per-table `…/draft/tables/<type>` initial-mount fan-out into
  one batch/whole-draft read that seeds per-table caches, WITHOUT regressing the
  PR #18 draft-etag coordination protocol.
RELATED:
  - planning/archive/dated/2026-06-29/batch-table-views-endpoint/ (the sibling refactor — SHIPPED; pattern precedent)
  - planning/refactor/production-frontend-performance/handoffs/step-2-equipment-fanout-investigation.md
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md
  - planning/archive/dated/2026-06-29/equipment-draft-etag-coordination/ (PR #18 — the protocol this MUST preserve)
---

# Collapse the draft-tables initial-mount fan-out (batch-seed)

## Why this exists

The production perf baseline (2026-06-29) found the `equipment` page issues 7
`GET …/versions/<v>/draft/tables/<type>` reads on a single mount (plus 7
`table-views`, handled by the sibling refactor). Each draft-tables read is more
expensive than it looks: server-side, `get_draft_table_slice` →
`get_current_document_view` → `load_current_document_parts`
(`backend/features/project_document/store.py`) **loads and validates the entire
draft document body**, then `contract.build_response` slices out one table. So
7 reads = 7 whole-draft loads + 7 validations, to return data that all lives in
**one** draft body. The fan-out wastes round-trips *and* server CPU/DB.

## The load-bearing / wasteful split — read this before touching anything

This is **not** a simple "fetch once instead of N." Part of the per-table split
is deliberate and was added very recently to fix a real bug.

**LOAD-BEARING — must NOT regress (PR #18, `equipment-draft-etag-coordination`,
merged 2026-06-29):**

- All tables share **one document-level draft etag** (`draft_etag` /
  `version_etag` on every `BaseTableSlice` are identical across tables).
- A write to table A invalidates **every other** table's cached editor slice:
  `applyAcceptedSlice` → `invalidateProjectDocumentEditorTableSlices(...,
  excludeTableName, refetchActiveSlices: false)`
  (`frontend/src/features/project_document/table-slice.ts`).
- Before a write, `resolveSliceForWrite`
  (`frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`)
  refetches the table fresh **iff its cache was invalidated**, so the `If-Match`
  header always carries the current draft etag.
- This is the fix for "edit table A, navigate to B, B's edit is blocked (stale
  draft conflict)." It is pinned by
  `frontend/tests/e2e/table-regression/table-draft-etag-coordination.spec.ts`.

**WASTEFUL — safe to collapse:**

- Only the **initial-mount fan-out**: the 7 individual GETs that fire when the
  page first renders. These can be replaced by one batch read that **seeds** the
  per-table caches.

The collapse removes the mount-time fan-out **without removing the per-table
query + refetch-before-write machinery**. `resolveSliceForWrite`'s refetch stays
per-table (one fresh table), so the #18 protocol is untouched.

## Proposed change

1. **New backend read** under `backend/features/project_document/`: a single
   request that returns all (or all requested) draft tables from the one
   already-assembled current-document view. Two shapes to weigh in Phase 0:
   - **(a) whole-draft document read** — `GET …/draft/document` →
     `ProjectDocumentV1` (the *current* doc = draft if present, else version).
     Simplest; one load+validate; frontend slices per table to seed caches.
   - **(b) batch draft-tables read** — `GET …/draft/tables?names=…` →
     `{ tables: dict[str, RegisteredTableResponse] }`, where each value is the
     **full** per-table response (it already embeds source + etags). Returns
     per-table `build_response` output directly, so seeding is a literal 1:1 map
     with no client-side slicing of raw document internals. (This is the shape
     the phase files use; an earlier draft listed redundant top-level meta.)
   - **Lean (b):** it reuses `contract.build_response` per table over the single
     loaded draft body, so each seeded entry is byte-identical to what the
     per-table `GET …/draft/tables/<name>` returns today. (a) risks subtle
     drift between "sliced on the client" and "built by the contract.")
   - **Target is the DRAFT, not `GET …/document`.** `…/document` returns the
     **saved** version, which diverges from the draft once there are unsaved
     edits. There is no whole-*draft* GET today; this refactor adds one.
2. **Frontend batch-seed (the careful part):** a page-scoped prefetch hook
   fetches the batch once for the page's table set and writes each per-table
   editor cache via `queryClient.setQueryData(<per-table editor slice key>, …)`
   **before** the table components mount their `useSliceQuery`. The components
   keep calling `useSliceQuery` / `useSliceTableController` **unchanged**:
   - seeded keys read the cache (no GET);
   - the existing invalidate-others-on-write + `resolveSliceForWrite` refetch
     paths are untouched and still per-table.
   - **Seed must be fresh, not stale:** tune `staleTime` (or seed with a current
     `dataUpdatedAt`) so a freshly-seeded `useSliceQuery` does **not** immediately
     refetch — otherwise the fan-out reappears. This is the #1 implementation
     trap; cover it with a test that asserts zero per-table GETs after seeding.

## Blast radius

`createTableSliceFeature` is instantiated per type across `equipment` (pumps,
fans, ventilators, hot_water_heaters, hot_water_tanks, electric_heaters,
appliances, rooms, heat-pump sub-tables), `spaces`, and `assets/ThermalBridges`.
The slice-query *hooks* are defined in `equipment/hooks.ts`, `spaces/hooks.ts`,
and consumed through `useSliceTableController` in many components. **Where the
GETs actually fire matters for the seed:** on equipment the 7 `useXxxSliceQuery`
calls live in `equipment/routes/EquipmentPage.tsx` (not `EquipmentPageBody.tsx`,
which only receives the resolved `.data` as props). So the seed/prefetch must be
at `EquipmentPage.tsx` — the same place the shipped table-views batch mounted its
provider. A page-level seed benefits all of them, but it touches the shared
write/coordination path — so this is a broad, high-care change.

## Effort / risk

- **Backend:** small-to-medium. One read endpoint + response model + a loop over
  contracts on the already-loaded draft body + tests. The hard part is matching
  per-table `build_response` output exactly.
- **Frontend:** medium-to-high. The seed itself is small; the risk is entirely
  in **not** regressing PR #18 and in the stale-time seeding trap. Every change
  is on the editor write path that was just stabilized.
- **Overall risk: higher than the table-views batch.** Perf is not urgent
  (37 KB, zero jank). The table-views batch has **shipped**; do this second,
  behind the #18 regression gate.

## Precedent from the shipped table-views batch (read before Phase 2)

The sibling `batch-table-views-endpoint` (archived
`planning/archive/dated/2026-06-29/batch-table-views-endpoint/`) landed the same
*shape* — a `?keys=`/`?names=` collection route declared before the
`{single}` item route (bounded list), plus a page-scoped provider mounted at
`EquipmentPage.tsx`. **Reuse that backend route convention.** But the
**frontend mechanism is deliberately different**: table-views uses a *context
read-through* because its per-table hook (`useProjectTableViewState`) is
hand-rolled (not TanStack Query), so the hook reads a shared context value.
Draft-tables slices **are** TanStack Query (`useSliceQuery` via
`createTableSliceFeature`), so this refactor seeds the query cache with
`queryClient.setQueryData(<editor slice key>, …)` instead — do **not** port the
context-read-through pattern onto the slice queries. Same goal (one request,
per-table fallback intact), different seam.

## Out of scope

- The `table-views` fan-out — separate, lower-risk, **already shipped** at
  `planning/archive/dated/2026-06-29/batch-table-views-endpoint/`.
- Any change to the draft-etag write protocol itself. This refactor is purely a
  *read-path* optimization; it must leave PR #18 behavior identical.
