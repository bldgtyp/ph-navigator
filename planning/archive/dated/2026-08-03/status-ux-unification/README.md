DATE: 2026-08-03
TIME: 12:53 EDT
STATUS: Complete — archived
AUTHOR: Claude with Ed May
SCOPE: Unify the fragmented "status" UX — one vocabulary, one control, one
  taxonomy, URL-addressable Documentation filters, and a restructured
  Status→Overview tab whose record pane becomes three-axis progress meters
  that deep-link into Documentation.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - ./research.md
  - ../../../../refactor/spec-status-value-unification/README.md
  - ../../../../../context/ui/pages/overview-tab.md
  - ../../../../../context/ui/pages/documentation-tab.md
  - ../../../../../context/UI_UX.md
  - ../../../../../context/GLOSSARY.md
---

# Status UX unification

Planning router for the cross-cutting cleanup of every "status" surface:
the Status tab, the Documentation tab, DataTable `Specification Status`
columns, and the Envelope Materials / Aperture Glazings / Frames report
panels.

## Problem

The data model already carries the right three independent axes per record
(Spec, Datasheet, Site Photos), but the UI presents them through **five
different controls**, **two different column headers**, **four phrasings of
"not done"**, **two conflicting section taxonomies**, and a derived
"Resolved" rollup that is never explained. The Status tab's record pane is a
one-axis, read-only subset of the Documentation page, which is why having
both feels redundant. `context/GLOSSARY.md` §"Status" already flags the
ambiguity. Full inventory with file/line references: `research.md`.

## Outcome

- One vocabulary module defines every axis label, value label, tooltip, and
  rollup phrase; every surface renders from it.
- One editor control (`StatusSelect`) and one viewer pill (`StatusPill`)
  everywhere; the DataTable pill joins the same token family.
- Documentation filters become URL-addressable (`?needs=spec,datasheet,photo`)
  and compose with the existing `#anchor` deep links.
- The Status tab is renamed **Overview** (slug `overview`, legacy redirect)
  and its record pane is replaced by per-section three-axis progress meters
  that deep-link into the Documentation page. Record-level lists and editing
  live in Documentation only.
- `status_summary.py` (the near-twin of `documentation_summary.py`) is
  retired; the Overview meters consume a counts-only rollup of the
  documentation summary.

## Read in this order

1. `PRD.md` — vocabulary contract, exact strings, surface-by-surface behavior.
2. `decisions.md` — accepted decisions (D-1…D-10) from the 2026-08-03 review.
3. `research.md` — as-is inventory (backend + frontend, with line refs).
4. `PLAN.md` — phase map with verification gates.
5. `STATUS.md` — current state and next action.

## Phase map

| Phase | Title | Ships independently? |
| --- | --- | --- |
| 01 | Vocabulary, labels, tooltips, legend | Yes — lowest risk, pure rename/copy |
| 02 | One control: StatusSelect/StatusPill everywhere + CSS token consolidation | Yes |
| 03 | Documentation URL-addressable filters (`?needs=`) | Yes |
| 04 | Overview tab: rename, rollup endpoint, meters pane, deep links | Yes (depends on 03) |
| 05 | Retire `status_summary.py`, dedupe helpers, context-docs sync | Yes (depends on 04) |

Phase files are authored under `phases/` when a phase is picked up;
`PLAN.md` carries enough detail to start each one.

## Constraints inherited from prior work

- `planning/refactor/spec-status-value-unification/` (shipped 2026-07-19): the stored
  DataTable option-id family (`opt_status_needed` etc.) must remain
  untouched (its D-2); the Honeybee `needed ↔ MISSING` adapters are
  permanent; its Phase 07 cached-client adapter retirement may still be
  pending — coordinate, don't collide.
- That packet explicitly deferred status-pill CSS consolidation and the
  `--report-status-missing` alias retirement; Phase 02 here is their new home.
- No stored document values change anywhere in this packet. Labels,
  controls, routes, and projections only.
