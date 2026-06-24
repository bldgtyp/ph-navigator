---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Active — planning complete; blocked on aperture WIP + sibling Phase 3 before code.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: State, blockers, sequencing for the table-write-architecture unification.
RELATED: ./README.md, ./PRD.md, planning/refactor/backend-data-architecture-cleanup/
---

# STATUS

## Current state
Planning docs written. No code changed. Promoted from
`backend-data-architecture-cleanup` Phase 4 (D5, Ed 2026-06-24).

## Phase ledger
| Phase | State | Blocker |
|---|---|---|
| 1 — backend write spine | `Blocked` | aperture v12 WIP; sibling Phase 3 (single validator + size guard) |
| 2 — heat-pumps onto registry (backend) | `Blocked` | Phase 1 here |
| 3 — frontend heat-pumps rewire | `Blocked` | Phase 2 here |

## Next step
Hold until: (a) the aperture/glazing-frame v12 WIP lands on main, and (b) the
sibling refactor's Phase 3 (document schema cleanup) is done. Then start Phase 1
(extract the shared spine).

## Blockers
- **Aperture/glazing-frame v12 WIP** (in-flight; owns the aperture-command path
  + registries this refactor extracts from). See [[feedback_concurrent_committer]].
- **Sibling Phase 3** installs the single current-schema validator + body-size
  guard on the current write boundaries; Phase 1 here re-homes that guard onto
  the shared spine, so it should follow.

## Verification posture
Each phase ends green (`make ci` backend + frontend). The cross-stack cut keeps
the old heat-pumps endpoint alive through Phase 2 and removes it only after the
Phase 3 frontend rewire, so the app is never broken mid-flight. Heat-pumps
cascade/preview acceptance tests are ported **before** the bespoke service is
deleted.
