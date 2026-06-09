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

## Status

**Planning complete; awaiting Ed PRD sign-off.** All directional
decisions are resolved; the PRD is drafted with a six-phase outline.
No implementation code yet. See `STATUS.md` for the current ledger.

## Read order

1. `research.md` — AirTable findings, observed shape, key insights
2. `decisions.md` — 13 numbered resolutions (all closed 2026-06-09)
3. `PRD.md` — V2 data shape, UI, REST, MCP, and phasing contract
4. `STATUS.md` — current state, next step, verification ledger
5. `phases/phase-00-backend-foundation.md` — backend foundation slice
   (Phases 1–5 stubs land after Phase 0 completes)

## Open discussion (see `research.md` for full context)

- Is HP-Equipment a project-scoped "type table" or a true shared
  Catalog (PH-Materials-style)?
- Single combined HPs sub-tab, or split into "HP Systems" +
  "HP Indoor Units" sub-tabs?
- How do we express the ERV-integrated indoor unit case without
  duplicating data between the HPs and ERVs sub-tabs?
- Do we model the HP as one entity ("a heat-pump system") with
  child arrays, or as two flat tables linked by FK?
