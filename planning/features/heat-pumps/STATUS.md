---
DATE: 2026-06-09
TIME: 15:10
STATUS: Active — planning + planning-context graduation complete;
        ready for Phase 0 implementation
AUTHOR: Ed May (with Claude)
SCOPE: Current state, next step, blockers, verification evidence
RELATED:
  - planning/features/heat-pumps/README.md
  - planning/features/heat-pumps/PRD.md
  - planning/features/heat-pumps/decisions.md
  - planning/features/heat-pumps/research.md
  - planning/features/heat-pumps/phases/
---

# Heat Pumps — Status

## Current state

**Planning + planning-context graduation complete.** PRD is
approved (Ed sign-off 2026-06-09). Vocabulary has graduated into
`context/GLOSSARY.md`; user-story stubs US-EQ-7..11 and the US-EQ-4
amendment have landed in `context/user-stories/30-tables-equipment.md`.
All six phase plans are written. Next step is Phase 0 backend
implementation.

| Artifact | State |
|---|---|
| Research notes | ✅ `research.md` |
| Decisions log | ✅ `decisions.md` (all 13 numbered decisions resolved) |
| PRD | ✅ `PRD.md` (approved 2026-06-09) |
| Phase plans | ✅ phases 00–05 all drafted |
| GLOSSARY graduation | ✅ 6 terms + Relationships entry added |
| User-story stubs | ✅ US-EQ-7..11 + US-EQ-4 amendment + US-EQ-1 sub-tab list updated |
| Other context graduation | ◻ `context/PRD.md` §6.2, `data-model.md`, `api.md`, `llm-mcp-schema.md` — runs during Phase 5 |
| Code | ◻ not started |

## Next step

1. Begin Phase 0 implementation per
   `phases/phase-00-backend-foundation.md`.
2. Open a feature branch off main; land Phase 0 in one PR per the
   phase acceptance criteria.
3. After Phase 0 merges, proceed to Phase 1 with the OPQ-1
   conditional-column-visibility decision pinned in this STATUS.md
   ledger.

## Blockers

None outstanding.

## Verification (running ledger — fills in per phase)

| Phase | Verified by | Date | Notes |
|---|---|---|---|
| 0 | — | — | — |
| 1 | — | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |

## Phase plans inventory

| Phase | File | Status |
|---|---|---|
| 0 | `phases/phase-00-backend-foundation.md` | ✅ drafted |
| 1 | `phases/phase-01-equipment-outdoor-page.md` | ✅ drafted |
| 2 | `phases/phase-02-equipment-indoor-page.md` | ✅ drafted |
| 3 | `phases/phase-03-unit-pages.md` | ✅ drafted |
| 4 | `phases/phase-04-erv-and-rooms-cross-link.md` | ✅ drafted |
| 5 | `phases/phase-05-phius-export-and-mcp.md` | ✅ drafted |

## Open questions queue

The following questions are flagged in the PRD/decisions for the
phase author to resolve when they reach the relevant phase. None
are blocking the planning sign-off.

- **OPQ-1** (Phase 1): conditional column visibility — per-row
  discriminator-based vs always-visible-empty-cells.
- **OPQ-2** (Phase 1): exact shadcn `Tabs` variant for the nested
  Heat Pumps sub-tab strip.
- **OPQ-3** (Phase 5): xlsx-paste payload format details.
- **OPQ-4** (Phase 4): hidden vs disabled for the
  "Linked ERV unit" field on non-integrated install types.
- **Q-HP-FOLLOWUP-3** (post-v1): direction of the room ↔ HP-indoor
  link — HP-side (current) vs Room-side (mirrors ERV).
