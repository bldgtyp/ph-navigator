---
DATE: 2026-06-14
TIME: -
STATUS: COMPLETE (2026-06-15) — the on-demand seed command
  (`features.climate.seeding --all`) and the Render runbook
  (`context/ENVIRONMENT.md → Climate reference-data seed (on-demand)`) are
  implemented, unit-tested, `make ci` green, AND the operator publish+seed was
  run and verified against the deployed Render (staging) environment: both
  bundles published to the `ph-navigator-v2-dev` R2 bucket and seeded into the
  Render Postgres — `phius/2022` = 1007 and `phi/10.6` = 1002 locations (2009
  total), read back through the app repository.
AUTHOR: Claude (for Ed)
SCOPE: The production (Render) seeding path — an on-demand, idempotent seed of
  the app-wide climate datasets from Cloudflare R2 into the Render Postgres.
RELATED:
  - ../PRD.md (§2 D-CS-7; §4 scope — Phase 3)
  - phase-01-phius-objectstore-pipeline.md (the bundle + seed-from-bundle path)
  - context/ENVIRONMENT.md (the Render seed runbook — "Climate reference-data seed")
  - backend/features/climate/seeding.py (the `--all` prod seed command)
  - backend/features/assets/storage_r2.py (R2 client; already serves attachments)
---

# Phase 3 — Render seed path

Run the Phase-1 seed-from-bundle against **Cloudflare R2** + the **Render
Postgres** so production carries the same app-wide `phius` / `phi` datasets as
dev — without putting source data in the repo.

## Done — 2026-06-15 (code + runbook)

The prod seed is the same provider-agnostic seed CLI, with a new **`--all`**
mode (`backend/features/climate/seeding.py`): it walks the provider registry
and seeds each provider's default version that is published in the object
store, reporting seeded-vs-skipped and failing loudly if nothing is published.
This makes the Render seed job **a single stable command that never changes as
providers are added** (PRD D-CS-3) — `python -m features.climate.seeding --all`.
Covered by `tests/test_climate_pipeline.py` (`seed_all_*`), and the test fake
`FakeR2Client` was aligned to real R2's 404 `ClientError` so `has_bundle()` is
exercised. As a cleanup, the duplicated `ClimateBundleStore(R2Client(settings))`
build was extracted to `ClimateBundleStore.from_settings()` (4 call sites).
`make ci` green.

The deploy runbook (confirm `R2_*` in Render → publish bundles with the process
`--upload` → run `seeding --all` as a Render one-off job / Shell command, on
publish of a new bundle, not per deploy) lives in
`context/ENVIRONMENT.md → "Climate reference-data seed (on-demand)"`.

**Operator publish + seed — DONE 2026-06-15.** Ed published both bundles to the
`ph-navigator-v2-dev` R2 bucket (the bucket the deployed Render staging service
reads) and seeded the Render Postgres with `seeding --all`, verified at
`phius/2022` = 1007 and `phi/10.6` = 1002 locations (2009 total). One-time
access detail: the Render managed Postgres blocks external traffic by default,
so the seed-from-local-shell run required temporarily allowlisting the
operator's IP under the DB's Networking → Inbound IP Rules (removed afterward).
A future reseed can instead run `seeding --all` from the Render Shell (internal
DB URL, no allowlist needed).

## Decision recap (D-CS-7)

Reference data is immutable and `seed_dataset(...)` is idempotent per
`(provider, version)`. Render therefore seeds **on demand** — when a new bundle
is published — **not** on every web-service restart. Rows persist in the Render
Postgres across restarts. "Seed on restart" is the *dev* reset convenience
(Phase 1), not a prod boot dependency.

## Work

1. **Confirm R2 in Render.** `R2_*` env is already present (the object store
   serves attachments + EPW there). Verify the seed process can read the
   `climate/<provider>/<version>/dataset.json` keys with the deployed creds.
2. **Publish the prod bundles.** Use the Phase-1 process CLI `--upload` to push
   `climate/phius/2022/dataset.json` (and later `climate/phi/10.6/…`) to R2.
3. **Wire a re-runnable seed job.** A Render one-off job or release command that
   runs the seed-from-bundle CLI against R2 + the Render database. Pick one-off
   job vs release command based on how Render is wired; both satisfy D-CS-7.
   Document the trigger ("run when a new (provider, version) is published").

## Exit criteria

- Prod climate datasets seeded from R2, queryable by country/region + nearest,
  version-tagged; re-running the job is a safe no-op (idempotent). The trigger
  and command are documented. `make ci` unaffected (no app-code change beyond
  what Phase 1 introduced).
