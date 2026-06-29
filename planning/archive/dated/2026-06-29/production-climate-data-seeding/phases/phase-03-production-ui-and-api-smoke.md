---
DATE: 2026-06-29
TIME: 17:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Verify live production Climate workflows after seeding.
RELATED:
  - ../README.md
  - ../PLAN.md
  - frontend/src/features/climate/
  - backend/features/project_climate_source/
  - backend/features/project_location/
---

# Phase 03 - Production UI And API Smoke

## Goal

Verify that production users can actually use the seeded climate data from the
live app, not just that rows exist in Postgres.

## Preconditions

- P02 success gate passed.
- A production editor account is available.
- Target project has a saved location with latitude and longitude.
- Operator understands PH-Navigator's single-active-session behavior before
  signing in as a production user.

## Outcome

Complete on 2026-06-29.

Manual production testing confirmed:

- PHIUS workflow works in production after P01/P02.
- PHI workflow works in production after P01/P02.
- Hourly Climate workflow works in production after P01/P02.
- No new production browser/API blocker was reported after manual smoke.

## Prior blocker

P02 passed and production has candidate projects with saved coordinates, but no
safe non-Ed active browser account is available to this operator.

Read-only production checks on 2026-06-29:

- Active password users are `admin@bldgtyp.com` and `ed@bldgtyp.com`.
- `codex-prod-smoke@example.com` exists but is inactive and has no editor
  capability.
- Candidate smoke project:
  `1c11786d-3a6f-414a-b1d5-b9caca348454`,
  `PROD-20260628-0919 - R2 Upload Smoke`, Housatonic, MA.
- Alternate real project:
  `a0f6b57c-1dc3-4433-8940-498b78d113ce`, `Linde Residence`, Fort Collins, CO.

Resolved by manual operator testing.

## PHIUS smoke

1. Open `https://www.ph-nav.com`.
2. Sign in as an authorized production editor.
3. Open the target project Climate tab.
4. Open `Set Phius Climate Data`.
5. Confirm the modal shows a dataset label and station count, not:
   `No Phius dataset is available yet.`
6. Use `Find Nearest`.
7. Select a station.
8. Attach or replace the PHIUS source.
9. Confirm the sidebar source card changes from `NOT SET` to attached.

Success evidence:

- Project id.
- Attached source kind `phius`.
- Attached station label.
- Dataset version.
- Any proximity warning/fail message.

## PHI smoke

Repeat the same flow for `Set PHI Climate Data`.

Success evidence:

- Project id.
- Attached source kind `phi`.
- Attached station label.
- Dataset version.
- Any advisory message.

## Hourly Data smoke

Hourly uses the weather-source path.

1. Open `Set Hourly Climate Data`.
2. Confirm OneBuilding roster loads for the project state or any-state mode.
3. Select a weather file.
4. Attach weather file.
5. Confirm the Hourly source card changes from `NOT SET` to attached.
6. Confirm DB/R2 evidence:
   - `project_climate_source.kind='weather'`.
   - `project_climate_source.ref` points at a `project_assets.id`.
   - `project_assets.asset_kind='epw'`.
   - asset `object_key` exists in R2.

If OneBuilding catalog/network is unavailable, use the manual upload modal with
a valid EPW and optional STAT/DDY files, then verify the same source/asset
contract.

## Verification SQL

For the target project:

```sql
SELECT kind, label, ref, data
FROM project_climate_source
WHERE project_id = '<project id>'
ORDER BY kind;
```

For the Hourly asset:

```sql
SELECT id, asset_kind, object_key, upload_status, content_type, size_bytes
FROM project_assets
WHERE id = '<weather ref asset id>';
```

## Success gate

- PHIUS picker shows stations and attaches a source.
- PHI picker shows stations and attaches a source.
- Hourly Data attaches a `weather` source and writes an uploaded EPW asset row.
- No new browser/API error appears in the live flow.

## Rollback

If smoke attaches to a real client project only for testing, remove the test
source through the UI or a planned SQL cleanup after recording evidence. Do not
delete R2 objects directly unless their DB `project_assets` row is also handled
through the app's asset lifecycle.
