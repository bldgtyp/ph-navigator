---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Active — drafted from the 2026-07-28 options discussion (Ed confirmed A)
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Contract for the licensed-data pipeline — the private `phn-data` source
  repo, its CI publish path to R2, and the PHN-side `datasets` feature
  (registry, applied-tracking, status/apply tooling).
RELATED: ./README.md, ./decisions.md, ./STATUS.md,
  context/DATA_STORAGE.md, context/PRODUCTION_DEPLOYMENT.md,
  backend/features/envelope/surface_film_store.py,
  backend/features/climate/object_store.py,
  planning/features/assembly-condensation-risk/PRD.md
---

# PRD — Licensed-data pipeline

## 1. One-paragraph summary

Licensed reference data (ASHRAE surface films today; ISO 10456 µ values next;
more to follow) currently reaches production by an operator running a seed
script in a Render shell against files kept in Dropbox. Replace that with a
pipeline: a **private GitHub repo (`phn-data`) holds the datasets as reviewed,
versioned JSON**; its **CI validates against a schema and publishes to the
existing private R2 bucket** under immutable versioned keys plus a manifest;
and PHN gains a small **`datasets` backend feature** — a registry of known
datasets, manifest-pinned reads for runtime datasets, an idempotent apply path
with an `applied_datasets` audit table for DB-seeded datasets, and
`status`/`apply` CLIs. Production keeps reading only R2; GitHub is never a
runtime dependency.

## 2. Goals

- **No licensed values in the public repo, ever** — unchanged hard rule; the
  pipeline exists so honoring it stops requiring manual operator work.
- **Every published dataset is reviewed, versioned, and diffable** — a µ-value
  transcription typo should be visible in a PR diff and recoverable from git
  history, not buried in a bucket.
- **Publishing is automated** — merging to `phn-data` is the publish event; no
  shells, no copy-paste, no "restart and hope".
- **Applied state is auditable** — one command answers "what version of what
  is published, applied, and expected, here and in production?"
- **Rollback is a revert** — repoint the manifest at a prior version via a
  normal PR; no object-store surgery.

## 3. Non-goals (v1)

- **No migration of the climate bundles.** They are already versioned by
  `(provider, version)`, change rarely (a new PHPP/Phius release), and their
  build step (`processing.build_bundle`) lives in PHN. Grandfathered;
  revisit when they next change. (`decisions.md` §D-8.)
- **No staging promotion flow** — there is no staging environment.
- **No UI** — CLIs and a GitHub Actions workflow only.
- **No scheduled/automatic applies** — applying to production is an explicit,
  Ed-triggered event, same doctrine as deploys.
- **No general ETL** — datasets are hand-curated JSON tables, not feeds.
- **No move of open seed data** (`backend/seeds/*` stays; `decisions.md` §D-2).

## 4. The `phn-data` repo (source of truth)

Private GitHub repo under `bldgtyp` (name = open question Q-1; working name
`phn-data`). **Private forever** — it exists to hold data that must not be
public; its README and description say so.

```text
phn-data/
  README.md                     # what this repo is, licensing posture, how to add a dataset
  manifest.json                 # THE source of truth: name → {version, sha256, key}
  datasets/
    <dataset-slug>/
      dataset.json              # the payload (SI-canonical, shape per its schema)
      schema.json               # JSON Schema; CI validates dataset.json against it
      PROVENANCE.md             # source, edition, license, transcription notes
  tools/
    publish.py                  # standalone publisher (boto3 + jsonschema; no PHN dependency)
  .github/workflows/
    publish.yml                 # PR: validate; merge to main: publish to R2
```

- **Dataset slugs** are kebab-case and stable: `ashrae-surface-films`,
  `iso10456-vapor-mu`, …
- **`manifest.json` is committed and reviewed** — the version bump is part of
  the same PR as the data change. CI enforces the invariant: a changed
  `dataset.json` whose `sha256` no longer matches the manifest entry **fails
  validation unless the version was bumped**. Content and version move
  together or not at all.
- **Versions are simple monotonic integers as strings** (`"1"`, `"2"`).
  Nothing needs semver; immutability does the real work. (Q-4.)
- **Payloads are SI-canonical** and match the consuming loader's existing
  format — the ASHRAE films dataset is byte-compatible with what
  `parse_surface_film_payload` already reads.
- **The publisher is standalone** (`tools/publish.py`, boto3 + jsonschema,
  ~100 lines): CI and Ed's laptop run the same code, against R2 or local
  MinIO. PHN never gains a publish path or write credentials.
  (`decisions.md` §D-3.)

## 5. The R2 layout and manifest

