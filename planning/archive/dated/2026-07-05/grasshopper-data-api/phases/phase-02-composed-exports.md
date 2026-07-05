# Phase 02 — Composed Export Routes (backend)

```
DATE:    2026-07-05
TIME:    13:30
STATUS:  ✅ Complete (implemented 2026-07-05; feature/gh-data-api)
AUTHOR:  Claude (with Ed)
SCOPE:   `GET /constructions/hbjson` (rich), `GET /aperture-types`
         (denormalized grid JSON), `GET /aperture-constructions/hbjson`;
         V1 parity verification.
RELATED: ../PRD.md §4.2, §7; ../research.md §2 (V1 wire contract), §5.1.6
```

## Goal

The three composed data routes on the Phase-01 router. These are the V1
replacement surface for the two existing GH components — parity here is the
whole point; PRD §7 is the checklist.

## Preconditions / read first

- Phase 01 merged (envelope, access dependency, version resolution).
- `../research.md` §2.1–§2.3 — the V1 wire contract this must match.
- V1 reference implementations (**read-only precedent — different repo, do
  not import**):
  - `~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/features/assembly/services/to_hbe_construction.py`
  - `.../services/to_hbe_material_typical.py` (rich material serialization:
    PhColor, refs, hybrid layers)
  - `.../services/to_hbe_material_steel_stud.py`
- V2 services to reuse: `features/envelope/hbjson_export.py`
  (`export_hbjson_constructions`), `features/aperture_hbjson_export/service.py`,
  `features/aperture_u_value/` (ISO 10077-1).

## Requirements

### R1 — `GET /constructions/hbjson` (RICH, decision D5)

