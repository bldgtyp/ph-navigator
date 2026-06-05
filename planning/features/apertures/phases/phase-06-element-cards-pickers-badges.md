---
DATE: 2026-06-05
TIME: 18:45 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Ship the per-element assignment cards below the canvas,
       per-side frame picker filtering by `location` / `use` /
       `operation`, click-on-canvas-region scoped pickers
       (Phase 04 surfaced `onRegionClick`; this phase attaches
       the handler), sourced-from / drift / hand-enter /
       datasheet badges, "You edited this" tag, inline override
       fields, More-fields expander, hand-enter `+` entry point,
       and the card ↔ on-canvas pill bidirectional sync.
RELATED:
  - planning/features/apertures/PRD.md §11, §11.1, §11.2, §11.4,
    §12 (FrameRef / GlazingRef field set), §15 (refresh hooks)
  - planning/features/apertures/PLAN.md (Phase 06 row, R4)
  - frontend/src/features/windows/components/WindowElementCard.tsx
    (V1 baseline card; reference only — the V2 card is a rebuild)
  - frontend/src/features/windows/components/CatalogPickerSlot.tsx
    (V1 catalog picker; informs the V2 Combobox port)
  - phase-01 (delivers `pickFrame` / `pickGlazing` command stubs;
    this phase fills them in)
  - phase-04 (overlay surface fires `onRegionClick` — Phase 06
    attaches the handler)
---

# Phase 6 — Element cards, region-click pickers, filtering, badges

## Implementation note (Claude, 2026-06-05)

Shipped as a single PR per user choice. All P1 acceptance items
landed; deviations are listed in STATUS.md under
"Phase 06 deviations from the doc". Highlights:

- Backend `pickFrame`, `pickGlazing`, `editFieldOverride` handlers
  live in `aperture_commands/handlers/picks.py`.
  ``apply_pick_frame`` / ``apply_pick_glazing`` accept the full
  `FrameRef` / `GlazingRef` on the wire (frontend resolves the
  catalog row into a ref before dispatch) — the handler re-stamps
  `synced_at`, resets `local_overrides`, and writes the slot.
  Hand-entered refs (null `catalog_origin`) round-trip unchanged.
- ``apply_edit_field_override`` patches one field via
  `model_copy` → `model_validate` so per-field validators fire,
  then appends `field_key` to `catalog_origin.local_overrides`
  (deduped). Hand-entered refs take edits without touching
  overrides.
- Catalog list endpoints gained server-side filter query params
  (`location`, `operation`, `use`, `manufacturers[]` on frames;
  `manufacturers[]` on glazings). Composes AND, case-insensitive.
- Frontend filter primitives (`picker-filters.ts`,
  `frame-label-map.ts`) and ref builders (`ref-builders.ts`) sit
  at the feature root, not under `lib/`, to avoid the
  `lib.ts` ↔ `lib/index.ts` collision documented in the Phase 05
  note.
- `FramePicker` / `GlazingPicker` use a `<details>` + `<summary>`
  pattern with a paired `useFrameCatalog` / `useGlazingCatalog`
  hook that runs both the filtered query and an unfiltered query
  so the "Showing N of M · Clear filter" footnote stays correct
  without an extra round-trip.
- `ApertureElementCard` / `ApertureElementCardStack` render below
  the canvas. Region clicks on the overlay surface a
  `focusedTarget` that the active card uses to scroll into view —
  the click does NOT auto-open the picker dropdown (the
  `<details>` element requires an explicit click), but it does
  surface the right card and side label. Interior-view label flip
  goes through `frameRowLabel` on every row.
- "You edited this" pill renders per inline override input from
  `catalog_origin.local_overrides`. The drift badge ships dormant
  (`hasDrift={false}`) — Phase 12 wires the input.
- `Combobox` + Sonner-equivalents from the phase doc are *not*
  shipped; the simpler `<details>` + `<button>` composition keeps
  the surface dependency-free.

