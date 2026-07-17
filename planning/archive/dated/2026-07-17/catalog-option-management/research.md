# Research — Catalog Option Management

DATE: 2026-07-17
TIME: 12:07
STATUS: Active
AUTHOR: Claude (Fable 5), three-agent codebase sweep + live-browser verification
SCOPE: Code map of what already exists; verified against the running app.
RELATED: PRD.md, decisions.md

## Headline: almost everything exists

Verified 2026-07-17 in the live dev app (codex@example.com, who holds a local
`catalog.edit` grant): the grid is EDITABLE, inline option creation works
("Find or create…" popover), single-select Cmd-C/Cmd-V works end-to-end — but
header double-click opens nothing and the header menu has no field-config
entry. The one missing wire is the modal entry point.

## Option store (backend) — complete

- Runtime store: Postgres `catalog_field_options` (`catalog_table, field_key,
  option_id, label, color, "order"`), PK + case-insensitive unique label
  index. DDL + seeds: `backend/alembic/versions/20260624_0001_baseline.py:23`.
- Raw-SQL repository: `backend/features/catalogs/_options_repository.py`
  (`list_options`:47, `replace_options`:80, `count_rows_using_label`:112,
  `rename_label`:126, `append_options`:193). Rows store the **label string**
  (D-2 in module docstring), so rename/merge = bulk rewrite over the owning
  catalog column.
- Edit service: `edit_frame_type_options`
  `backend/features/catalogs/frame_types/options_service.py:63` — validates
  editable field, rewrites rows on rename, folds in-use deletes via
  `replacements` or rejects 409 `catalog_option_in_use` (:120), recomputes
  derived names (:161), audit-logs (:163). Glazing twin in
  `glazing_types/options_service.py`.
- Routes: `GET/PUT /api/v1/catalogs/frame-types/options`
  (`frame_types/routes.py:100/:108`; PUT gated by `CatalogEditor`); glazing
  twin. DTOs in `catalogs/_shared.py:70/:79` (`replacements: dict[str,str]`).
- Seed vocabularies (import-fold source only): `catalogs/_option_seeds.py`
  (`FRAME_TYPE_SINGLE_SELECT_FIELDS`:94, `GLAZING_TYPE_SINGLE_SELECT_FIELDS`:173).

## Frontend — complete except the entry point

- Controllers already translate the DataTable option-edit mutation
  (`schemaMutation` variant `legacyOptions`) into the PUT:
  `frontend/src/features/catalogs/frame-types/controller.ts:217`
  (`editFrameTypeOptions`), merge map via `buildLabelReplacements`:204.
  Grid cell value = option **id**; controller maps id↔label at the REST
  boundary (`toFrameTypeRow`:70, `valueForField`:89).
- Overlays unlock `options` on the promoted fields (`field_type` stays
  locked): `frame-types/fieldDefs.ts:66`, `glazing-types/fieldDefs.ts:52`.
- Inline add already persists: `persistNewOptions` (`controller.ts:121`) PUTs
  new options before the row PATCH.
- **The gap:** `DataTable.tsx:1309` —
  `editConfigEnabled = !readOnly && Boolean(onWrite) && Boolean(onEditCustomFieldBundle)`.
  No catalog page passes `onEditCustomFieldBundle`
  (`routes/FrameTypesCatalogPage.tsx:309`, `GlazingTypesCatalogPage.tsx`), so
  the field-config modal (`components/FieldConfigModal.tsx`,
  `FieldConfigSectionOptions.tsx`) never mounts. Header affordances live in
  `components/GridHeader.tsx:210` (`canEditFieldConfig`).
  Implementation note: the modal's save path for legacy single-selects should
  land as the `legacyOptions` WriteOp the controllers already handle — verify
  which requests actually flow through the bundle handler vs. `onWrite`, and
  keep the bundle handler minimal (custom fields stay a non-goal; the
  controller throws on any other variant, `controller.ts:315`).

## Authorization model

