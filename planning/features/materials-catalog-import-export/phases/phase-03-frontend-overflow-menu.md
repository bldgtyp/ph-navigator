---
DATE: 2026-06-03
TIME: 22:00 EDT
STATUS: Implemented on `feat/materials-catalog-import-export`.
        See "What actually shipped" below for deltas from the
        original spec (review-pass fixes folded back).
AUTHOR: Claude (Opus 4.7)
SCOPE: Wire Export JSON and Import JSON… into the Materials
       Catalog DataTable "More view actions" overflow menu, with
       the upload preview/commit modal.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - phase-02-backend-import-pipeline.md
  - ../../../../frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx
  - ../../../../frontend/src/shared/ui/data-table/components/ViewMenuOverflow.tsx
---

# Phase 3 — Frontend Overflow Menu

## Objective

From the Materials Catalog page, give the user:

1. An **Export JSON** menu item that downloads the current
   catalog as a `materials-catalog_<YYYY-MM-DD>.json` file.
2. An **Import JSON…** menu item that opens a modal: pick file →
   POST to `/import/preview` → show dry-run report → POST to
   `/import/commit` → refresh the grid.

Both items live inside the DataTable toolbar's
`ViewMenuOverflow` ("More view actions" kebab) via the
`overflowMenuActions` slot already exposed by `<DataTable>`.

## Module layout

New subfolder
`frontend/src/features/catalogs/materials/import_export/` with:

| file | purpose |
|---|---|
| `export.ts` | `serializeCatalog(rows, opts) -> CatalogFile`; trigger browser download (Blob + anchor click). |
| `useImportMutations.ts` | TanStack-Query wrappers around `POST /import/preview` and `POST /import/commit`. |
| `ImportDialog.tsx` | The modal: file picker → preview report → confirm. |
| `OverflowMenuItems.tsx` | The two `<button>` items mounted into `overflowMenuActions`. |
| `types.ts` | Shared TS types matching the backend's `CatalogFile`, `PreviewReport`, `CommitReport`. |

## Export

`serializeCatalog` builds a `CatalogFile` object from the rows
currently in the page's TanStack-Query cache (the same list
`useMaterialsQuery` returns). Per PRD:

- Include all nine canonical fields plus `id`.
- Exclude `id`, timestamps, `created_by`, `updated_by`,
  `is_active`.
- Honor the page's include-inactive toggle: include inactive rows
  iff the toggle is on at click time.
- `kind = "ph-navigator.catalog.materials"`, `schema_version = 1`,
  `exported_at = new Date().toISOString()`,
  `exported_by = current user email`,
  `app_version = import.meta.env.VITE_APP_VERSION` (if present).
- `JSON.stringify(file, null, 2)` for pretty-printing.
- Trigger download via Blob + anchor click; filename
  `materials-catalog_${YYYYMMDD}.json`.

No backend round-trip; export is fully client-side.

## Import — modal flow

`ImportDialog` is a controlled component opened by the
"Import JSON…" menu item. States:

1. **Pick.** File input. On `change`, validate
   `file.size <= 8 MB` and `file.type` is JSON-ish, then upload.
2. **Loading.** Show spinner while `/import/preview` is in flight.
3. **Report.** Render counts (new / matched / errored / warnings),
   the grouped warning list, the first ~20 rows of `rows_preview`,
   the file's `schema_version` and `exported_at`. Two buttons:
   **Cancel** and **Import N rows** (label uses `counts.new`).
4. **Committing.** Spinner while `/import/commit` is in flight.
5. **Done.** Success toast `"Imported N rows"`; close dialog;
   invalidate `useMaterialsQuery` so the grid refreshes.

Error paths:

- `/import/preview` returns 400 (bad envelope, bad JSON,
  too-new schema_version) → close the picker state, show the
  server's error message inline, no commit step.
- `/import/preview` returns 413 → "File too large (max 8 MB)."
- `/import/commit` returns 410 (stale token) → show "Preview
  expired, please re-upload" and reset to the Pick state.
- Network error at either step → retryable error banner inside
  the dialog.

The dialog blocks interaction with the underlying grid while open
(standard modal behavior).

## Overflow menu wiring

In `MaterialsCatalogPage.tsx`:

```tsx
const [importOpen, setImportOpen] = useState(false);

<DataTable
  // …
  overflowMenuActions={
    <CatalogImportExportMenu
      onExport={() => exportCatalog(rows, { includeInactive })}
      onImport={() => setImportOpen(true)}
    />
  }
/>

<ImportDialog
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onCommitted={() => queryClient.invalidateQueries(materialsQueryKey)}
/>
```

`CatalogImportExportMenu` renders two `<button>`s with classes
matching the existing overflow-menu item styling
(`ViewMenuOverflow.tsx` is the reference). Keyboard reachable
through Radix Popover focus management; closing the popover after
click is the existing behavior.

## Types

`types.ts` mirrors the backend shape verbatim. Keep this file
hand-maintained and small; do not generate from OpenAPI in v1
(the rest of the frontend hand-maintains its types — match that
pattern, not introduce a new tool).

## Tests

- `frontend/src/features/catalogs/materials/import_export/__tests__/export.test.ts` —
  serialize a known rows array; assert key set, key order
  (`id` first, then the nine canonical fields), and
  pretty-print formatting.
