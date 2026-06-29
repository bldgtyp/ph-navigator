---
DATE: 2026-06-29
TIME: 17:30 EDT
STATUS: Decision recorded - dedicated testing account plus seeded fixture approved.
AUTHOR: Codex
SCOPE: Access, credential, account, and production-safety decisions required
  before running authenticated frontend performance tests against production.
RELATED:
  - planning/refactor/production-frontend-performance/README.md
  - planning/refactor/production-frontend-performance/PLAN.md
  - context/PRODUCTION_DEPLOYMENT.md
---

# Phase 00 - Credentials And Access

## Goal

Decide the minimum production access needed to run useful frontend performance
tests while protecting real project data, Ed's active session, and production
secrets.

Decision recorded 2026-06-29: Ed approved setting up a production `testing`
account and seeding it with project data for performance testing, analogous to
the normal local dev seed fixture. This should be implemented as an explicit
production testing fixture, not by bypassing the local-dev guards on existing
seed scripts.

Fixture decision recorded 2026-06-29:

- Testing account email: `codex@testing.com`.
- Fixture project name / BT number: `PERF-STRESS`.
- Fixture size: 250 rows per seeded table for the first production pass. If the
  implementation keeps separate `table_rows` and `equipment_rows` settings, set
  both to `250` for the first pass.
- Include Climate, Envelope, and Apertures fixture data.
- Do not include a 3D Model file in the first fixture.
- Reset policy: reset the same `PERF-STRESS` fixture in place before formal
  runs, preserving a stable `PERF_PROJECT_ID` for scorecard comparability.

## Access Levels By Run Mode

| Run mode | Credentials needed | Project access | Writes? | Notes |
|---|---|---|---|---|
| Public anonymous baseline | None | None | No | Safe now: readiness, headers, sign-in shell, static asset timing |
| Authenticated fixture baseline | Dedicated production `testing` login | Seeded testing fixture project | Optional, scoped | First full route matrix target |
| Disposable write baseline | Dedicated production `testing` login | Editor access to disposable test project only | Yes, scoped | Allowed only inside the fixture project |
| Observability correlation | Optional Render/Cloudflare read-only access | None | No | Only if browser data needs backend/edge attribution |

## Recommended Accounts

### Dedicated Testing Account

Purpose: authenticated route matrix and, if approved for a run, scoped write
timing inside seeded fixture data.

Properties:

- Not Ed's personal account.
- Not John's personal account.
- No admin privileges.
- Viewer/read-only permission is enough for read-only baselines.
- Editor permission is acceptable only on the seeded fixture project when live
  write-path timing is being measured.
- Can sign in normally through `https://www.ph-nav.com/sign-in`.
- Password or one-time setup handled outside the repo.

Why: avoids invalidating Ed's single active session and limits blast radius if
the test harness has a bug.

### Disposable-Project Editor Account

Purpose: optional production write-path timing.

Properties:

- May be the same dedicated perf account promoted only on the disposable test
  project, or a separate account if permissions are easier to reason about.
- Editor permission only on `PERF-PROD-YYYYMMDD` or another explicitly named
  disposable project.
- No admin privileges.
- No access to real client projects unless Ed explicitly approves.

Why: live table-edit timing is useful only if writes are isolated from real
project data.

### Admin / Operator Account

Purpose: account/project setup only.

Properties:

- Used by Ed or an operator to create/invite the test account, assign project
  access, or create/delete the disposable project.
- Not used by the perf harness.
- No admin password, reset link, or session cookie should be given to the
  automation run unless a separate admin workflow is explicitly requested.

## Information Needed From Ed

Required for authenticated testing:

- Approved production testing account email: `codex@testing.com`.
- How the password/session will be supplied at run time.
- Approved seeded fixture project id for `PERF-STRESS`, once created.
- Expected fixture data coverage:
  - Dashboard card visible,
  - Status page representative,
  - Spaces/Rooms rows present,
  - Equipment rows present,
  - Apertures present,
  - Envelope assemblies present,
  - Climate location/source present,
  - Model file intentionally absent,
  - catalog pages accessible.
