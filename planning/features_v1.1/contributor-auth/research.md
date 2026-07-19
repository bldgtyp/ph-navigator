---
DATE: 2026-07-18
TIME: 16:10
STATUS: Complete (code survey + external research, 2026-07-18)
AUTHOR: Claude (Fable 5) via Explore + web-research agents
SCOPE: Current auth/access model map + Cloudflare Zero Trust vs alternatives evaluation
RELATED: PRD.md, planning/archive/dated/2026-06-27/access-capability-model/ (canonical capability design)
---

# Contributor auth — research

## A. Current auth/access model (verified against source)

### Sessions & accounts
- Email + password (Argon2id) → server-side session row, opaque HttpOnly
  cookie `phn_session` (not a JWT). `backend/features/auth/*`.
- **Single-active-session rule**: new login invalidates prior sessions
  (`superseded_by_new_login`). Sliding expiry (480 min), touch-throttled.
- **No self-registration.** Accounts exist via admin invite
  (`admin.users.manage` → `account_tokens` single-use hashed invite/reset
  tokens, one active per user+type) or `scripts/bootstrap_admin.py`.
- Audit trail exists: `user_action_log` (+ target user fields).

### Capabilities (the seam we extend)
- `backend/features/access/capabilities.py`: capability strings; anonymous →
  `CLIENT_CAPS = {project.view}`; **any signed-in user → `MEMBER_CAPS`**
  (edit + exports + catalog.edit + private metadata). No intermediate tier.
- Grants table `user_grants` (`capability, scope_type global|team|project,
  scope_id, revoked_at`) exists, **but only `scope_type='global'` grants are
  resolved today** (`access/repository.py::active_global_capabilities_for_user`).
  Project-scoped resolution is the declared Phase-5 gap.
- Write gate everywhere: `projects/access.py::require_editor_user` →
  `PROJECT_EDIT` capability. `projects.owner_id` exists but is **not**
  consulted; any signed-in user can edit any project (beta model).
- Asset routes specifically: upload-intent / complete-upload / attach /
  detach / delete all `require_project_edit_access` → `require_editor_user`.
  Reads allow anonymous viewers (reference-checked against the viewed
  version).

### Anonymous access
- Every project URL is public-readable; `access_mode` (`editor|viewer`) is
  computed per request, never stored. Viewer metadata redaction exists.
  `context/ui/pages/viewer-public.md` is canonical.

### Token precedents
- `mcp_tokens`: project-scoped bearer tokens, `phn_mcp_` + SHA-256 hash +
  prefix, scopes CHECK (`project:read/write asset:read/write`), issued by
  editors, revoked on user deactivation/password reset. **A token acts as its
  issuer** (scope intersection deferred).
- Held DDL `backend/alembic/held/phase5_tenancy_and_shares.sql`:
  `project_shares` (audience client|certifier, token_hash, expires_at,
  revoked_at) — the reserved template for anonymous share links. Not applied.

### Abuse-prevention state
- Size caps (per-field 25 MB, global 100 MB), MIME allow-lists + magic-byte
  sniff at complete-upload, bulk caps (50 intents / 100 urls), DB CHECK on
  asset kind. Origin allow-list on all mutating `/api/` calls; admin routes
  add `X-PHN-CSRF`.
- **No rate limiting on uploads or login** (only an in-process GitHub-proxy
  limiter exists). Gap for any broader upload surface.

### The draft problem (feeds PRD §D3)
Attach/detach mutates the acting user's **per-user draft** of the versioned
document; content becomes publicly visible only when someone with edit rights
**Saves**. An upload-only contributor therefore has no clean landing place
for writes under the current model: their own draft would be invisible to
Ed and unsaveable by them; writing into Ed's draft crosses user boundaries;
auto-saving violates the explicit-save discipline (versioned, immutable-by-
discipline saves). This is the central design question, bigger than the
login mechanism itself.

## B. External research — login mechanism (2026-07-18)

### Cloudflare Access + Email OTP (Ed's low-impact candidate)
- Mechanics: gate hostname/path at the edge; email one-time PIN;
  `CF_Authorization` JWT cookie. Free ≤50 seats. Path-scoped apps supported
  (could gate only an /upload area while the site stays public).
- **Fit problems for this stack:**
  - SPA (`www`) and API (`api`) are different origins; the JWT cookie is
    host-scoped. Needs a Multi-Domain Access application + backend
    validation of `Cf-Access-Jwt-Assertion` (RS256, team certs, aud tag) in
    FastAPI — a second, parallel auth system next to `phn_session`.
  - CORS preflight: browsers don't send cookies on OPTIONS and Access 403s
    the preflight; requires the "bypass OPTIONS" app setting + Cloudflare-
    answered preflights. `SameSite=None` required across the subdomains.
  - Requires flipping Render DNS records to Proxied (orange-cloud) — Render
    supports it but only via a DNS-only-first cert dance; unverified-by-
    Render combination.
  - Documented mobile/Safari flakiness: `CF_Authorization` cookie not
    reliably delivered under Safari tracking prevention — bad for the
    phone-in-the-field persona.
- Verdict: free and capable, but moves complexity into edge config + known
  footguns rather than removing it. Weak fit.

### In-app magic-link (passwordless email) — recommended
- ~1 table (or reuse `account_tokens` with a new type) + request-link
  endpoint + verify endpoint that mints the **existing** `phn_session`
  cookie. Transactional email (Postmark/Resend/SES). Single-use, 5–15 min
  TTL tokens, hashed at rest (exact `account_tokens` pattern).
- Reuses everything: session middleware, cookie posture, Origin allow-list,
  audit log. No new origin story. Phone UX: tap link in email, done.
- Attribution by construction (email = identity) — satisfies "know WHO
  uploaded".
- Industry precedent: **CompanyCam Guest Access** — invite by email, guest
  verifies email via link, uploads photos with **no account/app install**;
  the exact persona and the exact pattern. (Buildertrend/Procore require
  full accounts; no anonymous-upload precedent found among the majors.)

### Capability URLs (signed project-scoped upload links, no identity)
- Smallest build; best field UX (zero friction). But: leaked link = access
  until expiry, no per-person revocation, **no attribution** (self-reported
  name at best). Fails Story 2's "logs in as a user" framing. Keep as the
  fallback if attribution is ever dropped.

### Google Sign-In only
- Strong identity, but excludes non-Google consultants (architect firms are
  often Microsoft-shop), adds OAuth console dependency. Weak fit.

### Ranking
**Magic link > Cloudflare Access > Google OAuth > capability URLs** (last
only if attribution is dropped).
