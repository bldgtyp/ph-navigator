---
DATE: 2026-07-01
TIME: -
STATUS: Not started.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 1 — duct/pipe segment and
  element total length on the wire.
RELATED:
  - ../PRD.md §7 (data source & backend changes — read in full first),
    §12 D-5/D-7, §14 acceptance criteria 10-11, §15 testing
  - ../PLAN.md
  - backend/features/model_viewer/schemas/honeybee_phhvac.py
  - backend/features/model_viewer/extraction.py
---

# Phase 1 — Backend: element & segment total length

## 1. Goal

Every duct segment, duct element, and pipe element in `/model_data`
reports a `length` field (meters), correct at every level of the hot-
water tree (trunk, branch, fixture, recirc). No rendering, selection,
or UI behavior changes in this phase — purely a wire-contract addition
plus the matching frontend TS types. This phase is fully independent
of Phases 2-5 and can be verified/merged on its own.

## 2. Required reading (in order)

1. `../PRD.md` §7 in full — the data-source reasoning, the exact
   file:line grounding for both the duct (needs computing) and pipe
   (already computed upstream, just undeclared) cases, and why pipe
   length is confirmed to propagate through every tree depth.
2. `backend/features/model_viewer/schemas/honeybee_phhvac.py` — the
   four schemas this phase touches:
   `PhHvacDuctSegmentSchema` (l.17-28), `PhHvacDuctElementSchema`
   (l.31-40), `PhHvacPipeSegmentSchema` (l.70-82, already has `length`
   — reference only, don't change), `PhHvacPipeElementSchema`
   (l.85-91, needs new fields).
3. `backend/features/model_viewer/schemas/ladybug_geometry.py:41-45` —
   `LineSegment3DSchema` is `{p: tuple[3], v: tuple[3]}`; there is no
   existing `.length` helper on it. `v` is the segment vector (end =
   p + v), so length = `sqrt(v[0]**2 + v[1]**2 + v[2]**2)`.
4. `backend/features/model_viewer/extraction.py` — read the ventilation
   path (~l.210-238, calls `PhVentilationSystemSchema(**system.to_dict())`
   with **no** `_include_properties` flag — ducts never had this
   mechanism) and the hot-water path (~l.240-251, calls
   `PhHotWaterSystemSchema(**system.to_dict(_include_properties=True))`
   — already passes the flag). **Do not change extraction.py in this
   phase** — the pipe fix is schema-only (the data is already in the
   dict); the duct fix is a schema-only computed field (derived from
   `geometry`, already in the dict).
5. Upstream reference only, read via the installed venv package — do
   not edit these, they are a separate repo
   (`~/Dropbox/bldgtyp-00/00_PH_Tools/honeybee_ph/`, installed at
   `backend/.venv/lib/python3.11/site-packages/honeybee_phhvac/`):
   - `ducting.py:61-64` (`PhDuctSegment.length` property — the exact
     formula to mirror) and `:286-289` (`PhDuctElement.length`).
   - `hot_water_piping.py:126-129` (`PhHvacPipeSegment.length`),
     `:165-181` (`PhHvacPipeSegment.to_dict`, `_include_properties`
     gate), `:327-330` (`PhHvacPipeElement.length`), `:411-423`
     (`PhHvacPipeElement.to_dict` — confirms `length`, `water_temp`,
     `daily_period`, `material_name`, `diameter` are all in the dict
     when `_include_properties=True`), `:669-672` (`PhHvacPipeBranch
     .to_dict` propagates the flag into its own `pipe_element`),
     `:927-930` (`PhHvacPipeTrunk.to_dict`, same propagation).
   - `hot_water_system.py:214-255` (`PhHotWaterSystem.to_dict` —
     confirms the flag is passed into every `distribution_piping` /
     `recirc_piping` entry at the top of the tree, which is what
     `extraction.py` actually calls).
6. `frontend/src/features/model_viewer/types.ts:184-250` — the TS
   mirrors of the schemas this phase touches
   (`DuctSegmentModelData`, `DuctElementModelData`,
   `PipeElementModelData`).

## 3. Work breakdown

### 3.1 Duct segment + element length (computed, local)

In `schemas/honeybee_phhvac.py`:

- `PhHvacDuctSegmentSchema`: add a Pydantic `@computed_field` property
  `length: float` computed from `self.geometry.v` — vector magnitude,
  matching `PhDuctSegment.length`'s formula exactly (`ducting.py:61-64`).
- `PhHvacDuctElementSchema`: add a `@computed_field` property
  `length: float` = `sum(segment.length for segment in
  self.segments.values())`, matching `PhDuctElement.length`
  (`ducting.py:286-289`).

Use Pydantic v2 `computed_field` (per-project CLAUDE.md: Pydantic v2
only) so the value serializes in `.model_dump()` / the API response
without needing a change to how these schemas are constructed
(`PhVentilationSystemSchema(**system.to_dict())` stays untouched —
the computed field derives from `geometry`, which is already in the
dict).

### 3.2 Pipe element length + bonus fields (declare, already computed)

In `schemas/honeybee_phhvac.py`, `PhHvacPipeElementSchema`
(l.85-91): add plain (non-computed) fields matching the dict keys
`PhHvacPipeElement.to_dict(_include_properties=True)` already emits
(`hot_water_piping.py:419-423`):

```python
length: float
water_temp: float
daily_period: float
material_name: str
diameter: float
```

These are **required, not Optional** — `extraction.py` always calls
`to_dict(_include_properties=True)` for hot water today
(`extraction.py:250`), and the propagation chain (§2.5 above) confirms
every `pipe_element` dict at every tree depth carries them. Do not add
defensive `| None` typing for a case that can't occur on the current
extraction path. If a golden-fixture test surfaces a genuine empty-
segments edge case (e.g. a `ZeroDivisionError` from the upstream
length-weighted-average properties on a zero-length element), that is
a pre-existing upstream behavior, not something to design around
silently — flag it in STATUS.md rather than adding a try/except.

`PhHvacPipeBranchSchema` / `PhHvacPipeTrunkSchema` need **no changes**
— they wrap `pipe_element: PhHvacPipeElementSchema`, so
`branch.pipe_element.length` etc. are available for free once the
element schema has the fields.

### 3.3 Frontend TS types

In `frontend/src/features/model_viewer/types.ts`:

- `DuctSegmentModelData` (l.184-194): add `length: number;`.
- `DuctElementModelData` (l.196-201): add `length: number;`.
- `PipeElementModelData` (l.224-228): add
  `length: number; water_temp: number; daily_period: number;
  material_name: string; diameter: number;`.

No loader, rendering, or store changes in this phase — these fields
exist on the wire/types but nothing reads them yet (Phase 2 consumes
`length` for the inspector card; the bonus pipe fields are optional
polish Phase 2/3 may or may not use for the summary line per PRD §5).

## 4. Fixture guidance

Use both existing fixtures — do not add a new one:

- **Canonical** (`ph_nav_v2_example.hbjson`): 1 supply duct element (3
  segments) + 1 exhaust duct element (2 segments) per the corrected
  Phase 2 golden counts in the archived MVP's STATUS.md; hot-water
  full 4-level tree (trunk → branch → fixture → 4 segments).
- **Hillandale** (`Hillandale_Gateway_NAR_260402.hbjson`, `hillandale`
  pytest marker): 48 duct elements across the ventilation systems, 1
  HW system with 10 trunks — the real coverage for "many elements,
  varied segment counts" and for exercising every tree depth
  (trunk/branch/fixture/recirc) at scale.

Compute expected values by summing the fixture's own segment vector
magnitudes (a small scratch script against the raw HBJSON, or by
cross-checking against `PhDuctElement.length`/`PhHvacPipeElement.length`
directly on the parsed honeybee_ph model before extraction) — do not
hand-guess expected totals.

## 5. Out of scope

Any loader, store, rendering, selection, or inspector change (Phases
2-5). The upstream `honeybee_phhvac` `to_dict()` fix (PRD §7b) — not
this phase, filed separately if ever done. Pipe branch/trunk/system-
level rollup fields (PRD §11 out-of-scope note) — do not add them even
though they're free in the same dict; only `pipe_element.length` +
the four bonus fields are in scope here.

## 6. Verification gate

1. **Backend pytest**: extend
   `backend/tests/test_model_viewer_extraction.py` with duct segment/
   element length assertions (canonical fixture) and pipe element
   length assertions at every tree depth (canonical fixture's full
   4-level tree). Add Hillandale-marked (`@pytest.mark.hillandale`)
   assertions for duct/pipe length across its 48 duct elements / 10 HW
   trunks. Assert the bonus pipe fields (`water_temp`, `daily_period`,
   `material_name`, `diameter`) are present and non-null.
2. **Type check**: `uv run ty check` (from `backend/`) green.
3. **Frontend type check**: `cd frontend && pnpm exec tsc -b --pretty
   false` green (type-only change, no runtime code path exercises the
   new fields yet).
4. **Closeout**: `make format` + `make ci` green.

## 7. Exit criteria

`/model_data` (and the per-feature `list_ventilation_systems` /
`list_hot_water_systems` subset routes / MCP tools that pass through
the same artifact) return `length` on every duct segment, duct
element, and pipe element at every tree depth, verified against known
fixture math on both the canonical and Hillandale fixtures. TS types
compile. No behavior change anywhere else in the app.
