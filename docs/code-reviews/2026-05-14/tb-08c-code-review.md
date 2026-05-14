# TB-08c Code Review

Date: 2026-05-14

Scope: current uncommitted TB-08c implementation only. This review checks the slice against `docs/plans/01_IMPLEMENTATION-ROADMAP.md` TB-08c, `context/user-stories/10-windows.md` US-WIN-1 / US-WIN-4, and `context/technical-requirements/data-model.md` bookshelf semantics. It does not review the code as a complete Windows app; TB-08d hardening, browser smoke, fuller Windows UX, refresh-from-catalog, hand-entry, calculations, and later US-WIN slices remain out of scope unless this diff blocks them.

## Findings

### P2 - Add defaults drift from the TB-08c / US-WIN-1 contract

`frontend/src/features/windows/lib.ts:22-42`

TB-08c explicitly routes the Add button defaults to US-WIN-1 §8. That contract says the new window type defaults to:

- `name: "Unnamed Window Type"`
- suffixes ` (2)`, ` (3)`, ...
- `row_heights_mm: [1000.0]`
- `column_widths_mm: [1000.0]`
- one 1x1 element with null frame/glazing slots

The implementation instead creates `"New window type"`, suffixes as `"New window type 2"`, and uses `row_heights_mm: [1500]`. The null slots and 1x1 element are correct, but the name/suffix/height drift from the context contract and the roadmap's TB-08c includes line. This is worth fixing before TB-08c is treated as landed because downstream browser evidence and docs will otherwise encode a different default than the canonical Windows story.

### P2 - Viewer / locked render still starts signed-in catalog queries

`frontend/src/features/windows/routes/WindowsTab.tsx:27-28`

`WindowsTab` always calls `useFrameTypesQuery(false)` and `useGlazingTypesQuery(false)`, even when `canEdit` is false for a locked version or public Viewer. The controls are disabled, but the query functions still hit `/api/v1/catalogs/frame-types` and `/api/v1/catalogs/glazing-types`. Those catalog routes require `require_current_user`, and the TB-08.a notes explicitly keep viewer catalog access deferred.

For a public Viewer, this will generate avoidable 401 network noise on a page that otherwise can read the project document through view access. For a signed-in read-only context, it also pulls global firm catalog rows even though the picker is disabled. Gate these queries behind `canEdit` or add an `enabled` parameter to the catalog query hooks and pass empty lists while read-only. The already-copied `FrameRef` / `GlazingRef` data is enough to render the disabled slots for TB-08c.

## Scope Fit

The implementation otherwise matches the narrow TB-08c slice:

- `/projects/:id/windows` now renders a real `WindowsTab` through `ProjectTabContent`.
- The Windows feature module is feature-local (`api`, `hooks`, `types`, `lib`, route component, tests).
- Draft reads use the editor draft table endpoint; viewer reads use the saved document table endpoint.
- Writes use the existing whole-table replace-slice endpoint with `If-Match` / `If-Match-Version`.
- Successful writes mark the local draft touched and invalidate the project-document draft summary so the shared header Save/dirty flow can update.
- Frame and glazing pickers use active catalog lists (`include_inactive=false`) and bookshelf-copy typed values into the document.
- Picked refs stamp `catalog_origin` with table, record id, version id, schema version, ISO `synced_at`, and empty `local_overrides`.
- The U-value tracer adds `u_value_w_m2k` to `catalog_origin.local_overrides` and intentionally keeps it there even after reverting.
- Locked versions and Viewer mode hide Add and disable picker controls.
- Unit coverage exists for natural sorting, unique-name behavior, default 1x1 element shape, catalog-origin stamping, override tracking, and hand-entered no-op behavior.

## Non-Findings / Deferred By Plan

- Browser smoke is still pending, but the roadmap row marks that as deferred to TB-08d, so I am not treating it as a TB-08c defect.
- Rename, duplicate, delete, sidebar collapse, search combobox, manufacturer filtering, hand-entered values, full inline field editing, drift badges/tooltips, calculations, dimensions editing, and refresh-from-catalog remain outside the current TB-08c implementation scope unless the roadmap is narrowed differently.
- The minimal CSS is acceptable for this tracer slice; TB-08d/browser polish can decide whether the 220 px fixed sidebar and card density need adjustment.

## Verification

Review only. I inspected the uncommitted diff and relevant context docs; I did not rerun the claimed local test gates.