## Original Phase 06 plan follows.

## P0. Why this slice

Phase 06 is the **first full assignment cycle**: the user can
walk an element through `Pick a frame…` for every side, `Pick a
glazing…` for the center, and the canvas re-renders with the
picked colors. Pickers are filtered by FrameRef `location` /
`use` / `operation`, so the Top slot only shows Head frames,
Bottom only shows Sill frames, etc. Datasheet PDFs link straight
from the card. Drift, hand-enter, and override tracking land
together so badges and "You edited this" tags are correct from
the start.

This phase is intentionally large because the card and the
picker share so much state (badge logic, filter logic, inline
edit logic). Splitting them runs the risk of subtle inconsistency
between the picker UX and the card UX.

By the end of Phase 06:

- A card stack renders below the canvas. One card per element,
  ordered by canonical `column_span[0]`, then `row_span[0]`.
- Each card surfaces: an editable element name (synced with the
  on-canvas pill), per-element U-Value chip placeholder (Phase 09
  fills in the value), glazing row, four frame rows (top / right
  / bottom / left), operation row (Phase 07 makes it editable —
  Phase 06 ships a read-only display), catalog-origin badges,
  datasheet link, hand-enter badge, "You edited this" tag, inline
  override fields, `More fields…` expander.
- Frame label in interior view: card label text flips so the
  visible right side maps to the row labelled `Right Frame`; the
  document field still carries the canonical left value (the
  `flipColumnForInterior` helper from Phase 03 informs the
  mapping).
- Per-side frame picker is a shadcn `Combobox` filtered by
  `location` (Top→Head, Bottom→Sill, Left/Right→Jamb) and by
  the element's `operation`. `use` filtering derives from the
  element-level operation pattern in v1 — no separate per-aperture
  `use` field. A "Showing N of M frames · Clear filter" footnote
  dismisses the filter when a catalog row is mis-classified.
- Glazing picker is the same Combobox primitive, filtered only
  by the project's manufacturer filter (Phase 11) — Phase 06
  ships the picker; the manufacturer filter wiring is added in
  Phase 11.
- Each picker's dropdown ends with a `+ Hand-enter` action that
  drops a fresh ref with `catalog_origin: null` and opens an
  inline edit row.
- Region click on the canvas (Phase 04 surface) opens the
  matching picker. Top-frame rect → top-side picker. Glazing rect
  → glazing picker.
- Backend `pickFrame` / `pickGlazing` command handlers ship.
  Each stamps `catalog_origin.catalog_schema_version=1`,
  `synced_at=utcnow()`, `local_overrides=[]`. Hand-enter writes
  the same shape with `catalog_origin=null`.
- A second command, `editFieldOverride`, ships to handle inline
  edits on the card's editable fields. Each commit appends the
  edited field key to `catalog_origin.local_overrides`.

Phase 06 does **not** ship: operation editor (Phase 07), merge /
split / copy-paste (Phase 08), U-Value chip values (Phase 09),
HBJSON export (Phase 10), manufacturer filter UI (Phase 11), or
the refresh-from-catalog dialog (Phase 12).

## P1. Acceptance — Phase 6 done when

1. `<ApertureElementCardStack />` renders below the canvas. Order:
   `column_span[0]` ascending, then `row_span[0]` ascending.
