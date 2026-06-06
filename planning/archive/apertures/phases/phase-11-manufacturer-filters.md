---
DATE: 2026-06-05
TIME: 17:00 EDT
STATUS: Done — shipped Phase 11 with the deviations noted in STATUS.md
AUTHOR: Codex
SCOPE: Add the project-document `manufacturer_filters` section,
       the configure-filters modal, the picker-integration layer
       so Phase 06 pickers actually honor the filters, the
       in-use enforcement rule, the "Filter narrowed your picker"
       hint, and the catalog-roster live source.
RELATED:
  - planning/features/apertures/PRD.md §12 (manufacturer filter
    storage), §15 (picker integration), §20 (phase group 9)
  - planning/features/apertures/PLAN.md (Phase 11 row)
  - context/user-stories/10-windows.md US-WIN-8
  - phase-06 (delivered the picker primitive with a
    `useManufacturerFilter` hook stub; this phase wires it)
---

# Phase 11 — Manufacturer filters

## P0. Why this slice

Phase 11 makes the per-side frame picker and the glazing picker
usable on real BLDGTYP projects, where the catalog often carries
80+ frame products and the project only buys from 2 or 3
manufacturers. The user opens `⋯ → Configure manufacturer filters`,
unchecks every manufacturer they're not specifying, and the
pickers narrow accordingly. The catalog row pool is the live
source; in-use manufacturers are always-on so a stale filter
cannot strand the user's existing picks.

By the end of Phase 11:

- The project document carries a
  `body.tables.manufacturer_filters` section with two enabled-list
  arrays (`frame_manufacturers_enabled`,
  `glazing_manufacturers_enabled`). Default `null` = "all enabled".
- The Apertures header overflow menu surfaces
  `Configure manufacturer filters`.
- The modal exposes two side-by-side checkbox columns (Frame
  Manufacturers, Glazing Manufacturers) with count badges per
  manufacturer, Select-all / Clear-all bulk actions, and an
  in-use lock (always-checked, disabled with tooltip) for
  manufacturers currently referenced by any element.
- Phase 06's `useManufacturerFilter` hook now returns the active
  enabled-list and the pickers narrow on the client by the same
  rule the server already applies (manufacturer ∈ enabled).
- A `Showing N of M manufacturers · Adjust filter` hint renders
  at the bottom of each picker dropdown when the filter is
  non-default.
- A new `setManufacturerFilters` aperture command commits the
  filter to the draft buffer through the same ApertureCommand
  seam.

Phase 11 does **not** ship: refresh-from-catalog dialog
(Phase 12), project-scoped refs view (Phase 12), or MCP writes
(Phase 13). The filter does affect what the Phase 12 refresh
dialog shows in its picker pane (Phase 12 reads the same hook).

## P1. Acceptance — Phase 11 done when

1. `ProjectDocumentTables` gains
   `manufacturer_filters: ManufacturerFilters | None = None`:
   ```python
   class ManufacturerFilters(BaseModel):
       model_config = ConfigDict(extra="forbid")
       frame_manufacturers_enabled: list[str] | None = None
       glazing_manufacturers_enabled: list[str] | None = None
   ```
   `null` (absence) means "all manufacturers enabled". Empty list
   `[]` means "no manufacturers enabled" (the explicit-disable
   state).
2. A new `setManufacturerFilters` aperture command:
   - Payload: `{ frame_manufacturers_enabled: list[str] | null,
     glazing_manufacturers_enabled: list[str] | null }`.
   - Handler validates that **every in-use manufacturer is
     present in the new enabled list** (or that the list is
     `null` = all-on). Otherwise raises 422
     `manufacturer_filter_strands_picks` naming the offending
     manufacturers.
   - Audit `affects_u_value=false`.
3. **`<ManufacturerFiltersModal />`** (shadcn `Dialog`):
   - Header title + count summary: `12 of 18 frame manufacturers
     enabled · 6 of 9 glazing manufacturers enabled`.
   - Two side-by-side checkbox columns: Frame Manufacturers,
     Glazing Manufacturers.
   - Each row: checkbox + manufacturer name + count badge
     (`Schüco · 23 products`).
   - In-use manufacturers (referenced by at least one element's
     picked frame / glazing): always-checked, disabled, tooltip
     `In use on N elements — can't be disabled while
     referenced.`
   - Top of each column: `Select all` / `Clear all` bulk-action
     links. `Clear all` skips in-use rows.
   - Footer: Cancel / Save. Save disabled when no changes.
