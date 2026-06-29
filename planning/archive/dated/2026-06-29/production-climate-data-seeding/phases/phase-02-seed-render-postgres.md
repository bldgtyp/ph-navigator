---
DATE: 2026-06-29
TIME: 17:39 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Seed production Render Postgres from published R2 climate bundles.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ../decisions.md
  - backend/features/climate/seeding.py
  - backend/features/climate/service.py
---

# Phase 02 - Seed Render Postgres

## Goal

Populate production `climate_dataset` and `climate_dataset_location` rows from
the PHIUS and PHI bundles published in P01.

## Outcome

Complete on 2026-06-29 at 17:39 EDT.

Production DB write performed:

- Render one-off job `job-d91eb7favr4c73fgdglg` on `ph-navigator-api`
  (`srv-d909p1b7uimc7396t580`).
- Command:
  `uv run python -m features.climate.seeding --all --no-replace`.
- Status: `succeeded`; started `2026-06-29T21:37:33Z`, finished
  `2026-06-29T21:38:17Z`.

Verification:

```text
provider,version,label,locations
phi,10.6,PHI 10.6,1002
phius,2022,Phius 2022,1007
```

Project climate sources remain empty before P03 smoke:

```text
kind,sources
```

Proceed to P03 live app smoke.

## Preconditions

- P01 success gate passed.
- Render Shell or one-off Job is available for `ph-navigator-api`.
- Root directory is `backend`.
- Service env includes production `DATABASE_URL` and R2 settings.

## Preferred command

For the first production seed or a no-op safety run:

```bash
uv run python -m features.climate.seeding --all --no-replace
```

Use only for intentional replacement:

```bash
uv run python -m features.climate.seeding --all
```

Why: default replacement deletes and rebuilds a provider/version row, cascading
its locations. The app can read stale existing project source payloads, but new
attach/update validates against live location IDs. Avoid replacement unless the
operator intentionally accepts that behavior.

## Verification SQL

Run after the seed:

```sql
SELECT d.provider, d.version, d.label, count(l.id) AS locations
FROM climate_dataset d
LEFT JOIN climate_dataset_location l ON l.dataset_id = d.id
GROUP BY d.provider, d.version, d.label
ORDER BY d.provider, d.version;
```

Check project source state:

```sql
SELECT kind, count(*) AS sources
FROM project_climate_source
WHERE kind IN ('phius', 'phi', 'weather')
GROUP BY kind
ORDER BY kind;
```

Optional sample by project:

```sql
SELECT p.bt_number, p.name, s.kind, s.label, s.ref, s.data->>'dataset_version' AS dataset_version
FROM project_climate_source s
JOIN projects p ON p.id = s.project_id
WHERE s.kind IN ('phius', 'phi', 'weather')
ORDER BY p.bt_number, s.kind;
```

## Success gate

Production DB reports seeded rows for:

- `phius / 2022`
- `phi / 10.6`

Location counts match P00 accepted counts or the operator records a clear
explanation.

Seeder output is captured in `STATUS.md` or a phase evidence note.

## Abort conditions

Stop and do not proceed to P03 if:

- The seeder says no published bundles were found.
- Only one provider seeds and the missing provider was not intentionally
  deferred.
- Counts are unexpectedly low.
- Render Shell is connected to a non-production service while targeting
  `ph-navigator-prod`, or vice versa.

## Rollback

If `--no-replace` was used and bad rows were inserted, delete the affected
dataset row only after confirming no project sources point at its locations.

If plain `--all` replaced a good production dataset with a bad bundle, publish
the correct bundle and rerun plain `--all` for that provider/version, then
re-smoke existing project source behavior.
