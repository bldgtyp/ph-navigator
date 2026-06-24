---
DATE: 2026-06-09
TIME: 19:30
STATUS: ✅ Complete — Phases 0–4 merged + Phase 5A (Phius CSV export
        end-to-end) merged in `79e11b3` (2026-06-09). Phase 5B (MCP
        tools) and Phase 5C (Playwright e2e + PRD §11 cross-doc
        graduation) **deferred** as Q-HP-FOLLOWUP-8, Q-HP-FOLLOWUP-9,
        Q-HP-FOLLOWUP-10. Folder archived to `planning/archive/heat-pumps/`.
AUTHOR: Ed May (with Claude)
SCOPE: Final state, verification evidence, deferred work
RELATED:
  - planning/archive/heat-pumps/README.md
  - planning/archive/heat-pumps/PRD.md
  - planning/archive/heat-pumps/decisions.md
  - planning/archive/heat-pumps/research.md
  - planning/archive/heat-pumps/phases/
---

# Heat Pumps — Status

## Current state

**Heat Pumps feature shipped 2026-06-09.** Six commits across five
phases land the v1 surface in `main`:

| Phase | Commit | What landed |
|---|---|---|
| 0 | `9da3726` | Backend foundation: four Pydantic v2 row models, repository, service skeleton, REST endpoints, document validator. |
| 1 | `1aeab68` | HP Equipment — Outdoor DataTable + 20-field row-detail modal + inline indoor-equip create shortcut. |
| 2 | `e9cd6dd` | HP Equipment — Indoor DataTable. |
| 3 | `399d4e6` | HP Units — Outdoor + Indoor pages with cascade-null preview + tag-uniqueness. |
| 4 | `16bdefe` | ERV cross-link picker + Rooms multi-select picker + silent backend cascades on ventilator/room delete. |
| 5A | `79e11b3` | Phius Multiple HP Performance Estimator CSV export end-to-end: backend pure-transform module + POST endpoint + frontend pre-export dialog + menu wire-up. |

Five of six PRD §2.1 user goals are met as of 5A:

1. ✅ Outdoor equipment table — Phase 1
2. ✅ Indoor equipment table — Phase 2
3. ✅ Outdoor units (instances) — Phase 3
4. ✅ Indoor units (instances) — Phase 3
5. ✅ Integrated unit ↔ ERV cross-link — Phase 4
6. ✅ Phius Multiple HP Estimator export — Phase 5A
7. ✅ Viewer (read-only) URL — inherited from US-Builder-Tables criterion 13

## Deferred work (post-v1)

Three pieces of Phase 5 deferred at archival rather than blocking the
shipped feature:

- **Q-HP-FOLLOWUP-8 (Phase 5B — MCP tools).** `read_table`,
  `add_row`, `update_row`, `delete_row` for the four HP table keys
  (likely already covered transparently by the generic
  `tool_get_table` / `tool_replace_table` — needs verification) and
  a dedicated `export_phius_hp_estimator(project_id) → text/csv`
  tool wrapping the Phase 5A `compute_phius_payload` +
  `serialize_csv`. Schemas land in
  `context/technical-requirements/llm-mcp-schema.md`.
- **Q-HP-FOLLOWUP-9 (Phase 5C — Playwright e2e).** Full-lifecycle
  spec at `frontend/tests/e2e/heat-pumps.spec.ts` covering seed,
  add-row across all four tables, ERV link, Phius CSV export
  download, ERV-delete cascade, version lock.
- **Q-HP-FOLLOWUP-10 (Phase 5C — cross-doc graduation).** Fold the
  durable bits into the always-loaded context docs per PRD §11:
  `context/PRD.md` §6.2, `context/technical-requirements/data-model.md`,
  `context/technical-requirements/api.md` §9.X,
  `context/technical-requirements/llm-mcp-schema.md`.
- **OPQ-3 (xlsx-paste payload format).** Phase 5A returns 501 on
  `?format=xlsx-paste`. Revisit if and when the calc's paste-target
  validation actually rejects the CSV form.

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

| Artifact | State |
|---|---|
| Research notes | ✅ `research.md` (frozen) |
| Decisions log | ✅ `decisions.md` (25 numbered D-HP decisions all closed) |
| PRD | ✅ `PRD.md` (approved 2026-06-09; frozen) |
| Phase plans | ✅ phases 00–05 all drafted; 0–4 + 5A merged |
| GLOSSARY graduation | ✅ 6 terms + Relationships entry added |
| User-story stubs | ✅ US-EQ-7..11 + US-EQ-4 amendment + US-EQ-1 sub-tab list updated |
| Other context graduation | ⏭️ Deferred to Q-HP-FOLLOWUP-10 — `context/PRD.md` §6.2, `data-model.md`, `api.md`, `llm-mcp-schema.md` were intentionally not folded back during 5A archival |
| Code | ✅ All five user-visible PRD §2.1 goals shipped (commits `9da3726`, `1aeab68`, `e9cd6dd`, `2dd9807`, `399d4e6`, `16bdefe`, `79e11b3`) |

