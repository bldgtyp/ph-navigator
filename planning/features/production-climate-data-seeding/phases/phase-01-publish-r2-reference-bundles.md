---
DATE: 2026-06-29
TIME: 17:35 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Publish full PHIUS and PHI reference bundles to production Cloudflare R2.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ../decisions.md
  - backend/features/climate/processing.py
  - backend/features/climate/object_store.py
---

# Phase 01 - Publish R2 Reference Bundles

## Goal

Upload the standardized full PHIUS and PHI bundles to production R2 under the
backend-controlled climate namespace.

## Outcome

Complete on 2026-06-29 at 17:35 EDT.

Production writes performed:

- `climate/phius/2022/dataset.json`
- `climate/phi/10.6/dataset.json`

Upload evidence:

- PHIUS command processed 1007 stations and uploaded
  `climate/phius/2022/dataset.json`.
- PHI command processed 1002 stations and uploaded
  `climate/phi/10.6/dataset.json`.

R2 HEAD verification against `ph-navigator-prod`:

- `climate/phius/2022/dataset.json`: size `4807491`, content type
  `application/json`, ETag present.
- `climate/phi/10.6/dataset.json`: size `4775302`, content type
  `application/json`, ETag present.

Proceed to P02 with:

```bash
uv run python -m features.climate.seeding --all --no-replace
```

## Preconditions

- P00 completed. Current production R2 keys are missing, so upload is required.
- Source counts are accepted:
  - PHIUS 2022: 1007 records.
  - PHI 10.6: 1002 records.
- Operator has production R2 credentials in the local shell.
- Target bucket is confirmed as `ph-navigator-prod`.

## Commands

Run from `backend/` in a local operator shell:

```bash
export R2_ACCOUNT_ID='<account id>'
export R2_ACCESS_KEY_ID='<access key id>'
export R2_SECRET_ACCESS_KEY='<secret>'
export R2_BUCKET='ph-navigator-prod'
export R2_ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
```

Publish PHIUS:

```bash
uv run python -m features.climate.processing \
  --provider phius \
  --version 2022 \
  --src ../planning/archive/dated/2026-06-14/climate/example_data \
  --upload
```

Publish PHI:

```bash
uv run python -m features.climate.processing \
  --provider phi \
  --version 10.6 \
  --src ../planning/archive/dated/2026-06-14/climate/example_data/phi_phpp_10_6_climate_data \
  --upload
```

Expected object keys:

```text
climate/phius/2022/dataset.json
climate/phi/10.6/dataset.json
```

## Verification

Use Cloudflare dashboard, `aws s3api head-object` with the R2 endpoint, or a
small `R2Client.head_object` operator snippet to confirm both objects exist.

Record:

- object keys,
- upload timestamp,
- processing output counts,
- source path used,
- operator initials.

## Success gate

Both R2 objects exist in `ph-navigator-prod`, and processing output reports:

- PHIUS 2022: accepted count from P00.
- PHI 10.6: accepted count from P00.

## Abort conditions

Stop immediately if:

- `R2_BUCKET` is not `ph-navigator-prod`.
- `--src` points at `backend/seeds/climate`.
- Processing reports unexpectedly low counts.
- Upload writes to a staging/dev bucket.

## Rollback

If the wrong bundle was uploaded before seeding, delete the wrong object from
R2 and rerun P01 with the correct source. If Postgres was already seeded from
the wrong bundle, stop and plan an intentional replace-style P02 rerun after
confirming project-source impact.