4. **Catalog-roster source**:
   - The list of available manufacturers in each column is built
     from the distinct `manufacturer` values across the
     corresponding catalog table (frame_types and glazing_types).
   - Manufacturer-roster query:
     `GET /catalogs/frame-types/manufacturers` returning
     `[ { manufacturer: string; product_count: number } ]`.
     Mirrors for glazing_types.
   - Refreshes when the catalog changes (live source — not
     snapshot in the document).
5. **Picker integration** — Phase 06's
   `useManufacturerFilter("frame_types" | "glazing_types")` hook
   now reads from the document and:
   - Returns `null` when the filters are absent / `null` (all
     manufacturers in the catalog roster).
   - Otherwise returns the enabled list.
   - The frame picker / glazing picker filter their candidate
     rows client-side after the server's location / use /
     operation filtering (manufacturer ∈ enabled).
6. **"Filter narrowed your picker" hint**:
   - When the picker shows fewer manufacturer rows than the
     full catalog roster, the bottom of the picker renders:
     `Showing 12 of 18 manufacturers · [Adjust filter]`. The
     link opens the modal.
7. **In-use enforcement on Save**:
   - Server side: the command validates and rejects (§P1.2).
   - Client side: `Clear all` toasts
     `3 manufacturers stayed enabled because they're in use.`
     and the in-use rows stay checked.
8. **Empty-catalog edge case**: if the catalog roster is empty
   for either kind, the corresponding column shows
   `No manufacturers in the catalog yet.` No save-on-empty
   issue.
9. **Locked / Viewer rendering**:
   - Locked: modal opens read-only; Save hidden; checkboxes
     disabled.
   - Viewer: overflow-menu action hidden.
10. `make ci` is green.

## P2. Files

### New (backend)

- `backend/features/aperture_commands/handlers/manufacturer_filters.py`
- `backend/features/catalog/frame_types/manufacturers_route.py`
- `backend/features/catalog/glazing_types/manufacturers_route.py`
- `backend/features/project_document/__tests__/test_manufacturer_filter_command.py`
- `backend/features/catalog/__tests__/test_manufacturer_rosters.py`

### New (frontend)

- `frontend/src/features/apertures/components/ManufacturerFiltersModal.tsx`
- `frontend/src/features/apertures/components/ManufacturerColumn.tsx`
- `frontend/src/features/apertures/components/PickerFilterHint.tsx`
- `frontend/src/features/apertures/hooks/useManufacturerRoster.ts`
- `frontend/src/features/apertures/lib/inUseManufacturers.ts`
- `frontend/src/features/apertures/__tests__/inUseManufacturers.test.ts`
- `frontend/src/features/apertures/__tests__/ManufacturerFiltersModal.test.tsx`
- `frontend/src/features/apertures/__tests__/PickerFilterHint.test.tsx`

### Modified

- `backend/features/project_document/document.py`
  - Add `ManufacturerFilters` and the `manufacturer_filters`
    field on `ProjectDocumentTables`.
- `backend/features/project_document/aperture_commands/models.py`
  - Fill in `SetManufacturerFilters` command.
- `frontend/src/features/apertures/components/AperturesHeader.tsx`
  - Add the overflow-menu action.
- `frontend/src/features/apertures/components/FramePicker.tsx`
  - Wire the now-real `useManufacturerFilter` hook (Phase 06
    stubbed it).
- `frontend/src/features/apertures/components/GlazingPicker.tsx`
  - Wire similarly.
- `frontend/src/features/apertures/hooks/useFrameCatalog.ts`
  - Apply manufacturer filter client-side after server filter.
- Tests for Phase 06's pickers — extend with manufacturer-
  filter cases.

### Deleted

None.

## P3. Component / model shapes

