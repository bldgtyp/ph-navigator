---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Draft
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Behavior contract for three 3D viewer display changes.
RELATED: ./README.md; ./STATUS.md
---

# PRD — Viewer display modes

## Item 13 — Spaces lens material (bug) — DONE

**Was:** the Spaces lens rendered space volumes with a semi-transparent green
material that read as muddy/chaotic (overlapping translucent boxes).

**Shipped (option (a), Ed-confirmed on a render):** Spaces render **fully opaque
with the *exact* Building shaded material** — same near-white `#ececec` fill,
same `MeshStandardMaterial` (roughness 0.78, metalness 0), same AO/lighting. The
Spaces lens now matches the Building lens material exactly; only the geometry
differs (interior room volumes vs. envelope surfaces). Interiors are occluded by
design — the **section/clipping plane** is the way to cut in.

**Implementation (not as the PRD assumed):** the material is *not* in `lenses.ts`.
The whole opaque-vs-transparent split is driven by one number,
`baseOpacity("spaceGroup")` in `frontend/src/features/model_viewer/lib/colors.ts`
(any type with opacity < 1 routes into the blending BatchedMesh). The fix was
`0.32 → 1` for opacity plus `#7aa58d → #ececec` for the base color — both done by
merging `spaceGroup` into `faceMesh`'s existing case branches. To revert, split
those case labels back out.

## Item 14 — Airflow color mode on Floor Areas (feature) — DONE

The Spaces "Airflow" color mode (supply / extract / none) now also works on the
**Floor Areas** lens. Floor segments already carry the parent space's airflow
(`loaders/building.ts` assigns `space.properties.ph` to both spaces and floor
segments), so this was a **2-line change**: (1) add
`ventilation-airflow` to the `floor-areas` entry in
`lib/themeState.ts` (`MODEL_VIEWER_THEMES_BY_LENS`); (2) widen the
`case "ventilation-airflow"` guard in `lib/themes.ts` `colorForThemedObject` to
also accept `spaceFloorSegmentMeshFace`. The theme menu, legend, batch recolor,
and legend-filter all flow from those two edits (they delegate to the same config
+ color switch). Verified on a render: Floor Areas shows the Ventilation Airflow
mode + the same Supply/Extract/None legend as Spaces.

## Item 15 — Color by Ventilator (ERV) mode (feature, research-gated)

Add a **new color mode** that colors each space by the **ventilation unit (ERV)
assigned to it**, alongside the existing Airflow mode.

**Research gate (Phase 3a) — RESULT: DROPPED (duct-length precedent).** The
space→ERV assignment exists in HBJSON but is **room-level, not per-space**: a
Space has no vent reference; the ERV lives at `room.properties.ph_hvac.
ventilation_system.ventilation_unit`, and every space in a room shares it (so
each space still deterministically resolves to exactly one unit). PHN
**drops** it at extraction: `backend/features/model_viewer/extraction.py`
`_spaces_from_model` iterates room-by-room (the vent system is in scope) but
copies only airflow magnitudes onto the space DTO; `_ventilation_systems_from_model`
dedupes systems into a flat dict keyed by `display_name`, discarding which
rooms/spaces each serves. So `SpaceSchema` carries no unit id, the two lists are
disconnected, and the viewer's `SpacePhProperties` (`_v_sup`/`_v_eta`/`_v_tran`)
has flow only — no unit identity. MCP tools expose the same disconnected payload.

**→ Item 15 is therefore a backend-first task, not a pure "register a color
mode."** Concrete minimal fix (single-source, no honeybee_ph change needed):
1. `backend/features/model_viewer/schemas/honeybee_ph.py` — add
   `ventilation_unit_id: str | None` (and optionally `_name`) to `SpaceSchema`.
2. `backend/features/model_viewer/extraction.py` `_spaces_from_model` — inside
   the existing room loop, populate it from
   `room.properties.ph_hvac.ventilation_system.ventilation_unit.identifier`
   (guard `None`). Same object `_ventilation_systems_from_model` already reads.
3. Frontend — thread the id through `types.ts` `SpacePhProperties`/`SpaceGroupMeta`
   → `loaders/building.ts` → a new `"ventilation-unit"` color mode + per-unit
   categorical legend in `themes.ts`/`themeState.ts` (Airflow-mode pattern).

## Reuse story

13 = material config change only. 14 and 15 both extend the per-lens color-mode
machinery: a lens declares which color modes it supports; `store.ts` holds the
active mode; `LegendCard` renders the legend for the active mode. Adding a mode
should be "register a mode + its color function + its legend", not a new render
path (build on `LensBatch`/`BatchedLens`, per the batched-substrate constraint).

## Open questions

1. ~~Item 13: opaque vs. keep-some-transparency~~ — **RESOLVED:** fully opaque,
   exact Building material (white), Ed-confirmed on a render.
2. ~~Item 15: is the space→ERV mapping in the PHN schema today?~~ — **RESOLVED
   (Phase 3a): DROPPED.** Room-level in HBJSON, discarded at PHN extraction;
   needs the backend carry-through in the Item 15 section above.
3. Item 15: color assignment when many ERV units exist — categorical palette +
   legend; how many units realistically, and do we need stable colors across
   sessions?

## Acceptance

- ✅ Spaces lens reads clean and solid — matches the Building material exactly
  (opaque white), interiors occluded (section plane to cut in).
- ✅ Floor Areas lens offers the Airflow color mode with the same legend as Spaces.
- (Item 15, backend-first) a "color by Ventilator" mode colors spaces by ERV with
  a per-unit legend — needs the extraction carry-through first (Phase 3a: DROPPED).
