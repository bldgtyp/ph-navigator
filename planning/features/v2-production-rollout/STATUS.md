---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Blocked
AUTHOR: Claude (for Ed May)
SCOPE: Live status + open decisions for the new PH-Navigator V1 production rollout.
RELATED:
  - ./PLAN.md
  - ./README.md
  - ../admin-user-management/STATUS.md
  - ../../features_v2.0/public-account-recovery/STATUS.md
  - ../../features_v2.0/account-security-hardening/STATUS.md
---

# Status — PH-Navigator V1 Production Rollout

**State:** Step 1 complete, then **gated** (2026-06-27). Render account, V0
hosting, domain/DNS setup, naming policy, and cost-sizing facts are mapped and
verified. Production rollout execution is blocked behind
`planning/features/admin-user-management/`.

**Gate update (2026-06-27):** the admin-user-management MVP is **implemented and
tested end-to-end** (Phases 00–06, `make ci` green) — invite, admin reset link,
deactivate/reactivate, Admin grant/revoke, last-admin protection, Origin +
`X-PHN-CSRF` guard, capability-gated UI, audited bootstrap. The gate is not yet
cleared: it still needs the manual staging/prod-shape rehearsal + browser smoke
(see `../admin-user-management/phases/phase-06-production-rehearsal.md`). New
prod env vars to set (sync:false): `ACCOUNT_TOKEN_SECRET`, `FRONTEND_BASE_URL`.

## Production-readiness gate

Do not proceed to paid V1 production services, production account creation, DNS
cutover, or GitHub repo canonicalization until Admin User Management reaches the
agreed **two-user MVP** threshold. The gate is tracked in
`planning/features/admin-user-management/` and must include, at minimum:

- invite-only user creation;
- admin-generated reset links without temporary admin-set passwords;
- minimal admin user dashboard;
- user deactivation/reactivation;
- `admin.users.manage` capability enforcement;
- CSRF/origin protection or verified `SameSite=Lax` production cookie posture
  for unsafe credentialed admin mutations;
- last-admin lockout protection;
- audit logging for sensitive user actions.

Not part of this rollout gate: public self-service reset, transactional email,
durable public reset/invite-resend rate limiting, fresh admin re-authentication,
MFA/passkeys, external users, richer IAM, and audit export. Those are tracked in
`planning/features_v2.0/`.

Allowed before this gate clears: local development, planning, `render.prod.yaml`
drafting, and optional Phase 0 staging sanity checks that do not create the real
paid production environment or move public domains.

## Decisions — settled (2026-06-27)

1. ✅ **Fresh data, no migration** — new V1 launches empty; existing projects
   stay on legacy V0 at `v0.ph-nav.com` and get recreated in V1 as we go.
2. ✅ **`api.ph-nav.com`** — V1 backend gets its own subdomain; prod blueprint
   targets it (and fixes the `VITE_API_BASE_URL`/MCP naming wrinkle).
3. ✅ **Budget** — approved to pay for V1's own paid Postgres + always-on web
   service. V0 currently uses `Basic-256mb` Postgres with 1 GB disk and a
   `Standard` 1 CPU / 2 GB backend; V1 should use paid Postgres and an
   intentionally chosen always-on web tier.
4. ✅ **V0 home** — `v0.ph-nav.com`.
5. ✅ **Repo names after cutover** — legacy repo becomes `ph-navigator_v0`; new
   repo takes over canonical `ph-navigator`; future product versions are normal
   releases inside that repo, not new repos.
6. ✅ **Future naming policy** — canonical URLs/repos/folders stay unversioned;
   only deprecated generations get numbered aliases. `/api/v1` remains the API
   contract version and is not tied to the product generation name.

## Cost-sizing facts from Render screenshots (2026-06-27)

- `ph_navigator` (V0 prod DB): `Basic-256mb` + `Basic-256mb Disk (1GB)`;
  current month-to-date datastore charge shown as `$5.67`.
- `ph-navigator-backend` (V0 web): `Standard`, `1 CPU`, `2 GB`; current
  month-to-date service charge shown as `$22.49`.
- For V1: start with the smallest paid Postgres (`Basic-256mb`, 1 GB disk) and
  choose the web tier intentionally. Matching V0's `Standard` tier is safer;
  starting smaller is acceptable only if Render performance/availability gates
  are checked during Phase 1.

## Step 1 completion

Complete as of 2026-06-27. No additional assumptions need confirmation before
the admin-user-management gate. The only tier choice deferred into execution is
whether V1 web should match V0 `Standard` immediately or prove a smaller paid
always-on tier during Phase 1 smoke/performance checks.

## Execution surface (who does what)

The work splits into two surfaces:

- **In-repo (Claude can do now, no dashboard):**
  - Author `render.prod.yaml` (paid DB + always-on web, prod env values,
    `api.ph-nav.com` / `www.ph-nav.com`, consistent MCP naming, prod secrets as
    `sync: false`).
  - Stage the one-line V0 CORS change (`https://v0.ph-nav.com`) in the V0 repo.
  - Add the GitHub repo rename/reorg choreography to the rollout phase plan.
  - Update `context/ENVIRONMENT.md` with a "Render production" section (Phase 4).
- **Dashboard / DreamHost (needs Ed; browser extension not paired this session
  — use screenshots):**
  - Resume/suspend services; apply the blueprint; create the R2 prod bucket +
    CORS; enter prod secrets; add/move custom domains; edit DNS records; run the
    audited first-admin bootstrap after Admin User Management lands; seed climate
    data.

## Next concrete step

Decisions are settled (above). Next: complete the
`planning/features/admin-user-management/` MVP gate. Optional, non-production
pre-work can continue: resume the suspended new-app `*-staging` services for a
Phase 0 sanity check and/or draft `render.prod.yaml`, but Phase 1+ production
execution waits until the gate clears.

No open Step 1 decisions remain.

## Verification log

- 2026-06-27 — DNS: `www`→V0 static (200), apex→Render anycast→301 www;
  `api`/`v0` absent. Dashboard: 1 project, V0=Production (paid PG16, Ohio),
  new app=Staging (3 services suspended by Ed), Hobby workspace. Render free-Postgres
  cap = 1/workspace (paid unlimited) — confirms two DBs coexist.
- 2026-06-27 — Ed screenshots confirmed V0 backend tier (`Standard`, 1 CPU /
  2 GB) and V0 DB tier (`Basic-256mb`, 1 GB disk). Step 1 assumptions locked.

## Notes / wrinkles to fix in prod blueprint

- Staging `render.yaml` points `VITE_API_BASE_URL`/MCP URLs at
  `ph-navigator-v2.onrender.com` while the API service is
  `ph-navigator-v2-api-staging` — make these consistent in `render.prod.yaml`
  (target `api.ph-nav.com`).
- Product/repo naming now differs from the local checkout name until the rename
  phase completes: legacy app = V0, new app = V1, current local folder still
  `ph-navigator-v2`.
- Production account seeding must not reuse local/staging credentials. Verified
  2026-06-27 that `seed_user.py`, `seed_dev_db.py`, agent fixture seeds, and
  catalog seed scripts refuse production after the catalog-script guard fix.
- Admin user management is now a hard MVP gate, tracked separately in
  `planning/features/admin-user-management/`. Initial prod account creation no
  longer proceeds as the normal rollout path; production launch waits for
  bootstrap, invite, admin reset-link, deactivate/reactivate, admin-grant, and
  audit flows to meet the gate. Public reset/email and hardening are v2.0
  follow-ups.