- Whether the first authenticated matrix should run read-only only, or whether
  scoped write-path timing inside the testing fixture is approved.

Required for production fixture seeding:

- Account email to own/share the fixture: `codex@testing.com`.
- Fixture project naming convention: `PERF-STRESS`.
- Fixture size: 250 rows per seeded table.
- Include Climate, Envelope, and Apertures data in addition to table rows.
- Do not include 3D Model data.
- Reset the same fixture in place before formal runs.
- Where the setup command runs:
  - Render Shell / one-off job with production env,
  - or app/API flows after account creation.

Required for optional write testing:

- Explicit approval to mutate the `PERF-STRESS` testing fixture.
- Disposable project id/name: `PERF-STRESS`.
- Which tables/actions may be edited.
- Whether created test drafts/versions should be deleted, archived, or retained.
- Maximum acceptable row counts if a production stress fixture is created
  manually.
- Preferred run window if we want quiet production traffic.

Optional for deeper attribution:

- Render dashboard access or `RENDER_API_KEY` with read-only scope, if available.
- Cloudflare dashboard/API access with read-only analytics scope, if cache/edge
  attribution is needed.
- Render deploy id or commit SHA for the exact production build under test, if
  it differs from the local checkout.

## Credentials Not Needed

Do not request these for frontend performance testing:

- Production database URL.
- Direct SQL credentials.
- R2 account id, endpoint, access key, or secret.
- Fernet secret.
- Account token secret.
- Production session cookie.
- Ed's personal login, unless Ed deliberately chooses to use it for a manual
  browser-only check.
- One-time invite/reset links in chat or docs.

## Secret Handling Rules

- Never write secrets into this repo.
- Never add a production `.env` file.
- Do not paste passwords into scorecards, planning docs, screenshots, or test
  artifacts.
- Use placeholders in recorded commands:
  `<approved-production-test-email>`, `<approved-production-test-password>`,
  `<approved-production-project-id>`.
- Supply secrets at runtime through the operator's shell or secret manager.
- Prefer an interactive/ephemeral password export over placing literal secrets
  in shell history.
- After the run, scorecards should record account role and project scope, not
  credentials.

## Proposed First Read-Only Command Shape

After Phase 01 harness guards exist:

```bash
cd frontend
E2E_BASE_URL=https://www.ph-nav.com \
E2E_API_BASE_URL=https://api.ph-nav.com \
E2E_EMAIL=<approved-production-test-email> \
E2E_PASSWORD=<approved-production-test-password> \
PERF_PROJECT_ID=<approved-production-project-id> \
PHN_PERF=1 \
PHN_PERF_PRODUCTION=1 \
PHN_PERF_READONLY=1 \
pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts
```

## Decision Record Template

Fill this before Phase 03:

| Decision | Value |
|---|---|
| Production testing account email | `codex@testing.com` |
| Account role | Viewer for read-only, Editor only on fixture for write timing |
| Approved project id | TBD after fixture creation |
| Fixture project id/name | `PERF-STRESS` |
| Fixture row counts | 250 rows per seeded table |
| Fixture content | Include Climate, Envelope, Apertures; exclude 3D Model |
| Fixture reset policy | Reset same fixture in place before formal runs |
| Read-only matrix approved | Yes, once harness guards exist |
| Write-path production testing approved | TBD - fixture only |
| Observability access needed | TBD |
| Run window | TBD |
| Cleanup/retention plan | TBD |

## Recommended Default

Start with:

- public anonymous baseline,
- dedicated production `testing` account,
- one seeded testing fixture project named `PERF-STRESS`,
- guarded read-only route matrix first,
- browser-side timing only,
- no Render/Cloudflare tokens,
- no writes outside the testing fixture.

Escalate only if the first scorecard shows a performance issue that needs
backend/edge attribution or live write-path confirmation.
