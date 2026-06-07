---
DATE: 2026-06-07
TIME: (compiled)
STATUS: Active — first in the cleanup queue. Prerequisite for
        C-02, C-03, and C-04 because the rename touches files
        all three later phases also touch.
AUTHOR: Claude
SCOPE: Retire the legacy `Window*` tracer-bullet that the
       13-phase Apertures build deliberately left in place.
       Rename the backend domain types, rename the document
       table field, ship a document-load migration shim for the
       `win_*` / `winel_*` id prefixes, write the Alembic
       migration that munges persisted JSON and seeds the
       default catalog rows, delete the frontend `windows`
       feature folder, and add the `/windows` → `/apertures`
       redirect. Folds in §B.2 (explicit `datasheet_url` column
       on FrameRef / GlazingRef) per the PRD note that it ships
       co-located with the rename.
RELATED:
  - planning/features/apertures-cleanup/PRD.md §A.1–§A.6, §B.2
  - planning/features/apertures-cleanup/STATUS.md (phase queue)
  - planning/archive/apertures/phases/phase-01-terminology-schema-command-seam.md
    (the original V2 type introduction)
  - planning/archive/apertures/phases/phase-02-shell-sidebar.md
    (Apertures tab cutover)
  - context/CODING_STANDARDS.md
---

# Phase C-01 — `Window*` → `Aperture*` removal

## P0. Why this phase

The 13-phase Apertures build-out shipped behind a tracer-bullet
coexistence pattern: every new V2 type (`ApertureTypeEntry`,
`ApertureElement`, `ApertureElementFrames`, `tables.apertures[]`,
the `apt_*` / `aptel_*` id prefixes) lives **side-by-side** with
the legacy V1 surface (`WindowTypeEntry`, `WindowElement`,
`WindowElementFrames`, `tables.window_types[]`, `win_*` /
`winel_*`). The TB-09 Windows tab is still mounted; the V1
`features/windows/` frontend folder still ships in the bundle.

This was intentional during the build — keeping the legacy types
let each phase land independently without a global breaking
migration. It is no longer earning its keep:

- The legacy type names are confusing for new contributors. "Why
  are there two parallel hierarchies for the same domain?" is
  the first question every reader asks.
- The `aperture_default_refs_missing` 503 noted in the archived
  STATUS is gated on the catalog seed rows that should ship with
  the JSON migration here.
- The `datasheet_url` column on `FrameRef` / `GlazingRef`
  (backlog §B.2) is a small ref-shape change that benefits from
  ship-co-location with the rename — adding it later would mean
  two migrations against the same Pydantic models.
- Phase C-02 will extract shared helpers across handler modules
  and Phase C-04 will rename canvas-mirror props; both phases
  will collide with the rename if it ships later.

Phase C-01 ships these six concerns as a single coordinated PR
because they touch the schema, the document-migration shim, the
persisted JSON, the frontend feature folder, and the route
table at the same time. Splitting them creates a window where
the persisted JSON shape does not match what the type validates.

## P1. Acceptance — Phase C-01 done when

1. **Backend type rename (PRD §A.1).** Every reference to
   `WindowTypeEntry`, `WindowElement`, `WindowElementFrames` is
   replaced with `ApertureTypeEntry`, `ApertureElement`,
   `ApertureElementFrames`. The legacy class names exist only
   as `# noqa` type-alias re-exports in
   `features/project_document/document.py` for one migration
   window. After this PR, no production code path references
   the `Window*` names.
2. **Field rename (PRD §A.2).**
   `ProjectDocumentTables.window_types` is removed.
   `ProjectDocumentTables.apertures` is the canonical list.
   A `@computed_field` alias on `ProjectDocumentTables` exposes
   `window_types` as a read-only mirror of `apertures` for one
   migration window so any document persisted under the old key
   round-trips. The alias is removed at the end of this PR
   (after the JSON munge has landed, no persisted JSON still
   carries the old key).
3. **ID-prefix migration shim (PRD §A.3).** A one-shot
   `model_validator(mode="before")` on `ProjectDocumentV1`
   rewrites `win_*` → `apt_*` and `winel_*` → `aptel_*` on the
   read path. It walks `tables.window_types` (if present) and
   `tables.apertures`. The shim is documented as deletable once
   the Alembic migration (Step 4) has run in every environment
   the V2 backend can reach. The shim ships in the same PR so a
   stale persisted document hitting the validator before the
   migration runs still validates.
