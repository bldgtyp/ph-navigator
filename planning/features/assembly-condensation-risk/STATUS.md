---
DATE: 2026-07-26
TIME: 10:14 EDT
STATUS: Blocked — awaiting decisions on Q-1…Q-7
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the condensation-risk feature.
RELATED: ./README.md, ./research.md, ./PRD.md, ./decisions.md
---

# Status

## State

**Research and documentation phase complete. No code written.**

Done:
- Full teardown of `PHI_CondenstationTool_March_v1.7.5.xlsx` — all six sheets,
  formulas extracted (not just values): saturation-pressure equations, layer
  R/sd/δ derivations, the Glaser tangent construction, gc/Ma accumulation, the
  four verification criteria, the four interior-climate models, and the national
  Ma-limit reference tables. → `research.md` §§1–3, 5.
- Input inventory mapped against the live PHN data model
  (`envelope/models.py`, `project_document/envelope_models.py`,
  `climate/record.py`, `envelope/thermal.py`, `catalog_materials` baseline
  migration). → `research.md` §4.
- Material-property analysis (µ vs sd vs permeance, US-unit conversions,
  verified against ISO 10456's 6-mil-poly value). → `research.md` §6.
- Feature interrogated from seven angles; verdict **build, conditionally**. →
  `decisions.md` Part 1.
- Eight design decisions taken or recommended, 14 edge cases enumerated, 7
  blocking open questions raised. → `decisions.md` Parts 2–4.
- Product contract drafted incl. progressive-disclosure modal design and a
  six-phase plan. → `PRD.md`.

Added 2026-07-26 (Ed's review of the above):
- **Q-2 resolved** — worst-of-all-paths, bounded enumeration (`decisions.md` §D-1).
- **Uncertainty caveats designed** as a named set rather than one flag, because
  capillary-active and high-storage materials fail in *opposite* directions and
  imply different actions. v1 fires two caveats derived from existing categories
  with **no new fields**; the per-material `moisture_behavior` enum is v1.1.
  (`decisions.md` §D-9)
- **Membrane layers spun out as a prerequisite feature** —
  `planning/archive/dated/2026-07-26/assembly-membrane-layers/` (complete). Membranes and coatings dominate
  a wall's sd, and PHN cannot represent them; the engine must not ship before
  they land. (`decisions.md` §D-10, `PRD.md` §2a)

Resolved 2026-07-26 (Ed, second review) — **all seven open questions closed**:
- Q-1 build it (with a preliminary coverage read in `decisions.md` §D-12 that
  surfaced the composite stud-material problem); Q-3 µ values live in the private
  DB; Q-4 confirmed against the tool, with two corrections in §D-13; Q-5 floors
  on grade excluded — **and the underlying boundary-condition gap became a second
  prerequisite feature** (§D-11); Q-6 per-project Ma limit, default 200; Q-7
  screen-only preview, no export, no download-report affordance (§D-14).

Not done: nothing implemented. No branch, no migration, no models.

## Next step

**Phase 0 — the catalog coverage probe (Q-1).** Before any code, measure: across
the production catalog and the assemblies in live projects, what fraction of
layers would have a µ or sd value after an ISO 10456 category-level seed? This is
the one number that decides whether the feature ships as a calculation or as a
data-entry push. It requires no schema change — it is a read-only analysis of
existing catalog rows against the ISO 10456 category list in `research.md` §7.

## Blockers

**All seven original open questions are resolved** (`decisions.md` Part 4). What
remains is sequencing, not decisions:

| Blocker | Nature |
| --- | --- |
| ✅ `assembly-boundary-conditions` **Phase 1** | **cleared 2026-07-26.** `backend/features/envelope/boundary_conditions.py` exposes `resolve_surface_resistances()` → `(Rsi, Rse, heat_flow_direction)` and `ISO_13788_SURFACE_CHECK_RSI = 0.25` for the surface-condensation / mould / fRsi criteria |
| ✅ `assembly-membrane-layers` **Phases 1–2** | **cleared 2026-07-26** — in fact all four phases shipped. Assemblies hold membrane layers, which are excluded from the R calculation and carry the `air_permeance_l_s_m2_at_75pa` datum. Archived to `planning/archive/dated/2026-07-26/assembly-membrane-layers/`. Note the `vapor_sd_equivalent_m` field is still unclaimed — this feature must land it. |
| ⚠️ Composite stud materials | `decisions.md` §D-12 — 24 % of the seeded catalog is stud+cavity pseudo-materials with no single defensible µ. Recommendation (i): use the cavity's µ plus a caveat. Needs Ed's nod during Phase 0. |
| ✅ Occupancy-class default | `decisions.md` §D-13b — `normal`, a knowing departure from PHI's `low`/EN 15026 suggestion. Signed off by Ed 2026-07-26. |

Both prerequisites are independent of each other and can run in parallel.

## Verification

Nothing to verify yet. When Phase 2 lands, the gate is acceptance criterion 3 in
`PRD.md` §9: golden-file agreement with the PHI workbook's own outputs for a
reference assembly, to within rounding.
