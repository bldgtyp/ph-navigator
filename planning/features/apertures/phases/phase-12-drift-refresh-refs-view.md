---
DATE: 2026-06-05
TIME: 17:10 EDT
STATUS: Active — not yet started
AUTHOR: Codex
SCOPE: Wire the per-entry refresh-from-catalog dialog to the
       Phase 06 drift badge, extend drift detection to cover
       field-delta on the current catalog version (in-place edit
       case per data-model §7.3 / TB-09.a), ship the Apertures
       Builder-level drift summary banner, the project-wide
       drift report link, and the project-scoped read-only view
       of all bookshelf-copied frame / glazing refs surfaced as
       `⋯ → View picked frames & glazings`.
RELATED:
  - planning/features/apertures/PRD.md §6.1 (project refs view),
    §11.2 (badges), §15 (drift detection logic), §21 decision 15
  - planning/features/apertures/PLAN.md (Phase 12 row, R8)
  - frontend/src/features/windows/refresh/ (V1-era refresh
    plumbing — Phase 02 migrated these into the apertures
    folder; this phase upgrades them)
  - phase-06 (delivered the drift badge as a non-functional
    indicator with a Phase-12 placeholder tooltip)
---

# Phase 12 — Catalog provenance polish

## P0. Why this slice

Phase 12 closes the catalog-provenance loop. The drift badge from
Phase 06 becomes clickable; the side-by-side diff dialog shows
catalog-current vs bookshelf-copied vs user-edited; the user
chooses per row, hits Save, and `catalog_origin.synced_at` /
`catalog_version_id` advance. Field-delta detection catches
in-place catalog edits that don't bump `current_version_id`
(TB-09.a revision per `data-model.md` §7.3). A Builder-level
banner aggregates drift across the active aperture type's
elements. A project-wide report aggregates across every aperture.
A new project-scoped view lists every distinct bookshelf-copied
ref so the user can audit picks without walking the canvas.

By the end of Phase 12:

- Drift detection is unified in
  `backend/features/aperture_drift/detector.py`. It returns a
  structured drift report covering both the version-id-mismatch
  case and the field-delta case.
- The Phase 06 drift badge is wired to open
  `<RefreshDialog />` showing the per-entry diff.
- `<BuilderDriftBanner />` renders above the canvas when any
  element of the active aperture is drifted, with a
  `Review all` link that opens
  `<BuilderDriftReviewAllModal />`.
- A project-wide drift report endpoint
  (`GET /projects/{id}/versions/{vid}/apertures/drift-report`)
  feeds a project header `⋯ → Catalog drift report` action;
  the report renders an aperture-grouped list with per-entry
  jump-to-card links.
- A new `<ProjectRefsView />` (modal) lists every distinct
  bookshelf-copied frame / glazing ref (deduped by
  `catalog_origin.catalog_record_id`; hand-entered refs listed
  separately) with manufacturer, brand, use, operation, location,
  width/U-Value/g-value, datasheet link, drift status, and the
  count of elements that use each ref.
- The PRD §6.1 supersedence is complete: the V1 sub-tabs are
  fully replaced by the refs view.

Phase 12 does **not** ship: MCP semantic tools (Phase 13) or the
catalog manager (separate feature).

## P1. Acceptance — Phase 12 done when

1. `backend/features/aperture_drift/` ships:
   - `detector.py` —
     `detect_aperture_drift(body: ProjectDocumentV1,
     catalog: CatalogReader) -> ApertureDriftReport`. Returns
     per-entry drift with the structured detail described in
     PRD §15.
   - `comparator.py` —
     `compare_ref_to_catalog(ref: FrameRef | GlazingRef,
     row: CatalogFrameType | CatalogGlazingType) ->
     RefFieldDeltas`. Returns the list of differing field keys.
   - `models.py` — `ApertureDriftReport`, `ApertureDriftEntry`
     (per-element-side / per-element-glazing),
     `RefFieldDeltas`.
   - `routes.py` —
     `GET /projects/{id}/versions/{vid}/apertures/drift-report`.
   - `__tests__/` — version-id mismatch, field-delta on current
     version, `local_overrides` interaction, hand-entered refs
     skipped.
2. **Drift rule (matches PRD §15):**
   - Drifted = `catalog_origin.catalog_version_id !=
     row.current_version_id` OR `compare_ref_to_catalog(ref,
     row).deltas` non-empty.
   - Fields in `catalog_origin.local_overrides` are reported in
     deltas (so the user sees them) but do not on their own
     make an entry "not drifted".
   - Hand-entered refs (`catalog_origin == null`) are not
     drifted by definition.