2. Each `<ApertureElementCard />` surfaces:
   - **Name row.** Editable element name on the left. On commit
     via Enter / blur, dispatches `setElementName`. Bidirectional
     sync with the on-canvas pill — Phase 04's pill remains the
     single source of write truth; Phase 06's card name input
     dispatches the same command and reads the same document.
   - **U-Value chip placeholder** on the right. Shows
     `U-Value: --` (Phase 09 wires the real value).
   - **Glazing row.** Label `Glazing:`, picker showing
     `glazing.name` (or `Pick a glazing…` if null), badges,
     U-Value column shows `g_value` and copied U-Value, an
     inline editable `name` / `u_value_w_m2k` / `g_value`.
   - **Top / Right / Bottom / Left Frame rows.** Same shape:
     label + picker + badges + columns for `width_mm`,
     `u_value_w_m2k`, `psi_g_w_mk` (the V1 column set, plus a
     `More fields…` expander).
   - **Operation row.** Phase 06 shows the read-only display
     label (`Fixed`, `Swing`, `Swing (Left, Up)`). Phase 07
     replaces with the editor.
   - **More fields expander.** Reveals the rest of the field set
     per PRD §11.2 / §12: `manufacturer`, `brand`, `use`,
     `operation`, `location`, `mull_type`, `psi_install_w_mk`,
     `color`, `datasheet_url`, `link`, `comments`, `source`.
     Each is inline-editable; editing any field dispatches
     `editFieldOverride` with the field key.
3. **Per-side frame picker filtering:**
   - The picker queries
     `GET /catalogs/frame-types?location=<head|jamb|sill>&operation=<...>`
     where `location` is derived from the slot (`top→head`,
     `bottom→sill`, `left|right→jamb`) and `operation` is
     derived from the element's current `operation.type` and
     direction pattern. The backend filters server-side.
   - Manufacturer filter (Phase 11) is layered on top.
   - The picker shows a `Showing N of M frames · Clear filter`
     footnote when filters exclude at least one row. Clearing
     the filter re-queries with no `location` / `operation`
     constraint.
4. **Glazing picker:**
   - Same Combobox primitive; queries
     `GET /catalogs/glazing-types` with no location/use/operation
     constraints; manufacturer filter (Phase 11) is layered on
     top.
5. **Region-click → picker:**
   - Phase 04 surfaced `onRegionClick(element, region)`.
   - Phase 06 attaches the handler: `top`/`right`/`bottom`/`left`
     opens the per-side frame picker; `glazing` opens the
     glazing picker. The picker mounts inline in the matching
     card row (auto-scrolls the card stack so the card is
     visible).
   - In interior view, clicking the visible left rect opens the
     canonical right picker (because the rect represents the
     canonical right side after flip). The picker label still
     reads `Right Frame:` so the user sees consistent labelling.
6. **Sourced-from-catalog badge:** `Library` icon + tooltip
   `From catalog: '<name>' · Synced <timestamp>` when
   `catalog_origin` is non-null.
7. **Drift badge:** `RefreshCw` icon + tooltip `Catalog has
   changed since pick. Click to review.` Phase 12 attaches the
   dialog; Phase 06 ships the badge as a non-functional
   indicator with `aria-disabled="true"` and a Phase-12 placeholder
   tooltip.
8. **Hand-enter badge:** `PencilLine` icon + tooltip
   `Hand-entered. Not linked to the catalog.` when
   `catalog_origin` is null.
9. **Datasheet link:** `FileText` / `ExternalLink` icon, opens
   `datasheet_url` in a new tab. Hidden when `datasheet_url` is
   null. Renders even on locked / Viewer access (read-only
   information).
10. **"You edited this" tag:** small pill on every inline field
    whose key appears in `catalog_origin.local_overrides`.
    Hover tooltip: `You edited this field. Refresh-from-catalog
    defaults to Keep mine.`
11. **Hand-enter entry point:** the picker dropdown ends with
    `+ Hand-enter`. Selecting it dispatches a `pickFrame` or
    `pickGlazing` with `hand_enter: true`; the command writes a
    fresh ref with `catalog_origin: null` and the slot's known
    fields blank; the user fills the inline fields immediately.
