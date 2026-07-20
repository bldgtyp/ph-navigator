---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Implemented — candidate B complete, not deployed
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

## As-built notes (2026-07-19)

- Steps 1–2 collapsed: both feature `types.ts` files already re-export the
  union from `project_document/specification-status.ts`, so the rename had one
  type edit site rather than two.
- The rename removed the reason Materials, the Glazings/Frames spec report, and
  Documentation each kept their own status option list (they differed only
  because Materials said `missing`). They now share
  `SPECIFICATION_STATUSES` / `SPECIFICATION_STATUS_LABELS` /
  `SPECIFICATION_STATUS_OPTIONS` exported beside the union, and
  `ReportStatusKey` / `StatusTone` derive from it instead of re-listing members.
  A fifth status is now one edit, not four.
- `serializeSpecificationStatus` accepts only `SpecificationStatus | "unknown"`.
  Its callers pass `DocumentationSpecStatus`, so a legacy `missing` cannot
  reach the write path; wire tolerance lives solely in
  `normalizeSpecificationStatus` on the read path.
- Step 9's matrix reuses `tests/status_field_helpers.py` rather than restating
  the option-id contract, and `status_field_helpers` now re-exports the option
  ids from `_status_field` instead of shadowing them with string copies.
- Browser verification used the seeded `PHN V2 Starter Project`, whose saved
  body is still **schema v7** with legacy `missing` in all three lists — so the
  check exercised the v7 → v8 read path end to end, not just new data. Materials
  rendered "Needed" with count 1 matching the one legacy row; Glazings likewise;
  Status showed `needed` chips for both storage families; Documentation kept
  "Missing datasheets/photos" wording alongside "Needed specs". The
  `AGENT-BROWSER` fixture is empty of materials/glazings and cannot show this.

## Deferred follow-up

`--report-status-missing` survives as an alias of `--report-status-needed` for
consumers that were never a specification status (Climate data gaps,
Documentation write errors and zero meters). Two independent reviews noted the
token is now misnamed for its remaining consumers and suggested a neutral name
(e.g. `--accent-warn`). Deliberately **not** done here: D-8 and this phase's
stop conditions exclude shared-CSS consolidation from the rollout. It belongs to
Phase 07 or a separate CSS packet.
