---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: PHASED IMPLEMENTATION PLAN
AUTHOR: Codex
SCOPE: Implementation sequence for confirmed DataTable Number with
       Units PRD.
RELATED:
  - PRD.md
  - STATUS.md
  - phases/phase-01-contract-and-registry.md
  - phases/phase-02-field-config-ui.md
  - phases/phase-03-grid-behavior.md
  - phases/phase-04-fixed-catalog-fields.md
  - phases/phase-05-verification-docs.md
---

# DataTable Number With Units Implementation Plan

## Implementation Order

1. **Contract and registry.** Add shared typed config contracts,
   backend validation, frontend field-def plumbing, and a closed unit
   registry for the MVP unit roster.
2. **Field config UI.** Extend the Number field dialog with Add/Remove
   units, editable vs fixed handling, separate SI/IP precision, and
   schema-mutation validation.
3. **Grid behavior.** Render header-only units, bare converted numbers,
   unit-aware edit/paste/fill/filter/aggregation behavior, and filter
   invalidation on unit-config changes.
4. **Fixed catalog fields.** Apply fixed feature-owned unit config to
   catalog/domain physical fields, starting with Material density and
   conductivity.
5. **Verification and docs.** Run focused and full gates, browser smoke
   tests, and fold any accepted decisions back into stable docs.

## Non-Negotiable Contracts

- Backend, API, MCP, downloads, and calculations remain SI canonical.
- Plain Number fields without `config.units` behave exactly as today.
- `config.units` must be complete or absent.
- `config.units.mode === "fixed"` is not user-editable.
- Same-system unit changes never rewrite or rescale existing cells.
- Cell display/copy/paste uses bare numbers; unit labels live in the
  field header only.
- Changing unit config invalidates filters for that field and preserves
  unrelated view state.

## Mandatory Closeout

Every code-changing implementation session must finish with:

```bash
make format
make ci
```

If `make format` changes files, inspect the diff and rerun `make ci`.
Do not report the feature complete while `make ci` is red.