- `frontend/src/features/catalogs/materials/import_export/__tests__/ImportDialog.test.tsx` —
  with mocked mutations:
  - Happy path: pick → preview → confirm → commit → query
    invalidated.
  - Stale token on commit → reset to Pick state.
  - File >8 MB → rejected client-side, no network call.
  - Cancel from report state → no commit call.
- Controller unit tests added in materials-catalog-datatable
  Phase 4 stay green (no controller changes here — import bypasses
  the per-cell controller because it's a bulk write that
  invalidates the query).

## Playwright MCP smoke

Plan (executed in Phase 4):

1. Open Materials Catalog page.
2. Click the "More view actions" kebab on the toolbar.
3. Assert Export JSON and Import JSON… are visible.
4. Click Export JSON; verify a download is triggered (browser
   intercept) and the parsed file contains `kind`,
   `schema_version`, and N `rows`.
5. Click Import JSON…; upload the just-downloaded file; assert
   the report shows N matched / 0 new; cancel; grid unchanged.
6. Upload a hand-rolled file with one new row; confirm; assert
   the new row appears in the grid.

## Verification

- `pnpm --filter frontend test` green for the new tests.
- `make check-frontend` green (lint, prettier, structural guards,
  vitest, build).
- Manual: round-trip export → import on a dev DB with the
  Skip-matches behavior leaves the catalog unchanged.

### Deferred (Phase 4 hardening)

- **`useImportMutations` typing.** Mutation generics declare the
  error as `Error`, but `fetchJson` rejects with
  `ApiRequestError`. Any future consumer that reads
  `mutation.error.status` / `.errorCode` from the hook return
  (instead of via the `instanceof` checks in `ImportDialog`) will
  lose the typed API surface. Trivial type-only fix; not user-
  reachable today.
- **`formatApiError` unmapped codes.** Only four backend
  error_codes get curated copy; everything else falls through to
  `error.message`. Acceptable today (server messages are
  reasonable) but worth adding a catch-all mapping pass.

## Out of scope

- Showing `id` in the DataTable.
- Drag-and-drop file input (file picker only in v1).
- Per-row "ignore this warning" UI — warnings are surface-only.
- Selection-based export.

## What actually shipped (deltas from spec)

`/simplify` precision review on the first cut surfaced six issues;
four were fixed before merge, two are deferred to Phase 4 as
hardening (recorded under Verification ↓):

1. **`ImportDialog` is conditionally mounted instead of taking an
   `open` prop.** `MaterialsCatalogPage` renders `{importOpen ?
   <ImportDialog ... /> : null}`. Closing the dialog tears down
   internal state and any in-flight `previewMutation` /
   `commitMutation` — so a late preview can't `setState` on a
   hidden dialog and surface a stale "report" stage on the next
   open. This changes the component contract: there is no `open`
   prop.

2. **Double-click double-commit fix.** The Confirm button now
   disables on `commitMutation.isPending` (in addition to
   `counts.new === 0`). Belt-and-braces against the brief window
   before React commits the `stage = "committing"` transition.

3. **Per-pick request-id guard.** Each file pick increments a ref
   counter; late-resolving FileReader / preview responses bail
   out of `setState` if their counter is stale. Defensive — the
   current UI unmounts the file input as soon as the stage leaves
   `pick`, so the race isn't user-reachable today, but a future
   refactor that keeps the picker visible during loading
   shouldn't regress correctness.

4. **`EMPTY_MATERIALS` constant.** `materialsQuery.data ??
   EMPTY_MATERIALS` reuses a module-level frozen `[]` so the
   loading state doesn't create a fresh array identity per render
   and defeat downstream memoization in `DataTable`.

### Module layout shipped

Slightly larger than the spec — adds `api.ts`:

| file | purpose |
|---|---|
| `types.ts` | Mirrors backend `CatalogFile`, `PreviewResponse`, `CommitResponse`. |
| `export.ts` | `serializeCatalog(rows, opts)`, `formatCatalogJson(file)`, `exportFilename(now?)`, `triggerCatalogDownload(file, name)` — the first three are pure (unit-tested); the fourth is the DOM side-effect. |
| `api.ts` | Thin wrappers around `/import/preview` and `/import/commit`. `previewCatalogImportRaw(body)` accepts an unknown JSON dict so per-row warnings from the backend's coerce step flow even when the file shape doesn't match `CatalogFile` exactly. |
| `useImportMutations.ts` | TanStack mutation hooks. Commit's `onSuccess` invalidates `catalogQueryKeys.materials()` (prefix), which covers both `include_inactive` variants. |
| `ImportDialog.tsx` | The state machine: pick → loading → report → committing → done. Uses FileReader (not `file.text()`, which jsdom omits). |
| `OverflowMenuItems.tsx` | `CatalogImportExportMenu` — two `<button>`s into `<DataTable overflowMenuActions>`. |

### Tests

12 frontend tests across two files (was 4 planned):

- `export.test.ts` (7) — envelope fields, canonical 10-key projection, audit columns excluded, nullable fields round-trip as `null`, pretty-print + trailing newline, JSON.parse round-trip, `exportFilename` YYYYMMDD stamp.
- `ImportDialog.test.tsx` (7) — happy path, > 8 MB rejected client-side, stale token resets to Pick, cancel doesn't commit, double-click triggers only one commit, close-during-loading unmounts the dialog (no stale state on reopen), backend 413 surfaces a clean message.
