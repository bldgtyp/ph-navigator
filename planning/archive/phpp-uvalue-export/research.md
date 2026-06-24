---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Reference — codebase findings captured during design
AUTHOR: Ed (via Claude)
SCOPE: Concrete file/line references and the architecture decision, so the
  implementer does not re-discover the export pipeline, units system, and
  thermal calc.
RELATED: README.md, PRD.md, decisions.md
---

# Research — PHPP U-Value Export

All paths relative to repo root
`/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2`.

## 1. Export precedent — "Download constructions HBJSON" (mirror this)

**Frontend**
- `frontend/src/features/envelope/routes/EnvelopePage.tsx`
  - `exportHbjson()` (~L214): draft warning via `window.confirm`, then
    `exportMutation.mutateAsync()`; errors → `exportErrorDetails()`.
  - `AppMenu` / `AppMenuItem` (~L249) rendered only on `isAssembliesRoute`.
- `frontend/src/features/envelope/hooks.ts`
  - `useEnvelopeHbjsonExportMutation` (L95–103): `downloadEnvelopeHbjson()` →
    `downloadBlob(blob, "envelope-constructions-<versionId>.hbjson")`.
- `frontend/src/features/envelope/api.ts`
  - `downloadEnvelopeHbjson` (~L64): `fetchBlob(GET /api/v1/projects/{pid}/
    versions/{vid}/envelope/export/hbjson)`.
- `frontend/src/shared/api/client.ts` — `fetchBlob` (L56) and
  `fetchApiResponse` (exposes the `Response`, so headers are readable before
  `.blob()` if ever needed).
- `frontend/src/shared/lib/downloadBlob.ts` — object-URL + anchor click.
- `frontend/src/features/envelope/routes/page-helpers.ts` —
  `exportErrorDetails()` formats a structured `{details:{errors:[…]}}` body.

**Backend**
- `backend/features/envelope/routes.py`
  - `@router.get("/envelope/export/hbjson")` (L66–76): `get_saved_document(
    version_id, access)` → `export_hbjson_constructions(body)` →
    `json_download_response(...)`. Access dep = `ProjectViewAccess` (read-only).
  - Router prefix gives the full path `…/projects/{project_id}/versions/
    {version_id}/envelope/...`.
- `backend/features/shared/responses.py`
  - `json_download_response(content, filename)` (L8–13): `Response(content,
    media_type="application/json", headers={"Content-Disposition": …})`.
    → **Add a sibling `zip_download_response(data: bytes, filename)` with
    `media_type="application/zip"`.**
- `backend/features/envelope/hbjson_export.py`
  - `export_hbjson_constructions(body)` (L16): builds `materials_by_id`,
    calls `_export_errors(...)`, raises **422 `envelope_export_incomplete`**
    with `{errors:[…]}` if any assembly is incomplete (PHPP diverges — per
    assembly, not all-or-nothing).
  - `_layers_outside_to_inside(assembly)` (~L177): **reuse / replicate** for
    the ext→int row order (decisions Q2).
  - `_construction_payload`, `_layer_material_payload`, equivalent-conductivity
    width-weighting at ~L90 (pattern for segment width fractions).
- `backend/features/project_document/store.py`
  - `get_saved_document(version_id, access)` (L47): reads the committed
    version body and `validate_document(...)` → `ProjectDocumentV1`.

## 2. Server-side ZIP + CSV precedent (stdlib, zero new deps)

- `backend/features/assets/service.py` — `_run_bulk_download` (~L700–788):
  - `io.BytesIO()` + `zipfile.ZipFile(buf, "w", ZIP_DEFLATED)` +
    `zf.writestr(path, bytes)`.
  - `io.StringIO()` + `csv.DictWriter(...).writeheader()/writerows(...)` →
    `zf.writestr("MANIFEST.csv", manifest.getvalue())`.
  - `_dedupe_path(name, used_paths)` — collision-safe filenames (reuse idea).
  - NOTE: that path uploads the zip to R2 via an async job. **We do NOT need
    that** — the PHPP zip is small; build it in-memory and stream it directly
    (like `json_download_response`). Use `csv.writer` on raw rows (not
    `DictWriter`) because the layout is a positional grid, not a flat table.

## 3. Data model (read-only inputs)

`backend/features/project_document/envelope_models.py`:
- `Assembly` (L185): `id, name, type, orientation, layers[]`.
- `AssemblyLayer` (L168): `id, order, thickness_mm, segments[]`.
- `AssemblySegment` (L145): `id, order, width_mm, is_continuous_insulation,
  steel_stud_spacing_mm, project_material_id, …`.
- `ProjectMaterial` (L210): `name, category, conductivity_w_mk, …`.
- Stored in JSONB at `ProjectDocumentV1.tables.assemblies[]` /
  `…project_materials[]` (`document.py`); no relational envelope tables.

## 4. Thermal calc (reference U-value + total thickness)