- `CATALOG_EDIT = "catalog.edit"` `backend/features/access/capabilities.py:47`.
  `MEMBER_CAPS` (:74) lacks it; granted via `ADMIN_EXTRA_CAPS` (:84),
  `is_staff` (:80), or explicit `user_grants`.
- Enforcement: `require_catalog_editor` / `CatalogEditor`
  `backend/features/catalogs/access.py:26` on every catalog write route.
- Certifier: reserved viewer audience, resolves to empty caps (fails closed) —
  `access/principals.py:24`, `capabilities.py:91`,
  `tests/test_access_resolver.py:93`.
- Frontend mirror: `canEditCatalogs(session)`
  `frontend/src/features/catalogs/lib.ts:42` reads session capabilities;
  pages pass `readOnly={!canEditCatalog}`.
- Grant tooling: `backend/scripts/manage_user_access.py` (grant/revoke/
  set-staff; refuses production).

## How projects reference catalogs (impact model)

- Snapshot-by-value + provenance: `FrameRef`/`GlazingRef` carry copied fields
  plus `CatalogOrigin{catalog_table, catalog_record_id, synced_at,
  local_overrides}` — `backend/features/project_document/envelope_models.py:43/84/122`.
  Matching is by immutable `catalog_record_id`; renames never break links.
- Drift detection (frames/glazing): `backend/features/aperture_drift/`
  (`detector.py:48`, comparator field lists `comparator.py:21/:43`, REST
  `routes.py:33`); kinds `field_delta` | `catalog_row_missing`. Materials has
  the parallel mechanism (`backend/features/envelope/drift.py`, 5 states incl.
  `source_deactivated`) — contract doc:
  `context/technical-requirements/envelope-catalog-drift.md`.
- Resolution: `refreshRefFromCatalog` command
  (`project_document/aperture_commands/handlers/refresh.py:50`) + RefreshDialog
  (`frontend/src/features/apertures/components/RefreshDialog.tsx`) with
  take-catalog / keep-mine / edit; `catalog_row_missing` → repick.
  Neither mechanism does name-based re-matching; renames appear as field
  deltas. **No mechanism change needed for this feature.**
- The rename hole: `ManufacturerFilters`
  (`project_document/document.py:246`) stores **label strings**
  (`frame_manufacturers_enabled`/`glazing_manufacturers_enabled`:259) while the
  roster is computed live from the catalog — a rename orphans enabled entries.
  This is what the Phase 2 cascade fixes.

## Clipboard (context: item 3 of the original request — no work needed)

Full generic pipeline: Cmd-C keydown → `useGridClipboard.copy` (TSV+HTML);
Cmd-V deliberately rides the native `paste` event
(`useGridKeyboard.ts:9-13`, `DataTable.tsx:1552/:1748`). Single-select copy
emits label (`lib/paste/tsv.ts:24`), paste coerces label→id with option
creation / rejection (`lib/rows/defaults.ts:113`). Live-verified: copy put
"Internorm" on the clipboard; real Meta+V pasted "Zola" and it persisted
through reload. If it misbehaves for Ed, suspect production lag (fixes
archived 2026-07-09: `planning/archive/dated/2026-07-09/…`) or a read-only
session — not missing code.

## Browser-probe gotchas (for the Phase 3 e2e work)

- Body rows: the row-number slot is a `th`, so `td[0]`=Name,
  `td[1]`=Manufacturer.
- Derived names re-sort rows after writes — re-identify rows after **every**
  write; index-based targeting hits the wrong row.
- `recPHNDefFrame001` ("PHN-Default-Frame") is an Alembic-seeded sentinel new
  apertures default to; its name is server-derived and grid deletes soft-delete
  it. If mutated, restore via SQL from the baseline-migration INSERT
  (`20260624_0001_baseline.py:206`).
- Clicking an already-selected single-select cell opens the popover and
  swallows subsequent keys; navigate via Name-cell click + ArrowRight instead.
