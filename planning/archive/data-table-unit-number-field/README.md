---
DATE: 2026-06-03
TIME: 19:15 EDT
STATUS: All five phases shipped on `codex/data-table-number-units`;
        durable contract folded into context docs. See STATUS.md.
AUTHOR: Claude (Opus 4.7)
SCOPE: Router for the DataTable Number with Units PRD.
RELATED:
  - PRD.md
  - STATUS.md
  - PLAN.md
  - ../ip-si-unit-switching/PRD.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/frontend-viewer-units.md
---

# DataTable Number With Units Planning

This folder holds the tracked planning packet for a user-authorable
DataTable Number-field extension that stores numeric SI values and
renders them in the active SI/IP display system when a complete unit
configuration is present.

Read order:

1. `STATUS.md`
2. `PRD.md`
3. `PLAN.md`
4. `phases/phase-01-contract-and-registry.md`
5. `phases/phase-02-field-config-ui.md`
6. `phases/phase-03-grid-behavior.md`
7. `phases/phase-04-fixed-catalog-fields.md`
8. `phases/phase-05-verification-docs.md`

All five phases have shipped. The durable contract has been folded
into `context/technical-requirements/data-table.md` ("Number with
Units" subsection, grid-surface specifics) and
`context/technical-requirements/frontend-viewer-units.md` §11.5.5
(registry, payload, mode, migration hook). Use the context docs as
the canonical reference; this folder is the historical record of how
the contract was reached, with one named deferred follow-up (Materials
catalog migration). See `STATUS.md` for the closeout summary.
