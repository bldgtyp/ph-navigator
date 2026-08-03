DATE: 2026-08-03
TIME: 11:25 EDT
STATUS: Active — planning accepted 2026-08-03; implementation not started
AUTHOR: Claude with Ed May
SCOPE: Current state, next step, and phase ledger for the status UX
  unification.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
  - ./research.md
---

# Status — Status UX unification

## Current state

Planning complete and accepted by Ed on 2026-08-03: unified vocabulary
(PRD §2, labels `Spec. Status` / `Datasheet` / `Site Photos`), one control
set, URL-addressable Documentation filters, Status tab renamed **Overview**
with its record pane replaced by three-axis meters deep-linking into
Documentation, and retirement of the duplicate `status_summary.py`
projection. No code written yet.

Deep-link feasibility verified against source 2026-08-03: Documentation
hash anchors already expand + scroll; axis filters are local state only, so
the `?needs=` param is net-new (Phase 03).

## Next step

Pick up **Phase 01** (vocabulary/labels/tooltips/legend) on a feature
branch. First action inside the phase: resolve **O-1** in `decisions.md`
(is built-in FieldDef `display_name` persisted or code-derived?) before
renaming the DataTable column header.

## Blockers

None. Coordinate Phase 02's CSS alias retirement with
`../spec-status-value-unification/` Phase 07 if that adapter cleanup is
still open when Phase 02 starts.

## Phase ledger

| Phase | State | Exit gate |
| --- | --- | --- |
| 01 Vocabulary, labels, tooltips, legend | Not started | retired-spelling grep clean; O-1 recorded; CI green |
| 02 One control + CSS tokens | Not started | five surfaces visually unified; CI green |
| 03 Documentation `?needs=` filters | Not started | PRD §6.3 browser smoke; CI green |
| 04 Overview rename + meters | Not started | PRD §6.4/§6.5 smoke; redirect verified; CI green |
| 05 Retire status_summary + docs sync | Not started | consumer sweep clean; context docs rewritten; packet archived |
