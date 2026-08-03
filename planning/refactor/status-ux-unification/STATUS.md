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

2026-08-03 follow-up review resolved the open items: chip strings accepted
(D-11), per-group meter disclosure is in v1 (D-12); O-1 approach approved
with the code check remaining the first Phase 01 action.

## Next step

Pick up **Phase 01** (vocabulary/labels/tooltips/legend) on a feature
branch. First action inside the phase: resolve **O-1** in `decisions.md`
(is built-in FieldDef `display_name` persisted or code-derived?) before
renaming the DataTable column header.

## Blockers

None. Coordinate Phase 02's CSS alias retirement with
`../spec-status-value-unification/` Phase 07 if that adapter cleanup is
still open when Phase 02 starts.

## Sequencing (Ed, 2026-08-03)

- Run **serial** with `../shared-segmented-control/` (either order). The
  packets are functionally disjoint — status selects/pills and filter chips
  are explicitly out of the segmented-control scope — but both edit the
  `context/DESIGN_SYSTEM.md` component inventory, so don't run them
  concurrently.
- `planning/features_v1.1/aperture-psi-install/` Phases 01/03 carry
  `[conditional]` `status_summary.py` entries: they are skipped if this
  packet's Phase 05 (retire `status_summary.py`) lands first. If psi-install
  runs first instead, Phase 05's consumer sweep must pick up whatever it
  added there. Re-check that packet's STATUS before starting Phase 05.

## Phase ledger

| Phase | State | Exit gate |
| --- | --- | --- |
| 01 Vocabulary, labels, tooltips, legend | Not started | retired-spelling grep clean; O-1 recorded; CI green |
| 02 One control + CSS tokens | Not started | five surfaces visually unified; CI green |
| 03 Documentation `?needs=` filters | Not started | PRD §6.3 browser smoke; CI green |
| 04 Overview rename + meters | Not started | PRD §6.4/§6.5 smoke; redirect verified; CI green |
| 05 Retire status_summary + docs sync | Not started | consumer sweep clean; context docs rewritten; packet archived |
