---
DATE: 2026-06-27
TIME: 22:55 ET
STATUS: Deferred (v2.0 — gated on the RBC trigger). Forward-looking build spec
  for the enforcement half of the access-capability model. Nothing here is
  scheduled; the resolver + schema it fills in already shipped in the beta.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: The deferred Phase 5 of the access-capability-model refactor — turn the
  reserved tenancy + viewer-share schema and the persona-split capability
  resolver into enforced roles (admin/staff), a real `certifier` principal, and
  revocable client/certifier share links.
RELATED:
  - README.md
  - planning/archive/dated/2026-06-27/access-capability-model/ — beta packet
    (PRD §5 reserved schema, decisions D1–D10 + CP-1..CP-9, PLAN §Phase 5).
  - planning/features_v2.0/multi-tenant-teams/PRD.md — the membership/tenant
    story + open questions (§7) that gate this.
  - backend/alembic/held/phase5_tenancy_and_shares.sql — the DDL to apply.
  - backend/features/access/{principals,capabilities,user_capabilities}.py,
    backend/features/access/repository.py — the live resolver to extend.
  - backend/features/projects/access.py — the enforcement seam.
  - backend/features/mcp/ — the per-project token model to mirror for shares.
---

# PRD — Access-Capability Enforcement (deferred Phase 5)

> **Build spec, not a thinking doc.** The model, principals, capability
> taxonomy, and per-surface rulings were all decided during the beta (see the
> archived packet). This document says *exactly what to fill in* when the
> trigger fires. It assumes the beta is in place.

## 1. Why this is deferred (the trigger)

The beta enforces a binary world correctly: `client` (anonymous viewer) and
`member` (any logged-in user). The richer principals only become *reachable*
when two things exist that do not today:

1. **Teams** — so a user can be an `admin` or a scoped `member` of a tenant,
   and `staff` can be bldgtyp-internal. Gated on the **RBC partnership** (first
   external member). [[multi-tenant-teams]] owns this trigger and the
   tenant-isolation hurdle.
2. **Share links** — so a viewer can be a `certifier` (more read scope) rather
   than a `client`, and can be pinned to a version. Gated on the **first
   certifier link** actually being needed.

Until one of those is real, building enforcement is speculative surface area.
The schema and resolver were shaped now (decision **D9**: reserve schema,
enforce when the consumer exists) precisely so this is a *fill-in*.

## 2. What the beta already shipped (the fill-in points)

- **Resolver** (`backend/features/access/`): `capabilities_for(principal)`
  dispatches on `ViewerPrincipal` vs `UserPrincipal`. `ViewerPrincipal` already
  carries an `audience` field; `AUDIENCE_CAPS` maps `"client" → CLIENT_CAPS`
  today and is the exact dict a `"certifier"` entry drops into. `UserPrincipal`
  already carries `is_staff` and `granted_capabilities`.
- **Bundles**: `CLIENT_CAPS`, `EXPORT_CAPS`, `MEMBER_CAPS` (= client + exports +
  edit + private-metadata), and `STAFF_EXTRA_CAPS` (= `catalog.edit`). The
  `certifier`/`admin`/`staff` bundles named below are additive on top.
- **Seam**: every route resolves through `projects/access.py`
  (`require_capability` → 401 viewer / 403 user). The MCP token path already
  flows through it (`project_access_for_user`).
- **Grants**: `user_grants` is a real table; `active_global_capabilities_for_user`
  is **scope-filtered to `scope_type = 'global'`** — the scoped-grant resolution
  is the deferred half (see §4.3).
- **Reserved schema**: `projects.team_id` is a live nullable column; the FK to
  `teams`, plus `teams` / `team_members` / `project_shares`, are finalized in
  the held DDL.

## 3. Capability bundles to add

Roles are named bundles of capabilities; this is the table the resolver fills
in. (Capabilities themselves already exist as the `*.export.*` / `project.*` /
`catalog.edit` constants from the beta.)

