---
DATE: 2026-06-22
TIME: 20:35 EDT
STATUS: ✅ Shipped (2026-06-22) — `ClimateUploadModal` (EPW/STAT/DDY) +
  `stat`/`ddy` asset kinds (migration `0035`) + from-upload attach; the temporary
  `ProjectEpwControls` is removed. Backend + frontend tests green.
AUTHOR: Claude (for Ed)
SCOPE: P3 — a dedicated "Upload Climate Data" modal (EPW / STAT / DDY), STAT
  parse-on-upload, store all three as assets, remove the temporary
  ProjectEpwControls, and finalize the three-action row.
RELATED:
  - ../PRD.md §3 (D5/D6), §5.7 (backend), §6.4 (frontend)
  - backend/features/project_location/service.py (parse_stat_file,
    parse_epw_location_header, build_weather_source_payloads)
  - backend/features/assets/ (asset kinds, upload, object-store read)
  - frontend/src/features/assets/hooks.ts (uploadAsset),
    frontend/src/features/climate/components/ClimateSourceDetailPage.tsx
    (ProjectEpwControls — removed here)
---

# Phase 3 — "Upload Climate Data" modal (EPW / STAT / DDY)

## Goal

Replace the temporary inline `ProjectEpwControls` with a dedicated **"Upload
Climate Data"** modal that accepts **EPW (required), STAT (optional), DDY
(optional)**, parses the STAT into the same metric + design-condition set as the
derive path, stores all three files as assets, and finalizes the three-action
row (Set from nearest · Select from map · Upload climate data). Delivers the
rest of ask **#2** and removes the interim scaffolding.

## Scope

### Backend

- **Asset kinds** — confirm the assets model/validation accepts `stat` and `ddy`
  alongside `epw` (the EPW upload uses `asset_kind="epw"`). Add them if the kind
  set is enumerated; the EPW *file* asset stays `epw` (file type, not the source
  kind).
- **STAT read for parsing** — `parse_stat_file` needs the STAT bytes; confirm the
  asset service exposes a read-bytes/object-store fetch for an uploaded asset
  (the derive path parses in-memory before storing; uploads are already stored,
  so we read them back).
- **Finalize endpoint** — `POST /{project_id}/climate/sources/weather/from-upload`
  `{ epw_asset_id, stat_asset_id?, ddy_asset_id? }`:
  - validate each asset exists, belongs to the project, is `uploaded`, and has the
    expected `asset_kind`;
  - parse the EPW header (`parse_epw_location_header`) for the location
    suggestion + the STAT (if given) → `stat_metrics` + `design_conditions`;
  - build the `weather` source `data` (station info from the EPW header + the
    `stat_asset_id` / `ddy_asset_id`); upsert via `upsert_source_by_kind`; audit.
  - Mirror `build_weather_source_payloads`' data shape so the page renders
    identically whether derived, catalog-picked (P2), or uploaded.
- **`project_location.epw_*` consolidation** — the weather source is now the
  single source of truth for the project EPW. Audit readers of
  `project_location.epw_asset_id` / `epw_source_url` (grep) and either keep them
  in sync from the weather source or retire them. Decide in build; default =
  keep writing them for now (low risk), file a follow-up to retire.

### Frontend

- **`ClimateUploadModal.tsx`** (new) — `ModalDialog` with three labelled file
  inputs (EPW required; STAT, DDY optional). Each file → `uploadAsset(project,
  kind, file)` (existing helper) to get an asset id; on submit →
  `attachWeatherFromUpload({ epw_asset_id, stat_asset_id?, ddy_asset_id? })`.
  Show per-file upload status, the parsed location suggestion, and STAT
  missing-field flags. Accept `.epw` / `.stat` / `.ddy` (+ `text/plain`).
- `hooks.ts` / `api.ts` — `attachWeatherFromUpload` mutation (invalidates the
  sources query).
- **Remove `ProjectEpwControls`** from `ClimateSourceDetailPage.tsx` and its
  tests; wire the **"Upload climate data"** button (Weather page actions row +
  empty-state) to open the modal.
- **Header downloads** — EPW / STAT / DDY download links on the Weather page
  header, from the asset ids in `source.data` (`assetDownloadPath`).
- The three-action row is now complete: **Set from nearest · Select from map ·
  Upload climate data**.

## Tests

- backend: from-upload with EPW only (metrics absent, EPW stored + parsed
  header); EPW + STAT (full metrics + design conditions); EPW + STAT + DDY (DDY
  asset id stored, not parsed). Asset-kind mismatch / not-uploaded → 422/409.
- frontend: vitest — modal renders three inputs; happy path calls
  `attachWeatherFromUpload`; STAT-missing path still attaches; the
  `ProjectEpwControls` tests are removed. `tsc --noEmit` clean.
- `make ci` green; Playwright visual — upload an EPW+STAT, see the Weather File
  page populate with metrics + downloads.

## Exit criteria

The "Upload climate data" modal accepts EPW/STAT/DDY, parses STAT into the same
metric/design set as the derive path, stores all three as assets, and renders on
the Weather page; the temporary `ProjectEpwControls` is gone; the three-action
row is complete; CI green.

## Risks / checks

- **Object-store read for STAT parse** — verify the read-bytes path for an
  uploaded asset before assuming it; the derive path parses pre-store.
- **`project_location.epw_*` readers** — don't break the location form / EPW
  descriptor; consolidate deliberately (default: keep in sync, retire later).
- **Asset-kind enum** — if kinds are constrained, add `stat`/`ddy` with the same
  upload/validation treatment as `epw`.
- **DDY** is store-only (D5) — no parser; just an asset ref on the source data.