3. **`<RefreshDialog />`** in
   `frontend/src/features/apertures/refresh/`:
   - Title: `Refresh '<name>' from catalog?`
   - Body: side-by-side three-column diff:
     `Field | Catalog (current) | Yours (saved)` with per-row
     radio `Take catalog | Keep mine | Edit a third value`.
   - Edit-a-third-value opens an inline input validated against
     the field's schema type.
   - Bulk: `Take all from catalog`, `Keep all mine`.
   - Diverged user-edited fields (in `local_overrides`) are
     tagged `You edited this` and default to **Keep mine**.
   - Save:
     - Writes chosen values into the document via
       `applyRefreshFromCatalog` (a new ApertureCommand —
       `refreshRefFromCatalog`).
     - Updates `catalog_origin.catalog_version_id =
       current_version_id` and `catalog_origin.synced_at =
       now()`.
     - Preserves `catalog_origin.local_overrides` verbatim in
       v1 (PRD §15 explicit decision).
4. **Drift badge wiring:** Phase 06's drift badge becomes
   clickable; opens the dialog scoped to the clicked ref.
5. **`<BuilderDriftBanner />`** renders above the canvas in the
   builder area when the active aperture has any drifted
   element:
   - Text: `N entries drifted from catalog · [Review all]`.
   - `Review all` opens `<BuilderDriftReviewAllModal />` listing
     each drifted entry with a `Refresh` button that opens the
     per-entry dialog.
6. **Project-wide drift report**:
   - Endpoint
     `GET /projects/{id}/versions/{vid}/apertures/drift-report`
     returns
     `{ apertures: [{ aperture_type_id, name, entries: [...] }] }`.
   - Project header `⋯ → Catalog drift report` action opens the
     report in a side panel; each entry has a `Jump to card`
     link that navigates to the matching aperture + scrolls the
     card into view.
7. **`<ProjectRefsView />`** modal:
   - Header overflow `⋯ → View picked frames & glazings`.
   - Two tabs: `Frames`, `Glazings`.
   - Each tab lists distinct refs:
     - Deduped by `catalog_origin.catalog_record_id` for
       catalog-sourced refs.
     - Hand-entered refs each listed individually under a
       `Hand-entered` group.
   - Columns: `Name`, `Manufacturer`, `Brand`, `Use`,
     `Operation`, `Location`, `Width (mm/in)`, `U-Value`,
     `Ψ-G`, `Datasheet`, `Drift`, `Used by (N elements)`.
     Glazings drop `Use/Operation/Location/Width` and add
     `g-Value`.
   - `Drift` column shows badge + link to the dialog; clicking
     opens the dialog scoped to the chosen ref.
   - `Used by` cell expands to show the aperture-element list
     with jump-to-card links.
   - Read-only view (no edits); editing happens on the cards.
8. **New `refreshRefFromCatalog` ApertureCommand**:
   - Payload: `aperture_type_id`, `element_id`,
     `target: "frame.<side>" | "glazing"`, `chosen_values:
     dict[str, object]`.
   - Validates chosen field values against the ref's schema.
   - Updates the target ref + `catalog_origin.synced_at` and
     `catalog_version_id`.
   - Audit `affects_u_value=True` when thermal fields change.
