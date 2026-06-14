---
DATE: 2026-06-14
TIME: 15:52 EDT
STATUS: Deferred (v2.0 — speculative). Requirements + concerns capture only.
  No decisions are locked; everything here is provisional and subject to the
  RBC partnership actually moving forward.
AUTHOR: Claude (for Ed)
SCOPE: Product/behavior thinking for multi-tenant teams + external membership
  access + downstream tokens, provisioned via an RBC entitlement.
RELATED:
  - README.md
  - STATUS.md
  - backend/features/projects/access.py
  - backend/features/projects/routes.py
  - backend/features/auth/ (service.py, routes.py, models.py, passwords.py)
  - backend/alembic/versions/20260512_0006_mcp_tokens.py
---

# PRD — Multi-Tenant Teams (speculative)

> **This is a thinking document, not a build plan.** It records the use-case,
> the model we currently favor, the requirements that fall out of it, and the
> concerns/open questions to resolve *before* any real planning. Nothing here
> is committed.

## 1. Context & use-case

bldgtyp wants to offer PH-Navigator V2 to **external firms** as a benefit of
their **Reimagine Buildings Collective (RBC)** annual membership. Target scale
is small (~100 users total across all firms). The realistic team shape, from
Ed: in many firms the **engineering work is done by juniors**, while
**seniors/managers oversee**. So the access model must let a manager open
scoped access to their staff and retain firm-wide visibility.

### Partnership / billing shape (the easy part)

- **RBC collects payment** from member firms. bldgtyp does **not** bill
  end-users and does **not** need Stripe, subscriptions, invoicing, or dunning
  *in the app*.
- bldgtyp negotiates a **separate billing contract with RBC** (out of band).
- What the app *does* need is an **entitlement / provisioning** notion: "this
  firm is an active RBC member, entitled to N seats." When membership lapses,
  the firm's access changes (see open questions on suspend vs. lock).
- Implication: **no open public signup.** Onboarding is **invite-driven** —
  bldgtyp (or RBC) provisions a firm + its admin; the admin invites members.
  This is both simpler and safer than public self-registration.

## 2. The tenant-isolation hurdle (recap — the load-bearing change)

Current authorization (verified in code):

- `backend/features/projects/access.py:62-66` — *edit* requires only an
  authenticated user; *view* is allowed even **unauthenticated**. Neither
  compares `project.owner_id` to the caller.
- `backend/features/projects/routes.py:110-127` — therefore any logged-in user
  can read/write **any** project by ID; any anonymous caller can read one.
- Safe today only because the dashboard lists just your own projects and every
  account is trusted staff.

Why it's tractable:

- **One seam.** `access.py` is explicitly the "forward-compatible project
  access seam" — the single chokepoint to add an ownership/membership check.
- **One tenancy column.** Every domain table (versions, status items, assets,
  jobs, drafts, table-views, MCP tokens) hangs off `project_id → projects`.
  Tenancy is added at `projects`, not sprinkled across ~15 tables.

The real work is **breadth, not depth**: audit *every* project-scoped route
(not just the shell routes) to confirm it flows through the seam, then prove —
with tests — that firm A cannot reach firm B's data. Also revisit the
"view = public/unauthenticated" default, which almost certainly must go for
external tenants.

## 3. Team & role model (favored direction)

Introduce a **team = firm = tenant**. Keep **individual project ownership**
(`owner_id`) AND add a firm pointer.

### Entities (provisional)

- `teams` — the firm/tenant. `id`, `name`, RBC entitlement fields (e.g.
  `seat_limit`, `membership_status`, `membership_expires_at`), lifecycle
  columns (`deleted_at`).
- `team_members` — `team_id`, `user_id`, `role`, `joined_at`. Each user
  belongs to one team (start simple; revisit multi-team later).
- `projects.team_id` — the owning firm, **in addition to** `owner_id` (the
  individual creator/owner).

### Roles (start with two)

| Role | Can see | Can manage |
|------|---------|------------|
| **admin** (manager/senior) | **all** projects in their team | team members, invites, seat assignment, access; their firm's projects |
| **member** (junior/engineer) | **only their own** scoped projects (`owner_id == self`) | their own projects only |

### Access rule the seam should encode

> Caller may access project *P* if **(a)** `P.owner_id == caller.id`, **or**
> **(b)** caller is an **admin** of `P.team_id`. (Optional later: **(c)** an
> explicit per-project share for peer collaboration.)

This cleanly expresses "juniors do the work in their own projects; the manager
sees everything." Dashboard/list queries get the same predicate.

### bldgtyp's own position

bldgtyp is itself a team — but also frequently needs to *consult on a client
firm's* project (we're the PH consultant). That implies a **platform/staff
role above team-admin** (cross-tenant, for support + consulting), distinct from
a firm admin. Flagged as an open question, not designed here.

## 4. Token strategy (downstream API + MCP)

Downstream tools — **Rhino/Grasshopper, Honeybee-PH** — and AI/MCP clients need
programmatic access without a browser session.

- **Precedent exists.** `mcp_tokens` (migration `..._0006_mcp_tokens.py`) is
  already a **per-project** token with `issued_by_user_id` and scopes
  (`project:read|write`, `asset:read|write`). The downstream-API and MCP token
  stories should **extend or mirror this model**, not invent a parallel one.
