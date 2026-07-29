---
DATE: 2026-07-28
STATUS: CANONICAL LICENSED DATASET RUNBOOK
RELATED:
  - context/DATA_STORAGE.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
  - backend/features/datasets/
  - planning/features/licensed-data-pipeline/
---

# Licensed Dataset Pipeline

This is the operator and developer runbook for reviewed licensed reference
data:

```text
private ph-navigator-data repo → CI → private R2/MinIO → PHN
```

The private repo is the source of truth. R2/MinIO is the distribution layer.
PHN reads only the object store and never GitHub. This public repo carries
schemas, loaders, and appliers but never licensed table values.

## Hard rules

1. Never copy licensed values into this repo, public issues/PRs, test fixtures,
   logs, screenshots, or chat. Refer to a dataset by slug, version, and SHA-256.
2. `ph-navigator-data` stays private. Every dataset has `dataset.json`,
   `schema.json`, `PROVENANCE.md`, and a committed manifest entry.
3. Published version keys are immutable. Correct data with a new integer
   version; there is no force-overwrite path.
4. The publisher uploads all immutable objects before
   `datasets/manifest.json`. A failed publish must not expose a partial set.
5. Production publish, deploy, apply, rollback, and object deletion are
   explicit Ed-operated events. Agents may implement and verify the machinery
   locally but do not trigger those events.

## Dataset kinds

| Kind | Where values are used | Activation |
|---|---|---|
| `runtime_read` | Parsed directly from the manifest-pinned object and cached by the API process | Publish, then restart/cache-reset the API |
| `db_seed` | Idempotent applier writes absolute values into Postgres and records `applied_datasets` | Publish, then dispatch **Apply Production Datasets** |

`backend/features/datasets/registry.py` is the code-side roster. A manifest
entry without a registry spec is **data ahead of code**; a registry spec with
no published entry is **code ahead of data**. `make datasets-status` reports
both states.

## Add or change a dataset

Work only in the private
`~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-data` checkout:

1. Branch from its current `main`.
2. For a new stable kebab-case slug, add:
   `datasets/<slug>/dataset.json`, `schema.json`, and `PROVENANCE.md`.
3. Add or update the same slug in `manifest.json`. New datasets start at
   version `"1"`; changed bytes advance exactly one integer version and update
   the SHA-256 and immutable key.
4. Validate without printing payloads:

   ```bash
   python tools/publish.py --validate --base-ref main
   python -m unittest discover -s tests
   ```

5. Open a private PR. Review the data diff against the edition/table cited in
   `PROVENANCE.md`, as well as schema, units, row identity, version, checksum,
   and key.
6. Merge only when publication is intended. The private repo's
   **Publish Licensed Datasets** workflow validates again, uploads immutable
   objects, and uploads the manifest last.

Do not hand-upload production data and do not restore a retired per-dataset
seed script. If CI cannot publish, fix or rerun CI.

## Local development

Prerequisites: PHN's Postgres and MinIO are running and the private data repo
is checked out at `PHN_DATA_DIR` (default `../ph-navigator-data`).

```bash
make datasets-publish-local
make datasets-status
make datasets-apply ARGS=--all-pending
```

`datasets-publish-local` runs the private repo's real publisher against MinIO.
It is idempotent. `datasets-status` prints only slug, kind, published and
applied/loaded versions, checksum, and mismatch classes. `datasets-apply`
prints only slug/version/checksum and matched/updated/unchanged/unmatched
counts.

Apply one DB-seed dataset while developing with:

```bash
make datasets-apply ARGS="--slug <slug>"
```

A fresh public checkout without `ph-navigator-data` must still boot and pass
CI. Tests use invented synthetic payloads only; missing licensed data is an
honest typed-unavailable state.

## Apply in production

Production DB-seed activation is the manual-dispatch GitHub Actions workflow
`.github/workflows/apply-production-datasets.yml`, displayed as
**Apply Production Datasets**.

One-time repository configuration:

- Actions secret `RENDER_API_KEY`: Render API key held by Ed.
- Actions variable `RENDER_API_SERVICE_ID`: production
  `ph-navigator-api` service ID from `context/PRODUCTION_DEPLOYMENT.md`.

