---
DATE: 2026-06-28
STATUS: CANONICAL DEVELOPMENT AND DEPLOY WORKFLOW
RELATED:
  - CLAUDE.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
  - .github/workflows/ci.yml
---

# Development Workflow

PH-Navigator production now deploys from the canonical GitHub repo
`bldgtyp/ph-navigator` through Render services that track `main`. Every `main`
update should be treated as a production deploy trigger.

## Branch Policy

Default to feature branches:

```bash
git switch main
git pull --ff-only
git switch -c codex/<short-task>
```

Use `codex/<short-task>` for agent-authored branches unless the user asks for a
different branch name. Keep unrelated changes out of the branch.

Avoid direct-to-`main` commits for normal work. Main is for accepted, coherent,
deployable changes. This reduces accidental Render production builds, keeps the
deploy history readable, and makes rollback decisions easier.

Emergency hotfix exception: direct `main` work is acceptable only when Ed
explicitly asks or when a production issue warrants an immediate deploy. State
the risk, run the narrowest meaningful check first, and verify production after
the deploy.

## Build-Minute Discipline

Render production services track `main`. A merge or push to `main` can trigger
new Render builds for `ph-navigator-api` and `ph-navigator-web`. GitHub Actions
also run on every push and pull request (`.github/workflows/ci.yml` has both
`push` and `pull_request` triggers).

Practical rules:

- Batch small edits locally on a feature branch instead of pushing many tiny
  commits to `main`.
- Push feature branches when review, backup, or CI evidence is useful; do not
  push every trivial local checkpoint.
- Prefer one final merge/squash/fast-forward to `main` per coherent task.
- For docs-only work, still branch and aggregate. It may run GitHub Actions, but
  it should not trigger Render until merged to `main`.
- For production config changes, validate `render.prod.yaml` before the merge.

Do not over-optimize by skipping important tests. Build-minute control is about
avoiding noisy production deploys, not avoiding verification.

## Local Iteration

Use focused checks while working:

```bash
make frontend-dev-check      # frontend layout/component work
cd backend && uv run pytest tests/test_health.py
cd frontend && pnpm exec vitest run src/features/.../name.test.tsx
```

Use the full closeout gate when the change is accepted and ready:

```bash
make format
make ci
```

If formatting changes files, inspect the diff and rerun the relevant checks.

## Deploy-Aware Closeout

Before a branch is merged to `main`:

1. Confirm the diff is coherent and does not include unrelated local work.
2. Run focused tests for the changed surface.
3. Run `make format`.
4. Run `make ci` for substantial code changes.
5. For `render.prod.yaml`, run:

   ```bash
   render blueprints validate ./render.prod.yaml -o json
   ```

6. Update durable docs when the change affects deployment, env vars, URLs,
   schema contracts, user-visible workflows, or operating procedures.

After `main` is updated and Render deploys:

```bash
curl -fsS https://api.ph-nav.com/api/v1/ready
curl -I https://www.ph-nav.com
```

For auth, upload, R2, custom-domain, or admin-user changes, add a browser smoke
on `https://www.ph-nav.com` and check Render logs for errors with the matching
`request_id`.

## Agent Notes

- Do not end a task by pushing directly to `main` unless that was explicitly the
  goal.
- If the user asks to "proceed" on implementation, work on the current feature
  branch and keep docs/status current.
- If the user asks for a production change, explain when the final merge to
  `main` will trigger Render.
- Use `context/PRODUCTION_DEPLOYMENT.md` for current service IDs, URLs,
  Blueprint facts, DNS, R2, auth/cookie posture, and Render verification.
