---
DATE: 2026-07-26
TIME: 11:05 EDT
STATUS: Phases 1–3 complete; Phase 4 mechanism in, awaiting Ed's ASHRAE data + the selector
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers.
RELATED: ./README.md, ./PRD.md, ../assembly-condensation-risk/STATUS.md
---

# Status

## Phase ledger

| Phase | State | Notes |
| --- | --- | --- |
| **1** — fields + ISO 6946 resolver | ✅ **complete** | `exterior_condition`, `tables.assumptions.thermal_standard`, `boundary_conditions.py`, `update_assembly_exterior_condition`, HBJSON round-trip. No displayed number moved. |
| **2** — fold films into the calculation | ✅ **complete** | Films folded in, tooltip rewritten, PHPP kept construction-only with a regression test, hash extended, citation reconciled. **Every displayed number moved.** |
| **3** — rendering | ✅ **complete** | Exterior label is a select, interior label shows derived Rsi + direction, face bands with distinct ground/ventilated treatments. No new tokens. Browser-verified. |
| **4** — ASHRAE set + selector | 🟡 **mechanism done; awaiting Ed's data + the selector** | Routing decided (private object store, loader-only). Store, loader, widened literal, typed 409 and tests all landed. Ed must publish the values; the UI selector waits on that. |

### Phase 1 as-built

Delivered:
- `Assembly.exterior_condition: ExteriorCondition = "outdoor_air"` — an
  additive amendment, **no `schema_version` bump** (`context/technical-requirements/data-model.md`
  §6.2 permits this); the default is a faithful no-op for every existing document.
- `ProjectAssumptions` on `tables.assumptions`, holding `thermal_standard`.
  `None` means "all defaults". `ProjectDocumentTables.resolved_assumptions()`
  is the read accessor. This is the block `assembly-condensation-risk` should
  add `condensation_settings` to.
- `backend/features/envelope/boundary_conditions.py` — the ISO 6946 table,
  `heat_flow_direction()`, `resolve_surface_resistances()`, and
  `ISO_13788_SURFACE_CHECK_RSI = 0.25` for the condensation screen.
- `update_assembly_exterior_condition` command (+ `create_assembly` accepts
  the field). No interior counterpart: it is derived from `type`.
- `exterior_condition` rides in the HBJSON `ph_nav` round-trip block;
  foreign files default it, as Honeybee has no construction-level equivalent.

**One deliberate deviation from `PRD.md` §4.2.** The PRD writes
`thermal_standard: "iso_6946" | "ashrae"`. Phase 1 ships
`ThermalStandard = Literal["iso_6946"]` — a single-member literal — and
Phase 4 widens it when the ASHRAE values land. Reason: with both members
settable from Phase 1, a document (via MCP or the API) could hold
`"ashrae"` with no value table behind it, and the resolver would have to
either raise a 500 or silently return ISO numbers. Widening a Literal
later is the same class of additive amendment as adding the field, so
nothing is foreclosed. The field shape, the default, and the
"independent project setting" decision are unchanged.

Verification (2026-07-26): `uv run ty check` clean; `uv run pytest` 1513
passed / 7 skipped; `pnpm exec tsc --noEmit` clean. The schema-fingerprint
guard (`backend/tests/project_document_schema/schema_fingerprint.json`) and
the five golden upgrade snapshots were regenerated; a structural diff
confirmed the **only** change is `tables.assumptions: null` — the corpus
fixtures carry no assemblies, so no `exterior_condition` appears there.

Known gap, pre-existing and not introduced here: the golden upgrade corpus
has zero assemblies in every fixture, so the "old document gains the new
assembly field" path is covered by a model-level test
(`test_existing_assemblies_default_to_outdoor_air`) rather than by the
corpus.

## Original state (2026-07-26, pre-implementation)

**PRD drafted. No code written.** Raised by Ed on 2026-07-26 while resolving
`assembly-condensation-risk` Q-5 (floors on grade), on the observation that the
interior/exterior model doesn't handle ground, ventilated, or surface films.
Investigation confirmed the gap is wider than the original question.

Verified against the codebase, not assumed:
- `thermal.py` adds no Rsi/Rse — the calculation is construction-only by
  construction, so the header's "Effective U-Value" is `1/R_construction`.
- `Assembly.type` is consumed only by `hbjson_export.py`, `hbjson_import.py`, and
  the sidebar icon — it drives no physics.
