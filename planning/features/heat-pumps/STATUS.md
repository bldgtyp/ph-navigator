---
DATE: 2026-06-09
TIME: 18:00
STATUS: Active — Phase 0 backend implementation complete locally;
        full closeout gate green. Ready for review / commit.
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

**Phase 0 backend implementation started (2026-06-09 evening).**
Backend feature module, project-document defaults, active-version REST
routes, draft-buffer writes, focused pytest coverage, and core
referential rules now exist locally. `$ simplify`, `$ docs-pass`,
`make format`, and `make ci` all ran green. Phase 0 is complete
locally and ready for review / commit; not yet marked merged.

**Planning round 2 tidy-up complete (2026-06-09 evening).** PRD,
decisions, and phase plans hardened against an end-to-end review:
seven new numbered decisions (D-HP-14..20) close internal
contradictions and promote unresolved research questions; five new
architectural open questions (OPQ-5..9) are flagged as blockers
needing Ed input before Phase 0 starts. Vocabulary, user-story
stubs, and the US-EQ-4 amendment landed earlier in
`context/GLOSSARY.md` and `context/user-stories/30-tables-equipment.md`.

**Round-2 changes in summary:**

- A1 → D-HP-20: column visibility is always-visible, no per-row shim.
- A2 → D-HP-17: heating/cooling data-type fields are hard enums, not
  user-renamable single-selects.
- A3 → D-HP-14/15/16: refrigerant ships in v1, per-instance datasheet
  ships in v1, sub-tab ordering is between ERVs and Pumps.
- B2 → D-HP-18: VRF Phius-export drops brackets when paired is null.
- D2/F2 → D-HP-19: cascade-delete uses pre-delete confirmation
  dialog with preview, not post-delete toast.
- C1 → PRD §2.2 + Q-HP-FOLLOWUP-4: AirTable / bulk-paste import
  named explicitly as v1.1+.
- C5 → PRD §2.2: energy-model load-coverage validation deferred.
- **OPQ-5 → D-HP-21 (closed 2026-06-09): `shared_with` directive
  on single-select primitive; HP unit columns alias rooms columns;
  manufacturer deferred to Q-HP-FOLLOWUP-6.**
- **OPQ-6 → D-HP-22 (closed 2026-06-09): `paired_indoor_model`
  field renamed `paired_indoor_equip_id` and re-typed to a strict
  FK; outdoor-first phase order preserved via Phase 1 inline-create
  shortcut.**
- **OPQ-7 → D-HP-23 (closed 2026-06-09): `linked_erv_unit_id`
  picker always rendered on every indoor unit modal; no install_type
  gate, no system-marker primitive in v1. Phase 2 and Phase 4
  simplified.**
- **OPQ-9 → D-HP-24 (closed 2026-06-09): `outdoor.mode_type`
  renamed to `outdoor.system_family` across all docs and phase
  plans. AirTable reference docs keep `MODE_TYPE`.**
- **OPQ-8 / OPQ-2 → D-HP-25 (closed 2026-06-09): nested-tab strip
  uses shadcn `Tabs` smaller variant (`size="sm"`); Phase 1
  captures a screenshot in its verification ledger for Ed
  eyeball-confirm before Phase 2 inherits the styling.**

**Next step is review / commit of the local Phase 0 implementation.**

| Artifact | State |
|---|---|
| Research notes | ✅ `research.md` |
| Decisions log | ✅ `decisions.md` (all 13 numbered decisions resolved) |
| PRD | ✅ `PRD.md` (approved 2026-06-09) |
| Phase plans | ✅ phases 00–05 all drafted |
| GLOSSARY graduation | ✅ 6 terms + Relationships entry added |
| User-story stubs | ✅ US-EQ-7..11 + US-EQ-4 amendment + US-EQ-1 sub-tab list updated |
| Other context graduation | ◻ `context/PRD.md` §6.2, `data-model.md`, `api.md`, `llm-mcp-schema.md` — runs during Phase 5 |
| Code | ✅ Phase 0 backend implementation complete locally; not yet merged |

## Next step

