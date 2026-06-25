---
DATE: 2026-06-24
TIME: 20:44 EDT
STATUS: Active - redesign reviewed; implementation not started
AUTHOR: Codex
SCOPE: Current state, next step, blockers, and verification for DataTable UI.
RELATED:
  - planning/features/data-table-ui/README.md
  - planning/features/data-table-ui/PRD.md
  - planning/features/data-table-ui/PLAN.md
---

# DataTable UI - Status

## Current state

Planning packet created from Ed's requested DataTable rendering tweaks,
then updated after reviewing the DESIGN-agent mockup under
`planning/features/data-table-ui/table-redesign/`.

No implementation has started.

Captured requests:

- right-align all numeric DataTable cells;
- investigate and fix Number decimal precision behavior;
- shrink the header description `"?"` marker;
- move unit labels under field names using a deliberate double-height
  header mechanism;
- improve status chips with better typography, colors, and possibly
  check/X icons;
- evaluate solid-fill white-text chip styling;
- run a restrained frontend-design pass over table padding, fonts,
  colors, and sizing.

## Next step

Start Phase 00 by capturing the route matrix and baseline screenshots,
then Phase 01 by writing/updating focused shared DataTable tests that
reproduce the decimal precision issue and cover numeric right alignment.

## Blockers

None.

Open decisions:

- Whether global search is in scope for this redesign or deferred.
- Whether single-select prefix hiding needs a new explicit display rule.
- Whether solid chips apply globally or only to status-like semantic
  states.

## Verification so far

Docs-only planning capture. No code or runtime checks have been run for
this feature.
