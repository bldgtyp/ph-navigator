DATE: 2026-08-03
TIME: 11:25 EDT
STATUS: Accepted — decisions from the 2026-08-03 Ed/Claude review
AUTHOR: Claude with Ed May
SCOPE: Accepted and rejected decisions governing the status UX unification.
RELATED:
  - ./README.md
  - ./PRD.md
---

# Decisions — Status UX unification

## Accepted

- **D-1 — Three-axis model is presentation-complete; no data-model rework.**
  Spec / Datasheet / Site Photos already exist as independent persisted
  axes. This packet changes labels, controls, routes, and projections only.

- **D-2 — One vocabulary module, exact strings in PRD §2.** Axis labels are
  `Spec. Status`, `Datasheet`, `Site Photos` (Ed, 2026-08-03). Rollup words
  are "need attention" and "resolved"; legend defines resolved =
  Complete + N/A.

- **D-3 — Tab rename Status → Overview** (Ed, 2026-08-03). Slug `overview`,
  legacy redirect preserves search + hash. Roadmap UI copy says
  "milestone", never "status item". Backend `status-items` routes, table,
  and MCP `list_status_items` keep their names (API stability; rename is
  cosmetic-only at the UI layer).

- **D-4 — No `Question` on evidence axes** (Ed, 2026-08-03). Rationale:
  `Question` and `Needed` both mean "follow up on this"; the Notes field is
  where discussion lives. Spec axis keeps `Question` unchanged.

- **D-5 — Overview's record pane becomes counts-only meters deep-linking
  into Documentation** (Ed, 2026-08-03: "clean this up for real"). The
  lighter alternative (keep the record list, add all three axes) was
  rejected as re-duplicating Documentation.

- **D-6 — One taxonomy: the Documentation/nav-tab sections** (Apertures /
  Envelope / Equipment / Thermal Bridges). The Mechanical vs Domestic Hot
  Water top-level split disappears with the record pane; per-table groups
  remain inside Equipment. Empty sections/groups are hidden everywhere.

- **D-7 — `documentation_summary.py` is the single record-status
  projection.** Overview consumes a counts-only rollup of it;
  `status_summary.py`, its routes, and `RecordStatusSummary` are retired
  after a consumer sweep. The duplicated `_STATUS_BY_OPTION_ID` maps and
  record helpers collapse into one shared location (natural home:
  `tables/_status_field.py` + `documentation_summary.py`).

- **D-8 — One control set:** `StatusSelect` (edit) / `StatusPill` (view);
  DataTable's `SingleSelectStatusPill` restyles onto the
  `report-status-chip` token family (the user-confirmed canonical chip
  pattern). Includes the status-pill CSS consolidation and
  `--report-status-missing` alias retirement deferred out of the
  spec-status-value-unification packet.

- **D-10 — Documentation filters become URL state** (`?needs=` param) so
  Overview meters, external links, and agents can address a filtered view.
  Verified 2026-08-03: hash-anchor expansion already works
  (`DocumentationSummaryView.tsx` hash effect); filter chips are local
  `useState` today, so the param is net-new work.

## Rejected

- **D-9 — Unifying the two storage families** (typed
  `specification_status` columns vs `custom_values["status"]` option-ids)
  — rejected. It would be a real document migration for zero user-visible
  gain; the spec-status packet's D-2 (option ids untouched) stands.

- **Renaming spec values** (e.g. merging Question into Needed) — rejected;
  value set shipped 2026-07 in the spec-status packet and reads well.

- **Adding Mechanical/DHW subgroup headers to Documentation's Equipment
  section** — rejected for now; per-table groups are sufficient and the
  section meters make the split unnecessary.

- **D-11 — Filter chip strings accepted** (Ed, 2026-08-03): `Needs spec` /
  `Needs datasheet` / `Needs site photos`.

- **D-12 — Overview section rows include the per-group meter disclosure in
  v1** (Ed, 2026-08-03): expanding a section reveals per-group meter rows
  with the same axis deep links (group anchors). Still counts-only — no
  record rows on Overview.

## Resolved implementation questions

- **O-1 — The built-in FieldDef `display_name` is persisted.** Resolved in
  Phase 01 on 2026-08-03. Built-in definitions are copied into
  `tables.*.field_defs`, and the backend drift audit compares those saved
  definitions against current seeds. The stable backend/API display name and
  description therefore remain unchanged; mounted DataTables receive the
  canonical `Spec. Status` label and exact tooltip through the frontend
  field-render overlay. Changing either stored definition produced a schema
  fingerprint delta and fixture drift, conflicting with this packet's explicit
  no-schema-change invariant. No `gh_api` export couples behavior to the
  visible label. This avoids document/schema churn while presenting one
  vocabulary.