| Principal | Bundle | = beta `client`/`member` plus… |
| --- | --- | --- |
| `client` | `CLIENT_CAPS` | (unchanged) project.view only |
| `certifier` | `CERTIFIER_CAPS` | client **+** `project.view.private_metadata` (street address, client name, `phius_dropbox_url`) **+** `EXPORT_CAPS` (HBJSON/PHPP/Phius/model/CSV) **+** `version.history.view`. **Never** any `*.edit` (CP-2: certifier never writes). |
| `member` | `MEMBER_CAPS` | (unchanged) own-scope edit |
| `admin` | `ADMIN_CAPS` | member **+** team-wide project visibility **+** `members.manage` / `team.manage` / `seats.manage` (T2: rename/delete/metadata/MCP-token management) |
| `staff` | `STAFF_CAPS` | admin-equivalent **cross-tenant** + `catalog.edit` (today's `STAFF_EXTRA_CAPS`) — designed deliberately, not an accidental super-user |
| `token` | issuer's bundle | acts *as* its issuing principal; **never widens** beyond the issuer's grants |

`certifier ⊇ client` and `staff ⊇ admin ⊇ member` are additive ladders (CP-2).

## 4. Work items

### 4.1 Apply the held DDL
Create a real Alembic revision and paste `phase5_tenancy_and_shares.sql`:
`teams`, `team_members(role admin|member)`, `project_shares(audience,
version_scope, pinned_version_id, token_hash, …)`, and the deferred
`projects.team_id` FK. **Re-validate every FK against the live schema first**
(held-DDL drift caveat) — `users`, `projects`, `project_versions` may have moved
since 2026-06-27. Write the matching `downgrade()`.

### 4.2 Roles → capabilities
- Add `CERTIFIER_CAPS` / `ADMIN_CAPS` / `STAFF_CAPS` (§3).
- Resolve a logged-in user's role from `team_members` (`role_in(team_id)`); map
  `admin`/`member` to the bundle. `users.is_staff` already gates `staff`.
- Tenant scoping: the project-access seam must compare the project's `team_id`
  to the caller's team(s) — this is the **tenant-isolation** enforcement that
  [[multi-tenant-teams]] R1 owns; do it at `projects/access.py`, not per-route.

### 4.3 Shares → principals
- A share-link request resolves its `token_hash` against `project_shares` (mirror
  `mcp_tokens` hashing) to a `ViewerPrincipal(audience, version_scope,
  pinned_version_id)`. `audience` selects `CLIENT_CAPS` vs `CERTIFIER_CAPS` via
  the existing `AUDIENCE_CAPS` dict.
- **Version-scope** lights up the persona split (decision D6 / ledger §4.9):
  `latest` → auto-follow head; `pinned` → lock to `pinned_version_id`. The
  frontend version-pin the beta applied to all viewers becomes audience-aware
  (certifier gets history + switch + diff; client stays pinned, no version UI).
- Extend grant resolution beyond `scope_type = 'global'` to honor
  project-scoped grants (the half the beta deferred).

### 4.4 Certifier link issuance UI
- A `member`+ can mint / label / revoke client and certifier share links for a
  project — **mirror the existing MCP-token UI** (`backend/features/mcp/` + its
  frontend). Show the secret once; store only the hash. Support `expires_at`
  and version-pinning for certifier links.

### 4.5 Topbar de-conflation
Today the viewer chrome treats `viewer == anonymous` ("Read-only / Sign in"
pill). Once a `certifier` principal exists, the topbar must distinguish an
authenticated/identified share audience from a plain anonymous client.

### 4.6 Cross-cutting (M-10)
When sign-in is touched here, harden the `?next=` redirect to a same-origin
allowlist (security-review M-10), and keep the invariant that **every token +
share check flows through the one seam** — no bespoke per-route auth.

## 5. Schema reference (held DDL)

- **`teams`** (id, name, `membership_status` active|suspended|lapsed,
  `seat_limit`, `membership_expires_at`, soft-delete + audit).
- **`team_members`** (team_id, user_id, `role` admin|member, joined_at) with a
  `uq_team_members_one_team_per_user` index — start one-team-per-user, drop the
  index for multi-team later.
- **`project_shares`** (id, project_id, `audience` client|certifier,
  `version_scope` latest|pinned, pinned_version_id, `token_hash` unique, label,
  expires_at, created_by, revoked_at) + a partial active-share index.
- **`projects.team_id` FK** → teams (column already live; FK deferred to here).

## 6. Tests this must add

- **Cross-tenant denial** (multi-tenant R1): a member of team A gets 403/404 on
  team B's project, at the seam, for every project route — the load-bearing
  test.
- **Audience redaction**: a `certifier` share sees street address /
  `phius_dropbox_url` / version history / exports; a `client` share does not;
  neither can write (CP-2).
- **Version-pinning**: a `pinned` certifier share is locked to its version; a
  `latest` share auto-follows.
- **Token-as-principal audit**: every token + share path runs through the seam
  and never widens beyond the issuer's grants.
- **Revocation / expiry**: a revoked or expired share resolves to no access.

## 7. Open questions / dependencies

- Inherits the unresolved business questions in
  [[multi-tenant-teams]] PRD §7 (membership-lapse behavior, bldgtyp consultant
  cross-tenant role, peer sharing, identity/SSO source). Answer those before
  real planning.
- **Sequencing:** tenant isolation (4.2) is the prerequisite and is shippable on
  its own as a hardening pass, *independent* of shares (4.3–4.4). Certifier
  shares can land separately once a certifier link is actually requested.

## 8. Verification (when built)

Held DDL applies up/down/up clean against the then-current schema; the
cross-tenant denial + audience-redaction + version-pinning + revocation tests
pass; `make ci` green; a logged-out + certifier-link walkthrough shows exactly
the decided per-audience surface (ledger §4).
