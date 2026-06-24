---
DATE: 2026-06-24
TIME: 17:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Phase 2 — rewire every inline-ref construction site to upsert a flat
  entity + set the element FK; re-source the drift comparator.
RELATED: ./phase-00-models-and-tables.md, ../decisions.md (D-2, D-3, D-6)
---

# Phase 2 — Rewire the write path (the riskiest phase)

Every site that today builds/stores an inline `GlazingRef`/`FrameRef` must
instead `ensure_project_*` (Phase 0 helper) → store the returned FK id. The
frontend pick command is unchanged (D-3): it still sends the full ref; the
backend does the upsert. (**D-2 settled: Option A** — catalog refs dedup by `catalog_record_id`; each hand-entered ref appends its own entity.)

## Backend sites

### Pick handlers — `aperture_commands/handlers/picks.py`

- `apply_pick_frame` (`:43-68`, inline store at `:56
  element.frames.model_copy(update={side: frame_ref})`): keep `_stamp_synced_at`
  on the incoming ref, then `frame_id = ensure_project_frame(tables, ref)` and
  set `element.frames.model_copy(update={side: frame_id})`.
- `apply_pick_glazing` (`:71-94`, inline store at `:84`): same shape →
  `glazing_id = ensure_project_glazing(...)`; set `element.glazing_id`.
- These handlers now mutate **two** parts of the document (append to the flat
  table + set the element FK); make sure both land in the one returned body.

### Refresh — `aperture_commands/handlers/refresh.py`

`apply_refresh_ref_from_catalog` (Phase-12 refresh dialog) wrote chosen field
values onto the inline ref. Re-point it at the **`ProjectGlazing`/`ProjectFrame`
row** the element references (look up by FK), applying `chosen_values` +
preserving `catalog_origin.local_overrides`. Because the entity is shared, a
refresh now updates every use — that is the intended shared-edit semantics (D-6).

### Drop `EditFieldOverride` — `aperture_commands/models.py:180-199`

Obsolete under shared-edit (D-6). Remove the kind + its `_NOT_IMPLEMENTED_KINDS`
entry (`dispatcher.py:~82`). Field edits go through the Phase-3
`update_project_glazing/frame` command instead.

### Factories — `apertures/factories.py`

`build_default_aperture_type` (`:47-107`) bookshelf-copies the default
frame/glazing into all four sides + glazing (`:79-103`). Rewire to:
`ensure_project_frame`/`ensure_project_glazing` against the default ref **once**,
then assign the returned id to all four sides + glazing. Net: a new default
aperture references **one** `ProjectFrame` + one `ProjectGlazing`, not four+one
inline copies.

### Default refs / bookshelf helpers

- `apertures/default_refs.py` `DatabaseDefaultsCatalog.get_default_frame/glazing`
  (`:74-96`) still returns a `FrameRef`/`GlazingRef` (the DTO) — unchanged; it
  feeds `ensure_project_*`.
- `apertures/_ref_helpers.py` `bookshelf_copy_frame/glazing` (`:64-85`) and
  `reset_origin`/`advance_origin` (`:30-61`): still build the ref DTO; the
  element-copy callers now route through `ensure_project_*`. Audit callers of
  `bookshelf_copy_*` for any that wrote directly to an element slot.

### Structural copies — split / duplicate / paste

Commands that copy an element's assignments (`duplicateApertureType`,
`splitElement`, `mergeElements`, `pasteAssignment`) currently deep-copy inline
refs (via `advance_origin`). Under FK they simply **copy the FK id** (the entity
is shared) — simpler. Verify each handler copies `glazing_id` + frame-slot ids
rather than re-creating entities.

### HBJSON aperture import

The HBJSON importer builds apertures (and their glazing/frame data) directly.
Locate the aperture-construction path in the HBJSON import feature and route its
glazing/frame creation through `ensure_project_*` so imported apertures land as
v12 (FK + flat). (Grep the hbjson import feature for `glazing` / `frame` / aperture
element construction; the seed `scripts/seed_hbjson_model.py` exercises it.)

### Drift comparator — `aperture_drift/comparator.py`

`compare_frame_ref`/`compare_glazing_ref` (`:55-68`) and the caller that walks
elements: read the referenced `ProjectFrame`/`ProjectGlazing` (by FK) and
compare against the catalog row, instead of the inline ref. `_FRAME_KEYS` /
`_GLAZING_KEYS` (`:21-52`) unchanged. The drift report keys results by entity id
now (one finding per product, not per slot) — confirm the report shape still
satisfies its consumers (`hooks.ts` `DRIFT_AFFECTING_KINDS`).

## Apertures slice response

The apertures table contract (`tables/apertures.py:19-86`,
`apertures_response`) returns apertures + manufacturer_filters. The builder
frontend (Phase 4) now needs the flat tables to resolve FKs. Extend
`AperturesSliceResponse` to include `project_glazings` + `project_frames` (or
have the slice join names in) — decide here so Phase 4 has its data source.
Simplest: add the two arrays to the slice response.

## Tests

- Pick frame/glazing from catalog → one flat row created, element holds the FK,
  re-picking the same product on another side reuses the row.
- Pick hand-entered → new row (Option A).
- New default aperture → one `ProjectFrame` + one `ProjectGlazing`, four FK
  slots.
- Refresh-from-catalog updates the shared entity (all uses reflect it).
- Duplicate/split/merge/paste copy FK ids (no new entities).
- HBJSON import yields v12 apertures with resolvable FKs.
- Drift: an edited shared entity flags drift once.

## Exit criteria

- Met. Focused aperture command/U-value/HBJSON/drift/refresh/manufacturer tests
  passed, touched-file `ruff check` passed, and full backend `uv run pytest`
  passed (1097 passed, 2 skipped).