`backend/features/envelope/thermal.py`:
- `calculate_assembly_thermal(assembly, materials_by_id) -> ThermalResult`
  (L36): SI-canonical `r_effective_m2k_w`, `u_effective_w_m2k`, `warnings`.
  Average of `_calculate_parallel_path_r_value` and
  `_calculate_isothermal_planes_r_value`.
- `_segment_r_value(layer, segment, materials_by_id)` (L173):
  `(thickness_mm/1000) / conductivity_w_mk` — the segment R primitive.
- Width-fraction weighting already done at L162–167:
  `segment.width_mm / total_width`.
- **No Rsi/Rse** — explicitly construction-only. Matches screenshots
  (Rsi=Rse=0.00). `thermal_issues(...)` (L219) classifies
  invalid_geometry / missing_material / missing_conductivity /
  broken_material_reference → reuse for the `incomplete_materials` reason.
- Total thickness = `sum(layer.thickness_mm for layer in layers)` (plain sum;
  not in thermal.py).

## 5. Backend feature layering (where new code goes)

`backend/features/envelope/`: `routes.py` · `service.py` · `thermal.py` ·
`hbjson_export.py` · `selectors.py` · `models.py` · `commands/` · `ops.py`.
- New module: **`backend/features/envelope/phpp_export.py`** (mirrors
  `hbjson_export.py`): pure functions, no I/O — takes `ProjectDocumentV1`,
  returns plans / CSV strings / zip bytes.
- New routes appended to **`routes.py`**; thin (read doc → call module →
  response), like the HBJSON route.
- Response helper in **`backend/features/shared/responses.py`**.

## 6. Units system

- Preference: `frontend/src/lib/units/` — `useUnitPreference()` →
  `{ unitSystem: "SI"|"IP", setUnitSystem, toggleUnitSystem, source, error }`.
  Persisted to `users.units_preference` via `PATCH /api/v1/auth/preferences`
  (+ localStorage `phn.units_preference`); default SI.
- Converters (frontend): `length.ts` (`mmToIn` = `/25.4`), `thermal.ts`,
  `numberUnits.ts` (`formatNumberUnitsDisplay`). The **DataTable CSV export**
  (`frontend/src/shared/ui/data-table/lib/export/csv.ts`) already builds CSVs
  client-side with these converters — the precedent for "CSV serialization is
  a frontend display concern."
- Backend has **no** unit-conversion code (SI only).

## 7. Architecture decision — build the zip in the BACKEND

Two viable homes; we choose backend.

**Backend (chosen).** New `phpp_export.py` + routes; stdlib `csv`+`zipfile`;
stream the zip like HBJSON. Pros: mirrors HBJSON exactly (same saved-version
read, same download mechanism); the U-value/total-thickness it needs are
already computed there; the only conversion needed is `mm/25.4` for the IP
name annotation (so "backend has no converters" barely matters); the
eligibility/section-mapping logic (data manipulation) lives in one place,
honoring the hard rule "all calculations and data manipulation live in the
backend"; zero new deps; a single preflight endpoint feeds the modal so the
rule is not duplicated in TS.

**Frontend (rejected).** Reuses `lib/units` and matches the DataTable-CSV
precedent, but: would need U-values for *every* assembly (today
`useAssemblyThermalQuery` fetches only the active one → N requests or a new
bulk endpoint anyway); needs a new zip dep (no `zip` package today —
supply-chain min-age rules apply); and splits export logic away from HBJSON's
backend home while duplicating the eligibility rule. The thermal-fetch wrinkle
alone tips it to backend.

→ Frontend stays thin: menu item + preflight call + modal + `downloadBlob`,
passing `?units=` from the live toggle.

## 8. Frontend UI primitives (already exist)

- `frontend/src/shared/ui/AppMenu.tsx` — `AppMenu` / `AppMenuItem` (icon +
  `onClick` + `disabled`). Add one item.
- `frontend/src/shared/ui/ModalDialog.tsx` — backdrop + Escape-to-close + a11y
  dialog. `frontend/src/shared/ui/DialogActions.tsx` — Cancel + primary button
  (relabel primary to "Download anyway"). Together = the §9 confirm modal.

## 9. PHPP worksheet facts (from the two screenshots)

- Up to **3 Area sections** (sec 1 / 2 / 3), each `λ [W/(mK)]`, one shared
  `Thickness [mm]` column per row, one global `Percentage of sec. N` each.
- Both IP and SI screenshots show **metric** λ (W/mK) and mm thickness; U-value
  `[W/(m²K)]`, total thickness `[cm]`. The IP screenshot's only IP-ism is
  `Concrete (Heavily Reinforced) [ 8.0 in ]` (203 mm ≈ 8.0").
- `Interior Rsi` / `Exterior Rse` both `0.00 m²K/W` in the filled example.
- "Assembly no." holds PHPP's own id (`01ud`, `04ud`) — not ours.
