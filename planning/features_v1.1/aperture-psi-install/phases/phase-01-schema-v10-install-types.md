# Phase 01 — Schema v10: install-types table, element slots, edge classification

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Not started
AUTHOR:  Ed + Claude
SCOPE:   Backend only. New `aperture_install_types` table + seeds, per-element
         install slots, edge-classification helper, v9→v10 migration,
         attachment-registry entries, drift-guard entries. No routes/commands
         yet (phase 02), no UI.
RELATED: ../decisions.md (D-1..D-4, D-7..D-9), ../research.md §5
```

Read first: `backend/.instructions.md`, `context/CODING_STANDARDS.md`,
`context/DATA_STORAGE.md`. The **thermal_bridges table is the template for
almost everything here** — when in doubt, clone its pattern.

## 1. Row + envelope models

`backend/features/project_document/rows.py` — add `ApertureInstallTypeRow`,
cloned from `ThermalBridgeRow` (`rows.py:408-431`):

- `id`: pattern `^apit_[A-Za-z0-9_-]+$`, max_length 80.
- Typed columns: `pdf_report_asset_ids`, `datasheet_asset_ids`,
  `photo_asset_ids` (list[str]), `datasheet_status`/`photo_status`
  (`EvidenceStatus`, default "needed"), `datasheet_not_required`/
  `photo_not_required` (bool), `notes`.
- No typed psi column — `name`, `psi_w_mk`, `source`, `status`, `record_id`
  are seeded FieldDefs in `custom_values` (TB stores `psi_value_w_mk` the
  same way; keeps DataTable/units/CSV machinery uniform).
- Add `ApertureInstallTypesTableEnvelope` (field_defs + rows), mirroring
  `rows.py:433-437`.

## 2. Element slots

`backend/features/project_document/envelope_models.py` — next to
`ApertureElementFrames` (`:488-497`) add:

```python
class ApertureElementInstalls(BaseModel):
    """Per-side install-type assignment; None inherits the project Default."""
    top: str | None    # pattern ^apit_..., max_length 80
    right: str | None
    bottom: str | None
    left: str | None
