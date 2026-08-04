# Phase 06 — Documentation integration + docs sync

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  ✅ Done 2026-08-04
AUTHOR:  Ed + Claude
SCOPE:   Backend + frontend + context docs. Surface install types on the
         Documentation page (and thereby the future Overview meters), update
         direction copy, sync context docs, e2e.
RELATED: ../decisions.md (D-7, D-9),
         ../../../archive/dated/2026-08-03/status-ux-unification/PRD.md
```

## 1. Documentation summary (backend)

`backend/features/project_document/documentation_summary.py`:

- New `DocumentationTable` for `aperture_install_types` in section
  **"apertures"**, built with a TB-style factory (custom `status` source —
  clone `_thermal_bridge_table` `:181-193`, not `_aperture_table` which
  reads `specification_status`).
- Record deep-link template → `/projects/{project_id}/apertures/installs?focus={record_id}`.
- Evidence axes stay the standard datasheet/photo pair (D-7): rows carry
  those typed columns from phase 01. The Flixo PDF (`pdf_report_asset_ids`)
  is intentionally **not** an axis here — do not extend
  `DocumentationAxisCounts` (status-ux-unification non-goal). Note the
  deferral in code comment sparingly only if the reviewer would otherwise
  re-ask; the planning record is decisions.md D-7.

## 2. Documentation frontend

- Verify the new table renders generically in
  `DocumentationSummaryView`/`DocumentationRecordViews` (they are
  registry-driven; fix any hardcoded per-section table lists).
- `frontend/src/features/documentation/directions/content.ts`: apertures
  section (`:193-201`) already mentions installation psi — rewrite that
  bullet to point at the Installs workflow ("create install types on the
  Apertures → Installs tab; attach the Flixo/THERM report PDF to each
  calculated type; assign edges in the aperture's Installs modal").
- Confirm the existing `?needs=` filters and Overview meters pick the new
  table up with zero extra work (they read the documentation summary).

## 3. Context docs (the durable layer)

- `context/ui/pages/apertures-tab.md`: document the fifth sub-tab, the
  Installs modal, the FrameRow Ψ-inst cell, and the derived-mull rule.
- `context/GLOSSARY.md`: `Ψ-install (psi-install)`, `install type`,
  `perimeter vs interior (mulled) edge`.
- `context/technical-requirements/data-model.md`: `aperture_install_types`
  table + `ApertureElementInstalls` slots + schema v10 note.
- `context/mcp.md` needs no change (generic table tools cover the new
  table) — verify `get_table`/`replace_table` on it via `phn-local` once,
  discard the draft.
- Route-3 contract doc (wherever phase 02 updated it): confirm the
  `installs` block + uniform `frame_type` policy is written down for the
  GH-side consumer (phase 07 reads this).
- `graphify update .` after the code lands.

## 4. Tests & exit gate

- Backend: documentation summary snapshot includes the new table with
  correct counts (mix of complete/needed rows in fixture).
- e2e: `documentation-tab.spec.ts` — section shows Installs group; row
  deep-link lands on the Installs tab with `?focus=` highlighting.
- Agent-browser screenshot: Documentation page with the Installs group.
- Closeout gate; STATUS.md ledger. On completing this phase, the PHN side
  of the feature is done — re-check `planning/STATUS.md` and this packet's
  README status line, and run the docs-pass skill across the whole diff
  history of the feature.

## As-built notes (2026-08-04)

- **Registry entry:** no separate factory — `_aperture_table` gained a
  keyword-only `status_source` param (default `specification_status`), and
  the Installs entry registers as
  `_aperture_table("aperture_install_types", "Installs", "installs",
  status_source="custom_status")`. The phase's "clone `_thermal_bridge_table`"
  direction assumed the source couldn't be parameterized; the param is
  strictly simpler.
- **Frontend:** the only code change the generic documentation UI needed was
  the `ROWS_KEY_BY_TABLE` entry (`aperture_install_types` → same-named slice
  rows key) — that map doubles as the documentation write allowlist. The
  `?focus=` deep link was already handled by the phase-03 Installs page.
- **Directions copy:** the apertures photo-shot bullet stays a photo subject
  (window-to-wall junction condition per Ψ-install type); the editor
  create/attach/assign workflow lives in `context/ui/pages/apertures-tab.md`
  §2.6.4, not in the contractor photo guide.
- **Rollup test delta:** `test_documentation_rollup_is_counts_only_...` now
  expects the apertures section always present — every document carries the
  seeded Default row (complete, evidence not-required), so a fresh project
  shows Installs 1/1 complete rather than an empty section.
- **MCP:** `context/mcp.md` unchanged — the MCP table tools resolve through
  the same `get_table_contract` registry, which has included
  `aperture_install_types` since phase 01. Verified via REST
  (`GET .../draft/tables/aperture_install_types` → 200 with seeded Default).
  Note: a phn-local stdio server spawned before the v10 code will 404 with a
  stale `supported_tables: [rooms, apertures]` diagnostic (that list is a
  legacy literal in `tables/registry.py`, not the real registry) until the
  process restarts.
- **Pre-existing follow-up (not this phase):** the first test in
  `documentation-tab.spec.ts` ("contractor directions and editor evidence
  publication") fails on clean HEAD — it predates status-ux-unification
  (expects no "Documentation…" heading and a "Missing photos" chip; the
  shipped UI has "Documentation progress" meters and "Needs site photos").
  Needs a rewrite against the current Overview/Documentation UX.
- Screenshot: `working/agent-browser/documentation-installs-phase06.png`
  (Apertures section with Glazings/Frames/Installs groups; Default record
  expanded, meters picking the group up with zero extra work).
