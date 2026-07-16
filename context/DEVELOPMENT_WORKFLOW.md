---
DATE: 2026-07-16
STATUS: CANONICAL DEVELOPMENT AND DEPLOY WORKFLOW
RELATED:
  - CLAUDE.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
  - .github/workflows/ci.yml
---

# Development Workflow

PH-Navigator production deploys from the canonical GitHub repo
`bldgtyp/ph-navigator` through Render services that track `main` with
**auto-deploy off**. Merging to `main` does NOT deploy. The production deploy
event is the **"Deploy Production" GitHub Actions workflow**
(`.github/workflows/deploy.yml`) — run it manually from `main`, or push a `v*`
tag on the tip of `main`. Deploying is Ed's decision; agents never trigger it.

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
deployable changes. Merging no longer builds anything on Render, but `main`
must stay deployable at all times — the next Deploy Production run ships its
tip.

Emergency hotfix exception: direct `main` work is acceptable only when Ed
explicitly asks or when a production issue warrants an immediate deploy. Note
that a hotfix is now two steps — merge/push to `main`, then run Deploy
Production. State the risk, run the narrowest meaningful check first, and
verify production after the deploy.

## Deploying To Production

Render auto-deploy is off (`render.prod.yaml` → `autoDeployTrigger: "off"`), so
deploys are explicit and batched: merge freely to `main`, then ship a bundle of
merges as one deploy when ready.

Two equivalent triggers for `.github/workflows/deploy.yml`:

```bash
# Versioned release (preferred for bundles of work):
git switch main && git pull --ff-only
git tag v0.x.y && git push origin v0.x.y

# Or manual: GitHub → Actions → "Deploy Production" → Run workflow (from main)
```

The workflow refuses to run unless the triggering ref is the tip of `main` —
production history stays linear, and an old tag can't ship stale code onto a
newer database schema. It then waits for the required CI checks on that commit
to pass, hits both Render deploy hooks pinned to the exact commit (`&ref=`),
polls `https://api.ph-nav.com/api/v1/version` until `git_sha` matches, and
smoke-checks the public surfaces.

Setup it depends on (already provisioned; re-create if services are rebuilt):

- Repo secrets `RENDER_DEPLOY_HOOK_API` / `RENDER_DEPLOY_HOOK_WEB` — the
  per-service deploy-hook URLs from the Render dashboard.
- Auto-deploy off on both Render services (Blueprint + dashboard setting).

GitHub Actions CI still runs on every push and pull request
(`.github/workflows/ci.yml`); that is verification, not deployment.

## Build-Minute Discipline

- Batch small edits locally on a feature branch instead of pushing many tiny
  commits.
- Push feature branches when review, backup, or CI evidence is useful; do not
  push every trivial local checkpoint.
- Prefer one merge/squash/fast-forward to `main` per coherent task; bundle
  several merged tasks into one Deploy Production run.
- For production config changes, validate `render.prod.yaml` before the merge.

Do not over-optimize by skipping important tests. Build-minute control is about
avoiding noisy builds, not avoiding verification.

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

Merging to `main` ends the code task. Deployment is a separate, explicit step
(see "Deploying To Production" above). After a Deploy Production run finishes:

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
- Never trigger the Deploy Production workflow (no `v*` tags, no
  `gh workflow run deploy.yml`) unless Ed explicitly asks. Merging to `main` is
  safe; deploying is Ed's call.
- If the user asks to "proceed" on implementation, work on the current feature
  branch and keep docs/status current.
- If the user asks for a production change, remind them that after the merge to
  `main` they still need to run Deploy Production to ship it.
- Use `context/PRODUCTION_DEPLOYMENT.md` for current service IDs, URLs,
  Blueprint facts, DNS, R2, auth/cookie posture, and Render verification.