## Blockers

**None.** Feature shipped. All architectural and phase-implementation
OPQs resolved 2026-06-09:

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

OPQ-3 (xlsx-paste payload format) deferred at archival; the CSV form
is the v1.0 commit. Phase 5A returns 501 on `?format=xlsx-paste`.

## Verification (running ledger — fills in per phase)

| Phase | Verified by | Date | Notes |
|---|---|---|---|
| 0 | `cd backend && uv run pytest tests/features/heat_pumps -q`; targeted Ruff; `$ simplify`; `$ docs-pass`; `make format`; `make ci` | 2026-06-09 | Focused HP tests 7 passed; full CI passed: backend 700 passed / 2 skipped, frontend 145 files / 1498 tests passed, production build passed |
| 1 | `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`; `make frontend-dev-check`; Playwright / Node REPL browser smoke; `$ simplify`; `$ docs-pass`; `make format`; `make ci` | 2026-06-09 | Focused HP frontend tests 3 passed; fast frontend gate passed with 3 pre-existing Fast Refresh warnings and existing Vite chunk warning; browser smoke add/edit/delete passed against project `a2126d4b-e84c-4512-b22f-190de3b6a2da`; screenshots in `working/heat-pumps-phase-1-*.png`. `$ simplify` fixed HP shell leakage of legacy Pumps draft/error state. `$ docs-pass` updated `context/user-stories/30-tables-equipment.md` for Phase 1 status and the temporary HP option-id caveat. Full CI passed: backend 700 passed / 2 skipped; frontend 146 files / 1501 tests passed; production build passed |
| 2 | `pnpm exec vitest run src/features/equipment/heat-pumps` (3 files, 13 tests passed); `make frontend-dev-check`; browser empty-state screenshot at repo-root `heat-pumps-phase-2-empty-state.png`; `$ simplify` (no findings, no fixes); `$ docs-pass`; `make format`; `make ci` | 2026-06-09 | Browser in-app add/edit/delete smoke blocked by sticky "Recovered draft found" dialog on the Phase 1 seed project — pre-existing project-state condition, not a Phase 2 regression. Empty-state mount and nested-tab navigation verified via Playwright MCP. `$ simplify` confirmed clean diff (no correctness or cleanup findings). `$ docs-pass` graduated US-EQ-9 status to "Phase 2 implemented" and recorded the `install_type` seed-list datalist approach + Phase 1 option-id caveat carry-over. Full CI green: backend 700 passed / 2 skipped; frontend 148 files / 1511 tests passed; production build passed. Phase 2 merged in commit `2dd9807`. |
| 3 | `pnpm exec vitest run src/features/equipment/heat-pumps` (7 files, 28 tests passed); `pnpm exec eslint src/features/equipment/heat-pumps` clean; `pnpm exec tsc --noEmit` clean; `$ simplify` (3 findings applied: leafFromPath split index, CascadeReference type dedup, stale-slice cache-read in confirmDelete; 2 follow-ups noted); `$ docs-pass` (US-EQ-10 + US-EQ-11 graduated to "Phase 3 implemented" + option-id carry-over recorded) | 2026-06-09 | Phase 3 ships HP Units — Outdoor and Indoor pages, two-step cascade-null preview dialog (dry-run → confirm via fresh slice from query cache), tag-uniqueness helper (auto-suffix on add / reject on rename), and Phase-4 disabled stubs for `linked_erv_unit_id` + `served_room_ids` in the indoor modal. Backend is unchanged — Phase 0 service already supports `?dry-run=true` and cascade-null. New files: 4 components, 2 column files, 1 dialog, 4 test files; modified: `lib.ts`, `api.ts`, `types.ts`, `HeatPumpsPanel.tsx`, `HeatPumpsPanel.test.tsx`. |
| 4 | `cd backend && uv run pytest tests/features/heat_pumps/test_cross_table_cascades.py` (7 passed after simplify pass); `pnpm exec vitest run src/features/equipment` (26 files, 160 tests passed); `pnpm exec tsc --noEmit` clean; `$ simplify` ×2: pre-merge pass applied 4 findings (functional `setDraft` updater in `toggleRoom`, em-dash for loading state on count column, reused `prior_row_ids` in `apply_rooms_replace`, undefined-vs-empty count map in `VentilatorsTableSlot`); post-merge pass applied 5 more (loading-aware accessor on the count column to match the em-dash render, `dict.fromkeys` dedupe in the rooms cascade + 3 new tests covering multi-row deletes and dedupe, memoized `selectedRoomIds`, documented mount-time-capture semantics of `defaultHiddenColumns`); `$ docs-pass` ×2 (US-EQ-4 amendment + US-EQ-11 graduated to "Phase 4 implemented" with AC-AMEND-3 marked descoped to Q-HP-FOLLOWUP-7; second pass updated this ledger row + Next step). Two architectural edges noted but deferred: cross-tab stale-snapshot race on `linked_erv_unit_id`, access-mode cache split on `useHeatPumpsQuery`. | 2026-06-09 | Phase 4 ships the `linked_erv_unit_id` single-select picker and `served_room_ids` multi-select picker on the HP indoor unit modal (both always rendered per D-HP-23; helper text when ventilators/rooms are empty), and the default-hidden `Linked HP indoor` count column on the Ventilators DataTable. Backend gets two new silent cascades: `apply_ventilators_replace` nulls `linked_erv_unit_id` on every referencing HP indoor row when a ventilator is removed; `apply_rooms_replace` filters `served_room_ids[]` when a room is removed (also dedupes via `dict.fromkeys` to scrub any latent duplicates upstream may have introduced — the field itself has no uniqueness constraint and the document validator only checks per-element existence). Phase 4 scope amended 2026-06-09 — AC #6 modal badge + AC #8 pre-delete dialog descoped to Q-HP-FOLLOWUP-7 (Ventilators uses inline DataTable editing; no row-detail modal to host them). Generic improvement: `useSliceTableController` learned a `defaultHiddenColumns?: string[]` arg, applied only when no saved view exists. Merged in `16bdefe` (Phase 4 cohort) + `9337f62` (commit-hash bookkeeping) + `66a8f63` (post-merge simplify cleanup). New files: `backend/tests/features/heat_pumps/test_cross_table_cascades.py`; modified: `backend/features/project_document/tables/{ventilators,rooms}.py`, `frontend/src/features/equipment/{components/{VentilatorsTable,VentilatorsTableSlot}.tsx, routes/EquipmentPageBody.tsx, equipment.css, heat-pumps/{components/{IndoorUnitsTable,IndoorUnitRowModal}.tsx, lib.ts}}`, `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`, two test files. |
| 5A | `cd backend && uv run pytest tests/features/heat_pumps/test_phius_export.py` (17 passed: 14 pure-transform + 3 HTTP integration covering JSON / raw-csv / 501 xlsx-paste); `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/PhiusExportDialog.test.tsx` (8 passed: dialog states + filename builder); `pnpm exec tsc --noEmit` clean; `$ simplify` (1 finding applied: renamed `format` route param to `export_format` with `Query(alias="format")` to avoid Python builtin shadow; 4 findings skipped with reason); `$ docs-pass` (this row + STATUS Next step + Phase 5 plan header + README header + US-EQ-8 status all touched); `make ci` (backend 724p/2s; frontend 153f/1536t; production build clean). Merged in commit `79e11b3`. | 2026-06-09 | Phase 5A ships the Phius CSV export end-to-end. **Backend:** new `phius_export.py` pure-transform module (`compute_phius_payload` derives Qty from outdoor-unit instance count, emits per-row warnings per PRD §6.4 incl. zero-instance; `serialize_csv` writes CRLF-terminated CSV with column order per PRD §6.2; column-conditional cells per `heating_data_type` / `cooling_data_type`). New `POST /api/v1/projects/{id}/equipment/heat-pumps/export-phius` returns wrapped `{rows, warnings, csv}` JSON by default; `?format=raw-csv` returns `text/csv` bytes for curl / MCP consumers; `?format=xlsx-paste` returns 501 (OPQ-3 deferred). `read_slice` helper added to `service.py` to keep the export route thin. **Frontend:** new `PhiusExportDialog` opens on the Equipment — Outdoor `⋯` menu (replacing the Phase 1 stub), fetches once on mount, renders row count + warnings grouped by `model_number`; "Continue with gaps" / "Download CSV" downloads the embedded CSV via `shared/lib/downloadBlob`; filename built via new `lib/phius-export.ts` `buildPhiusExportFilename(btNumber)` → `phius-hp-estimator-{bt}-{YYYY-MM-DD}.csv`. Menu remains disabled with tooltip when the outdoor-equip table is empty per PRD §6.3. New files: `backend/features/heat_pumps/phius_export.py`, `backend/tests/features/heat_pumps/test_phius_export.py`, `frontend/src/features/equipment/heat-pumps/components/PhiusExportDialog.tsx`, `frontend/src/features/equipment/heat-pumps/lib/phius-export.ts`, `frontend/src/features/equipment/heat-pumps/__tests__/PhiusExportDialog.test.tsx`. Modified: `backend/features/heat_pumps/{routes,service}.py`, `frontend/src/features/equipment/heat-pumps/{api,types}.ts`, `frontend/src/features/equipment/heat-pumps/components/OutdoorEquipTable.tsx` (removed dead `status` banner state along with the Phase 1 stub), `frontend/src/features/equipment/heat-pumps/routes/HeatPumpsPanel.tsx` (threads `project.bt_number`), `frontend/src/features/equipment/equipment.css` (removed dead `.hp-status-banner`; added `.hp-phius-warning-list`). |
| 5B | — | deferred | **Deferred at archival as Q-HP-FOLLOWUP-8.** Pending: MCP `read/add/update/delete_row` for the four HP table keys (verify generic tool coverage first), plus dedicated `export_phius_hp_estimator(project_id)` tool wrapping the Phase 5A `compute_phius_payload` + `serialize_csv`. Schemas land in `context/technical-requirements/llm-mcp-schema.md`. AC #7–11. |
| 5C | — | deferred | **Deferred at archival as Q-HP-FOLLOWUP-9 (e2e) and Q-HP-FOLLOWUP-10 (cross-doc graduation).** Pending: full-lifecycle Playwright spec at `frontend/tests/e2e/heat-pumps.spec.ts`; PRD §11 cross-doc graduation checklist (`context/PRD.md` §6.2 / data-model / api / llm-mcp-schema). AC #12–14. |

