DATE: 2026-08-03
TIME: 11:25 EDT
STATUS: Active — Phase 03 complete; Phase 04 next
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

Planning was accepted by Ed on 2026-08-03. Phase 01 now implements the unified vocabulary
(PRD §2, labels `Spec. Status` / `Datasheet` / `Site Photos`), one control
set, URL-addressable Documentation filters, Status tab renamed **Overview**
with its record pane replaced by three-axis meters deep-linking into
Documentation, and retirement of the duplicate `status_summary.py`
projection.

Deep-link feasibility verified against source 2026-08-03: Documentation
hash anchors already expand + scroll; axis filters are local state only, so
the `?needs=` param is net-new (Phase 03).

Phase 01 resolved O-1: built-in FieldDef display names are persisted and
drift-audited, so the backend/API display-name constant stays stable while
frontend field overlays present `Spec. Status`. Focused Vitest passed (9 files,
212 tests), the production frontend build passed, and the isolated browser
fixture showed the canonical labels on Documentation, an Equipment DataTable,
and the Status report pane. The first full-CI attempt proved that changing the persisted
backend FieldDef description alters the schema fingerprint and fixture drift;
that trial change was reverted and the exact tooltip remains a frontend render
overlay, preserving the accepted no-schema-change invariant. Simplify review
findings were reconciled; the docs pass found the packet itself was the correct
durable home. Final CI passed: backend 1,830 passed / 7 skipped; frontend 2,390
passed; production build and static gates green.

Phase 02 now consolidates Aperture editors on `StatusSelect`, all report and
DataTable read-only statuses on `StatusPill`, the two DataTable status-column
builders into one, and non-status amber consumers on `--attention-amber`.
Focused tests and the production build pass. Browser screenshots covered all
five named surface classes; the isolated fixture has empty report datasets,
while a local draft Equipment row visibly exercised the shared Needed pill.
Simplify review findings were reconciled; the docs pass updated the established
design-system/token inventories. Full CI passed: backend 1,830 passed / 7
skipped; frontend 2,391 passed; production build and static gates green.

Phase 03 now derives Documentation filters from `?needs=` and writes canonical
filter state with replace navigation while explicitly preserving hashes.
Focused RTL passed (8 tests), the production build passed, and browser smoke of
`?needs=datasheet#equipment` showed Equipment expanded/scrolled with only the
datasheet chip active. Three-lens simplify review reconciled the reusable
query-param setter; docs-pass updated the durable route contract. Full CI
passed: backend 1,830 passed / 7 skipped; frontend 2,395 passed; production
build and static gates green.

## Next step

Pick up **Phase 04** (Overview rename, rollup endpoint, and meters).

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
| 01 Vocabulary, labels, tooltips, legend | Complete | O-1 recorded; mounted surfaces verified; CI green |
| 02 One control + CSS tokens | Complete | five surfaces visually inspected; CI green |
| 03 Documentation `?needs=` filters | Complete | PRD §6.3 browser smoke; CI green |
| 04 Overview rename + meters | Not started | PRD §6.4/§6.5 smoke; redirect verified; CI green |
| 05 Retire status_summary + docs sync | Not started | consumer sweep clean; context docs rewritten; packet archived |