12. **Backend handlers** in
    `aperture_commands/handlers/picks.py`:
    - `pickFrame(aperture_type_id, element_id, side,
      source: "catalog" | "hand_enter", catalog_record_id?)`.
      Catalog path: reads the row, bookshelf-copies into the
      target slot with `catalog_schema_version=1`,
      `synced_at=now()`, `local_overrides=[]`. Hand-enter path:
      writes an empty-fields `FrameRef` with `catalog_origin=null`.
    - `pickGlazing(aperture_type_id, element_id,
      source, catalog_record_id?)`. Mirrors.
    - `editFieldOverride(aperture_type_id, element_id,
      target: "frame.<side>" | "glazing",
      field_key, new_value)`. Validates the value against the
      schema field type, writes the value, appends `field_key`
      to `catalog_origin.local_overrides` if non-null.
    - Any change to `frame.<side>` or `glazing` triggers a
      U-Value cache invalidation (Phase 09 wires the
      content-hash; Phase 06 emits the audit field so Phase 09
      can hook it).
13. **Catalog query endpoints:**
    - `GET /catalogs/frame-types` accepts optional
      `location`, `operation`, `use`, `manufacturers[]` query
      params (only `location` and `operation` are used by
      Phase 06; `manufacturers` ships in Phase 11). Server-side
      filtering.
    - `GET /catalogs/glazing-types` mirrors (with
      `manufacturers` only, used by Phase 11).
14. **Read-only behavior on locked / Viewer:**
    - Pickers disabled (chip renders as static label + badges).
    - Inline override fields disabled.
    - `More fields…` expander still expands (information is
      readable).
    - Datasheet link remains clickable.
    - Hand-enter `+` hidden.
15. `make ci` is green.

## P2. Files

### New (frontend)

- `frontend/src/features/apertures/components/ApertureElementCardStack.tsx`
- `frontend/src/features/apertures/components/ApertureElementCard.tsx`
- `frontend/src/features/apertures/components/FrameRow.tsx`
- `frontend/src/features/apertures/components/GlazingRow.tsx`
- `frontend/src/features/apertures/components/FramePicker.tsx`
  (Combobox + filter rules + footnote)
- `frontend/src/features/apertures/components/GlazingPicker.tsx`
- `frontend/src/features/apertures/components/InlineOverrideInput.tsx`
- `frontend/src/features/apertures/components/MoreFieldsExpander.tsx`
- `frontend/src/features/apertures/components/CatalogBadges.tsx`
  (sourced-from, drift placeholder, hand-enter, datasheet,
  "You edited this")
- `frontend/src/features/apertures/components/FrameLabelMap.tsx`
  (interior-view label flip helper)
- `frontend/src/features/apertures/lib/pickerFilters.ts`
  (location-from-slot, operation-from-element)
- `frontend/src/features/apertures/lib/frameLabelMap.ts`
- `frontend/src/features/apertures/hooks/useFrameCatalog.ts`
- `frontend/src/features/apertures/hooks/useGlazingCatalog.ts`
- `frontend/src/features/apertures/__tests__/pickerFilters.test.ts`
- `frontend/src/features/apertures/__tests__/frameLabelMap.test.ts`
- `frontend/src/features/apertures/__tests__/FramePicker.test.tsx`
- `frontend/src/features/apertures/__tests__/ApertureElementCard.test.tsx`
- `frontend/src/features/apertures/__tests__/CatalogBadges.test.tsx`

### New (backend)

- `backend/features/project_document/aperture_commands/handlers/picks.py`
- `backend/features/project_document/aperture_commands/handlers/overrides.py`
- `backend/features/catalog/frame_types/routes.py`
  (add `location`, `operation`, `use`, `manufacturers` query
  params if not already present)
- `backend/features/catalog/glazing_types/routes.py`
  (add `manufacturers` query param if not already present)
- `backend/features/project_document/__tests__/test_aperture_pick_commands.py`
- `backend/features/project_document/__tests__/test_aperture_override_command.py`
- `backend/features/catalog/__tests__/test_frame_types_filter.py`

### Modified

- `frontend/src/features/apertures/components/ApertureCanvasContainer.tsx`
  - Mount `<ApertureElementCardStack />` below the dimension
    strip.
  - Wire `onRegionClick` from Phase 04 overlay to open the
    matching picker in the card stack.