## Phase plans inventory

| Phase | File | Status |
|---|---|---|
| 0 | `phases/phase-00-backend-foundation.md` | ✅ merged |
| 1 | `phases/phase-01-equipment-outdoor-page.md` | ✅ merged |
| 2 | `phases/phase-02-equipment-indoor-page.md` | ✅ merged (commit `e9cd6dd`) |
| 3 | `phases/phase-03-unit-pages.md` | ✅ merged (commit `399d4e6`) |
| 4 | `phases/phase-04-erv-and-rooms-cross-link.md` | ✅ merged (commit `16bdefe`; scope amended 2026-06-09 — Option B) |
| 5 | `phases/phase-05-phius-export-and-mcp.md` | ⏳ split into 5A/5B/5C — 5A merged (commit `79e11b3`); 5B + 5C deferred at archival to Q-HP-FOLLOWUP-8/9/10 |

## Open questions queue

All OPQs closed; folder archived. Live post-v1 follow-ups carry
forward outside this folder:

- **OPQ-3** (xlsx-paste payload format): deferred — see `decisions.md`.
  Phase 5A returns 501 on `?format=xlsx-paste`. Revisit if the calc's
  paste-target validation actually rejects the CSV form.
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
- **Q-HP-FOLLOWUP-8** (post-v1, added 2026-06-09 at archival):
  Phase 5B MCP tools. Verify the generic `tool_get_table` /
  `tool_replace_table` register the four HP table keys, then add a
  dedicated `export_phius_hp_estimator(project_id) → text/csv` tool
  wrapping the Phase 5A `compute_phius_payload` + `serialize_csv`.
  Schemas land in `context/technical-requirements/llm-mcp-schema.md`.
- **Q-HP-FOLLOWUP-9** (post-v1, added 2026-06-09 at archival):
  Phase 5C Playwright e2e. Full-lifecycle spec at
  `frontend/tests/e2e/heat-pumps.spec.ts` covering seed, add-row
  across all four tables, ERV link, Phius CSV export download,
  ERV-delete cascade, version lock.
- **Q-HP-FOLLOWUP-10** (post-v1, added 2026-06-09 at archival):
  Phase 5C cross-doc graduation per PRD §11. Fold durable bits into
  `context/PRD.md` §6.2, `context/technical-requirements/data-model.md`,
  `context/technical-requirements/api.md` §9.X, and
  `context/technical-requirements/llm-mcp-schema.md`. The user-stories
  and GLOSSARY graduations were done during Phase 1; only the
  technical-requirements docs remain.