- No "adjacent to" axis exists; ground, ventilated, and unconditioned assemblies
  are indistinguishable from outdoor-air ones.
- The `air_*` categories are air **cavities** (180 of 408 seeded rows, 1 mm
  thickness increments with an equivalent λ), not surface films.
- ISO 6946 resistance values recovered from the PHI workbook's `Data` sheet;
  ASHRAE equivalents still need extraction and private-DB routing.

Reviewed with Ed 2026-07-26, after reading the honeybee-energy source:
- Confirmed honeybee `OpaqueConstruction` carries no type/direction; films are
  ISO 10292 (glazing), reporting-only; E+ computes its own at runtime.
  PHN's assembly-level type is a deliberate and necessary divergence. (`PRD.md` §1a)
- **Q-B1 resolved: fold films into the thermal calculation.** Every displayed
  U-value moves.
- **Q-B3 resolved: four exterior options.** Initially cut to three on the
  grounds that ISO 6946 gives `unconditioned_space` the same `Rse = Rsi` as
  `ventilated`; **reversed the same day** — identical output today does not
  justify collapsing two different meanings, and the distinction cannot be
  recovered by migration once assemblies have been mislabelled. Ft math deferred
  to `assembly-condensation-risk`.
- **Q-B2 resolved: `other` → horizontal (Rsi 0.13)** — the mid-value and the
  least-wrong default when direction is unknown.
- **Q-B4 resolved: `air_*` cavity materials unchanged.**
- **Q-B5 resolved: the `#assembly-thermal-metric` tooltip is the announcement.**
- **Correction to an earlier claim in this folder:** the header metric does *not*
  overclaim today. `AssemblyHeader.tsx` labels it "Thermal" (not "Effective
  U-Value" — that string is from a stale ASCII mockup in
  `context/ui/pages/envelope-tab.md`) and its tooltip already states films are
  excluded. Phase 2 is therefore a change of convention, not a correctness fix.
- Two wrinkles found in that file: the metric **changes kind by unit system**
  (IP → R-value, SI → U-value), so both branches move and the tooltip title
  ("Effective Thermal Resistance") is IP-only; and the tooltip cites ASHRAE
  Ch. 27 where `thermal.py` cites Ch. 25 — reconcile in the same pass.
- **`thermal_standard` is an independent project setting, default ISO 6946.**
  The earlier "derive from `cert_programs`" idea is withdrawn — projects can be
  both PHI and Phius, or neither.
- Settings consolidated into one versioned `assumptions` block shared with
  `assembly-condensation-risk`.
- UI: the existing `exterior`/`interior` labels become the control.

### Phase 2 as-built

**This is the phase that changed reported numbers.** `r_effective_m2k_w` /
`u_effective_w_m2k` now mean `Rsi + R_construction + Rse`.

- `ThermalResult` / `AssemblyThermalResponse` carry **both** conventions:
  the new `r_construction_m2k_w` / `u_construction_w_m2k` are the old
  numbers under a new name, and `rsi_m2k_w` / `rse_m2k_w` /
  `heat_flow_direction` / `thermal_standard` disclose what was applied.
  The four film fields are never null — they hold even when missing
  materials null every R/U field, which is what Phase 3's interior label
  needs.
- Films add **in series with the PH average**, not inside each parallel
  path, per ISO 13788's `R_total = Rsi + ΣR + Rse`. So
  `r_parallel_path_m2k_w` / `r_isothermal_planes_m2k_w` stay
  construction-only and comparable to each other.
- **PHPP export kept construction-only, structurally.** This was a live
  double-count risk: `phpp_export.py` fed `calculate_assembly_thermal`
  straight into the worksheet's U-value cell while the same sheet declares
  `Rsi: 0.00` / `Rse: 0.00`. Rather than rely on the call site picking the
  right field, `thermal.py` now has two entry points —
  `calculate_construction_thermal()` returns a `ConstructionThermalResult`
  with **no film or effective field on it**, and
  `calculate_assembly_thermal()` wraps that and adds the films. PHPP takes
  the former, so the wrong value is unreachable, not merely untested.
  (Prompted by the altitude review, which correctly noted a naming
  convention plus one test was the only backstop.) Three tests pin it,
  including one asserting the exported value does **not** move with
  `exterior_condition`.
- `thermal_input_hash` gained the standard (it is not in the assembly
  subtree, so a project switching standards would otherwise serve stale
  cached previews).