- **API tokens (Rhino/GH/Honeybee-PH):** long-lived, user- or project-scoped,
  carrying the *same* tenant-isolation guarantees as session auth — a token
  must never widen access beyond what its issuing user/role has. Needs
  create/list/revoke UI, last-used tracking, and an explicit scope set.
- **MCP tokens:** likely keep the per-project model; confirm whether external
  members get MCP access at all in v1 of this feature, or whether it's
  bldgtyp-internal first.
- **Cross-cutting rule:** every token check must run through the **same access
  seam** as cookie auth. Two enforcement paths = two places to leak across
  tenants. This is the biggest token risk.

## 5. Requirements (provisional, grouped)

**R1 — Tenant isolation (blocking; nothing ships without it)**
- Ownership/membership enforced at the `access.py` seam for every
  project-scoped route AND every token path.
- Automated tests proving cross-tenant denial (A cannot read/write/list B).
- Reconsider/remove anonymous view access.

**R2 — Teams & roles**
- `teams`, `team_members`, `projects.team_id`; admin vs member roles.
- Admin: firm-wide visibility + member management + invites + seat control.
- Member: own-scope only.

**R3 — Provisioning / entitlement (replaces billing)**
- Represent RBC membership status + seat limit per team.
- Invite-driven onboarding (no open signup); seat-limited.
- Define lapse behavior (suspend → read-only → lock → grace-delete).

**R4 — Account lifecycle (absent today; mandatory for non-staff)**
- Invite accept → set-password flow.
- **Password reset / forgot-password** (non-negotiable for external users).
- Email verification on invite accept.

**R5 — Transactional email (zero capability today)**
- Provider (Resend/Postmark/SES) + sending domain + SPF/DKIM/DMARC.
- Templates: invite, password reset, (optional) verification.
- New token tables for invite / reset / verify.

**R6 — Tokens (see §4)**
- Extend `mcp_tokens` model for downstream API + MCP; create/list/revoke;
  isolation-safe; scoped.

**R7 — Abuse / posture hardening (skippable internally, required publicly)**
- Login rate-limiting / brute-force + credential-stuffing protection.
- Per-tenant quotas (asset storage, jobs) — `project_assets`/`project_jobs`
  let an external user consume resources.
- Production CORS origins + cookie domain + `Secure`/`SameSite` (config is
  pinned to `localhost:5173` today).
- Revisit the **single-active-session** rule — fine internally, a support-ticket
  generator for customers (login on laptop kills phone session).

## 6. What's already in good shape (we extend, not rebuild)

- **Auth crypto:** Argon2id, constant-time verify, server-side sessions,
  HTTP-only/Secure cookies, expiry + touch-throttle, generic error messages,
  login action logging. Solid foundation.
- **The access seam exists** (`access.py`) — designed for this.
- **Tenancy is one column** — `owner_id`/`team_id` localized to `projects`.
- **Soft-delete + `hard_delete_after` grace + audit columns**
  (`created_by`/`updated_by`/`deleted_by`) are pervasive — useful for lapse
  handling and data-deletion obligations.
- **`user_action_log`** gives an audit trail to build tenant-aware logging on.
- **Per-project token model** already present to extend.

## 7. Concerns & open questions

1. **Membership lapse → data fate.** When a firm's RBC membership ends:
   suspend (read-only), lock, export, or grace-delete? (`hard_delete_after`
   precedent helps.) Contractual + technical.
2. **bldgtyp consultant access.** Do we need a cross-tenant platform/staff role
   so bldgtyp can see a client firm's project for consulting/support? Likely
   yes — design it deliberately, not as an accidental super-user.
3. **Peer sharing within a firm.** Members see only their own projects; is
   junior↔junior or junior→another-senior sharing ever needed, or is
   admin-sees-all sufficient for v1?
4. **One team per user vs. many.** Start one-team-per-user; a consultant who
   belongs to multiple firms (incl. bldgtyp staff) breaks that. Defer multi-team
   until proven necessary.
5. **Token blast radius.** A long-lived Rhino/GH token that leaks must not
   cross tenants — enforce via the shared seam; consider scoping + rotation +
   last-used + easy revoke.
6. **Data residency / privacy / liability.** External firms' building/energy
   data in our DB + object store → privacy policy, ToS, export/delete
   obligations, breach responsibility. Note: **repo is public** — provisioning
   and tenant data must never leak into git ([[project_public_repo_licensed_data]]).
7. **RBC as identity source?** Does RBC offer SSO / a member directory we
   should federate against, or do we own identity entirely? Affects signup,
   provisioning, and lapse sync.
8. **Seat model mechanics.** Does the firm admin self-serve invites up to a
   seat cap, or does bldgtyp/RBC provision seats? Where does the cap live and
   who can change it?

## 8. Explicitly out of scope (for this speculative pass)

- In-app payment/billing (RBC owns it).
- Real schema DDL, migrations, endpoint contracts, or phase plans.
- Performance/scaling work (100 users is trivial).
- Public open self-registration (onboarding is invite-driven).
