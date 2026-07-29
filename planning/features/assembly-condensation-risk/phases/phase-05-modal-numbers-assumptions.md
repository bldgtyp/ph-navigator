---
DATE: 2026-07-28
UPDATED: 2026-07-29
TIME: 22:52 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 5 — modal tiers 3–4: every intermediate number, and the
  assumptions surface that edits `condensation_settings`. Feature-complete,
  plus closeout.
RELATED: ../PRD.md §5/§6.3 (tiers 3–4), ../decisions.md §D-3/§D-6/§D-13,
  context/technical-requirements/data-table.md
---

# Phase 5 — Modal tiers 3–4 (numbers + assumptions) and closeout

## Goal

Every intermediate the workbook shows is reachable, and the interior-climate
assumptions are editable in place — writing to the versioned document draft,
so a saved version carries the assumptions that produced its result.

## Work

### Tier 3 — The numbers

1. **Layer table** (selected month): layer, material, d, λ, R, µ, sd, θ,
   psat, pv, RH. Membrane rows show sd with no R — the two-profiles reality
   made visible.
2. **Monthly table**: 12 rows × (gc, Ma, condensing-interface count,
   per-criterion verdict).
3. **Per-interface breakdown**: gc and Ma per interface per month (the
   workbook's collapsed "+" table).
4. All three on the standard `DataTable` — **uniformity is an iron-law**:
   parent-owned affordances, built-in copy, no per-table opt-outs. Copy is
   in; there is still no download/export affordance (§D-14).
5. IP/SI display follows the app toggle: perms / perm·in / gr/ft² (E-12).

### Tier 4 — Assumptions

6. **Exterior climate** — which source, monthly θe and derived φe, read-only,
   link to the Climate tab.
7. **Interior climate editor** — the §5 model selector and its parameters
   (continental + occupancy class; humidity class + setpoint θi; fixed
   setpoint θi/φi), writing `condensation_settings` to the draft through the
   document spine. `low` is labelled with PHI's rationale so choosing it is
   deliberate (§D-13b); defaults mean the block is only written on change.
8. **Ma limit** with the national reference values as guidance text
   (`research.md` §3.6 table).
9. **Derived facts, read-only**: start month (and the E-15 canonical-month
   note when nothing closes), surface resistances used, roof −2 K applied or
   not, the `ventilated` stack convention statement (§6.5), the
   ventilated/unconditioned `Rse = Rsi` standard seam.
10. **Per-material provenance**: µ/sd value, source, catalog vs project
    override.

### Closeout

11. Settings edits invalidate the cached result (the hash already covers
    them — verify end-to-end in the browser, AC 14).
12. Full acceptance sweep — all 16 ACs in `PRD.md` §9, each with evidence.
13. Docs pass: `context/ui/pages/envelope-tab.md` gains the chip + modal;
    fold accepted decisions back per the planning instructions; update
    `planning/STATUS.md`; decide the Part-5 follow-ons' fate (MCP tool,
    Status-tab roll-up → v1.1 folders or explicit drops); archive the packet.
14. Production µ apply (the pipeline's Ed-dispatched workflow) gets scheduled
    here at the latest — the chip is only useful in production once the seed
    is applied there.

## Out of scope

MCP exposure; Status-tab roll-up; `moisture_behavior` enum; variable-sd
curves; any export path.

## Verification

- AC 6 re-proven end-to-end: a fresh project with defaults never opens tier 4
  and still computes.
- Editing assumptions → chip/result update without reload; saved version
  diff shows the settings block.
- Full `make ci`; browser smoke of both editing models and the IP toggle;
  the 16-AC evidence table recorded in `STATUS.md` before archiving.

## Result — 2026-07-29

- The Numbers tier exposes selected-month layer intermediates, the 12-month
  cycle, and the per-interface breakdown through three shared read-only
  `DataTable` instances. Numeric fields retain numeric sort/filter semantics;
  CSV/download remains disabled for this screen-only result.
- SI/IP follows the project toggle, including µ ↔ perm-in, sd ↔ perm, and
  g/m² ↔ gr/ft² display. Month selection updates the layer table without
  altering the result.
- The Assumptions tier shows the exterior climate source and 12 monthly
  conditions, edits all three interior-climate models plus Ma limit through
  `set_condensation_settings`, and discloses derived films, roof correction,
  start month, boundary seams, and per-material vapour provenance.
- Settings writes persist the complete effective block, invalidate all
  condensation results but no thermal results, and can repair an invalid
  persisted settings block. Empty required setpoints are rejected rather than
  serialized as zero.
- Browser verification covered the continental, humidity-class, and fixed
  models, settings/hash/chip updates without reload, restoration to defaults,
  SI/IP values, month changes, absent download actions, Climate routing, and
  zero horizontal overflow at 1280 px and 900 px widths.
- Focused verification: backend condensation suites **47 passed**; frontend
  Phase 5 plus Envelope integration suites **67 passed**; TypeScript passed.
  Full-repository CI evidence is recorded in the phase commit.
- Production licensed-data publish/apply remains explicitly operator-held; no
  production data action was run.