- `frontend/src/features/apertures/components/ApertureCanvasOverlay.tsx`
  - Attach the `onRegionClick` handler (Phase 04 left it
    unattached).
- `backend/features/project_document/aperture_commands/models.py`
  - Fill in `PickFrame`, `PickGlazing`, `EditFieldOverride`
    command shapes.
- `frontend/src/features/apertures/apertures.css`
  - Card layout, picker styling, badge styles, "You edited this"
    pill, expander animation.

### Deleted

None.

## P3. Component / model shapes

```ts
// frontend/src/features/apertures/lib/pickerFilters.ts — sketch

export type FrameSide = "top" | "right" | "bottom" | "left";

export function locationForSide(side: FrameSide): "head" | "sill" | "jamb" {
  if (side === "top") return "head";
  if (side === "bottom") return "sill";
  return "jamb";
}

export function operationForElement(operation: ApertureOperation | null): {
  type: "Fixed" | "Swing" | "Slide";
  directions: ("Left" | "Right" | "Up" | "Down")[];
} {
  if (operation === null) return { type: "Fixed", directions: [] };
  return {
    type: operation.type === "swing" ? "Swing" : "Slide",
    directions: operation.directions.map(capitalize),
  };
}
```

```ts
// frontend/src/features/apertures/lib/frameLabelMap.ts — sketch

export function visualSideToCanonical(
  visualSide: FrameSide,
  viewDirection: "exterior" | "interior",
): FrameSide {
  if (viewDirection === "exterior") return visualSide;
  if (visualSide === "left") return "right";
  if (visualSide === "right") return "left";
  return visualSide;
}

export function canonicalSideToVisual(
  canonicalSide: FrameSide,
  viewDirection: "exterior" | "interior",
): FrameSide {
  // symmetric
  return visualSideToCanonical(canonicalSide, viewDirection);
}
```

```tsx
// FramePicker.tsx — sketch

export function FramePicker(props: FramePickerProps) {
  const { element, side, viewDirection, onPick } = props;
  const location = locationForSide(side);  // always canonical
  const operationFilter = operationForElement(element.operation);
  const { rows, total } = useFrameCatalog({
    location,
    operation: operationFilter,
    manufacturers: useManufacturerFilter("frame_types"),  // Phase 11
  });
  const [filterCleared, setFilterCleared] = useState(false);
  const visible = filterCleared
    ? rows.allFrames
    : rows.filtered;

  return (
    <Combobox>
      <ComboboxTrigger>
        {element.frames[side]?.name ?? "Pick a frame…"}
      </ComboboxTrigger>
      <ComboboxList>
        {visible.map((row) => (
          <ComboboxOption key={row.id} onSelect={() => onPick("catalog", row.id)}>
            <strong>{row.name}</strong>
            <SecondaryLine row={row} />
          </ComboboxOption>
        ))}
        <Separator />
        <ComboboxOption onSelect={() => onPick("hand_enter")}>
          + Hand-enter
        </ComboboxOption>
      </ComboboxList>
      {!filterCleared && rows.filtered.length < rows.allFrames.length && (
        <ComboboxFooter>
          Showing {rows.filtered.length} of {rows.allFrames.length} frames
          · <button onClick={() => setFilterCleared(true)}>Clear filter</button>
        </ComboboxFooter>
      )}
    </Combobox>
  );
}
```

