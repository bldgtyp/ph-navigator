---
DATE: 2026-06-09
TIME: 12:00
STATUS: Active — research phase
AUTHOR: Ed (via Claude)
SCOPE: Heat-Pump equipment data model for PH-Navigator V2
RELATED:
  - context/user-stories/30-tables-equipment.md (US-Builder-Equipment; HPs currently absent from sub-tabs)
  - context/GLOSSARY.md (Equipment, ERV, Catalog)
  - context/PRD.md §6.2 / §7.0 (equipment tables; v1.1+ catalogs)
---

# Heat Pumps — Feature Folder

## Scope

Add Heat Pump support to the Equipment tab. Heat Pumps are richer than
the existing line-item equipment (Pumps, Fans, ERVs) because:

1. A single physical heat-pump system has **two paired sides**
   (outdoor condenser ↔ one or more indoor air-handlers/cassettes).
2. Performance numbers are AHRI-rated **per outdoor↔indoor pairing**,
   not per outdoor model in isolation.
3. Outdoor↔indoor cardinality is **1:N** (one outdoor serves many
   indoors) in mini-split / VRF topologies.
4. Some indoor units **integrate ERV functionality** (Mitsubishi LEV
   Kit + Lossnay LGH pattern) — meaning an HP indoor row needs a
   relationship to an ERV row.

**Planning round 2 tidy-up complete; all OPQs resolved
2026-06-09. Phase 0 ready to start.** 25 numbered D-HP decisions
fully specify the v1 surface. See `STATUS.md` Next step.

## Read order

1. `research.md` — AirTable findings, observed shape, key insights
2. `decisions.md` — 13 numbered resolutions (all closed 2026-06-09)
3. `PRD.md` — V2 data shape, UI, REST, MCP, and phasing contract
4. `STATUS.md` — current state, next step, verification ledger
5. `phases/phase-00-backend-foundation.md` — backend foundation slice
   (Phases 1–5 stubs land after Phase 0 completes)

## Resolved directional debates (archived in `decisions.md`)

All 25 D-HP decisions are now numbered and closed. Highlights:

- ✅ Catalog vs project-only → D-HP-1 (project-only in v1).
- ✅ Combined vs split sub-tabs → D-HP-3 (nested four-leaf).
- ✅ ERV-integrated unit modeling → D-HP-4 (two rows, one FK link).
- ✅ Entity vs flat-tables → D-HP-2 (four flat tables, EQUIP/UNIT
  split, indoor + outdoor symmetric).
- ✅ Cross-table option sharing → D-HP-21 (`shared_with` directive).
- ✅ Paired-indoor as FK → D-HP-22 (strict FK +
  inline-create shortcut preserves outdoor-first phase order).
- ✅ ERV picker gating → D-HP-23 (always-rendered; no gate).
- ✅ Field naming → D-HP-24 (`mode_type` → `system_family`).
- ✅ Nested-tab visual treatment → D-HP-25 (shadcn `Tabs` smaller
  variant).

The only live question is **OPQ-3** — Phase 5 xlsx-paste payload
format — which is a phase-implementation detail with no blocker
implications.
