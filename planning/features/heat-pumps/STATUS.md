---
DATE: 2026-06-09
TIME: 17:00
STATUS: ✅ Active — Phase 4 merged (commit `16bdefe`, 2026-06-09).
        Scope amended 2026-06-09: AC #6 modal badge and AC #8
        pre-delete dialog descoped to Q-HP-FOLLOWUP-7 (Ventilators
        has no row-detail modal). Next: Phase 5 (Phius export + MCP).
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

**Phase 2 merged (commit `2dd9807`, 2026-06-09).** Phases 0–2 are all
on `main`. Phase 3 (HP Units — Outdoor + Indoor pages) is now in
progress. Backend already provides every endpoint Phase 3 needs:
the `outdoor-units` / `indoor-units` patch routes, referential-
integrity 409 blocks for `outdoor-equip` / `indoor-equip` deletes,
cascade-null preview via `?dry-run=true` for `outdoor-units`
delete, and `_apply_delete_cascades` to null `outdoor_unit_id`
on confirm. No backend scope amendment is needed for Phase 3.

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

**Next step: implement Phase 3 frontend.**

| Artifact | State |
|---|---|
| Research notes | ✅ `research.md` |
| Decisions log | ✅ `decisions.md` (all 13 numbered decisions resolved) |
| PRD | ✅ `PRD.md` (approved 2026-06-09) |
| Phase plans | ✅ phases 00–05 all drafted |
| GLOSSARY graduation | ✅ 6 terms + Relationships entry added |
| User-story stubs | ✅ US-EQ-7..11 + US-EQ-4 amendment + US-EQ-1 sub-tab list updated |
| Other context graduation | ◻ `context/PRD.md` §6.2, `data-model.md`, `api.md`, `llm-mcp-schema.md` — runs during Phase 5 |
| Code | ✅ Phases 0–4 merged (commits `9da3726`, `1aeab68`, `e9cd6dd`, `2dd9807`, `399d4e6`, `16bdefe`) |

## Next step

