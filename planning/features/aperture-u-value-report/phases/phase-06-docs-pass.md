---
DATE: 2026-07-29
TIME: 14:31 EDT
STATUS: Ready after Phase 5
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