- Payload key `hb_constructions`: `{assembly_name: OpaqueConstruction.to_dict()}`,
  **single-encoded** (kill V1's string-in-JSON double encoding).
- Rich = V1 parity on each material dict:
  - `honeybee_energy_ph` properties: **PhColor** from the V2 material
    `color` field; division-grid data for mixed (multi-segment) layers.
    Verified available: `from honeybee_energy_ph.properties.materials.opaque
    import EnergyMaterialPhProperties, PhColor` imports clean in the V2
    venv.
  - `honeybee_energy_ref` references: **NOT currently installed** —
    `uv add honeybee-ref` (PH-Tools package; verify the import name
    `honeybee_energy_ref` and pin per the repo's supply-chain posture).
    Emit `add_external_identifier("ph_nav", <pmat_id>)` and datasheet /
    photo references.
- **Design point — asset references**: V1 emitted AirTable URLs. V2 assets
  live in a private bucket behind signed URLs (`context/DATA_STORAGE.md`).
  Do NOT bake short-lived signed URLs into the payload. Recommendation:
  reference stable identifiers — the `pmat_` id via external-identifier and
  the `datasheet_asset_ids` / `photo_asset_ids` as document references whose
  locator is the PHN asset id (+ optionally a stable API URL that performs
  the signed redirect). Confirm the exact `honeybee_energy_ref` object
  fields against V1's usage before deciding; record the decision in
  `../decisions.md`.
- Hybrid (multi-segment) layers: equivalent conductivity must match V1's
  `PhDivisionGrid.get_equivalent_conductivity()` behavior. V1 carries a
  known limitation (equivalent density/specific-heat NOT computed — base
  material's values kept); match it and document, don't silently "improve".
- Steel-stud segments (`steel_stud_spacing_mm` on V2 segments): parity with
  V1's `calculate_steel_stud_eq_conductivity` path.
- Layer order: outside→inside (V2 helper `_layers_outside_to_inside`,
  `features/envelope/hbjson_export.py:203`, already handles `orientation`).
- **Name keying**: V1 keyed by assembly name. Verify whether V2 enforces
  assembly-name uniqueness within a document; if not, define the policy
  (recommend: 409-style validation error naming the duplicates — silent
  suffixing corrupts the user's mental model in GH).

### R2 — `GET /aperture-types` (denormalized grid JSON)

- Payload key `aperture_types`: `{aperture_name: {...}}` matching the V1
  client schema (`window_types_schema.py` in honeybee_grasshopper_ph_plus —
  the parser this payload must satisfy):
  - type: `name`, `display_name`, `row_heights_mm`, `column_widths_mm`,
    `elements`, `last_modified` (envelope-level is authoritative; keep a
    per-type copy only if trivially available).
  - element: `name`, `row_number`, `column_number`, `row_span`, `col_span`
    (**counts**, V1 shape) — map from V2's inclusive tuples:
    `row_number = start`, `row_span = end - start + 1`.
  - `glazing: {name, glazing_type: {id, name, u_value_w_m2k, g_value, ...provenance}}`
    inlined from `project_glazings` via `glazing_id`.
  - `frames: {top|right|bottom|left: {name, frame_type: {id, name, width_mm,
    u_value_w_m2k, psi_g_w_mk, psi_install_w_mk, ...provenance}}}` inlined
    from `project_frames`.
  - `operation: {type, directions} | null`.
- **Emit `psi_install_w_mk`** (V2 has it; V1 never sent it and the GH
  client silently defaulted 0.04). `chi_value`: V2 `ProjectFrame` has no
  chi field — omit and let the client default 0.0; note in decisions.md.
- **Row-order contract**: V1 served the grid top-to-bottom and the GH
  client reverses for Rhino. Verify V2's stored row order against the web
  UI rendering (`features/apertures/` + the apertures page docs under
  `context/ui/pages/`); the payload MUST be top-to-bottom. If V2 stores
  bottom-to-top, convert server-side and test it.
- Element coverage invariant already guaranteed by the document model
  (`features/apertures/coverage.py`) — no holes/overlaps; don't re-validate,
  but fixtures should include multi-row/col spans.

### R3 — `GET /aperture-constructions/hbjson`

- Thin wrapper over `features/aperture_hbjson_export/service.py` inside the
  Phase-01 envelope. Note that service is deliberately minimal (stable
  subset) — that stays as-is; richness was decided for opaque constructions
  only (the GH client builds ph_frame/ph_glazing itself from R2 data).
- Reconcile with the existing route (`features/aperture_hbjson_export/routes.py:39`,
  capability-gated, `source=draft|version`): GH route = saved versions only,
  GH access rules. Existing route unchanged.

## Out of scope

Generic tables route (Phase 03); GH client changes (Phase 04); changes to
existing capability-gated export routes.

## Testing

- **Golden-parity fixtures**: build a synthetic fixture project (assemblies
  incl. one simple, one multi-segment/hybrid, one steel-stud, one flipped
  `orientation`; aperture types incl. multi-span elements, all four frame
  sides, operation set and null). **Public repo — synthetic values only,
  never PHI/Phius/PHPP/WUFI-derived data.**
- Round-trip test: `OpaqueConstruction.from_dict(payload[...])` in-process
  (honeybee installed) restores identifier, layer order, conductivities,
  PhColor, refs, external ids — asserting the PRD §7 checklist items.
- Aperture-types payload parses through a vendored copy of the V1 client
  transforms (port the essential `from_dict`/reversal logic of
  `window_types_schema.py` into the test as CPython — do not import from
  the GH repo).
- U-value spot check: ISO 10077-1 window U on the fixture matches
  `features/aperture_u_value` output.
- Auth/version behavior inherited from Phase 01 — one smoke per route.

## Acceptance gate

PRD §7 checklist: every line checked or explicitly waived in
`../decisions.md`. `make ci` green. Closeout gate per repo CLAUDE.md.

## Risks / notes

- `honeybee-ref` version pinning: keep supply-chain rules (uv lockfile; no
  hand-edits). If the PyPI name differs, it's a PH-Tools-owned package —
  ask Ed rather than guessing.
- Rich payloads are NOT byte-deterministic (honeybee ref/generated ids) —
  never assert payload-hash stability; assert semantic equality.
- V1's material identifier embedded IP thickness (`"[X.X in]"`). Decide
  parity vs plain names with Ed if it affects downstream GH matching —
  V1-parity default is to keep the convention.