The workflow:

1. refuses a non-`main` dispatch;
2. verifies that the live API SHA equals the tip of `main`, so the Render
   one-off job cannot use an older artifact;
3. creates a Render job over the API service's latest successful build;
4. runs
   `scripts.datasets_apply --all-pending` with the explicit production guard
   and a `github-actions:<actor>:<run-id>` audit identity;
5. waits for a terminal Render status and copies the job-scoped sanitized
   `ApplyReport` logs into Actions.

Normal production order for a DB-seed dataset:

1. Merge the private data PR and watch **Publish Licensed Datasets** finish
   green.
2. Merge and explicitly deploy any PHN registry/applier change first.
3. Confirm the deployed API SHA is the tip of `main`.
4. GitHub → Actions → **Apply Production Datasets** → **Run workflow** on
   `main`.
5. Require a green Render job. Review every unmatched count; `unmatched > 0`
   is a data/catalog reconciliation issue even though the job completed.
6. Re-run the workflow when useful: with nothing pending it reports
   `No pending db-seed datasets.` and writes nothing.

Do not add dataset application to the API start command. Publishing and
deploying remain separate from applying.

## Runtime-read activation and the ASHRAE film cutover

`ashrae-surface-films` is a `runtime_read` dataset. No database apply occurs.
The rollout order is load-bearing:

1. Merge/publish `ashrae-surface-films` v1 from `ph-navigator-data`.
2. Verify production `datasets/manifest.json`, the pinned object checksum, and
   `datasets-status` from the production API environment without printing
   payload values.
3. Deploy the PHN code that reads only the manifest-pinned key.
4. Restart the API (or use its cache-reset hook) and confirm ASHRAE thermal
   requests succeed.
5. Only after that proof, delete the retired
   `standards/ashrae/surface_films.json` object from the production bucket.

The PHN feature branch removes the legacy fallback. Do not deploy it before
step 1 succeeds. The retired `scripts.seed_surface_films` exits with a pointer
to this runbook.

## Status and mismatch handling

`make datasets-status` returns nonzero when it finds:

- `data_ahead_of_code` — published slug has no registry entry;
- `code_ahead_of_data` — registry entry is absent from the manifest;
- `runtime_version_mismatch` — a process has a different runtime-read version
  loaded than the manifest now pins;
- `unapplied_pending` — DB-seed version awaits an apply;
- `checksum_mismatch` — fetched bytes do not match the manifest.

A missing manifest, missing pinned object, malformed payload, or checksum
failure is never replaced by another standard's values. Repair the publish or
rollback the manifest.

## Rollback

Rollback starts in `ph-navigator-data`:

1. Open a private PR that restores the prior manifest entry. Do not delete or
   overwrite either immutable object.
2. Merge and watch the publish workflow repoint the production manifest.
3. For `runtime_read`, restart/cache-reset the API and verify the loaded
   version.
4. For `db_seed`, dispatch **Apply Production Datasets**. Appliers set
   absolute values, so applying the republished older version is the data
   rollback; the new `applied_datasets` audit row records who ran it.

If a DB-seed apply caused broader damage, follow
`context/PRODUCTION_DEPLOYMENT.md` / `context/DATABASE_BACKUPS.md`; database
restore remains Ed's action.

## Failure recovery

| Symptom | Response |
|---|---|
| Private CI stops before manifest upload | Fix/rerun; readers remain on the old manifest |
| Immutable key already holds different bytes | Bump the dataset version; never overwrite |
| Manifest points to a missing object or bad checksum | Hard stop; repair or revert the private manifest |
| Apply workflow says deployed SHA differs from `main` | Run **Deploy Production** first |
| Render job fails | Inspect the job link/logs in Actions; fix code/data, deploy if needed, rerun |
| `unmatched > 0` | Reconcile stable target row identities; do not silently accept missing rows |
| Runtime dataset still shows old version | Restart/cache-reset API processes, then rerun status |

The production publisher holds write credentials. PHN and its one-off apply
job use the API service's existing R2 credentials; the dataset read/apply path
itself requires only object-read permission.
