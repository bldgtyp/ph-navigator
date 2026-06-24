---
DATE: 2026-05-26
TIME: planning
STATUS: Proposed implementation plan for Attachments Phase 3.
AUTHOR: Codex
SCOPE: Thermal-bridge attachment cells: datasheets plus simulation files
       with HBJSON support and locked-version verification across all
       attachment cells.
RELATED:
  - context/technical-requirements/attachments.md
  - context/technical-requirements/data-model.md §6.5
  - context/user-stories/30-tables-equipment.md (US-EQ-3)
  - planning/features/attachments/phases/phase-01-site-photo-cell.md
  - planning/features/attachments/phases/phase-02-datasheet-cells.md
---

# Plan 26 - Attachments Phase 3: Thermal-Bridge Cells

## P0. Why this slice

Thermal bridge work has two file classes: supporting datasheets and the
actual simulation file. Phase 3 wires both onto
`tables.thermal_bridges[*]` and proves that one `<AttachmentCell>` can
handle previewable files and non-previewable HBJSON-style files without
forking the UX.

This phase also performs the cross-surface locked-version pass. By this
point Phases 1 and 2 have put attachment cells on segments, materials,
and equipment; Phase 3 must verify the read-only contract across all of
them.

## P1. Acceptance - Phase 3 Done When

1. Thermal-bridge rows expose two attachment fields:
   `datasheet_asset_ids[]` and `simulation_file_asset_ids[]`.
2. `datasheet_asset_ids[]` accepts PDF, PNG, JPG, and WebP with the
   same behavior as Phase 2 datasheets.
3. `simulation_file_asset_ids[]` accepts PDF, PNG, JPG, JSON/HBJSON, and
   octet-stream files with `.hbjson` extension where configured.
4. HBJSON simulation files render with a generic file glyph, file
   metadata, Download, and Open in new tab; no inline model preview is
   attempted.
5. Invalid HBJSON-like files are rejected by the backend sniff rule
   when they cannot parse as JSON or fail the extension/MIME policy.
6. Locked-version mode is verified across segment photos, material /
   equipment datasheets, and thermal-bridge attachments: preview and
   download work; drop, delete, replace, reorder, and empty-cell upload
   affordances do not.
7. Version diff reports added / removed asset ids for both thermal
   bridge fields.
8. Browser smoke passes with one datasheet PDF and one HBJSON simulation
   file on a thermal-bridge row.

## P2. Backend Work

### P2.1 Thermal-Bridge Registry

Add registered attachment-field configs:

```text
tables.thermal_bridges[*].datasheet_asset_ids[]
asset_kind: datasheet
allowed MIME: application/pdf, image/png, image/jpeg, image/webp
max_count: 5
max_file_size_mb: 25

tables.thermal_bridges[*].simulation_file_asset_ids[]
asset_kind: simulation_file or hbjson
allowed MIME / ext:
  application/pdf
  image/png
  image/jpeg
  application/json with .hbjson
  application/octet-stream with .hbjson
max_count: 5
max_file_size_mb: 25
```

The registry should decide whether an HBJSON upload is stored as
`asset_kind = simulation_file` or `asset_kind = hbjson`. Keep that
decision consistent with `data-model.md §6.5`: `hbjson` is shared with
the model viewer, while the referencing field distinguishes TB sim files
from model-tab files.

### P2.2 HBJSON Sniff

Implement the `attachments.md §A9` HBJSON sniff:

- extension must be `.hbjson`;
- accepted MIME is `application/json` or `application/octet-stream`;
- backend attempts a bounded JSON parse on the first chunk;
- non-JSON returns `asset_mime_not_allowed`;
- full HBJSON schema validation is not part of this phase.

Do not add DXF, Flixo, THERM, or other simulation formats. Q-ATT-23
defers those until a concrete workflow exists.

### P2.3 Version-Diff Coverage

Ensure diff extraction covers both thermal bridge fields. For a replace
operation, diff should show old asset id removed and new asset id added
on the same row/field.

### P2.4 Locked-Version Audit

Review the backend write dependencies used by all attachment cells.
Locked versions must reject attach, detach, replace, and reorder through
the same existing save/version guards as other draft writes.

## P3. Frontend Work

### P3.1 Thermal-Bridge Table Wiring

Add attachment core field definitions to the thermal-bridge table:

- `datasheet_asset_ids`: display name `Datasheet`;
- `simulation_file_asset_ids`: display name `Simulation File`.

If the thermal-bridge table is still a placeholder when this phase is
implemented, this phase owns the minimum table surface needed to create,
edit, save, and reload thermal-bridge rows with the two attachment
fields. Do not block the attachment slice on final thermal-bridge
calculation UI.

### P3.2 Non-Previewable File Panel

Extend `AttachmentModal` for HBJSON / other generic files:

- file-type glyph;
- filename, MIME, size, uploaded-by/date if available;
- Download and Open in new tab;
- no inline JSON dump by default;
- editor-only Delete / Replace controls still available.

The cell strip uses the same generic glyph tile. Tooltip includes
filename, size, and MIME.

### P3.3 Locked-Version Pass

Add a shared read-only fixture or story-like test state that renders:

- a segment photo cell;
- a project-material datasheet cell;
- an equipment datasheet cell;
- thermal-bridge datasheet and simulation-file cells.

For each, assert:

- thumbnails / glyphs render;
- modal opens;
- download action is present;
- drop affordance is absent;
- Delete / Backspace is ignored;
- Replace is absent;
- reorder rail is disabled.

## P4. Tests

Backend:

- thermal-bridge datasheet validation;
- thermal-bridge simulation-file validation;
- `.hbjson` JSON parse acceptance / rejection;
- non-`.hbjson` JSON rejected for simulation field if policy requires
  extension;
- cross-project reference rejection;
- locked-version write rejection;
- diff for attach, detach, replace.

Frontend:

- thermal bridge fields render as attachment cells;
- HBJSON generic glyph and modal panel;
- read-only behavior shared across all attachment fields;
- Delete / Replace unavailable in locked/public modes.

Browser:

- add a thermal-bridge row;
- attach one PDF datasheet and one HBJSON simulation file;
- reload and preview/download both;
- lock the version and verify no mutation affordances remain.

## P5. Out Of Scope

- DXF, Flixo, Dartwin proprietary formats, THERM files, and other
  simulation formats.
- Parsing or rendering HBJSON in the attachment modal.
- Model-tab `project_hbjson_files` upload/list/select behavior.
- Bulk jobs and MCP tools - Phase 4.
- Per-row thermal-bridge calculations or full TB workflow polish beyond
  the attachment field surface.

## P6. Done Definition

This phase is mergeable when thermal-bridge attachment fields are wired,
HBJSON policy is enforced, and one read-only browser pass proves that
every v1 attachment cell respects locked/public mode.