4. **Alembic migration (PRD §A.4).** A roll-forward-only
   Alembic revision:
   - For every row in `project_versions`, rewrites the `body`
     JSON column in-place — moves `tables.window_types[]` →
     `tables.apertures[]` and rewrites `win_*` / `winel_*` ids.
   - Inserts the catalog rows `PHN-Default-Frame` (in the
     `frame_types` catalog) and `PHN-Default-Glazing` (in
     `glazing_types`). Phase 01 + Phase 03 of the original
     build-out depend on these rows existing.
   - No `downgrade()` body — the V1 columns are dropped here
     and a downgrade is explicitly out of scope per the PRD.
5. **Frontend folder removal (PRD §A.5).**
   `frontend/src/features/windows/` is deleted in its entirety
   (V1 Windows tab + every component, hook, test under it). The
   `PROJECT_TABS` array in the tab router drops the `windows`
   entry; the `apertures` entry stays.
6. **Route redirect (PRD §A.6).** The React router redirects
   `/projects/:id/windows` → `/projects/:id/apertures` for any
   bookmarks or saved links. Single entry in the route table.
7. **`FrameRef` / `GlazingRef` `datasheet_url` column (PRD
   §B.2).**
   - Both refs gain an explicit `datasheet_url: str | None`
     field.
   - The matching catalog models (`FrameType`, `GlazingType`)
     gain the same column. Alembic migration adds the column
     in the same revision as Step 4.
   - `CatalogBadges` is updated to read `datasheet_url`
     explicitly. The existing fallback to `source` for
     `http(s)://…` strings is kept for one release as a
     defensive net but logs a deprecation warning.
8. **`aperture_default_refs_missing` 503 unblocks.** After the
   migration runs, `+ Add aperture type` no longer surfaces the
   structured 503 because the catalog now contains
   `PHN-Default-Frame` and `PHN-Default-Glazing`. Verified by
   running the existing acceptance test from the archived Phase
   01 plan.
9. **All existing tests pass unchanged.** No assertion text
   changes (only test fixture names, where they referenced
   `WindowTypeEntry` etc.). New tests for the migration shim
   and the Alembic migration are added (P4).
10. **`make ci` is green.** `make smoke` confirms the migrated
    document loads without the legacy alias on a fresh
    sandbox.

## P2. Files touched

### Backend — rename surface

- `backend/features/project_document/document.py` — rename the
  three model classes; add deprecated type aliases at the
  bottom; add the `@computed_field` `window_types` alias on
  `ProjectDocumentTables`.
- `backend/features/project_document/tables/apertures.py` — no
  rename needed (already V2-named); double-check no
  `WindowType*` lingers.
- `backend/features/project_document/repository.py` (or
  wherever the document model is referenced for SQL casting) —
  audit every `Window*` import.
- `backend/features/project_document/aperture_commands/models.py`
  and every `handlers/*.py` — confirm none reference the legacy
  type names. (The handlers were already written against the
  V2 types, but verify before delete.)
- `backend/features/aperture_drift/`, `aperture_u_value/`,
  `aperture_hbjson_export/`, `apertures_mcp/` — same audit.

### Backend — migration shim

- `backend/features/project_document/document.py` — add the
  `@model_validator(mode="before")` that rewrites `win_*`
  prefixes. Class-method-level docstring documents the
  deletion criterion.

### Backend — Alembic

- `backend/alembic/versions/<rev>_window_to_aperture_removal.py`
  (new) — JSON munge over `project_versions.body`, drop the
  legacy column references, insert the two seed catalog rows,
  add the `datasheet_url` column to `frame_types` and
  `glazing_types`.

### Backend — `datasheet_url`

- `backend/features/project_document/document.py` — add
  `datasheet_url: str | None = None` to `FrameRef` /
  `GlazingRef`.
- `backend/features/catalog/models.py` (or wherever the
  catalog Pydantic models live) — add the column to
  `FrameType` / `GlazingType`.
- `backend/features/catalog/repository.py` — surface the
  column in the row → model mapping.

### Frontend — deletions

- `frontend/src/features/windows/` — delete the entire folder.
- Project tab router (likely `frontend/src/features/project/
  ProjectTabs.tsx` or similar) — drop the `windows` entry.

### Frontend — additions

- `frontend/src/app/router.tsx` (or wherever the route table
  lives) — add the `/projects/:id/windows` →
  `/projects/:id/apertures` redirect.
- `frontend/src/features/apertures/components/CatalogBadges.tsx`
  — read `datasheet_url` explicitly; keep the `source`
  fallback with a `console.warn` for one release.

### Tests

- `backend/tests/project_document/test_id_prefix_migration_shim.py`
  (new) — feeds a `win_*` document through the validator and
  asserts the rewritten output.