1. Review / commit Phase 0 backend foundation. Implemented locally:
   - Four HP arrays under `tables.equipment.heat_pumps`.
   - Active-version read endpoint and table PATCH endpoints.
   - Draft-buffer write path with ETag gating.
   - Pydantic row validation for hard enums, ULID IDs, required
     model/tag fields, and numeric ranges.
   - Server-side HP FK validation and delete preview/cascade rules for
     HP-owned relations.
   - Focused pytest slice: `cd backend && uv run pytest
     tests/features/heat_pumps -q` → 7 passed.
2. Then land Phase 0 in one PR per the phase acceptance criteria.
   Phase 0 includes:
   - Four HP tables (outdoor equip / indoor equip / outdoor units
     / indoor units) under `tables.equipment`.
   - Room-vocabulary reuse for HP unit fields
     (`outdoor_units.building_zone`, `indoor_units.floor_level`).
   - `?dry-run=true` delete contract for cascade-preview (D-HP-19).
   - FK validation on `paired_indoor_equip_id` (D-HP-22).
   - Hard-enum validation for `heating_data_type` / `cooling_data_type`
     (D-HP-17).
3. After Phase 0 merges, proceed to Phase 1 with all round-2
   pinned decisions inherited. Phase 1 ships the screenshot of
   the nested-tab strip for Ed eyeball-confirm per D-HP-25.

## Blockers

**None.** All architectural and phase-implementation OPQs resolved
2026-06-09:

| ID | Status |
|---|---|
| ~~OPQ-1~~ | **CLOSED via D-HP-20** — column visibility is always-visible (no per-row shim) |
| ~~OPQ-2~~ | **CLOSED via D-HP-25** — subsumed into OPQ-8's nested-tab resolution |
| OPQ-3 | Phase-detail (xlsx-paste format) — pin in Phase 5 |
| ~~OPQ-4~~ | **CLOSED in Phase 4** — `linked_erv_unit_id` hidden when non-integrated (now moot via D-HP-23) |
| ~~OPQ-5~~ | **CLOSED via D-HP-21** — `shared_with` directive on single-select primitive |
| ~~OPQ-6~~ | **CLOSED via D-HP-22** — strict FK `paired_indoor_equip_id`; outdoor-first phase order preserved via inline-create |
| ~~OPQ-7~~ | **CLOSED via D-HP-23** — `linked_erv_unit_id` picker always rendered; no gating, no marker primitive |
| ~~OPQ-8~~ | **CLOSED via D-HP-25** — nested tabs use shadcn `Tabs` smaller variant; Phase 1 ships a screenshot for Ed confirm |
| ~~OPQ-9~~ | **CLOSED via D-HP-24** — `outdoor.mode_type` renamed `outdoor.system_family` across all docs |

OPQ-3 (xlsx-paste payload format in Phase 5) is the only remaining
question and is a Phase 5 detail, not blocking any earlier phase.

## Verification (running ledger — fills in per phase)

| Phase | Verified by | Date | Notes |
|---|---|---|---|
| 0 | `cd backend && uv run pytest tests/features/heat_pumps -q`; targeted Ruff; `$ simplify`; `$ docs-pass`; `make format`; `make ci` | 2026-06-09 | Focused HP tests 7 passed; full CI passed: backend 700 passed / 2 skipped, frontend 145 files / 1498 tests passed, production build passed |
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

Live phase-author-scope questions (none blocking the planning sign-off):

- **OPQ-1** — ~~Conditional column visibility~~. **Closed** via
  D-HP-20: always-visible columns, no per-row shim.
- **OPQ-2** (Phase 1): exact shadcn `Tabs` variant for the nested
  Heat Pumps sub-tab strip. Now linked to **OPQ-8** (above) for the
  visual wireframe.
- **OPQ-3** (Phase 5): xlsx-paste payload format details.
- **OPQ-4** — ~~Hidden vs disabled for "Linked ERV unit"~~.
  **Closed** in Phase 4 acceptance criterion #2: hidden when
  `install_type` is not ERV-INTEGRATED.
- **Q-HP-FOLLOWUP-3** (post-v1): direction of the room ↔ HP-indoor
  link — HP-side (current) vs Room-side (mirrors ERV).
- **Q-HP-FOLLOWUP-4** (post-v1): bulk import (AirTable / CSV / xlsx
  paste) for the four HP tables.
- **Q-HP-FOLLOWUP-5** (post-v1): system-marked single-select options
  primitive (the OPQ-7 escalation path).
