---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned
AUTHOR: Codex with Ed May
SCOPE: Move frontend status controls and current API consumers to canonical
  `needed`.
RELATED:
  - ../research.md
  - ./phase-02-v8-backend-migration.md
---

# Phase 03 — Canonical UI and adapters

## Goal

Make every in-scope frontend state, count, filter, command, and status data
attribute use `needed`, while retaining deliberately different storage and
non-status uses of `missing`.

## Ordered implementation steps

1. Change both `SpecificationStatus` unions:
   - `features/envelope/types.ts`;
   - `features/apertures/types.ts`.
2. Convert `MaterialsPanel` options, count keys, filters, commands, and tests to
   `needed`; retain the visible Needed label.
3. Convert `ApertureSpecReportPanel` shared Glazing/Frame status list, labels,
   count keys, filters, commands, type guards, and tests to `needed`.
4. Change Documentation's built-in write adapter so Needed and response-only
   Unknown persist canonical `needed`. Keep custom status writes mapped to
   `opt_status_needed`.
5. Change `ReportStatusKey`, report status dots, filter typings, and
   `data-status` from `missing` to `needed` for specification-status widgets.
6. Change `StatusTone`/`data-tone` to `needed` for status controls. Add
   `--report-status-needed: #d97706` and move status-semantic consumers to it.
   Set `--report-status-missing: var(--report-status-needed)` for unchanged
   Climate and non-status consumers. Leave Documentation write-error/zero-meter
   uses unchanged unless separately reclassified; do not blind-replace CSS.
7. Keep Documentation phrases such as “Missing photos” where they describe
   absent evidence rather than the enum value.
8. Verify current Documentation and Project Status types already consume
   `needed`; add regression rather than rewriting them.
9. Add one automated option-list/default/render/write contract matrix covering
   all 12 custom-status tables: Ventilators, Pumps, Fans, Hot Water Heaters,
   Hot Water Tanks, Electric Heaters, Appliances, all four Heat Pump leaves,
   and Thermal Bridges. Every namespaced option list must retain
   `opt_status_needed`. Add a Thermal Bridge default regression if none exists.
10. Verify MCP and current GH API typed payloads show `needed`; verify rich
    Honeybee construction output remains external `MISSING`.
11. Use scoped grep checks over status symbols/paths. Do not assert that the
    English word `missing` is absent from the repo.

## Focused test matrix

- Materials: counts, Needed filter, edit command, read-only pill.
- Glazings/Frames: counts, Needed filter, edit command, read-only pill.
- Documentation: built-in material/glazing/frame Needed write and custom
  Equipment Needed write.
- Status dashboard: summaries for both storage families.
- Shared status widgets: `needed` data attributes/tone.
- All 12 Equipment/Heat Pump/TB table surfaces: stable namespaced option lists,
  defaults, render values, writes, ids, and labels.
- API/MCP/GH/HBJSON: canonical vs external boundary values.

## Browser verification

After code/tests are ready, run `make agent-browser-ready` and verify mounted
Materials, Glazings, Frames, Documentation, Status, one Equipment table, and
Thermal Bridges routes with the printed fixture/login. Confirm filters/counts,
editor values, read-only pills, and network payloads.

## Exit gate

- No in-scope UI displays Missing as the specification-status label.
- Built-in current writes send `needed`; custom tables send
  `opt_status_needed`.
- Phases 02+03 pass focused suites, browser checks, and full `make ci`.
- Candidate B is built but not deployed.

## Stop conditions

- Token work alters Climate or unrelated missing-data presentation.
- Shared CSS consolidation expands the phase.
- Frontend canonical writes are enabled without the Release-A backend being
  production-ready to accept them.
