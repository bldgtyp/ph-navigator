---
DATE: 2026-06-15
TIME: -
STATUS: v1.0. Phase 1 COMPLETE 2026-06-15 (full 1007-station seed verified
  locally) and Phase 2 PHI COMPLETE 2026-06-15 (column map validated,
  unit-tested, `make ci` green; bundle published to local MinIO + seeded +
  verified — 1002 datasets across 82 countries) — see STATUS.md. Phase 3
  (Render prod seed) not started.
AUTHOR: Claude (for Ed)
SCOPE: Product/behavior contract for the climate reference-data ingest + seed
  pipeline: a two-stage process→seed flow that lands the full Phius + PHI
  libraries in Postgres, sourced from the private object store, with the
  licensed source data removed from the public repo.
RELATED:
  - README.md
  - STATUS.md
  - phases/phase-02-phi-importer.md (the PHI process step)
  - planning/archive/climate/phases/phase-02-reference-datasets-and-format.md
  - backend/features/climate/record.py (ClimateRecord — the .json shape)
  - backend/features/climate/service.py (seed_dataset, SeedResult)
  - backend/features/climate/importers/ (phius.py; the process step)
  - backend/features/assets/storage_r2.py (object-store client)
  - backend/scripts/seed_dev_db.py, backend/scripts/_seed_paths.py
  - backend/seeds/README.md, Makefile (db-seed, db-reset-dev, object-store-*)
---

# Climate reference-data ingest + seed — PRD

## 1. Problem

The Climate Postgres store is live and provider-agnostic, but there is no
clean, license-safe way to get the *full* PHI + Phius libraries into it:

- The repo is **public**, yet **25 real Phius source files are committed**
  (`backend/seeds/climate/USA/NY/*-mon.txt` ×24 +
  `backend/tests/fixtures/climate/phius/USA/MA/WORCHESTER_REGIONAL_ARPT_MA-mon.txt`).
  PHI/PHPP source would be even more clearly restricted.
- Only a NY slice is seeded; the real 1007-station Phius set has no non-repo
  home, and PHI has none at all.
- The seed today parses raw source at seed time (`seed_phius_dataset(root)`
  reads `.txt` *and* writes to the DB in one call) — so every environment that
  seeds needs the raw files and the provider parser on the seed path.

## 2. Decisions (made with Ed 2026-06-14; this is the ledger)

### D-CS-1 · Runtime store stays Postgres — accept
No second Render DB (Option 4 rejected: can't JOIN project pins to climate
rows, doubles backup/migration domains for ~5 MB). No Cloudflare KV/D1 for the
structured library (Option 5 rejected; R2 stays for EPW binaries only). Reuse
the shipped `climate_dataset` / `climate_dataset_location` tables unchanged.

### D-CS-2 · Source-of-truth lives in the private object store — accept
The raw source files **and** the standardized `.json` bundles live in the
S3-compatible object store already in the stack: **MinIO** locally
(`docker compose … object-store`, `:9000`), **Cloudflare R2** in deployment.
Reuse `backend/features/assets/storage_r2.py` and the existing `R2_*`
settings + bucket. Never in git. Works identically local and on Render.

### D-CS-3 · Two-stage pipeline: admin **process** → **seed** — accept
Split the current one-shot parse-and-seed into:
1. **Process (admin-only, offline, rare):** provider-specific parser
   (`.txt`/`.xlsx`) → `list[ClimateRecord]` → write a **standardized `.json`
   bundle** → upload to the object store. Not exposed to app users — a backend
   CLI (matches the existing `python -m features.climate.importers` pattern).
2. **Seed (dev + prod, frequent, provider-agnostic):** pull the `.json`
   bundle from the object store → `ClimateRecord.model_validate` each →
   `service.seed_dataset(provider, version, records, replace=…)`. The seed
   step knows only the one JSON shape, never the messy source formats.

**Why:** the load-bearing parsing (Phius mojibake; the PHI ~130-column
workbook reverse-engineering, see climate-phi-importer) runs once, by an
operator, not on every reset. Seeding becomes uniform across providers and
fast/deterministic. The `.json` is already validated, so a bad seed fails at
process time, not in front of a user.

### D-CS-4 · Standardized artifact = `ClimateRecord` JSON, in a versioned envelope — accept
One bundle object per `(provider, version)`, mirroring the catalog seed
envelope already used in `backend/seeds/`:

