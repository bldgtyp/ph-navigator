---
DATE: 2026-06-22
TIME: -
STATUS: **DONE** (2026-06-22). The dev seed now seeds **every** published
  climate provider (prod's `seeding --all` semantics) — `phius/2022` + `phi/10.6`
  both land in the local DB, the Phius default is pinned, and the **nearest PHI
  station** is attached as the advisory PHI source. Verified live: the PHI picker
  resolves `phi 10.6`, lists stations nearest-first, and shows advisory verdicts
  (58.7 mi → `warning`, never `fail`). O-DP-5 closed. One new gap surfaced —
  **O-DP-6** (PHI region-filter vocabulary mismatch). See **Outcome — P4** below.
AUTHOR: Ed (via Claude)
SCOPE: P4 — seed PHI in the dev DB (mirroring prod) and exercise the PHI picker
  + advisory proximity semantics end-to-end. The picker's PHI half was built in
  P2b/P3 (shared component); this wired the dev seed so it runs against real
  PHI data instead of the empty state.
RELATED:
  - ../PRD.md §3 (PHI advisory semantics), §11
  - ../decisions.md O-DP-5 (resolved), O-DP-6 (new open item)
  - ../STATUS.md
  - phases/phase-01 (the roster endpoint + dataset/location tables this reuses)
  - planning/archive/climate-reference-data-seeding/ (built the PHI pipeline; D-CS-3/D-CS-7)
---

# Phase 4 — PHI dataset seed + PHI picker verification (DONE)

> **Premise correction.** This phase was filed as "blocked on a **data/ops**
> dependency (a PHI dataset for the dev DB)." That was **stale.** The archived
> `climate-reference-data-seeding` feature already built, published, and verified
> the full PHI pipeline (2026-06-15): `phi/10.6` (1002 records) sits in **both**
> the real Cloudflare R2 dev bucket and local MinIO. The real gap was narrow and
> code-side: the dev seed (`seed_dev_db._seed_climate`) hardcoded `phius/2022`
> and never adopted prod's "seed every published provider" (`seeding --all`)
> path, so PHI was simply never seeded into the local Postgres.

## Goal (met)

Run the PHI picker against a **real seeded PHI dataset** and confirm the
PHI-specific behaviour the code already implemented:

- the roster endpoint resolves the pinned **PHI** dataset for `kind="phi"` and
  returns its stations with per-station proximity; ✅
- the picker lists PHI stations nearest-first, plots them on the basemap, and
  attaches the chosen one to the project's `kind="phi"` `project_climate_source`
  row, independent of the Phius row (D-DP-1); ✅
- **PHI advisory semantics** (PRD §3/§8): distance/Δelev shown, a *soft*
  50 mi/400 ft warning, no hard pass/fail gate. ✅

## Outcome — P4 (2026-06-22)

The dev seed now mirrors production; no new licensed data was added (both
bundles were already in the private object store).

- **Seed-side (`seed_dev_db._seed_climate`)** now calls
  `seed_all_from_object_store(...)` — the same provider-agnostic path the Render
  job uses (`seeding --all`, PRD D-CS-7) — so it seeds every published bundle
  (today `phius/2022` + `phi/10.6`). It pins the firm's home-turf Phius station
  as the project default and attaches the **nearest PHI station** as a
  non-default advisory PHI source (reusing `repository.nearest_locations`, no new
  proximity math). Phius is required; PHI is pinned only when published.
- **Bootstrap-side (`scripts.seed_climate_bundle`)** generalized from
  Phius-only to a provider-spec list, so a fresh MinIO bootstraps each provider
  with a local source: Phius (required, default `backend/seeds/climate/`,
  `$CLIMATE_SOURCE_DIR`) and PHI (optional, default `backend/seeds/climate/phi/`,
  `$CLIMATE_PHI_SOURCE_DIR`). The no-clobber rule is preserved per provider.
- **Verified live (Playwright + DB + API).** `make db-seed` seeded
  `phi 10.6 (1002)` + `phius 2022 (1007)`; the PHI source resolved to "New York
  (PHI 10.6)", FK-consistent. The roster endpoint returns the `phi 10.6` dataset
  nearest-first with advisory verdicts — "New York" 0.3 mi `pass`, "Poughkeepsie"
  58.7 mi **`warning`** (beyond the band, never `fail`). The PHI picker opens
  from the PHI source card and renders the seeded roster.
- **Tests.** `tests/test_seed_climate_bundle.py` covers the multi-provider
  bootstrap (Phius required → loud failure; PHI optional → graceful skip / reuse);
  `tests/test_seed_dev_db.py` covers the nearest-PHI pin (closest station,
  non-default, `(PHI 10.6)` label) against a DB-seeded PHI dataset. `make ci` green.

## Follow-up surfaced — O-DP-6 (PHI region-filter mismatch)

Exercising the PHI picker exposed one gap (see ../decisions.md O-DP-6): the
default state filter returns **zero PHI stations** for a US project because the
project's state is a 2-letter code (`"NY"`) while PHI's `region` is a full name
(`"New York"`). Phius uses 2-letter codes, so its default filter works; PHI's
does not (it populates only via the "any state / nearest" mode). The fix is a
design fork (normalize PHI regions at import vs. map at query vs. per-provider
default) entangled with PHI's 82-country scope — left for Ed's decision, not
folded into this seed-wiring phase.