Same private bucket the app already uses (`ph-navigator-prod` in production,
MinIO locally), new prefix:

```text
datasets/<slug>/<version>/dataset.json     # immutable once written
datasets/manifest.json                     # mutable pointer, uploaded LAST
```

Published manifest shape (mirrors the repo's `manifest.json`):

```json
{
  "generated_at": "2026-07-28T16:05:00Z",
  "datasets": {
    "ashrae-surface-films": {
      "version": "1",
      "sha256": "…",
      "key": "datasets/ashrae-surface-films/1/dataset.json"
    }
  }
}
```

Invariants the publisher enforces:

1. **Version keys are immutable.** Publishing refuses to overwrite an
   existing `datasets/<slug>/<version>/…` object whose content differs.
   Republishing identical bytes is a no-op (idempotent CI reruns).
2. **Manifest last.** All dataset objects upload before the manifest switches.
   A publish that dies halfway leaves the old manifest — and therefore every
   reader — fully intact.
3. **Rollback = manifest revert.** Old versions stay in the bucket; a PR that
   reverts a manifest entry to a prior version, merged, repoints every reader.
   No deletion tooling in v1.

Credentials: the R2 write token lives **only** in `phn-data`'s Actions
secrets, scoped to the bucket. The production app keeps its existing
credentials; nothing new lands in Render or in this repo. CI logs print slugs,
versions, and checksums — never payload values.

## 6. The PHN `datasets` feature

New backend feature `backend/features/datasets/` following the standard
layering. It is the *read/apply* half of the pipeline.

### 6.1 Registry

A declarative registry of every dataset the code knows how to consume:

```python
@dataclass(frozen=True)
class DatasetSpec:
    slug: str                              # "ashrae-surface-films"
    kind: Literal["runtime_read", "db_seed"]
    parse: Callable[[dict], object]        # payload → typed value; raises on shape errors
    apply: DatasetApplier | None = None    # db_seed only; idempotent; returns an ApplyReport
```

- **`runtime_read`** — served from R2 at request time. The loader resolves
  the manifest, fetches the pinned versioned key, parses, and caches (the
  existing film-store cache + `reset_…_cache` pattern). Unpublished →
  the existing typed-unavailable behaviour (`surface_film_table_unavailable`
  409 precedent) — never a fallback to another dataset's numbers.
- **`db_seed`** — applied into Postgres by an explicit command. Appliers are
  **idempotent**: running twice writes nothing the second time and says so.
  Each successful apply upserts a row in `applied_datasets`.

### 6.2 `applied_datasets` (Alembic-for-data)

```sql
applied_datasets (
  slug        text        NOT NULL,
  version     text        NOT NULL,
  sha256      text        NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  applied_by  text        NOT NULL,          -- operator / workflow identity
  UNIQUE (slug, version)
)
```

Re-applying an already-applied version refreshes `applied_at` (idempotent
apply, audit stays honest). The latest applied version per slug is
`max(applied_at)`.

### 6.3 CLIs

- `scripts/datasets_status.py` — for every registered dataset: **published**
  version (manifest), **applied** version (`applied_datasets`; `runtime_read`
  shows the currently-loaded version instead), and mismatch flags. Also warns
  on manifest entries with no registry spec (data ahead of code) and registry
  specs with nothing published (code ahead of data). `make datasets-status`.
- `scripts/datasets_apply.py [--slug X | --all-pending]` — fetch, verify
  `sha256` against the manifest, parse, apply, record. Refuses a non-local
  database unless `PHN_DATASETS_ALLOW_PRODUCTION=1` is set (the existing
  guarded-script pattern).

Integrity rule shared by both paths: **a fetched object whose `sha256` does
not match the manifest is a hard error**, not a warning.

### 6.4 First migration: the surface-film table

`surface_film_store.py` currently reads the unversioned key
`standards/<standard>/surface_films.json` — published once, no history, no
rollback. Phase 2 migrates it to the manifest-pinned
`datasets/ashrae-surface-films/<v>/dataset.json` (payload format unchanged),
keeping the typed 409 and the cache-reset hook. The legacy key is read as a
fallback only during the cutover window, then deleted (Phase 3).
`scripts/seed_surface_films.py` is then deprecated in favour of the pipeline.

## 7. Production apply trigger

Applying a `db_seed` dataset to production needs prod DB access and an
explicit human decision. Recommended (decision §D-5, Ed confirms in Phase 3):

- A manual-dispatch GitHub Actions workflow in **this** repo,
  **"Apply Production Datasets"** — same doctrine as "Deploy Production":
  Ed-triggered, never automatic, `concurrency` so applies serialize.
- The workflow calls the **Render API to run a one-off job** on the API
  service: `uv run python -m scripts.datasets_apply --all-pending` (with the
  production override env var). The job runs in the app's own environment —
  correct DB URL, correct R2 credentials, zero new secrets beyond a
  `RENDER_API_KEY`.
- Recorded alternative: GitHub Actions connecting straight to prod Postgres
  with a scoped writer role (the `backup-db.yml` precedent, inverted to
  writes). Viable, but it duplicates app config outside the app and puts DB
  write credentials in a second system. Rejected unless the Render job path
  proves awkward.

`runtime_read` datasets need no apply — a publish takes effect on the next
cache reset or API restart, and the runbook says which.

## 8. Local development and agents

- **Ed / John:** clone `phn-data`, run `tools/publish.py --target local`
  against MinIO — identical code path to CI. Documented as
  `make datasets-publish-local` (thin wrapper that shells to a configured
  `PHN_DATA_DIR` checkout).
- **Agents and tests:** unchanged — **synthetic fixtures only** (the
  film-store fixture precedent, commit `b869a8fc`) and graceful
  typed-unavailable states when nothing is published. No test may require
  licensed data; the skip-if-absent pattern (Hillandale precedent) covers
  anything heavier. A fresh dev environment with no `phn-data` access must
  boot, pass CI, and show honest "unavailable" states.

## 9. Phasing

| Phase | Content | Ships |
| --- | --- | --- |
| **1** | Bootstrap `phn-data`: layout, `manifest.json` + invariant checks, standalone publisher, CI (PR validate / merge publish), first dataset = `ashrae-surface-films` (payload identical to what's live), full drill against local MinIO. | licensed data has a reviewed, versioned home |
| **2** | PHN `datasets` feature: manifest store + integrity checks, registry, `applied_datasets` migration, `datasets_status` / `datasets_apply` CLIs + make targets, film loader migrated to manifest-pinned keys (legacy-key fallback kept). | PHN can read, apply, and audit pipeline datasets |
| **3** | Production: "Apply Production Datasets" workflow → Render one-off job (D-5 confirmed by Ed here); films cutover published via pipeline to prod R2, verified, legacy key deleted; `seed_surface_films.py` deprecated; `context/DATASET_PIPELINE.md` runbook + pointers from `DATA_STORAGE.md` / `PRODUCTION_DEPLOYMENT.md` / `ENVIRONMENT.md`. | the manual shell path is gone |
| **4** | First `db_seed` dataset end-to-end: `iso10456-vapor-mu` authored in `phn-data`, applied locally through the full path (publish → status → apply → idempotent re-apply). Joint milestone with `assembly-condensation-risk` Phase 1, which owns the µ *content* and the catalog columns it lands in. Production apply waits for that feature's own schedule. | the pattern is proven by its first real consumer |

Phases 1–2 are independently valuable; the feature can pause after either.

## 10. Acceptance criteria

1. No licensed values exist in this repository — including test fixtures —
   and the entire publish path (values, schemas, publisher, CI) lives outside
   it. This repo carries loaders, appliers, and synthetic fixtures only.
2. A `phn-data` PR that changes a `dataset.json` without bumping its manifest
   version fails CI.
3. A published `datasets/<slug>/<version>/…` object is never overwritten with
   different content; the publisher errors instead.
4. A publish interrupted before the manifest upload leaves every reader
   serving the previous versions (verified in the Phase 1 MinIO drill).
5. Rollback works as a manifest revert: publish v2, revert to v1 by PR,
   readers serve v1 — drilled locally on the films dataset.
6. `make datasets-status` reports published / applied / loaded versions and
   flags every mismatch class (data-ahead-of-code, code-ahead-of-data,
   checksum mismatch, unapplied pending).
7. `datasets_apply` is idempotent: a second run performs zero writes and
   reports it; both runs upsert exactly one `applied_datasets` row.
8. A checksum mismatch between the manifest and a fetched object is a hard,
   typed error on both the runtime-read and apply paths.
9. The surface-film table serves from the manifest-pinned versioned key with
   behaviour unchanged (including the typed 409 when unpublished); the legacy
   `standards/…` key is deleted after cutover.
10. A fresh dev environment with no `phn-data` checkout boots, passes
    `make ci`, and shows typed-unavailable states — no test requires licensed
    data.
11. Applying to a production database requires both the explicit env override
    and a deliberate dispatch; nothing applies on deploy, startup, or merge.
12. CI logs in both repos print slugs, versions, and checksums only — never
    payload values, never credentials.
