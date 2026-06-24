---
DATE: 2026-06-24
TIME: 17:30 EDT
STATUS: Planned
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 4 — aperture builder frontend reads FK + resolves against flat
  tables; types updated; visual parity; no user-facing change.
RELATED: ./phase-02-rewire-write-path.md, ../README.md (Sequencing)
---

# Phase 4 — Frontend aperture-builder rewire

The only frontend phase here. The pick **write** path barely changes (the
command still sends the full ref — D-3). The **read** path changes: the element
now holds an FK id, so the canvas/sidebar/inspector must resolve it against the
flat `project_glazings` / `project_frames` arrays the slice now returns.

**Sequencing:** land `window-glass-catalog-enums` Phase 5 first or coordinate —
both touch the glazing/frame builder UI.

## Targets

### Types — `frontend/src/features/apertures/types.ts`

- `ApertureElementFrames` (`:51-56`): `top/right/bottom/left: string | null`
  (FK id) instead of `FrameRef | null`.
- `ApertureElement` (`:58-66`): `glazing: GlazingRef | null` →
  `glazing_id: string | null`.
- Add `ProjectGlazing` / `ProjectFrame` types (mirror envelope
  `frontend/src/features/envelope/types.ts` `ProjectMaterial`).
- Extend the apertures slice response type with `project_glazings` +
  `project_frames`.
- `FrameRef`/`GlazingRef` (`:7-39`) stay (still the pick payload).

### Slice query / api — `apertures/api.ts`, `apertures/hooks.ts`, `query-keys.ts`

`fetchAperturesSlice` already returns the slice; it now includes the two flat
arrays — surface them through the query so components can build lookup maps
(`Map<id, ProjectGlazing>` / `Map<id, ProjectFrame>`).

### Resolve-for-display — canvas / sidebar / inspector

Every component that read `element.glazing?.name` / `element.frames.top?.name`
etc. now reads the FK id and looks up the entity in the lookup map. Audit the
apertures components (the inspector/breakdown table, the canvas labels, the
U-value summary). Behavior + visuals unchanged.

### Pickers — `GlazingPicker.tsx` / `FramePicker.tsx`

`currentCatalogId` already derives from `catalog_origin.catalog_record_id`; now
derive it from the **resolved** entity (`map.get(element.glazing_id)?.catalog_origin`).
`onPick` still hands a full ref built by `ref-builders.ts`
(`catalogRowToFrameRef`/`catalogRowToGlazingRef`, `:15-65`) — unchanged.
`AperturesTab.tsx` dispatch (`:361-377`) unchanged.

### Invalidation — `apertures/hooks.ts`

`U_VALUE_AFFECTING_KINDS` / `DRIFT_AFFECTING_KINDS` (`:15-50`) unchanged
(`pickFrame`/`pickGlazing` still the triggers).

## Note on `refsAggregation.ts` / `ProjectRefsView.tsx`

These do **frontend** dedup of inline refs. After this phase the data is already
deduped server-side, so they are redundant. **Leave them working for now** (they
can read the flat tables, or keep aggregating — harmless) and **retire them in
the sibling report-pages feature**, which replaces the modal with the two real
pages. Do not delete here to avoid leaving the builder without its current
"view project refs" affordance mid-stream.

## Tests / verification

- Update the apertures component tests that asserted on inline ref fields to use
  FK + lookup.
- `pnpm run format`; frontend type-check; `make frontend-dev-check`.
- Visual sanity: the aperture builder renders identical names/values from the
  resolved entities. (Full browser smoke is owned by the report-pages feature,
  Phase 3 there, where the new data first becomes user-visible.)

## Exit criteria

- Frontend type-check + lint clean; apertures tests green.
- Builder visually unchanged; no console errors picking/clearing glazing/frame.
