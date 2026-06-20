---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implementation plan
RELATED: planning/archive/data-table-field-config-modal/PRD.md
---

# Plan

## Phase Map

1. `phases/phase-01-field-type-select.md`
   - Add the shared field-type dropdown component.
   - Replace type-pill selection logic in Add/Edit modal flows without
     changing modal layout yet.
   - Keep field-type conversion locking and draft reset behavior intact.

2. `phases/phase-02-modal-markup-css.md`
   - Remove visible modal title and uppercase top labels.
   - Retire the old add-field label/pill classes.
   - Restyle type-specific labels and the type-change preflight card in
     shared DATA-TABLE CSS.

3. `phases/phase-03-tests-static-guards.md`
   - Update shared unit tests from radio/pill assumptions to combobox/select
     behavior.
   - Add static checks for retired class names and route-level modal forks.

4. `phases/phase-04-browser-closeout.md`
   - Run focused tests, `make frontend-dev-check`, and a live DATA-TABLE
     smoke on a representative route.
   - Capture final verification and any follow-up decisions.

## Sequencing Rationale

Phase 01 separates behavior from styling. The dropdown can be tested while
the rest of the modal still looks mostly unchanged, which narrows failures
to type selection and conversion policy.

Phase 02 then changes visual hierarchy and CSS class ownership. This is
where the Airtable-parity cleanup lands, but only after the shared type
control is already stable.

Phase 03 keeps the regression suite focused on shared DATA-TABLE tests.
Feature-local tests should only change if they assert shared modal internals.

Phase 04 verifies the actual parent-level rollout: a page consumer opens
the shared modal and inherits the new behavior without local work.

## Guardrail

Do not add route-level CSS or modal props that let individual DATA-TABLE
consumers opt out of the shared UI. If a consumer exposes a bug, fix the
shared modal or shared `DataTable` integration.
