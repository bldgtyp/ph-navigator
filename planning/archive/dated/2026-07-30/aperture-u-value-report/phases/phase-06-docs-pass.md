---
DATE: 2026-07-29
UPDATED: 2026-07-30 — documentation closeout complete
TIME: 14:31 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 6 — documentation closeout: page docs, glossary, decision
  fold-back, graphify, and feature archive.
RELATED: ../PRD.md, ../decisions.md, context/ui/pages/apertures-tab.md,
  context/ui/pages/.instructions.md, planning/.instructions.md
---

# Phase 6 — Docs pass & closeout

## Goal

The report sub-tab is documented where the next agent will look, accepted
decisions live in `context/`, and the feature folder is ready to archive.

## Work

1. **`context/ui/pages/apertures-tab.md`** — read
   `context/ui/pages/.instructions.md` first, then add **§2.6.4 U-Values
   Report** in the §2.6.2/§2.6.3 house style: columns by name, expansion
   content, summary table, downloads, editor-vs-viewer behavior, the
   D-7 annotation, the exterior-view legend, empty state copy. Update the
   §2.6 sub-tab list. Reconcile the §2.6.1 "no separate audit page" line
   with a sentence noting the builder keeps its inline U-values and the
   report adds depth + export (PRD §4.1 wording).
2. **`context/GLOSSARY.md`** — add/confirm: *uninstalled U-w*, *45° corner
   split*, *glazing-area-weighted SHGC* (only if not already present).
3. **Decision fold-back** (planning rule 4): the convention note
   (uninstalled, 45° split, exterior orientation, include-as-zero rollup)
   belongs in `apertures-tab.md` §2.6.4 and, if a backend calc doc exists
   for the slice, in a short docstring reference — verify the `service.py`
   header docstring still matches shipped behavior (it becomes
   user-visible via the export provenance note).
4. **Capability docs**: wherever existing capabilities are enumerated
   (access docs / admin page docs), add `APERTURE_EXPORT_U_VALUE_REPORT`.
5. **MCP docs**: add `get_aperture_u_value_report` to `context/mcp.md`'s
   tool list if that file enumerates tools.
6. **Screenshots** from Phase 4 into `planning/features/
   aperture-u-value-report/assets/` (or referenced from the page doc if
   that's the house pattern — follow §2.6.2's precedent).
7. **Graphify**: `graphify update .` after the code phases.
8. **Closeout**: run the repo closeout gate (simplify, docs-pass,
   `make format`, `make ci`); update `STATUS.md` (this folder) and the
   `planning/STATUS.md` row; when Ed calls it complete, archive to
   `planning/archive/dated/<date>/aperture-u-value-report/` + one line in
   `planning/archive/README.md`. Deploy remains Ed's call (auto-deploy
   off).

## Out of scope

Any behavior change discovered here → new issue or follow-up feature, not
a silent fix inside the docs pass.

## Verification

Docs guards green in `make ci`; `apertures-tab.md` §2.6.4 readable
standalone; graphify query for "aperture u-value report" resolves to the
new modules; archive checklist from `planning/.instructions.md` satisfied.

## Implementation ledger

- Added `context/ui/pages/apertures-tab.md` §2.6.4 and updated both UI indexes
  for the fourth route-addressable sub-tab. The page contract covers all
  summary/element/edge columns, source fallback, warnings, Empty-panel count
  metadata, downloads, capability hiding, and saved-version consent.
- Added **Uninstalled U-w**, **45° corner split**, and
  **Glazing-area-weighted SHGC** to `context/GLOSSARY.md`, including the
  missing-g-value denominator rule.
- Added the report/export routes and capability contract to
  `context/technical-requirements/api.md`; corrected the active
  `context/USER_STORIES.md` route set and the pre-existing `catalog.edit`
  capability wording in `context/PRD.md`.
- `context/mcp.md` already contained `get_aperture_u_value_report` in the
  CI-guarded inventory; the scope matrix now names the aperture read tools.
- The calculation service header now states the uninstalled U-w and 45° frame
  corner invariants next to the shipped implementation.
- Simplify review corrected editor source fallback, void-count reconciliation,
  unfinished-row wording, missing-SHGC treatment, route inventory, and
  capability-bundle wording. The reuse and efficiency reviews found no other
  contract-placement or maintainability issues.
- The collaborative browser's final 1280×800 IP snapshot captured the
  expanded Top/Right/Bottom/Left edge table. No screenshot binary was copied
  into `assets/`: Phase 4 had not produced a local file, and
  `context/ui/pages/.instructions.md` requires the durable page doc to remain
  narrative-only. The thread snapshot and the Phase 04/05 ledgers retain the
  browser evidence.
- `graphify update .` completed and a query for the aperture U-value report
  resolved the saved-version exporter and `AperturesTab.tsx`.
- Final `make format` and `make ci` passed: backend `1741 passed, 7 skipped`;
  frontend `256` files / `2365` tests, structural guards, and production build.
