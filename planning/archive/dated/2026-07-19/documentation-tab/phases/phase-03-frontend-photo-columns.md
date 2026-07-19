---
DATE: 2026-07-18
TIME: 19:30
STATUS: Done (implemented + verified on feature/documentation-tab)
AUTHOR: Ed May (with Claude)
SCOPE: Proximate photo columns on the owning Equipment / Apertures / Thermal Bridges surfaces
RELATED: ../PRD.md §D1 ("proximate columns" half), ../research.md (equipment tables map)
---

# Phase 03 — Frontend: proximate photo columns

## Goal

Editors can attach site photos where they already attach datasheets —
US-SP-1 lands here, before the Documentation page exists.

## Work

1. **Equipment tables (8) + heat-pump leaf tables (4):** add a second
   `attachmentColumn` (config `SITE_PHOTO_ATTACHMENT_CONFIG`,
   `fieldKey: *_PHOTO_FIELD_KEY`) beside the existing Datasheet column in
   each `*Table.tsx` / heat-pump `*-columns.tsx`. Add `*_PHOTO_FIELD_KEY`
   constants to `features/equipment/types.ts`; default `[]` in each
   `buildEmpty*Row.ts`; include photo ids in each table's `useAssetUrls`
   collection.
2. **Apertures (frames/glazings report panels):** add a "Site photos"
   attachment cell beside the datasheet cell in
   `ApertureSpecReportPanel`-family components, using the same
   attach/detach hook pattern as datasheets there.
3. **Thermal Bridges table:** same as equipment pattern.
4. **DataTable invariants (iron-law):** the new column must inherit the
   parent-owned defaults — excluded from row duplication like existing
   attachment columns, fixed attachment width, filter/sort behavior
   consistent. No per-table opt-outs.
5. **No waiver UI on these surfaces** (waivers are Documentation-page
   only, per PRD §D5). No column for waiver fields anywhere in
   DataTables — verify none leaks in via custom-field/column generation.
6. Verify the renamed "Specification Status" column header renders
   everywhere the old "Status" did (Phase 01 rename is backend
   display-name; adjust any frontend-side hardcoded labels/tests).

## Verification

- ✅ `pnpm run format`
- ✅ `pnpm exec tsc -b --pretty false`
- ✅ Focused Vitest:
  `src/features/equipment/lib.test.ts`,
  `src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx`,
  `src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts`,
  `src/features/assets/thermal-bridges/__tests__/payloads.test.ts`,
  `src/features/apertures/__tests__/ApertureSpecReportPanel.test.tsx`,
  `src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx`,
  plus the affected Equipment / Heat Pump table suites.
- ✅ `make frontend-dev-check`
- ✅ `make ci`:
  - backend: 1419 passed, 7 skipped, 1 existing deprecation warning
    (`HTTP_413_REQUEST_ENTITY_TOO_LARGE`)
  - frontend: 241 test files passed, 2235 tests passed; build passed with
    existing Fast Refresh / Vite chunk-size warnings
- ✅ `graphify update .`
- ✅ Agent browser:
  - Ventilators: `Site Photos` column renders beside `Datasheet`;
    `Specification Status` renders as the status header.
  - Heat Pumps / Outdoor Equipment leaf: `Site photos` column renders beside
    `Datasheet`.
  - Thermal Bridges: `Site Photos` column renders beside `PDF Report`.
  - Post-simplify refactor recheck: Ventilators and Heat Pumps / Outdoor
    Equipment still render the proximate photo columns.
  - Frames route loaded but the seeded agent-browser fixture had no project
    frames (`No project frames`), so the live row-level Frames photo cell was
    verified by `ApertureSpecReportPanel.test.tsx` instead of a live browser
    upload.
- ✅ Duplicate-row attachment invariant covered by payload tests:
  duplicated Equipment, Heat Pump, and Thermal Bridge rows clear both
  datasheet/report attachment ids and `photo_asset_ids`.
- Upload/save/anonymous-viewer file-selection smoke was not completed in the
  live browser because the exposed Playwright MCP controls do not provide a
  file chooser path. Upload/detach/write behavior is covered by focused
  component and payload tests.