```jsonc
{
  "kind": "climate_dataset",
  "schema_version": 1,
  "provider": "phius",          // phius | phi
  "version": "2022",            // 2022 | 10.6 | …
  "label": "Phius 2022",
  "source": "Phius WUFI climate set 2022",
  "exported_at": "2026-06-14T00:00:00Z",
  "records": [ /* ClimateRecord.model_dump() … 1007 of them */ ]
}
```

Object-store key layout:
```
climate/<provider>/<version>/dataset.json     # the seed input (standardized)
climate/<provider>/<version>/raw/…            # optional raw .txt/.xlsx archive (provenance)
```

The standardized `.json` is still PHI/Phius data — reformatting does not change
ownership — so it stays in the object store, not the repo (D-CS-2).

### D-CS-5 · PH-Nav-V2 only — accept
No shared `ph-climate-data` repo/package now. Revisit only if OpenPH / ph-dash
ever need the same curated library; the object-store bundle could be promoted
to a published artifact later without changing the runtime store.

### D-CS-6 · Public-repo cleanup: remove from HEAD, no history rewrite — accept
`git rm` the 25 committed real files from the tree; do **not** rewrite history.
Add a `.gitignore` guard so climate source data cannot be recommitted. Replace
the real test fixture with a **synthetic** station (fabricated numbers, clearly
fake) so the parser test keeps a golden without shipping licensed data.

### D-CS-7 · Prod (Render) seeding: seed-once / on-demand, idempotent — accept
Reference data is immutable, and `seed_dataset` is idempotent per
`(provider, version)`. Render seeds **on demand** (a one-off job / release
step run when a new bundle is published), **not** on every web-service
restart. Rows persist in the Render Postgres across restarts. "Seed on
restart" is the *dev* reset/reseed convenience (§4 Phase 1), not a prod boot
dependency.

## 3. The standardized format

`ClimateRecord` (`backend/features/climate/record.py`) is already the canonical
shape — mirrors `honeybee_ph.site` (D-CL-10), SI units verbatim, with
`ClimateLocation` / `ClimateData` / monthly temps + radiation / 4 peak loads /
`ClimatePhppCodes` / `ClimateAux`, plus `provider`/`version`/`station_id`
identity. The standardized `.json` is just `ClimateRecord.model_dump()` rows in
the D-CS-4 envelope. No new schema — this feature *serializes* the existing one
to disk/object-store instead of going straight to Postgres.

## 4. Scope

### Phase 1 — process→seed over the object store + full Phius + cleanup (independent, now)

> Detailed plan: `phases/phase-01-phius-objectstore-pipeline.md`.

1. **Refactor importers into a process step.** Split `importers/phius.py`'s
   parse-and-seed into `parse → list[ClimateRecord]` (pure) and keep a thin
   convenience wrapper. Add a bundle writer
   (`records → D-CS-4 envelope .json`).
2. **Object-store source resolver.** A helper over `storage_r2.py` that, given
   `(provider, version)`, uploads/downloads the bundle (and optional raw
   archive). Local → MinIO; prod → R2; same code.
3. **Process CLI (admin-only).**
   `python -m features.climate.processing --provider phius --version 2022
   --src <raw .txt tree> --out climate/phius/2022/dataset.json [--upload]` —
   parse, validate, write the bundle, optionally push to the object store. Not
   wired to any API route.
4. **Seed from bundle (provider-agnostic).** Generalize the seed entry point to
   read a standardized `.json` bundle from `{object-store | local path}` →
   `seed_dataset(...)`. Keep `--no-replace` idempotency. Replaces the current
   `--root`/parse-on-seed path for seeding (the parser moves to step 3).
5. **Dev reset/reseed wiring.** `make db-seed` / `make db-reset-dev` pull
   `phius/2022` from MinIO and seed all 1007, then keep pinning NYC / Central
   Park as the starter project default + `project_location`. Add a
   `make seed-climate-bundle` recipe to push the operator's local bundle into
   MinIO once (MinIO starts empty — same bootstrap role as
   `object-store-init`). Document the env var for the operator's local source
   dir.
6. **Public-repo cleanup (D-CS-6).** `git rm` the 24 NY files + the MA fixture;
   add `.gitignore` for `backend/seeds/climate/`; swap the parser test to a
   synthetic fixture; update `backend/seeds/README.md` to describe the bundle
   pull instead of committed files.