- Tooltip rewritten (`AssemblyHeader.tsx`): title now tracks the unit
  system ("Effective R-Value" IP / "Effective U-Value" SI), states films
  **are** included, names the standard + Rsi/Rse + heat-flow direction,
  and shows the construction-only value. A frontend test asserts the old
  "are NOT included" sentence is gone.
- Citation reconciled on **Ch. 25** (the tooltip's Ch. 27 was the
  outlier; `thermal.py` and the contract doc both already said 25).

Measured impact on the test fixtures: IP `7.5 → 8.4 h-ft²-F/Btu` on the
1.316 m²K/W wall — the direction and rough magnitude the PRD predicted.

Verification (2026-07-26): `make ci` equivalent green — see below.

### Phase 3 as-built

`AssemblyBoundaryLabels.tsx` replaces the two static caption spans. The
container lost its `aria-hidden` (it now holds an interactive control).

- Exterior label → an editable `<select>` whose chrome only appears on
  hover/focus, so it still reads as a caption rather than a form field.
  Viewers/locked versions get static text (mirroring the `StatusSelect`
  editable/read-only precedent without borrowing its pill styling, which
  is the wrong visual language here).
- Interior label → static, showing the derived Rsi and heat-flow
  direction.
- Face bands from `color-mix` over the existing palette — **no new
  tokens** (criterion 8). Outdoor air solid, ground hatched, ventilated /
  unconditioned dashed.

**Verified in a real browser**, not just RTL — three screenshots across
outdoor-air / ground / unconditioned-space confirmed the bands are
distinguishable at a glance (criterion 6) and that the labels fit the
canvas. Two defects were found and fixed only because of that check:
`--space-2` is 2px, so `INTERIORRsi` rendered with no gap; and the
original caveat sentence ran the label off the canvas. The caveat is now
short, truncates with `text-overflow`, and carries the full sentence in a
`title`.

Ports 5173/8000 were already in use, so this ran on an isolated stack
(`:5199` / `:8099`, throwaway `phn_bc_smoke` DB) per
`planning/features/.instructions.md`. Both services were stopped
afterwards; nothing of Ed's was touched.

## Next step

**Phase 4** — the ASHRAE resistance set + the standard selector.
**This one needs Ed** (see Blockers).

`assembly-condensation-risk` Phase 2 is **unblocked from this side** as of
Phase 1: `resolve_surface_resistances()` and `ISO_13788_SURFACE_CHECK_RSI`
are available. It still waits on `assembly-membrane-layers`.

## Dependencies

- **Blocks:** `assembly-condensation-risk` Phase 2 (the engine), alongside
  `assembly-membrane-layers` Phases 1–2.
- **Independent of** `assembly-membrane-layers` — the two can proceed in
  parallel; they touch different parts of the assembly model.

### Phase 4 as-built (mechanism)

**Routing decided 2026-07-26 (Ed): the private object store, loader only.**
D-7 option 1 — the repo carries the loader, never the values.

- `features/envelope/surface_film_store.py` — object-store home at
  `standards/<standard>/surface_films.json`, mirroring
  `features/climate/object_store.py`. Publishing requires a `source`
  citation so the next reader knows the edition and table.
- `scripts/seed_surface_films.py` — `--from <json>` publishes the
  operator's own values; `--show ashrae` prints what is live.
- `ThermalStandard` widened to `"iso_6946" | "ashrae"`.
- **ISO stays in code, ASHRAE does not.** ISO's four values are the
  default, are already published in this feature's PRD, and keeping them
  in-repo means a deployment with no object store still computes
  U-values. Recorded as a deliberate asymmetry, not an oversight — if you
  want ISO routed privately too, that is a separate call.
- **Unavailable ≠ fall back.** Asking for a standard with no published
  table raises; the route returns a typed **409
  `surface_film_table_unavailable`**. Serving ISO numbers under an ASHRAE
  label would be a wrong answer confidently presented.
- The table resolves at the **service edge** and is passed into
  `calculate_assembly_thermal` as a `SurfaceFilmTable`. The first draft
  looked it up inside `thermal.py` and produced a genuine import cycle
  through the storage layer — the cycle was the design saying the pure
  calculation should not reach for I/O, and the fix put it at the edge.
- Tests use **invented fixture values**, never real ASHRAE numbers, with
  a guard test asserting the fixtures differ from ISO so the assertions
  cannot pass vacuously.

## Still open on Phase 4

