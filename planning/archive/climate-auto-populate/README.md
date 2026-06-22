---
DATE: 2026-06-21
TIME: -
STATUS: Complete — P1–P5 implemented and merged to main (2026-06-22); archived
AUTHOR: Ed (via Claude)
SCOPE: Address-first auto-populate for the Climate tab — enter a site
  address once, derive and attach every climate basis (county, elevation,
  climate zone, nearest Phius/PHI/ASHRAE/EPW) with certification proximity
  flags; plus the privacy model and the roster-first tab redesign.
RELATED:
  - PRD.md — product / behavior contract
  - decisions.md — accepted decisions + open questions to refine
  - research.md — geocoding / API / certification-rule findings (cited)
  - STATUS.md — current state, next step, blockers
  - phases/ — phased implementation plans
  - planning/archive/climate/PRD.md — the climate STORE this extends
  - planning/archive/climate/decisions.md — D-CL-1..11 (base ledger)
  - backend/features/climate/, backend/features/project_climate_source/
  - frontend/src/features/climate/
---

# Climate Auto-Populate — Feature Folder

## Scope

The shipped Climate feature (`planning/archive/climate/`) built the climate
**store**: app-wide versioned reference datasets (Phius / PHI), per-project
`project_climate_source` rows, and a dataset browser. This feature
makes that store **address-driven** and fixes the tab's primary UX gaps.

The spine is one user story: a designer enters the **site address** once;
the app then derives and attaches the project's full climate basis —

1. validate the address → store **lat/long** (the canonical key; address is
   optional for address-less rural new-construction);
2. state + **county**;
3. site **elevation**;
4. **IECC/ASHRAE climate zone**;
5. nearest **Phius** dataset location — **flag** if none within the
   certification limits;
6. nearest **PHI/PHPP** dataset location — proximity advisory;
7. nearest **ASHRAE** design conditions (Htg 99.6/99, Clg 1% DB/MCWB, DP 1%);
8. nearest **EPW** + derived metrics (HDD/CDD, record high·low).

…and the tab is reshaped so **attached sources become first-class and
visualizable** (today's browser-only visualization is orphaned from the
sources a project actually attaches).

## What changes vs. the shipped climate feature

- **Inverts the UX.** Today the dataset browser is the primary path (hunt →
  attach) and attached sources are bare rows. After this: address → derive →
  sources auto-attach with proximity flags; the browser demotes to manual
  override/add; the **roster** becomes the main, visualizable surface.
- **Adds an address field + auth-gated geocoding modal** and a public
  projection that strips the spelled-out address (privacy; D-CL-13).
- **Pulls forward the deferred design-conditions work** (archived Phase 4):
  ASHRAE/EPW-derived design conditions get cached per-source (#7/#8).

## Read order

1. `PRD.md` — the user story, privacy model, store rule, routine table,
   certification proximity rules, and reshaped UI.
2. `decisions.md` — accepted decisions (extends D-CL-1..11 → D-CL-12..) and
   the **open questions** to refine.
3. `research.md` — the cited findings behind every external choice.
4. `STATUS.md` — current state and next step.
5. `phases/` — implementation plans in dependency order.

## Phase map

| Phase | Title | Gist | Depends on |
| --- | --- | --- | --- |
| P1 | Address, geocoding, derived geodata | Address modal + MapTiler + lat/long/county/elev/zone (#1–4); privacy projection | — |
| P2 | Phius/PHI auto-pin + proximity flags | Reuse nearest-search; haversine gate + auto-attach (#5/6) | P1 |
| P3 | ASHRAE + EPW pulls / design conditions | `.stat` + ashrae-meteo + EPW catalog; cached value-sets (#7/8) | P1 |
| P4 | Roster visualization + tab redesign | Attached-source detail (table/charts/flags), roster-first layout | — (independent; may lead) |
| P5 | Elevation auto-fill on Set Location | Lightweight elevation-only lookup fills the modal's elevation field on coordinate change; manual override preserved | P1 (reuses `fetch_elevation_geodata`) |

P4 fixes a current bug (orphaned visualization) and does **not** depend on
P1–P3 — it can be sequenced first if we want the UX win early.

P5 closes a modal-UX gap left by the 2026-06-22 scope split: it adds a
side-effect-free elevation lookup so elevation auto-populates when a site is
set, without dragging the heavy `Locate Climate Data` derive back into the
modal.

## Consolidates (D-CL-25)

This feature absorbs the deferred v1.1 climate items:
- **climate-tab-followups → folded in** (custom-record form,
  attached-source charts, ClimateRecord→`context/` doc) — P4/P2.
  *(Update 2026-06-22: the 2D Location-page sun-path follow-up was removed;
  site/sun visualization belongs in the Model tab.)*
- **climate-design-conditions → partial** — its EPW/ASHRAE production + display
  are built here (P3/P4); only the consumer **contract endpoint** stays
  deferred (gated on fRSI/comfort + D-CL-5).
- **climate-rain-exposure → stays deferred** — separable; its EPW-metrics
  substrate is built here in P3.

## Out of scope

- Re-seeding or re-versioning the app-wide Phius/PHI datasets (admin flow
  stays deferred per archived D-CL-8). We confirm the seeded versions cover
  what we certify against (open question O5) but do not build the upload UI.
- Address↔geocoding for non-US sites (US-first; the derived-geodata APIs are
  US federal). International is a later concern.
- The fRSI / thermal-comfort consumers that read design conditions — they
  remain their own features (archived D-CL-5 / cross-feature contract).