```python
# backend/features/project_document/aperture_commands/handlers/picks.py
# — sketch

def apply_pick_frame(
    body: ProjectDocumentV1,
    command: PickFrame,
    actor: str,
    catalog: CatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    apertures = list(body.tables.apertures)
    apt_idx, entry = _locate_aperture(apertures, command.aperture_type_id)
    el_idx, element = _locate_element(entry.elements, command.element_id)

    if command.source == "catalog":
        if command.catalog_record_id is None:
            raise api_error(422, "aperture_pick_missing_catalog_id", ...)
        row = catalog.get_frame_type(command.catalog_record_id)
        if row is None:
            raise api_error(422, "aperture_pick_unknown_catalog_row", ...)
        frame_ref = FrameRef(
            name=row.name,
            manufacturer=row.manufacturer,
            brand=row.brand,
            use=row.use,
            operation=row.operation,
            location=row.location,
            mull_type=row.mull_type,
            width_mm=row.width_mm,
            u_value_w_m2k=row.u_value_w_m2k,
            psi_g_w_mk=row.psi_g_w_mk,
            psi_install_w_mk=row.psi_install_w_mk,
            color=row.color,
            source=row.source,
            comments=row.comments,
            catalog_origin=CatalogOrigin(
                catalog_table="frame_types",
                catalog_record_id=row.id,
                catalog_version_id=None,  # current row-version layer is flat
                catalog_schema_version=1,
                synced_at=utcnow(),
                local_overrides=[],
            ),
        )
    else:
        frame_ref = FrameRef(name="Unnamed", catalog_origin=None)

    next_frames = element.frames.model_copy(update={command.side: frame_ref})
    next_element = element.model_copy(update={"frames": next_frames})
    next_elements = list(entry.elements)
    next_elements[el_idx] = next_element
    next_entry = entry.model_copy(update={"elements": next_elements})
    apertures[apt_idx] = next_entry
    next_body = body.model_copy(
        update={"tables": body.tables.model_copy(update={"apertures": apertures})}
    )
    audit = {"command": "pickFrame", "aperture_type_id": command.aperture_type_id,
             "element_id": command.element_id, "side": command.side,
             "source": command.source,
             "catalog_record_id": command.catalog_record_id,
             "affects_u_value": True}
    return next_body, audit
```

## P4. Sequence

1. **Commit 1 — Backend pick handlers + override handler.** Fill
   in `pickFrame`, `pickGlazing`, `editFieldOverride`.
   `local_overrides` append logic + validation per field key.
   Tests cover catalog path, hand-enter path, unknown catalog
   id → 422.
2. **Commit 2 — Catalog filter endpoints.** Extend `frame_types`
   / `glazing_types` GET handlers to accept query params.
3. **Commit 3 — Picker filter primitives.** Add
   `pickerFilters.ts`, `frameLabelMap.ts`, the catalog hooks,
   and the Combobox primitive composition. No card yet.
4. **Commit 4 — Frame / Glazing rows.** Compose `FrameRow` and
   `GlazingRow` with picker, badges, inline overrides, More
   fields expander.
5. **Commit 5 — Element card + card stack.** Compose the card
   with name + chip placeholder + glazing row + 4 frame rows +
   operation row (read-only placeholder).
6. **Commit 6 — Region click handler.** Wire the
   `onRegionClick` handler from the Phase 04 overlay to open the
   matching picker. Auto-scroll the card into view.
7. **Commit 7 — Interior-view label flip + pill ↔ card sync.**
   Verify both surfaces stay coherent. `make ci` green.

## P5. Tests

### Unit — filter primitives

- `locationForSide("top") === "head"` etc.
- `operationForElement(null) === { type: "Fixed", directions: [] }`.
- `operationForElement({ type: "swing", directions: ["left", "up"] })
  === { type: "Swing", directions: ["Left", "Up"] }`.

### Unit — frame label map

- Exterior: visual = canonical.
- Interior: visual left ↔ canonical right; top / bottom unchanged.

### Component — `FramePicker`

- With manufacturer-filter mock returning all rows, picker shows
  all rows matching the slot's `location`.
- Footnote shows `Showing N of M frames · Clear filter` when the
  filter excludes rows.
- Clearing the filter shows all rows.
- `+ Hand-enter` triggers `onPick("hand_enter")`.
- On locked / Viewer, picker trigger is a static label.

### Component — `ApertureElementCard`