### Phase 2 — PHI/PHPP 10.6 (see `phases/phase-02-phi-importer.md`)

> **COMPLETE 2026-06-15.** `importers/phi.py` + the `phi` provider entry
> shipped; the ~130-column map is reverse-engineered, validated, and
> unit-tested; `make ci` green. The CLI/seed path needed no change. The bundle
> was published to local MinIO + seeded + verified (1002 datasets, 82
> countries). Prod (Render) seeding is Phase 3.

- Depends on `importers/phi.py` (the `.xlsx` parser + ~130-column map
  validation; full plan in the phase doc). Once it exists, it is just another
  **process** parser →
  `ClimateRecord` → the same bundle writer + object-store upload + seed path.
  No new seed code (provider-agnostic by D-CS-3).
- Publish `climate/phi/10.6/dataset.json`; add `phi` to the process CLI
  `--provider`; seed loads it like Phius. Country/region spans multiple
  countries (`DE-…`, `US-…`) — already handled by `ClimatePhppCodes`.

### Phase 3 — Render seed path (D-CS-7)

> Detailed plan: `phases/phase-03-render-seed.md`.

- A documented, re-runnable seed job against R2 + the Render Postgres (one-off
  job or release command). Confirm `R2_*` env is present in Render (the object
  store already serves attachments there). Run on publish of a new
  `(provider, version)`, not per deploy.

## 5. Data / sizing

Phius 2022: 1007 `.txt`, ~4 MB raw; PHI 10.6: ~1474-row `.xlsx`, ~1.3 MB. As
standardized `.json`: a few MB per provider. As Postgres rows: ~5 MB total.
Object-store bundles: one `dataset.json` (+ optional raw archive) per
`(provider, version)`. Trivial at every layer.

## 6. Tests

- **Process:** parser → `ClimateRecord` golden values for a known station
  (reuse the existing Phius golden expectations, now against a **synthetic**
  fixture); bundle writer round-trips (`records → .json → records` equal);
  envelope shape asserted.
- **Object-store resolver:** upload → download → parse a tiny fixture bundle
  through MinIO (a couple of stations), not the full set.
- **Seed-from-bundle:** seed a MinIO fixture bundle → assert row count + a
  golden station's monthly values; re-seed with `--no-replace` is a no-op;
  `replace=True` rebuilds. (Reuses existing idempotency tests.)
- **Guard:** structural-guard test (matches the repo's CI guards) asserting no
  real climate source files are tracked under `backend/seeds/climate/` /
  `tests/fixtures/climate/`.
- `make ci` green (new code typed, Ruff/Ty clean, migration n/a — no schema
  change).

## 7. Exit criteria

- No PHI/Phius source bytes tracked at HEAD; `.gitignore` guard in place;
  synthetic test fixture; `backend/seeds/README.md` updated.
- Full Phius 2022 (1007) processes to a standardized `.json` bundle, uploads to
  the object store, and seeds into Postgres in local dev; `make db-seed` /
  `make db-reset-dev` bring climate back automatically (MinIO).
- An admin-only **process** CLI and a provider-agnostic **seed** path exist and
  are documented; a `make` recipe publishes a bundle to the object store.
- PHI 10.6 importer implemented + validated as Phase 2
  (`phases/phase-02-phi-importer.md`); bundle published to local MinIO + seeded
  + verified (1002 datasets, 82 countries). Prod seed is Phase 3.
- A documented Render seed job (Phase 3). `make ci` green.

## 8. Risks / open sub-questions

- **Bundle granularity:** one `dataset.json` per `(provider, version)`
  [recommended — atomic, one key] vs. object-per-station. Recommend the single
  envelope; revisit only if a bundle gets unwieldy (it will not at this size).
- **Local bootstrap chicken/egg:** MinIO is empty on a fresh `make dev`; the
  `seed-climate-bundle` recipe must run before `db-seed`. Document the order
  (mirror `object-store-init`).
- **PHI parser correctness** (the ~130-column map) is the real risk, owned by
  Phase 2 (`phases/phase-02-phi-importer.md`); the seed path only consumes its
  standardized `.json` output.
- **Render seed trigger:** one-off job vs release command — pick during Phase 3
  based on how Render is wired; both satisfy D-CS-7.