```

`ApertureElement` gains `installs: ApertureElementInstalls =
Field(default_factory=ApertureElementInstalls)`. Follow the exact Field
patterns used by `ApertureElementFrames` (same pattern/length constraints).

## 3. Table module + seeds

New `backend/features/project_document/tables/aperture_install_types.py`,
cloned from `tables/thermal_bridges.py`:

- Seeded FieldDefs: `record_id` (via the shared seed helper), `name` (text,
  required-ish like TB name), `psi_w_mk` — unit-configured conductivity
  column, copy the config verbatim from `thermal_bridges.py:60-75`
  (`w_m_k` / `btu_h_ft_f`, precision 3/4), description "Window install
  linear thermal transmittance in W/(m-K)."; `source` — single-select with
  option ids `opt_apit_src_program_default`, `opt_apit_src_phius_mid_wall`,
  `opt_apit_src_phius_mid_wall_oi`, `opt_apit_src_calculated`,
  `opt_apit_src_manufacturer`; shared status field
  (`_status_field.status_field_def()`).
- Attachment FieldDefs via `_attachment_fields.pdf_report_field_def()`,
  `datasheet_field_def()`, `photo_field_def()`.
- Option-list keys registered in `document.py` next to
  `:153-159` (`aperture_install_types.source`,
  `aperture_install_types.status`).
- Contract: `schema_slug="aperture-install-type"`,
  `table_path=("aperture_install_types",)`, full `field_registry` via
  `make_field_registry` (clone TB `:224-244`), `link_targetable` as TB has
  it. Register in `tables/registry.py` `_TABLES`.
- **Delete-block (D-8)**: in the contract's `apply_replace` path, before
  accepting a replace, diff removed row ids against every aperture element's
  `installs` slots and against the well-known `apit_default` id; on a hit
  raise the 409 conflict shape used by
  `dependent_links.py` (`dependent_link_delete_blocked`, `:41`) with
  per-type usage counts. `apit_default` is never deletable. Wire the same
  check into the `:preview-replace` response so the UI can warn.

## 4. Document + schema bump

`backend/features/project_document/document.py`:

- `ProjectDocumentTables` gains
  `aperture_install_types: ApertureInstallTypesTableEnvelope` (default
  factory) — alongside `thermal_bridges` at `:427`.
- Add `APERTURE_INSTALL_TYPES_TYPED_COLUMN_FIELD_KEYS` next to the TB set
  (`:323-334`).
- `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` 9 → 10 (`:228`);
  `ProjectDocumentV1.schema_version: Literal[10]`; changelog comment entry.

## 5. Migration `_upgrade_v9_to_v10`

`backend/features/project_document/migrations/upgrade.py` (append after
`_upgrade_v8_to_v9`, `:438`; register in the ladder `:549-557`):

- Insert `aperture_install_types` envelope with the seeded FieldDefs.
- Seed the **Default row**: id `apit_default`, name "Default",
  `psi_w_mk` = **0.052 if `"phius"` in `raw["project"]["cert_programs"]`
  else 0.04** (D-4; `cert_programs` is in the body — `document.py:343`),
  `source` = `opt_apit_src_program_default`, status Complete,
  datasheet/photo `not_required=True`.
- Every aperture element gains `installs` = all-None (the Pydantic default
  covers absent keys, but write it explicitly for a clean raw dict —
  match the style of prior migrations).
- `templates.py`: seed the same envelope + Default row for new projects
  (`empty_project_document`, value from `payload.cert_programs`).

## 6. Validation

`backend/features/project_document/document_validation.py` (clone the TB
block `:324-342`):

- Every non-null `installs` slot references an existing
  `aperture_install_types` row id.
- `psi_w_mk` ≥ 0 when set; `source`/`status` option ids valid.
- Exactly one `apit_default` row exists (seeded, delete-blocked).
- Do **not** validate perimeter-vs-interior here — stale interior
  assignments are tolerated and ignored by the resolver (phase 02); grid
  mutations clean them up (phase 02).

Also update the table listings in `_validators.py` (`:50,:107`),
`downloads.py` (`:17`), and `gh_api/tables_export.py` (`:55`).

## 7. Edge classification helper

New `backend/features/project_document/apertures/edge_classification.py`:

- Pure function `classify_element_edges(aperture: ApertureTypeEntry) ->
  dict[tuple[str, ApertureSide], Literal["perimeter", "interior"]]`.
- An element side is **interior** iff it abuts another element of kind
  `"glazed"` across the grid (span-aware: use `row_span`/`column_span` and
  occupancy the same way `apertures/coverage.py` walks the grid).
  Sides abutting `void` elements or the aperture boundary are
  **perimeter** (D-3).
- Unit tests: 1×1; 1×2 mull (two interior sides); 2×2; spans (2×1 element
  beside two 1×1s); void neighbor → perimeter; L-shaped span adjacency.

## 8. Attachment registry + guards

`backend/features/assets/registry.py`:

- Three `AttachmentFieldConfig` entries for
  `aperture_install_types.{pdf_report,datasheet,photo}_asset_ids` — the
  pdf_report one clones the TB entry (`:121-130`: kind `datasheet`,
  PDF-only content types, max 5 × 25 MB).
- Add the table to the table-key maps (`:26-45`) and the row walker
  (`iter_rows_for_raw_tables`, `:293-313`).
- `backend/tests/test_attachment_reachability_guards.py` must pass
  unmodified — it's the guard proving the wiring.

## 9. Status integration

- `tables/_status_field.py`: add `aperture_install_types` to
  `STATUS_TABLE_NAMES` (`:53-65`).
- Do not recreate retired `status_summary.py`; status-ux-unification Phase 05
  is complete (D-9).

## 10. Tests & exit gate

- New: migration round-trip (v9 fixture body → v10: envelope present,
  Default row program-aware for a phius and a phi fixture, slots added);
  validation cases (bad slot ref, missing default, dup default); edge
  classification suite (§7); delete-block 409 with usage counts;
  reachability guard green.
- Existing suites that will notice: document round-trip snapshots, tables
  registry drift tests, downloads listing — update fixtures, don't loosen
  asserts.
- Closeout: `simplify` → `docs-pass` → `make format` → `make ci` green.
- Exit gate: all above + STATUS.md phase ledger updated with evidence.