- `backend/tests/alembic/test_window_to_aperture_migration.py`
  (new) — runs the migration against a fixture DB populated
  with a `win_*` document and asserts the post-migration shape
  + the two seed catalog rows.
- `backend/tests/aperture_commands/test_default_refs_missing.py`
  — flip the assertion from "503 expected" to "happy path"
  now that the seed rows exist.
- `backend/tests/catalog/test_datasheet_url_column.py` (new) —
  basic round-trip on the new column.

## P3. Implementation steps

Each step is a self-contained commit. `make ci` between steps.
The order matters: the type rename without the shim breaks
existing dev data; the shim without the migration runs forever.

### Step 1 — Audit the rename surface

1. Run `grep -rn "WindowTypeEntry\|WindowElement\|WindowElementFrames\|window_types"
   backend/ frontend/` and inventory every hit.
2. For each hit, categorise:
   - V2 production code accidentally still using the V1 name
     (rename in Step 2)
   - V1 `features/windows/` frontend folder (delete in Step 6)
   - Test fixture (rename in Step 2; assertions untouched)
   - Migration / archive doc (leave alone)
3. The PR description carries this inventory as a checklist.

### Step 2 — Backend type rename + deprecated aliases

1. Rename the three model classes in
   `features/project_document/document.py`.
2. At the bottom of the same module, add:
   ```python
   # Deprecated — kept for one migration window; remove after
   # all consumers migrate to the Aperture* names.
   WindowTypeEntry = ApertureTypeEntry  # noqa: F401
   WindowElement = ApertureElement  # noqa: F401
   WindowElementFrames = ApertureElementFrames  # noqa: F401
   ```
3. Update every production import to use the new names.
4. Test fixtures named `WindowTypeEntry(...)` etc. are updated
   to `ApertureTypeEntry(...)` — assertion text untouched.

### Step 3 — Field rename + computed alias

1. Drop `window_types: list[ApertureTypeEntry] = []` from
   `ProjectDocumentTables`.
2. Add:
   ```python
   @computed_field
   @property
   def window_types(self) -> list[ApertureTypeEntry]:
       """Deprecated read-only mirror of `apertures` for one
       migration window. Removed after the Alembic JSON munge
       lands in every environment."""
       return self.apertures
   ```
3. Confirm no writer path (handlers / commands / repository)
   ever writes through `window_types`. The handlers were
   already written against `tables.apertures` per the archived
   Phase 01 design.

### Step 4 — ID-prefix migration shim

1. Add the `@model_validator(mode="before")` to
   `ProjectDocumentV1`. The validator walks `data.get("tables",
   {}).get("window_types", [])` AND
   `data.get("tables", {}).get("apertures", [])`, rewriting
   `win_*` → `apt_*` and `winel_*` → `aptel_*` recursively on
   every id field.
2. The validator is idempotent — running it twice produces the
   same output.
3. New test
   `test_id_prefix_migration_shim.py` covers:
   - A pure V1 document loads and validates with rewritten ids.
   - A pure V2 document is unchanged.
   - A mixed document (some elements `win_`, some `apt_`)
     normalises to all-`apt_`.

### Step 5 — Alembic migration

1. New revision file with:
   - `upgrade()`:
     - For every row in `project_versions`, parse `body` JSON,
       move `tables.window_types[]` → `tables.apertures[]`,
       rewrite ids, write back. Use a server-side `jsonb_set`
       expression where possible to keep the migration fast on
       large rows; fall back to Python-side parsing for the
       complex bits.
     - Add `datasheet_url TEXT NULL` to `frame_types` and
       `glazing_types` tables.
     - Insert the two seed catalog rows
       (`PHN-Default-Frame`, `PHN-Default-Glazing`) if absent.
     - Drop any V1-only columns confirmed unused in Step 1's
       audit.
   - `downgrade()`: raise `NotImplementedError("roll-forward
     only — V1 surface deleted")`. PRD explicitly excludes a
     downgrade path.
2. New test
   `test_window_to_aperture_migration.py` runs the migration
   against a fixture DB containing one `win_*` document; asserts
   the post-migration JSON, the column adds, and the seed row
   inserts.

### Step 6 — Frontend deletion + redirect

1. `git rm -r frontend/src/features/windows/` (the entire
   folder).
2. Remove the `windows` entry from `PROJECT_TABS`.
3. Add the redirect route. Confirm by visiting
   `/projects/<id>/windows` in the dev server.
4. Confirm no other frontend code imports from
   `features/windows`. TypeScript build will flag any miss.

