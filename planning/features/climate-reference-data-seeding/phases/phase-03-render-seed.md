---
DATE: 2026-06-14
TIME: -
STATUS: Planned (Phase 3) — deploy task; follows Phase 1 (the object-store
  bundle + seed-from-bundle path it runs).
AUTHOR: Claude (for Ed)
SCOPE: The production (Render) seeding path — an on-demand, idempotent seed of
  the app-wide climate datasets from Cloudflare R2 into the Render Postgres.
RELATED:
  - ../PRD.md (§2 D-CS-7; §4 scope — Phase 3)
  - phase-01-phius-objectstore-pipeline.md (the bundle + seed-from-bundle path)
  - backend/features/assets/storage_r2.py (R2 client; already serves attachments)
---

# Phase 3 — Render seed path

Run the Phase-1 seed-from-bundle against **Cloudflare R2** + the **Render
Postgres** so production carries the same app-wide `phius` / `phi` datasets as
dev — without putting source data in the repo.

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
