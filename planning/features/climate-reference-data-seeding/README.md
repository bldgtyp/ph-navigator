---
DATE: 2026-06-14
TIME: -
STATUS: Planned (v1.0). Phase 1 (Phius + object-store pipeline) is independent
  and buildable now; the public-repo cleanup (D-CS-6) is partially executed
  (2026-06-14 — licensed source files untracked + synthetic test fixture; the
  object-store dev-seeding swap remains). Phase 2 (PHI) is integrated here as
  `phases/phase-02-phi-importer.md`.
AUTHOR: Claude (for Ed)
SCOPE: Router for the climate reference-data ingest + seed pipeline — get the
  full PHI + Phius libraries into Postgres without putting licensed source
  data in the PUBLIC repo, via a two-stage process→seed flow over the
  existing object store. Promoted to v1.0 and absorbed the former
  `climate-phi-importer` candidate (Ed, 2026-06-14).
RELATED:
  - PRD.md
  - STATUS.md
  - phases/phase-02-phi-importer.md (the PHI `.xlsx` process step, integrated
    from the former standalone climate-phi-importer feature)
  - planning/archive/climate/ (the complete Climate feature this extends)
  - planning/archive/climate/decisions.md (D-CL-8 app-wide versioned datasets,
    D-CL-10 mirror honeybee_ph.site)
  - backend/features/climate/ (record.py, service.seed_dataset, importers/)
  - backend/features/assets/storage_r2.py (the object-store client to reuse)
  - backend/seeds/README.md (dev reset/reseed workflow)
---

# Climate — reference-data ingest + seed pipeline

Get the full **Phius 2022** (1007 stations) and **PHI/PHPP 10.6** (~1000+
datasets) climate libraries into the shipped Postgres store, with a clean,
repeatable reset-and-reseed — **without** committing PHI/Phius source data to
the PUBLIC `bldgtyp/ph-navigator-v2` repo.

## Why this exists

The Climate store shipped (Postgres `climate_dataset` /
`climate_dataset_location`, app-wide + versioned + immutable; read endpoints +
MCP live). What is missing is a *supply chain* for the data:

1. **Licensing.** The repo is **public**. PHI/Phius climate data is licensed /
   proprietary reference data — we may *use* it in our app (we hold PHPP +
   WUFI licenses) but should not *redistribute* it in a public repo. There
   are already **25 real Phius `-mon.txt` files committed** (24 NY seed files
   + 1 MA test fixture).
2. **Coverage.** Only a 24-file NY slice is seeded for dev; the real 1007-
   station set never had a non-repo home.
3. **Repeatability.** The DB schema is still in flux; a clean reset must bring
   climate back automatically.

## The shape (two stages)

```
 RAW SOURCE                PROCESS (admin only)        SEED (dev + prod)
 .txt / .xlsx     ──▶   parse → ClimateRecord →   ──▶   load .json →
 (operator's            standardized .json bundle       validate → Postgres
  machine)              (uploaded to object store)      (idempotent per
                                                         provider/version)
```

- **Process** = the messy, provider-specific parsing (Phius German-label
  mojibake; the PHI ~130-column workbook). Run *rarely*, **backend-admin
  only** (a CLI, not a user-facing route). Output is the standardized
  `.json` — the only artifact the seed step knows about.
- **Seed** = trivial, provider-agnostic: pull the `.json` bundle from the
  object store → validate via `ClimateRecord` → `service.seed_dataset(...)`.
  This is what runs in dev reset/reseed and the Render seed job.
- **Source-of-truth** (raw files *and* the standardized `.json`) lives in the
  **private object store** (MinIO local / Cloudflare R2 prod), never in git.

## Phase map

| Phase | Doc | What |
|---|---|---|
| 1 | `phases/phase-01-phius-objectstore-pipeline.md` | Process→seed over the object store; full Phius 2022; dev reset/reseed wiring; public-repo cleanup (partly done). **Independent, build now.** |
| 2 | `phases/phase-02-phi-importer.md` | The PHI/PHPP 10.6 `.xlsx` process step (the ~130-column workbook map). Reuses the Phase-1 seams. |
| 3 | `phases/phase-03-render-seed.md` | On-demand idempotent prod seed from R2 into the Render Postgres. |

## Read order

1. `PRD.md` — decisions, two-stage scope, artifact format, tests, exit
   criteria.
2. `STATUS.md` — current state, gate, next step.
3. `phases/phase-01-phius-objectstore-pipeline.md` — the buildable-now plan.
4. Precedent: `backend/features/climate/importers/phius.py` (the Phius parser
   to refactor into the process step) and `backend/features/assets/storage_r2.py`
   (the object-store client to reuse).

## Decisions locked with Ed (2026-06-14)

- Runtime store stays **Postgres** — no second DB, no Cloudflare KV/D1
  (confirms D-CL-8). The data is ~5 MB; Postgres is more than enough.
- Source-of-truth → **private object store** (R2/MinIO), never git.
- **PH-Nav-V2 is the only consumer** — no shared package/repo for now.
- Standardize to **`.json`** (the `ClimateRecord` shape) via an **admin-only
  process step**; seed loads only `.json`.
- The 25 committed real Phius files → **remove from HEAD, do not rewrite
  history**; add a `.gitignore` guard.