### Step 7 — `datasheet_url` field + UI consumption

1. Add the field to `FrameRef` / `GlazingRef` in
   `document.py` and to the matching catalog models.
2. Update the catalog repository row → model mapping.
3. Update `CatalogBadges` to read `datasheet_url` first; fall
   back to `source` only if `datasheet_url == null` AND
   `source` looks like a URL. Emit a `console.warn` on the
   fallback path naming the catalog kind + id.
4. Add `test_datasheet_url_column.py`.

### Step 8 — Remove the deprecated aliases

This step is a follow-up landed in a separate small PR **after**
the Alembic migration has run in dev + staging + production.

1. Delete the three `WindowTypeEntry = ApertureTypeEntry` lines
   from `document.py`.
2. Delete the `@computed_field window_types` property.
3. Delete the ID-prefix migration shim from
   `ProjectDocumentV1`.
4. Delete the `CatalogBadges` `source` fallback path (replace
   the `console.warn` with a hard log + remove the fallback).

If the team prefers, Step 8 can ship in the same PR as Steps
1–7, accepting that any developer with a stale dev database has
to run `make migrate` before opening the app. This is the more
ergonomic choice for a single-team codebase; PRD §A.3's
"deletion criterion" suggests the safer split. Default to the
single PR; the STATUS gate is whether anyone holds a dev DB
older than this PR's HEAD.

## P4. Verification

- `make ci` green at phase close.
- `make smoke` confirms a fresh-from-migration document loads.
- `make migrate` against a copy of staging confirms the JSON
  munge completes without error.
- Backend test: load a fixture document written under the V1
  shape, confirm it round-trips through
  `ProjectDocumentV1.model_validate` to all-V2 names.
- Frontend test: visit `/projects/<id>/windows`, confirm
  redirect to `/projects/<id>/apertures`.
- Frontend test: open the Apertures tab on a fresh project,
  click `+ Add aperture type`, confirm the structured 503 no
  longer appears.
- Grep: `grep -rn "Window*" backend/features frontend/src`
  returns only the alias re-exports (if Step 8 is split out)
  or zero hits (if Step 8 is in-PR).

## P5. Risks

- **R-C01-1 — Migration leaves orphaned V1 documents in a
  staging environment.** The Alembic migration only touches
  documents the migration runner can reach. **Mitigation:**
  pre-PR audit lists every environment with a project-versions
  table; the rollout plan runs `make migrate` against each.
  The shim (Step 4) covers any document the migration somehow
  misses.
- **R-C01-2 — `@computed_field window_types` is written to.**
  Pydantic `computed_field` is read-only; if any code writes
  `doc.tables.window_types = [...]`, it raises at assignment.
  **Mitigation:** Step 3 confirms no writer path exists via
  grep + type-checker. If a write is found, fix the caller, do
  not relax the computed field.
- **R-C01-3 — JSON munge corrupts a large project's `body`
  column.** **Mitigation:** the migration runs inside a
  transaction; the per-row update is idempotent. Backup the
  database before running in production (standard pre-migration
  practice).
- **R-C01-4 — Frontend deletion misses an import from outside
  `features/windows/`.** TS will flag this. **Mitigation:**
  run the Vite build before opening the PR.
- **R-C01-5 — `datasheet_url` column add is treated as a
  separate concern by reviewers and pushed to a separate PR.**
  This is the wrong call — the PRD §B.2 note says ship together
  to avoid two ref-shape migrations. **Mitigation:** the PR
  description names this explicitly with a link to PRD §B.2.
- **R-C01-6 — Phase C-02 / C-03 / C-04 begin work on a branch
  before C-01 lands.** Per the memory note on
  `[[feedback_worktree_chain]]`, the next worktree should
  branch off the unmerged C-01 base, not main. The STATUS file
  flags this.

## P6. Out of scope

- Anything in PRD §B.1 (sidebar polish), §B.3 (Sonner toasts),
  §B.4 (region-click + pick-paste), §B.5 (drift report side
  panel), §B.6 (modal extraction), §B.7 (typed inputs).
- §C.1 (drift-report cache key) — depends on catalog
  versioning work.
- §C.2 (U-Value debounce).
- §D.1–§D.3 (MCP polish).
- §E.1 (Playwright E2E), §E.2 (V1 fixture parity), §E.3
  (banner / refs view smoke tests).
- All of Phase C-02, C-03, C-04 — those are separate plans.
- The decision of whether the `MIN_CANVAS_WIDTH_PX` or other
  V2 magic numbers should be revisited.
