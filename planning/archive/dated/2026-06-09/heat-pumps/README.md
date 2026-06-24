---
DATE: 2026-06-09
TIME: 19:30
STATUS: Complete — Phases 0–4 + Phase 5A all merged (final commit
        `79e11b3`, 2026-06-09). Phase 5B (MCP tools) and Phase 5C
        (Playwright e2e + PRD §11 cross-doc graduation) deferred to
        Q-HP-FOLLOWUP-8/9/10. Folder archived to
        `planning/archive/heat-pumps/`.
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

**Feature shipped 2026-06-09 across seven commits.** Phases 0–4
(commits `9da3726`, `1aeab68`, `e9cd6dd`, `2dd9807`, `399d4e6`,
`16bdefe`) plus Phase 5A Phius CSV export (commit `79e11b3`)
deliver all five user-visible PRD §2.1 goals. Phase 4 scope was
amended on 2026-06-09: AC #6 modal badge and AC #8 pre-delete
dialog descoped to Q-HP-FOLLOWUP-7 (Ventilators uses inline
DataTable editing — no row-detail modal to host them).

**Phase 5 split into three slices.** 5A (Phius CSV export
end-to-end) merged in `79e11b3`. **5B (MCP) and 5C (Playwright
e2e + PRD §11 cross-doc graduation) deferred to
Q-HP-FOLLOWUP-8/9/10** rather than blocking the shipped feature.

25 numbered D-HP decisions fully specify the v1 surface. See
`STATUS.md` for the per-phase verification ledger and the deferred
follow-up list; `phases/phase-04-erv-and-rooms-cross-link.md` for
the Phase 4 scope amendment details.

## Read order

1. `research.md` — AirTable findings, observed shape, key insights
2. `decisions.md` — 13 numbered resolutions (all closed 2026-06-09)
3. `PRD.md` — V2 data shape, UI, REST, MCP, and phasing contract
4. `STATUS.md` — current state, next step, verification ledger
5. `phases/phase-00-backend-foundation.md` …
   `phases/phase-04-erv-and-rooms-cross-link.md` — implemented and
   merged. `phases/phase-05-phius-export-and-mcp.md` split into
   5A/5B/5C — 5A merged in `79e11b3`; 5B + 5C deferred at archival
   to Q-HP-FOLLOWUP-8/9/10.

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

**OPQ-3** (Phase 5 xlsx-paste payload format) was deferred at
archival; the CSV form is the v1.0 commit. Phase 5A returns 501 on
`?format=xlsx-paste`.
