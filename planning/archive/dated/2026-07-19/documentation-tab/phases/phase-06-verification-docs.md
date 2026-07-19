---
DATE: 2026-07-18
TIME: 17:37
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: End-to-end verification, context-doc updates, and feature closeout
RELATED: ../STATUS.md, ../PRD.md §5 (edge-case checklist), context/README.md
---

# Phase 06 — Verification + docs

## End-to-end verification (the PRD §5 checklist, executed)

Run against a seeded fixture with records in every family:

1. **Contractor path (the Story-3 acceptance):** signed-out, phone-width —
   open project URL → Documentation tab → find a specific ventilator by
   Display Name → open 📖 directions → see exact shot list → rollup and
   "Missing photos" filter match reality.
2. **Designer path (Story-1):** editor uploads a JPEG and a real HEIC to
   an equipment record from both the owning table and the Documentation
   page; Save; anonymous view updates.
3. Edge cases: spec-na row (axes off) · waived axes count as done ·
   locked version read-only · Save-As shares photo refs · deleted row's
   assets survive in older versions · row duplication excludes photos ·
   empty project state · version picker switches the viewer's photo set.
4. e2e: add a Playwright spec covering (1) and (2) happy paths to the
   existing e2e suite.

## Docs pass (fold-back per planning rules)

- `context/ui/pages/documentation-tab.md` — new page doc distilled from
  PRD §D2 + wireframe (follow the ui/pages house style); add the row to
  `context/UI_UX.md` §2 table and the CLAUDE.md working-by-area table's
  page list if applicable.
- `context/user-stories/`: confirm US-ENV-15 absorption notes still
  accurate; add a pointer from `30-tables-equipment.md` datasheet/status
  sections to the documentation summary derivation.
- `context/GLOSSARY.md`: `Documentation tab`, `Specification Status`,
  `waiver ("not required")`, `documentation axes`.
- `context/technical-requirements/attachments.md`: extend the attachment-
  field roster table with the new photo fields + HEIC conversion note.
- Feature closeout: STATUS → `Complete` with evidence; archive per
  `planning/.instructions.md` (dated archive + README line) once Ed calls it
  done; then squash-merge to `main` in the git closeout step.

## Exit criteria

All PRD §5 items checked with evidence in STATUS.md; `make ci` green on
the final branch tip; docs updated in the same PR(s) as the code they
describe.