Phase 4 merged in `16bdefe`; bookkeeping in `9337f62`; post-merge
simplify cleanup in `66a8f63`. Proceed to **Phase 5 (Phius export +
MCP)** per `phases/phase-05-phius-export-and-mcp.md` — the only
remaining open question is OPQ-3 (xlsx-paste payload format),
which is a Phase 5 implementation detail.

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
| 1 | `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`; `make frontend-dev-check`; Playwright / Node REPL browser smoke; `$ simplify`; `$ docs-pass`; `make format`; `make ci` | 2026-06-09 | Focused HP frontend tests 3 passed; fast frontend gate passed with 3 pre-existing Fast Refresh warnings and existing Vite chunk warning; browser smoke add/edit/delete passed against project `a2126d4b-e84c-4512-b22f-190de3b6a2da`; screenshots in `working/heat-pumps-phase-1-*.png`. `$ simplify` fixed HP shell leakage of legacy Pumps draft/error state. `$ docs-pass` updated `context/user-stories/30-tables-equipment.md` for Phase 1 status and the temporary HP option-id caveat. Full CI passed: backend 700 passed / 2 skipped; frontend 146 files / 1501 tests passed; production build passed |
| 2 | `pnpm exec vitest run src/features/equipment/heat-pumps` (3 files, 13 tests passed); `make frontend-dev-check`; browser empty-state screenshot at repo-root `heat-pumps-phase-2-empty-state.png`; `$ simplify` (no findings, no fixes); `$ docs-pass`; `make format`; `make ci` | 2026-06-09 | Browser in-app add/edit/delete smoke blocked by sticky "Recovered draft found" dialog on the Phase 1 seed project — pre-existing project-state condition, not a Phase 2 regression. Empty-state mount and nested-tab navigation verified via Playwright MCP. `$ simplify` confirmed clean diff (no correctness or cleanup findings). `$ docs-pass` graduated US-EQ-9 status to "Phase 2 implemented" and recorded the `install_type` seed-list datalist approach + Phase 1 option-id caveat carry-over. Full CI green: backend 700 passed / 2 skipped; frontend 148 files / 1511 tests passed; production build passed. Phase 2 merged in commit `2dd9807`. |
| 3 | `pnpm exec vitest run src/features/equipment/heat-pumps` (7 files, 28 tests passed); `pnpm exec eslint src/features/equipment/heat-pumps` clean; `pnpm exec tsc --noEmit` clean; `$ simplify` (3 findings applied: leafFromPath split index, CascadeReference type dedup, stale-slice cache-read in confirmDelete; 2 follow-ups noted); `$ docs-pass` (US-EQ-10 + US-EQ-11 graduated to "Phase 3 implemented" + option-id carry-over recorded) | 2026-06-09 | Phase 3 ships HP Units — Outdoor and Indoor pages, two-step cascade-null preview dialog (dry-run → confirm via fresh slice from query cache), tag-uniqueness helper (auto-suffix on add / reject on rename), and Phase-4 disabled stubs for `linked_erv_unit_id` + `served_room_ids` in the indoor modal. Backend is unchanged — Phase 0 service already supports `?dry-run=true` and cascade-null. New files: 4 components, 2 column files, 1 dialog, 4 test files; modified: `lib.ts`, `api.ts`, `types.ts`, `HeatPumpsPanel.tsx`, `HeatPumpsPanel.test.tsx`. |
| 4 | `cd backend && uv run pytest tests/features/heat_pumps/test_cross_table_cascades.py` (7 passed after simplify pass); `pnpm exec vitest run src/features/equipment` (26 files, 160 tests passed); `pnpm exec tsc --noEmit` clean; `$ simplify` ×2: pre-merge pass applied 4 findings (functional `setDraft` updater in `toggleRoom`, em-dash for loading state on count column, reused `prior_row_ids` in `apply_rooms_replace`, undefined-vs-empty count map in `VentilatorsTableSlot`); post-merge pass applied 5 more (loading-aware accessor on the count column to match the em-dash render, `dict.fromkeys` dedupe in the rooms cascade + 3 new tests covering multi-row deletes and dedupe, memoized `selectedRoomIds`, documented mount-time-capture semantics of `defaultHiddenColumns`); `$ docs-pass` ×2 (US-EQ-4 amendment + US-EQ-11 graduated to "Phase 4 implemented" with AC-AMEND-3 marked descoped to Q-HP-FOLLOWUP-7; second pass updated this ledger row + Next step). Two architectural edges noted but deferred: cross-tab stale-snapshot race on `linked_erv_unit_id`, access-mode cache split on `useHeatPumpsQuery`. | 2026-06-09 | Phase 4 ships the `linked_erv_unit_id` single-select picker and `served_room_ids` multi-select picker on the HP indoor unit modal (both always rendered per D-HP-23; helper text when ventilators/rooms are empty), and the default-hidden `Linked HP indoor` count column on the Ventilators DataTable. Backend gets two new silent cascades: `apply_ventilators_replace` nulls `linked_erv_unit_id` on every referencing HP indoor row when a ventilator is removed; `apply_rooms_replace` filters `served_room_ids[]` when a room is removed (also dedupes via `dict.fromkeys` to scrub any latent duplicates upstream may have introduced — the field itself has no uniqueness constraint and the document validator only checks per-element existence). Phase 4 scope amended 2026-06-09 — AC #6 modal badge + AC #8 pre-delete dialog descoped to Q-HP-FOLLOWUP-7 (Ventilators uses inline DataTable editing; no row-detail modal to host them). Generic improvement: `useSliceTableController` learned a `defaultHiddenColumns?: string[]` arg, applied only when no saved view exists. Merged in `16bdefe` (Phase 4 cohort) + `9337f62` (commit-hash bookkeeping) + `66a8f63` (post-merge simplify cleanup). New files: `backend/tests/features/heat_pumps/test_cross_table_cascades.py`; modified: `backend/features/project_document/tables/{ventilators,rooms}.py`, `frontend/src/features/equipment/{components/{VentilatorsTable,VentilatorsTableSlot}.tsx, routes/EquipmentPageBody.tsx, equipment.css, heat-pumps/{components/{IndoorUnitsTable,IndoorUnitRowModal}.tsx, lib.ts}}`, `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`, two test files. |
| 5 | — | — | — |

## Phase plans inventory

| Phase | File | Status |
|---|---|---|
| 0 | `phases/phase-00-backend-foundation.md` | ✅ merged |
| 1 | `phases/phase-01-equipment-outdoor-page.md` | ✅ merged |
| 2 | `phases/phase-02-equipment-indoor-page.md` | ✅ complete locally; ready for review / commit |
| 3 | `phases/phase-03-unit-pages.md` | ✅ merged (commit `399d4e6`) |
| 4 | `phases/phase-04-erv-and-rooms-cross-link.md` | ✅ merged (commit `16bdefe`; scope amended 2026-06-09 — Option B) |
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
- **Q-HP-FOLLOWUP-7** (post-v1, added 2026-06-09 during Phase 4
  scope amendment): "Linked from HP indoor" deep-link badge on the
  Ventilators row. Deferred because Ventilators uses inline DataTable
  editing — no row-detail modal exists to host the badge. Revisit
  when / if Ventilators grows a row-detail modal pattern.