9. **Locked / Viewer rendering**: PRD §15 explicit decision —
   v1 hides refresh affordances for locked / Viewer because the
   current drift report endpoint is editor-only. Read-only drift
   badges deferred until a read-safe drift-status endpoint
   exists (Phase 12 documents this as a known v1 limitation;
   Phase 13's MCP tool may revisit).
10. `make ci` is green.

## P2. Files

### New (backend)

- `backend/features/aperture_drift/__init__.py`
- `backend/features/aperture_drift/detector.py`
- `backend/features/aperture_drift/comparator.py`
- `backend/features/aperture_drift/models.py`
- `backend/features/aperture_drift/routes.py`
- `backend/features/aperture_drift/__tests__/test_detector.py`
- `backend/features/aperture_drift/__tests__/test_comparator.py`
- `backend/features/aperture_drift/__tests__/test_routes.py`
- `backend/features/project_document/aperture_commands/handlers/refresh.py`
- `backend/features/project_document/__tests__/test_refresh_command.py`

### New (frontend)

- `frontend/src/features/apertures/refresh/RefreshDialog.tsx`
  (the V2 rebuild — replaces the V1-era plumbing migrated
  in Phase 02)
- `frontend/src/features/apertures/refresh/RefreshDialog.test.tsx`
- `frontend/src/features/apertures/components/BuilderDriftBanner.tsx`
- `frontend/src/features/apertures/components/BuilderDriftReviewAllModal.tsx`
- `frontend/src/features/apertures/components/ProjectRefsView.tsx`
- `frontend/src/features/apertures/components/ProjectRefsRow.tsx`
- `frontend/src/features/apertures/hooks/useApertureDriftReport.ts`
- `frontend/src/features/apertures/hooks/useDistinctRefs.ts`
- `frontend/src/features/apertures/lib/refsAggregation.ts`
- `frontend/src/features/apertures/__tests__/refsAggregation.test.ts`
- `frontend/src/features/apertures/__tests__/ProjectRefsView.test.tsx`
- `frontend/src/features/apertures/__tests__/BuilderDriftBanner.test.tsx`

### Modified

- `frontend/src/features/apertures/components/CatalogBadges.tsx`
  - Drift badge becomes clickable (Phase 06 stub → Phase 12
    real).
- `frontend/src/features/apertures/components/AperturesHeader.tsx`
  - Add `View picked frames & glazings` overflow action.
- The project header `⋯` overflow — add
  `Catalog drift report` action (location may be outside this
  feature folder; if so, only the entry point is touched here).
- `backend/features/project_document/aperture_commands/models.py`
  - Fill in `RefreshRefFromCatalog`.
- The existing V1-era refresh plumbing migrated in Phase 02 —
  replaced by the V2 components above; deleted at the end of
  this phase.

### Deleted

- The remaining V1-era refresh helpers under
  `frontend/src/features/apertures/refresh/` that don't survive
  the V2 rewrite (RefreshReviewAllModal, RefreshDialog v1
  shape, etc.). The folder reorganizes around
  `RefreshDialog.tsx` v2 + `BuilderDriftReviewAllModal.tsx`.

## P3. Component / model shapes

```python
# backend/features/aperture_drift/comparator.py — sketch

@dataclass(frozen=True)
class RefFieldDelta:
    field_key: str
    catalog_value: object
    yours_value: object
    in_local_overrides: bool


def compare_frame_ref(
    ref: FrameRef, row: CatalogFrameType,
) -> list[RefFieldDelta]:
    deltas: list[RefFieldDelta] = []
    overrides = set(ref.catalog_origin.local_overrides) if ref.catalog_origin else set()
    for key in FRAME_COMPARED_KEYS:
        ours = getattr(ref, key)
        theirs = getattr(row, key)
        if ours != theirs:
            deltas.append(RefFieldDelta(
                field_key=key,
                catalog_value=theirs,
                yours_value=ours,
                in_local_overrides=key in overrides,
            ))
    return deltas
```

```python
# backend/features/aperture_drift/detector.py — sketch

def detect_aperture_drift(
    body: ProjectDocumentV1,
    catalog: CatalogReader,
) -> ApertureDriftReport:
    entries: list[ApertureDriftEntry] = []
    for apt in body.tables.apertures:
        for el in apt.elements:
            entries.extend(_check_element(apt, el, catalog))
    return ApertureDriftReport(entries=entries)


def _check_element(
    apt: ApertureTypeEntry, el: ApertureElement, catalog: CatalogReader,
) -> list[ApertureDriftEntry]:
    out: list[ApertureDriftEntry] = []
    for side in ("top", "right", "bottom", "left"):
        frame = getattr(el.frames, side)
        if frame is None or frame.catalog_origin is None:
            continue
        row = catalog.get_frame_type(frame.catalog_origin.catalog_record_id)
        if row is None:
            out.append(ApertureDriftEntry(
                aperture_type_id=apt.id, element_id=el.id,
                target=f"frame.{side}",
                kind="catalog_row_missing", deltas=[],
            ))
            continue
        version_drifted = (
            frame.catalog_origin.catalog_version_id is not None
            and frame.catalog_origin.catalog_version_id != row.current_version_id
        )
        deltas = compare_frame_ref(frame, row)
        if version_drifted or deltas:
            out.append(ApertureDriftEntry(
                aperture_type_id=apt.id, element_id=el.id,
                target=f"frame.{side}",
                kind="version_or_field_delta", deltas=deltas,
                version_drifted=version_drifted,
            ))
    # ... glazing similarly
    return out
```

```ts
// refsAggregation.ts — sketch

export type RefUsage = {
  refSnapshot: FrameRef | GlazingRef;
  origin: "catalog" | "hand_enter";
  catalogRecordId: string | null;
  elementUsages: { aperture_type_id: string; element_id: string; target: string }[];
};

export function aggregateRefs(
  doc: ProjectDocumentV1,
  kind: "frame_types" | "glazing_types",
): RefUsage[] {
  const byKey = new Map<string, RefUsage>();
  for (const apt of doc.body.tables.apertures) {
    for (const el of apt.elements) {
      const targets = kind === "frame_types"
        ? (["top", "right", "bottom", "left"] as const).map((side) => ({
            ref: el.frames[side], target: `frame.${side}`,
          }))
        : [{ ref: el.glazing, target: "glazing" }];
      for (const { ref, target } of targets) {
        if (!ref) continue;
        const recId = ref.catalog_origin?.catalog_record_id ?? null;
        const key = recId ?? `hand:${apt.id}:${el.id}:${target}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            refSnapshot: ref,
            origin: recId ? "catalog" : "hand_enter",
            catalogRecordId: recId,
            elementUsages: [],
          });
        }
        byKey.get(key)!.elementUsages.push({
          aperture_type_id: apt.id, element_id: el.id, target,
        });
      }
    }
  }
  return [...byKey.values()];
}
```

## P4. Sequence

1. **Commit 1 — Backend detector + comparator + tests.**
2. **Commit 2 — Backend `refreshRefFromCatalog` command + tests.**
3. **Commit 3 — Drift-report endpoint + tests.**
4. **Commit 4 — `RefreshDialog` v2 + drift badge wiring.**
5. **Commit 5 — `BuilderDriftBanner` + Review-all modal.**
6. **Commit 6 — `ProjectRefsView` + overflow action.**
7. **Commit 7 — Project header drift-report action.**
8. **Commit 8 — Cleanup + `make ci` green.**

## P5. Tests

### Backend — comparator

- Identical field set → empty deltas.
- One thermal field differing → one delta with the right
  catalog / yours values.
- Field in `local_overrides` → delta with
  `in_local_overrides=True`.

### Backend — detector

- Version-id mismatch alone surfaces the entry.
- Field-delta alone (current version, in-place edit) surfaces
  the entry.
- Hand-entered refs are skipped.
- Catalog row missing → `catalog_row_missing` entry.

### Backend — refresh command

- Take-catalog values overwrite the ref.
- `catalog_origin.catalog_version_id` advances to the current
  catalog `current_version_id`.
- `synced_at` ≈ now.
- `local_overrides` unchanged.
- Validation fails on a third-value edit that violates the
  schema (e.g. negative `u_value_w_m2k`).

### Frontend — refs aggregation

- Two elements picking the same catalog frame for top → one
  refusage with two element usages.
- Hand-entered refs listed per-occurrence.

### Component

- `RefreshDialog` renders the three-column diff and the per-
  row radios.
- Diverged user-edited fields default to **Keep mine** with the
  `You edited this` tag.
- Save dispatches `refreshRefFromCatalog`.
- `BuilderDriftBanner` shows when any element of the active
  aperture has drift.
- `ProjectRefsView` lists distinct refs with usage counts.

### Browser

- Edit a catalog frame's `u_value_w_m2k` in the catalog
  manager (or simulate via test fixture); reopen the aperture;
  verify the drift badge appears on the affected element row.
- Click the badge; verify the dialog shows the delta.
- `Take all from catalog`; verify the values write through
  and the badge clears.
- Open `View picked frames & glazings`; verify every picked
  ref shows with its usage count.

## P6. Out of scope (lands in later phases)

- MCP semantic-write tools — Phase 13.
- Read-safe drift-status endpoint for viewers — future.
- Full project-wide auto-refresh — explicitly out of scope
  (PRD §15).

## P7. Risks

- **R-12-1. Field-delta detection on every drift report query
  is O(elements × fields).** Mitigation: response cached at the
  detector level by `(catalog_snapshot_id, document_hash)` and
  invalidated on either side's change.
- **R-12-2. `local_overrides` semantics interact with
  `editFieldOverride` (Phase 06).** Mitigation: refresh
  preserves `local_overrides` verbatim per PRD §15 explicit
  decision. A future phase may add a "promote refreshed value
  to override" flow if needed.
- **R-12-3. ProjectRefsView dedup may surprise the user when
  two manufacturers share a name.** Mitigation: dedup key is
  `catalog_record_id`, not name; hand-entered refs always show
  individually.
- **R-12-4. The locked-viewer behavior hides the refresh
  affordance.** Mitigation: PRD §15 explicit decision; the
  banner and badge are entirely hidden for locked / Viewer;
  Phase 13 may revisit when MCP read tools exist.