- Renders name + 5 frame/glazing rows + operation row.
- Editable name dispatches `setElementName` on Enter / blur.
- Inline override edit dispatches `editFieldOverride` with the
  field key.
- "You edited this" tag appears for keys in `local_overrides`.
- Datasheet link renders when `datasheet_url` is set; opens in
  new tab.
- Interior view: card row labels read in visual order; the
  document field still updates the canonical side.

### Backend — pick + override commands

- `pickFrame` catalog path stamps `catalog_origin` with
  `catalog_schema_version=1`, `synced_at` ≈ now, no
  `local_overrides`.
- `pickFrame` hand-enter path leaves `catalog_origin=null`.
- `pickGlazing` mirrors.
- `editFieldOverride` on a catalog-sourced ref appends the
  field key to `local_overrides`; on a hand-entered ref (null
  origin), the override commit succeeds without touching
  `local_overrides`.
- Unknown catalog id → 422.
- Validation: editing `width_mm` to `-5` → 422.

### Backend — catalog filter endpoints

- `GET /catalogs/frame-types?location=head` filters server-side.
- `operation=Tilt-Turn` filters server-side.
- Both filters combine.
- Unknown filter values → 422.

### Browser

- Open an aperture; click the top frame rect on the canvas →
  the top-frame picker opens in the card.
- Pick a frame; verify the canvas top frame fills with the
  picked color; verify the card shows the picked name + badge.
- Click the same picker; the dropdown only shows Head frames
  by default; clear the filter; all frames show.
- Pick a hand-enter row; verify the row collapses into an
  editable inline form; type a name + `width_mm`; verify it
  persists.
- Edit `u_value_w_m2k` inline; verify "You edited this" tag
  shows after commit.
- Flip view direction; verify the card's `Right Frame:` label
  shows the formerly-left frame data.
- Click on the on-canvas pill, rename the element; verify the
  card's name field updates on the next render.

## P6. Out of scope (lands in later phases)

- Operation editor (Phase 06 ships read-only display) — Phase 07.
- Merge / split / copy-paste — Phase 08.
- U-Value chip values — Phase 09.
- HBJSON export — Phase 10.
- Manufacturer filter UI + Apply-to-picker integration — Phase 11.
- Refresh-from-catalog dialog wired to drift badge — Phase 12.

## P7. Risks

- **R-06-1. Card stack grows large for high element counts.**
  Each card is ~80 LOC of nested rows; 30 elements × that is a
  lot of DOM. Mitigation: cards render in document order without
  virtualization in v1; if performance bites, add a virtualized
  list in a follow-up (cards are cheap to virtualize because
  they have stable heights once the More fields expander is
  closed).
- **R-06-2. `operation`-based picker filtering depends on
  catalog rows being correctly tagged.** Mitigation: the
  dismissible "Showing N of M frames" footnote always shows
  when the filter excludes rows; the user can opt out. Drift
  detection (Phase 12) will report rows that lack expected
  fields.
- **R-06-3. Interior-view label semantics are confusing.**
  Mitigation: a single helper (`frameLabelMap.ts`) owns the
  mapping; both the card and the picker (when opened from a
  region click in interior view) use the same helper. Tests
  cover both directions.
- **R-06-4. `editFieldOverride` interacts with refresh.**
  Mitigation: refresh dialog (Phase 12) reads
  `local_overrides` for the "Keep mine" default; Phase 06's
  list-append logic must be deterministic (no duplicates;
  ordering preserved by first edit). Test
  `test_aperture_override_command.py` asserts idempotency.
- **R-06-5. Region click + selection click race.** A click on
  a region rect both selects the element (Phase 04 wiring) and
  opens the picker (Phase 06 wiring). Mitigation: Phase 06's
  handler `e.stopPropagation()` after dispatching the picker
  open; the element-level click handler stays untouched for
  background clicks. Test verifies a region click does not
  alter selection state.
