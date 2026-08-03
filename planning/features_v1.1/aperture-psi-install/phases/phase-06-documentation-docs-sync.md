# Phase 06 — Documentation integration + docs sync

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Not started
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
