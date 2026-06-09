---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Not started
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 6 — split `backend/features/project_document/document.py`
       (currently 1,602 lines, soft limit 600) into models / templates
       / validation. Pure organisation, zero behavior change.
EFFORT: ~2–3 h
BUCKET: Soon
DEPENDS_ON: Phase 2 (extract `empty_project_document` first so the
            templates file already exists)
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §1a
  - `backend/features/project_document/document.py`
  - `backend/features/project_document/models.py` (existing)
  - `backend/features/project_document/validation.py` (existing)
---

# Phase 6 — Split `project_document/document.py`

## Goal

End state: no file in `backend/features/project_document/` exceeds the
600-line soft limit. `document.py` is either deleted or reduced to a
small re-export shim. Every symbol previously importable from
`backend.features.project_document.document` is still importable from
the same path (via re-export) for the duration of this phase, then
call sites are migrated in a follow-up commit.

## Current shape

`document.py` (1,602 lines) holds, by the grep outline:

| Range | Content |
|------|--------|
| 115–129 | `RowWithCustomFields`, `SingleSelectOption` |
| 145–470 | Row + Envelope types for every table family (Rooms, Pumps, Ventilators, Fans, HotWaterHeaters, HotWaterTanks, ElectricHeaters, Appliances, ThermalBridges, EmptyEquipmentTables) |
| 482–520 | `CatalogOrigin`, `_require_catalog_origin_family` |
| 521–833 | `FrameRef`, `GlazingRef`, `AssemblySegment`, `AssemblyLayer`, `Assembly`, `ProjectMaterial`, `ApertureOperation`, `ApertureElementFrames`, `ApertureElement`, `ApertureTypeEntry`, `RoomsTableEnvelope` |
| 847–874 | `ProjectDocumentProject`, `ManufacturerFilters` |
| 874–898 | `ProjectDocumentTables` |
| 899–1338 | `ProjectDocumentV1` |
| 1339–1360+ | `_require_record_id_seeded`, `_validate_unique_ids`, `_validate_contiguous_orders` (cross-table validators) |

`project_document/` already has `models.py` (separate, presumably
smaller), `validation.py`, and (after Phase 2) `templates.py`. The
split must respect those existing files, not invent duplicates.

## Pre-work

1. Read `project_document/models.py` and `validation.py` end-to-end.
   What's in them today is the existing home for some of this content;
   the split should *consolidate*, not create parallel namespaces.
2. Read the bottom 200 lines of `document.py` (which I haven't sampled
   at planning time) to confirm there is nothing structurally different
   from the outline above.
3. Map every symbol in `document.py` to one of: `models.py`,
   `templates.py`, `validation.py`, or "stays in `document.py` because
   it is the public type façade".

## Split plan

Provisional mapping (refine during pre-work):

### `project_document/models.py` (target home for row + envelope types)

- `RowWithCustomFields`, `SingleSelectOption`
- All `*Row` and `*TableEnvelope` classes (Rooms, Pumps, Ventilators,
  Fans, HotWaterHeaters, HotWaterTanks, ElectricHeaters, Appliances,
  ThermalBridges)
- `EmptyEquipmentTables`
- `CatalogOrigin`
- `FrameRef`, `GlazingRef`, `AssemblySegment`, `AssemblyLayer`,
  `Assembly`, `ProjectMaterial`, `ApertureOperation`,
  `ApertureElementFrames`, `ApertureElement`, `ApertureTypeEntry`
- `ProjectDocumentProject`, `ManufacturerFilters`,
  `ProjectDocumentTables`, `ProjectDocumentV1`

If after consolidation `models.py` itself exceeds 600 lines, split it
along the family seams that already exist in the file. Reasonable
sub-files:

- `models/equipment.py` — Pumps, Ventilators, Fans, HotWaterHeaters,
  HotWaterTanks, ElectricHeaters, Appliances, ThermalBridges + their
  envelopes + `EmptyEquipmentTables`.
