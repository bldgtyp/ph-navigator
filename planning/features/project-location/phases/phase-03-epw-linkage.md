---
DATE: 2026-06-12
TIME: 17:19 EDT
STATUS: Ready for handoff — depends on Phases 1–2 and the existing R2
  asset system. Phase 3 backend can start in parallel with Phase 2.
AUTHOR: Claude (for Ed)
SCOPE: EPW weather-file linkage — new asset_kind='epw', upload in the
  Location section, header parse → one-click pre-fill, source URL,
  non-blocking entered-vs-EPW mismatch warning, parsed header retained
  in asset metadata, full file retained in R2.
RELATED:
  - planning/features/project-location/PRD.md §6,§8
  - planning/features/project-location/decisions.md D-PL-3
  - backend/features/assets/{registry.py,schemas.py,service.py,repository.py}
  - backend/alembic/versions/20260526_0011_project_assets_and_jobs.py
  - frontend/src/features/assets/{types.ts,hooks.ts,components/AttachmentCell.tsx}
---

# Phase 3 — EPW linkage (backend + frontend)

## 1. Goal

An editor uploads an EPW into the Location section; the app parses its
`LOCATION` header, offers a one-click pre-fill of
lat/long/elevation/time-zone (editable after), stores a provenance
URL, warns non-blockingly on a >1° entered-vs-EPW mismatch, retains
the parsed header in asset metadata, and keeps the full EPW in R2 for
future climate consumers. The EPW is a data **source**, never the
owner of the location fields (PRD §6).

## 2. Required reading (in order)

1. `backend/features/assets/registry.py` — `AssetKind` literal
   (~line 14), `all_asset_kinds()` (~88), `AttachmentFieldConfig`.
2. `backend/features/assets/service.py` — `complete_upload` and
   `_validate_magic` (~434–450); the object-prefix read used for magic
   checks (reuse it to read the EPW header).
   `repository.set_asset_metadata` for stashing parsed values.
3. `backend/alembic/versions/20260526_0011_project_assets_and_jobs.py`
   — the `asset_kind` CHECK constraint (~46–49) to extend.
4. `frontend/src/features/assets/` — `types.ts` `AssetKind` union,
   `hooks.ts` `uploadAsset`, `AttachmentCell.tsx` upload UX.
5. PRD §6 (flow), §8 (mismatch rule). decisions.md D-PL-3 (parse
   ownership), D-PL-4 (true-north is NOT in the EPW — leave it to the
   user).

## 3. Work breakdown

### 3.1 Register the `epw` asset kind (backend)
- `registry.py`: add `"epw"` to the `AssetKind` literal and to
  `all_asset_kinds()`. Add an `AttachmentFieldConfig` (or the minimal
  project-level registration the system needs) for EPW: allowed
  content types `text/plain` + `application/octet-stream`, allowed
  extension `.epw`, a sensible size cap, project-scoped.
- **Migration** under `backend/alembic/versions/`: drop and recreate
  the `project_assets_kind_allowed` CHECK to include `'epw'` (the kind
  is a CHECK constraint, not an enum table). Verify upgrade/downgrade.

### 3.2 Light EPW validation in assets (D-PL-3)
In `_validate_magic`, add a minimal EPW branch: when extension is
`.epw`, the first line must begin `LOCATION,` with the expected field
count. Failure ⇒ asset failed / 422. **No** full parse here — that is
the location feature's job.

### 3.3 EPW parse endpoint (project_location)
`POST /api/v1/projects/{id}/location/epw/parse?asset_id=...`
(editor-only):
- Read the EPW's leading bytes via the assets service's object-prefix
  read; parse the `LOCATION` header (dependency-free split — no
  ladybug): `city, state, country, source, wmo, latitude, longitude,
  time_zone(UTC offset hrs), elevation`.
- Map UTC-offset → a representative IANA `time_zone` only if
  unambiguous; otherwise return the numeric offset and let the user
  pick the zone. Return a **suggestion** object (not persisted to the
  location row).
- Persist the parsed snapshot into the asset's `metadata` JSONB
  (`set_asset_metadata`, key `epw_location`) so future consumers and
  re-opens don't re-parse.

### 3.4 Mismatch warning rule (service)
Extend Phase 1's `warnings[]` plumbing in
`update_project_location`: when both entered and the linked EPW's
parsed lat/long exist and differ by ≳1°, append a non-blocking warning
(code + human message). Never reject (PRD §8).

### 3.5 Frontend — uploader + apply (in the Phase 2 section)
- `types.ts`: add `"epw"` to the `AssetKind` union.
- In the Location section: an EPW uploader (reuse `uploadAsset` /
  asset upload UX) visible to editors; on upload-complete call the
  parse endpoint; show the parsed values with an **"Apply"** button
  that fills the form inputs (editable, not auto-saved) and sets
  `epw_asset_id` + `epw_source_url` on the next save.
- Show the linked EPW (filename, source URL) with a download affordance
  for editors and viewers; render the `warnings[]` mismatch banner in
  the Phase 2 slot.
- True-north is **not** in the EPW — keep it a user field (D-PL-4).

## 4. Out of scope

Climate summary / degree days / dataset alignment / WUFI-PHPP
cross-checks (future consumers — kept unblocked by retaining the
parsed snapshot + full file, not built). Geocoding. Sun-path wiring
(model-viewer; PRD §10).

## 5. Verification gate

1. **pytest**: header parse on a real EPW fixture (lat/long/elev/tz
   extracted); light `_validate_magic` accepts a valid EPW and rejects
   a non-EPW with a `.epw` name; mismatch rule fires >1° and is silent
   ≤1°; parsed snapshot lands in asset metadata; parse endpoint is
   editor-gated.
2. **Vitest**: apply-suggestion fills inputs without auto-saving;
   uploader hidden for viewers; warning banner renders.
3. **Playwright/MCP**: editor uploads an EPW fixture, applies values,
   edits one, saves, reloads → persisted; viewer can download but not
   upload.
4. **Closeout**: `make format` + `make ci` green. `graphify update .`.

## 6. Exit criteria

EPW upload → parse → one-click apply → editable → save works;
provenance URL stored; >1° mismatch warns non-blockingly; full EPW
downloadable and parsed header retained in metadata; viewers read-only
with download. Feature is product-complete for v1; fold any drift back
into PRD/decisions and `context/` per planning/.instructions.md, and
note in STATUS.md that the model-viewer sun-path wiring (PRD §10)
remains the only open consumer, owned by model-viewer.
