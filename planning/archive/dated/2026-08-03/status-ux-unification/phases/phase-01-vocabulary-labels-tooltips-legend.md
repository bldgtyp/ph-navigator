---
DATE: 2026-08-03
STATUS: Complete
AUTHOR: Codex with Ed May
SCOPE: Canonicalize the three status-axis labels, explanatory copy, and
  rollup language without changing persisted values or schema version.
RELATED:
  - ../PLAN.md
  - ../PRD.md
  - ../decisions.md
---

# Phase 01 — Vocabulary, labels, tooltips, legend

## Outcome

One frontend vocabulary contract now owns the Spec. Status, Datasheet, and
Site Photos labels, exact tooltips, filter labels, legend copy, evidence
options, and `need attention` / `resolved` rollup phrases. Documentation,
report panels, DataTables, and interim Status-tab reporting consume that
contract. Roadmap actions use milestone language.

The persisted `Specification Status` FieldDef display name and legacy
description remain unchanged; the frontend render overlay supplies
`Spec. Status` and its exact tooltip (O-1 in `decisions.md`). A trial backend
description change correctly failed the schema fingerprint and fixture-drift
gates, so it was reverted to preserve the accepted no-schema-change invariant.

## Verification evidence

- Focused Vitest: 9 files, 212 tests passed.
- Frontend production build passed.
- Browser smoke on the isolated `AGENT-BROWSER` fixture verified:
  - Documentation meters and chips use the three canonical axes;
  - the Ventilators DataTable renders `Spec. Status`, `Datasheet`, and
    `Site Photos` headers;
  - the Status report pane renders `0 of 0 resolved` and
    `0 need attention`.
- Simplify review reconciled shared-tooltip reuse, typed evidence-axis field
  construction, canonical legend labels, and import placement; efficiency was
  clean.
- Docs pass kept durable findings in this packet; no context document changed.
- Full CI passed: backend 1,830 passed / 7 skipped; frontend 2,390 passed;
  production build and static gates green.

## Invariants

- Persisted status values and option ids are unchanged.
- Project-document schema version is unchanged.
- Evidence axes remain Complete / Needed / N/A; only Spec. Status includes
  Question.
