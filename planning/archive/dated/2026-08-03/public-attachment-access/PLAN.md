---
DATE: 2026-08-03
TIME: 11:24 EDT
STATUS: Complete — phases 00-06 implemented and verified locally
AUTHOR: Claude with Ed May
SCOPE: Phase map, sequencing rationale, and bundling for public attachment
  access.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./research.md
  - ./STATUS.md
  - ./phases/
---

# Plan — Public attachment access

## Phase map

| Phase | Title | Kind | Depends on |
| --- | --- | --- | --- |
| [00](./phases/phase-00-production-inventory.md) | Production inventory | investigation, read-only | — |
| [01](./phases/phase-01-row-walker.md) | Fix the row walker | backend | 00 |
| [02](./phases/phase-02-register-pdf-report.md) | Register `pdf_report_asset_ids` | backend | 00, 01 |
| [03](./phases/phase-03-reachability-guard.md) | Reachability guard tests | backend tests | 01, 02 |
| [04](./phases/phase-04-download-error-ux.md) | Downloads never show a raw error | frontend + backend | — |
| [05](./phases/phase-05-unavailable-state.md) | Explicit unavailable state | frontend | — |
| [06](./phases/phase-06-closeout.md) | Docs, context updates, closeout | docs | all |

## Bundling

- **Backend bundle: 00 → 01 → 02 → 03, one branch, landing together.** Splitting
  01 from 03 would ship a fix with no regression guard; splitting 01 from 02
  would leave the originally reported column still broken. Keep them as
  separate *commits* inside one PR so the production preflight findings stay
  traceable to the change they justified.
- **04 and 05 are independent** of the backend bundle and of each other. They
  can share a second branch or ship separately. Neither blocks the certifier
  link.
- **06 runs last**, after the code is green.

## Sequencing rationale

**Why 00 precedes any code.** Phase 01 switches on write-time validation for
Thermal Bridges and Heat Pump references that have never been validated
(PRD §6). If production holds a reference that fails the newly-enabled checks,
the first save after deploy 422s on the whole table. The inventory is read-only
and cheap; running it after the fix means discovering the problem as a
production write failure instead of as a list.

**Why 01 precedes 02.** Registering `pdf_report_asset_ids` while the walker
still returns zero rows for `thermal_bridges` changes nothing observable — the
column would remain broken and the phase would appear to fail. Fix reachability
first, then the registry entry has an effect you can actually verify.

**Why 03 exists as its own phase.** The current test suite asserts that every
table key has a registry entry but never that the walker can reach it
(research.md §4). Registration was tested; reachability was not. That is
precisely the shape of the bug, so the guard is the deliverable, not a
formality.

**Why 04 is not folded into 05.** They fix different failures. 04 is about an
error that escapes the app entirely; 05 is about an error the app never
mentions. Fixing only one still leaves a bad experience.

## What "done" means for the reported bug

The certifier link works after **01 + 02**. If Ed needs to send it before the
rest is ready, that is the minimum viable set — and it is the smaller, more
contained half of the work. 04 and 05 improve every failure mode but are not
required for the PDFs to open.

## Risk register

| Risk | Phase | Mitigation |
| --- | --- | --- |
| Stored references fail newly-enabled validation → 422 on save | 01 | Phase 00 inventory first; remediate or relax before shipping |
| Assets already swept to the orphan prefix | 00 | Inventory checks `orphaned_status`; objects are recoverable from the orphan prefix, not deleted outright |
| FieldDef refactor in 02 changes the built-in seed fingerprint | 02 | Assert the produced `TableFieldDef` is byte-identical before/after |
| Widening the walker accidentally widens the anonymous gate | 01, 03 | Explicit negative test: an asset referenced by nothing stays 404/403 for anonymous |
| Frontend error-mapping churn touches four call sites | 04 | One shared helper; convert call sites to it rather than duplicating logic |

## Verification

Per-phase gates live in each phase file. The packet-level gates are in
[STATUS.md](./STATUS.md). Closeout discipline (`simplify` skill → `docs-pass`
skill → `make format` → `make ci`) is in
[phase-06](./phases/phase-06-closeout.md), per the repo `CLAUDE.md` closeout
gate.

Deploying is Ed's call, never an agent's.