1. ~~**Ed publishes the values.**~~ **DONE 2026-07-28.** Published to
   `standards/ashrae/surface_films.json` in the `ph-navigator-prod` bucket
   from the `ph-navigator-api` Render Shell, and verified by a real R2
   round-trip (`--show ashrae` → `op=get`, 279 bytes, values intact). Local
   MinIO carries the same values. Source: ASHRAE Handbook — Fundamentals
   2017 (SI), Ch. 26, Table 10, non-reflective ε=0.90, Ro winter 6.7 m/s
   (`R = 1/h`). The values live only in the two private object stores; the
   repo still carries the loader alone.

   Two operator notes for anyone repeating this: the seed script only exists
   in a container built from a commit at or after `53d1f974`, so the deploy
   must land first; and uv warns that Render's `VIRTUAL_ENV` points at the
   repo-root `.venv` while the project lives in `backend/` — harmless, uv
   uses the right environment.
2. **The project-setting selector.** Deliberately not shipped yet: a
   picker that offers ASHRAE before any table is published would hand the
   user a 409. It should land with — or after — step 1, and should offer
   ASHRAE only when a table is actually available (which needs a small
   availability endpoint). Same reasoning that kept Phase 1's literal
   single-member.

## Blockers

**Phases 1–3 are done, merged, and unblocked.** Phase 4's mechanism is in
and its data is published to both object stores; only the selector remains
(above). Nothing is user-visible until that lands — every project is
`iso_6946` and no UI can change it, which is the intended ordering.

Low urgency regardless — Ed reports ~99 % ISO.

### Resolved design questions (2026-07-26)

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-B1~~ | Header U-value includes films? | ✅ yes |
| ~~Q-B2~~ | What does `type: "other"` resolve to? | ✅ horizontal, Rsi 0.13 — mid-value, least-wrong default; flagged visibly |
| ~~Q-B3~~ | `unconditioned_space` in the enum? | ✅ **yes, model it; defer Ft** — reverses the earlier same-day "no" |
| ~~Q-B4~~ | Do the `air_*` cavity materials change? | ✅ no — leave unchanged |
| ~~Q-B5~~ | How is the change communicated at Phase 2 deploy? | ✅ rewrite the `#assembly-thermal-metric` tooltip in `AssemblyHeader.tsx`; no in-app banner |

## Verification

Against `PRD.md` §8:

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Every existing assembly resolves to `outdoor_air`; no number moved in Phase 1 | ✅ `test_existing_assemblies_default_to_outdoor_air`; Phase 1 touched no calculation |
| 2 | `(type, exterior_condition, standard)` → deterministic triple, unit-tested for all combinations | ✅ `test_iso_6946_resolves_every_type_and_exterior_condition`, parametrized over the full cross-product against an independently transcribed table |
| 3 | Phase 2 metric reflects `Rsi + R + Rse` on both unit branches; construction-only reachable; hash changes | ✅ `test_films_are_added_in_series_with_the_construction`, `test_effective_r_tracks_both_boundary_axes`, `test_input_hash_changes_with_both_surface_film_inputs`; both branches share `formatThermalValue` |
| 3a | Tooltip no longer claims films are excluded; names standard, Rsi/Rse, direction | ✅ frontend test asserts the disclosure **and** that "are NOT included" is gone |
| 4 | PHPP export still construction-only — explicit regression test | ✅ **enforced by type**: PHPP consumes `ConstructionThermalResult`, which has no with-films field. Three tests, incl. one that the export does not move with `exterior_condition` |
| 5 | ISO 13788 `Rsi = 0.25` available to the condensation feature, never in the U-value | ✅ `ISO_13788_SURFACE_CHECK_RSI`; `test_iso_13788_surface_check_rsi_is_separate_from_the_u_value_films` |
| 6 | Ground / ventilated visually distinguishable at a glance, without reading text | ✅ browser-verified across three conditions — hatch vs dashed vs solid bands |
| 7 | Changing `exterior_condition` updates resistances and U-value immediately | ✅ frontend test drives the select → command; API round-trip confirmed live |
| 8 | No new design tokens | ✅ `color-mix` over the existing palette; `check:css-vars` + `check:typography` guards pass |

Gate run for each phase: `ruff format/check`, backend boundaries, `ty`,
full `pytest` (1525 passing), `prettier`, `eslint`, `check:all`, full
`vitest` (2263 passing), `vite build`.