- `models/rooms.py` — `RoomRow`, `RoomsTableEnvelope`.
- `models/envelope.py` — `CatalogOrigin`, `FrameRef`, `GlazingRef`,
  `AssemblySegment`, `AssemblyLayer`, `Assembly`, `ProjectMaterial`,
  apertures.
- `models/project.py` — `ProjectDocumentProject`, `ManufacturerFilters`,
  `ProjectDocumentTables`, `ProjectDocumentV1`.
- `models/__init__.py` re-exports everything for back-compat.

The four-file split lands every file comfortably under the 600 line
limit and groups by table family — the natural seam in this domain.

### `project_document/templates.py` (created in Phase 2)

- Already holds `empty_project_document`.
- Move any other `empty_*` template builders (e.g. private factories
  for `EmptyEquipmentTables`) here.

### `project_document/validation.py`

- `_require_catalog_origin_family`
- `_require_record_id_seeded`
- `_validate_unique_ids`
- `_validate_contiguous_orders`
- Any other cross-table validators in `document.py`

These have leading underscores today. Once they live in a shared module
they should either:
- stay private to the validation module and be called via a small
  public surface, or
- drop the underscore and become public helpers on the validation
  module.

Decide at split time — both are defensible. The review's intent is
just to get them out of `document.py`.

### `project_document/document.py` shim (interim)

Until call sites are migrated, leave a one-liner:

```python
"""Backward-compat shim. Imports moved to `models`, `templates`,
`validation`. New code should import from those modules directly."""

from backend.features.project_document.models import *  # noqa: F401,F403
from backend.features.project_document.templates import *  # noqa: F401,F403
from backend.features.project_document.validation import *  # noqa: F401,F403
```

This keeps the diff per commit minimal and gives `ty` and `ruff` a
chance to flag any import that didn't resolve.

## Steps

1. **Commit 0**: pre-work. Confirm mapping; record the chosen layout
   in `decisions.md`.
2. **Commit 1**: move row + envelope types into `models.py` (or the
   `models/` sub-package if needed). Leave the shim. `make ci` green.
3. **Commit 2**: move validators into `validation.py`. `make ci` green.
4. **Commit 3**: move any remaining template builders into
   `templates.py`. `make ci` green.
5. **Commit 4**: sweep call sites to import from the new locations
   directly (`grep -rn "from backend.features.project_document.document"`)
   and delete the shim. `make ci` green.

Each commit is independently revertable. Do not collapse them.

## Files touched

- `backend/features/project_document/document.py` (becomes shim, then
  is deleted)
- `backend/features/project_document/models.py` (or new `models/` pkg)
- `backend/features/project_document/templates.py`
- `backend/features/project_document/validation.py`
- Every file that imported a symbol from `.document` (commit 4)

## Verification

- After commit 4: `wc -l backend/features/project_document/*.py
  backend/features/project_document/models/*.py 2>/dev/null` shows
  no file over 600 lines.
- `grep -rn "from backend.features.project_document.document"
  backend/` returns nothing.
- Every previously passing `project_document` test still passes
  without modification.
- `make ci` green at each commit boundary.

## Risks

- **Circular imports**: `templates.py` imports types from `models.py`;
  `validation.py` may import types from `models.py`; `models.py` must
  not import from either. Plan import direction in pre-work.
- **`from .document import *`-style imports** elsewhere will break
  silently if a symbol moves and is not re-exported by the shim. The
  shim's `import *` lines cover this, but only if every target module
  has a correct `__all__`. Set `__all__` in each new module before
  removing the shim.
- **Test fixtures**: tests in `backend/tests/features/project_document/`
  likely import many symbols from `.document`. Update them in commit 4
  alongside production code.

## Done when

- `document.py` is gone. No file in `project_document/` exceeds 600
  lines. CI green. `STATUS.md` updated. `decisions.md` records the
  chosen sub-package layout.