```python
# backend/features/aperture_commands/handlers/manufacturer_filters.py
# — sketch

def apply_set_manufacturer_filters(
    body: ProjectDocumentV1,
    command: SetManufacturerFilters,
    actor: str,
    catalog: CatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    in_use_frames = collect_in_use_manufacturers(body, kind="frame_types")
    in_use_glazings = collect_in_use_manufacturers(body, kind="glazing_types")

    if command.frame_manufacturers_enabled is not None:
        missing = in_use_frames - set(command.frame_manufacturers_enabled)
        if missing:
            raise api_error(
                422,
                "manufacturer_filter_strands_frame_picks",
                "Cannot disable in-use frame manufacturer(s).",
                {"in_use": sorted(missing)},
            )
    if command.glazing_manufacturers_enabled is not None:
        missing = in_use_glazings - set(command.glazing_manufacturers_enabled)
        if missing:
            raise api_error(422, "manufacturer_filter_strands_glazing_picks", ...)

    filters = ManufacturerFilters(
        frame_manufacturers_enabled=command.frame_manufacturers_enabled,
        glazing_manufacturers_enabled=command.glazing_manufacturers_enabled,
    )
    next_tables = body.tables.model_copy(update={"manufacturer_filters": filters})
    next_body = body.model_copy(update={"tables": next_tables})
    audit = {"command": "setManufacturerFilters", "affects_u_value": False}
    return next_body, audit
```

```ts
// frontend/src/features/apertures/lib/inUseManufacturers.ts — sketch

export function inUseManufacturers(
  doc: ProjectDocumentV1,
  kind: "frame_types" | "glazing_types",
): string[] {
  const set = new Set<string>();
  for (const apt of doc.body.tables.apertures) {
    for (const el of apt.elements) {
      if (kind === "frame_types") {
        (["top", "right", "bottom", "left"] as const).forEach((side) => {
          const manu = el.frames[side]?.manufacturer;
          if (manu) set.add(manu);
        });
      } else {
        const manu = el.glazing?.manufacturer;
        if (manu) set.add(manu);
      }
    }
  }
  return [...set].sort();
}
```

## P4. Sequence

1. **Commit 1 — Document section + backend command + tests.**
   Add `ManufacturerFilters`, the command, the in-use validation.
2. **Commit 2 — Catalog roster endpoints.**
3. **Commit 3 — Modal + ManufacturerColumn.** Two-column shell
   with checkbox lists and bulk-action links.
4. **Commit 4 — Picker integration.** Wire
   `useManufacturerFilter` from real document; both pickers
   now narrow.
5. **Commit 5 — Hint + tests.** `PickerFilterHint`; toasts on
   `Clear all` when in-use rows stay enabled.
6. **Commit 6 — Locked / Viewer states + `make ci` green.**

## P5. Tests

### Unit — backend

- `manufacturer_filter_strands_frame_picks` when a referenced
  manufacturer is missing from the enabled list.
- `null` enabled list passes (all-on).
- Empty `[]` enabled list with no in-use frames passes (the
  explicit-disable state).

### Unit — frontend

- `inUseManufacturers(doc, "frame_types")` returns all distinct
  manufacturers across element frames.
- Returns sorted, deduplicated.

### Component

- Modal renders both columns with count badges.
- `Select all` checks every row in the column.
- `Clear all` skips in-use rows and toasts when any stay
  enabled.
- Save disabled when no changes; enabled after toggle.
- Save dispatches `setManufacturerFilters`.

### Picker integration

- With a filter that excludes Schüco, the frame picker no
  longer lists Schüco rows.
- `PickerFilterHint` shows when fewer manufacturers are visible
  than the roster.
- Clicking the hint opens the modal.

### Browser

- Open the modal; uncheck a non-in-use manufacturer; Save;
  open a frame picker; verify the manufacturer is missing.
- Try to uncheck an in-use manufacturer; verify the checkbox
  is disabled with the tooltip.
- `Clear all`; verify in-use stays checked and the toast
  fires.

## P6. Out of scope (lands in later phases)

- Refresh-from-catalog dialog — Phase 12.
- Project-scoped refs view — Phase 12.
- MCP semantic-write tools — Phase 13.

## P7. Risks

- **R-11-1. Roster query frequency.** The two roster endpoints
  are queried every time a picker opens. Mitigation: TanStack
  Query caches the roster for the active catalog version with
  `staleTime: 60_000`; rosters change rarely.
- **R-11-2. `null` vs empty `[]` ambiguity.** `null` = all-on;
  `[]` = all-off. Mitigation: explicit comments in the model
  and a `useEffect` migration if any existing dev document
  stores `[]` accidentally.
- **R-11-3. In-use detection lags after a pick.** Mitigation:
  the modal recomputes in-use from the *draft* document, not
  the saved version. Picks made earlier in the same session
  are reflected immediately.
- **R-11-4. Save fails on race (someone else picked a frame
  from a now-disabled manufacturer in another tab).**
  Mitigation: server-side check fires on every write; the
  user gets the structured error and re-opens the modal with
  the (now larger) in-use set.
