---
DATE: 2026-06-27
TIME: 16:10 ET
STATUS: Active — behavior contract for the capability-based access model that
        replaces the current binary editor/viewer check. Schema designed to
        future-proof for multi-tenant teams + viewer shares while shipping a
        binary-equivalent beta. Phase 1 (schema foundation) is implemented; this
        remains the contract the remaining phases build to.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: The access/authorization model end-to-end — principals, capabilities,
        the resolution algorithm, the schema (teams, team_members, user_grants,
        project_shares, columns), and the beta-vs-future enforcement boundary.
        Per-page exposure rulings live in the decisions ledger (see RELATED) and
        are not re-derived here.
RELATED:
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md  (the page-by-page rulings + CP-1..CP-9 + §5 punch-list — the source of truth for WHAT each surface exposes)
  - planning/code-reviews/2026-06-27/editor-vs-viewer-access-model-review.md  (current-state map this replaces)
  - planning/features_v2.0/multi-tenant-teams/PRD.md  (the tenancy story this schema reserves for)
  - planning/code-reviews/2026-06-07/security-review.md  (findings C-2..C-6, C-4 admin gate, M-10 — folded into the punch-list)
  - backend/features/projects/access.py  (the single seam that grows the resolver)
  - backend/features/auth/service.py, routes.py  (CurrentUser dependency, session model)
  - backend/alembic/versions/20260512_0006_mcp_tokens.py  (per-project hashed-token precedent that project_shares + api tokens mirror)
---

# PRD — Access Capability Model

## 1. Why this exists

Today authorization is binary: `access.is_editor = (user is not None)`. A valid
session = editor of every project; anonymous = viewer of one. That is correct for
two trusted staff but cannot express the access we just designed (a read-only
client vs an enhanced certifier vs a member vs a team admin vs bldgtyp staff vs a
grantable catalog-admin), and it would have to be ripped out of a hundred call
sites later.

This refactor replaces the binary with a **capability model**: every access
decision answers *"does this principal have capability C on this resource?"*
Roles and viewer-audiences are code-defined **bundles** of capabilities;
per-user exceptions are **explicit grants**. The schema is laid down now so the
future role/team/share model is a *fill-in*, not a migration of meaning. **Beta
ships binary-equivalent behavior expressed through the new resolver.**

## 2. Principals

| Principal | Identified by | Notes |
|---|---|---|
| **`client`** | a `client`-audience share link (beta: any anonymous request) | most-redacted read-only viewer |
| **`certifier`** | a `certifier`-audience share link | enhanced read-only viewer; never writes |
| **`member`** | session cookie → user, ordinary | edits projects they own / are scoped to |
| **`admin`** | session → user with `team_members.role = admin` | firm-wide visibility + member/seat mgmt |
| **`staff`** | session → user with `users.is_staff = true` | bldgtyp cross-tenant (consult/support) |
| **`token`** | bearer token (MCP today; downstream API later) | acts *as* its issuer; **never widens** beyond issuer's caps |

The two viewer principals and the decided model are summarized in the decisions
ledger §0.1; the full per-surface tables are its §4. **This PRD does not restate
them** — it defines the machinery that enforces them.

## 3. Capabilities

A capability is a stable string key checked at the seam and (where it gates UI)
surfaced to the frontend. The namespace discovered during the walkthrough:

- **Project:** `project.view`, `project.manage`, `project.create`, `project.delete`, `project.list`
- **Versions:** `version.current.view`, `version.history.view`, `version.edit`
- **Per tab (view/edit, plus tab-specific):**
  `status.view|edit|template`,
  `climate.location.view|address|edit`, `climate.source.view|edit`,
  `apertures.view|spec.view|drift.view|edit|export.hbjson`,
  `envelope.view|thermal.view|spec.view|drift.view|element.inspect|edit|export.hbjson|export.phpp`,
  `spaces.view|edit|room.inspect`,
  `equipment.view|edit|export.csv|export.phius`,
  `thermalbridges.view|edit|export`,
  `model.view|edit|export`
- **Catalogs:** `catalog.view`, `catalog.edit`
- **Tokens:** `tokens.mcp.manage`, `tokens.api.manage`
- **Table views:** `tableviews.use`, `tableviews.shared` (deferred)

Capabilities compose with the cross-cutting principles (decisions ledger
CP-1..CP-9): pure view controls, click-to-inspect, and the IP/SI toggle are
*never* capabilities — they are always-available client state.

## 4. Resolution algorithm (the seam)

`access.py` grows a resolver. Every project route asks
`require_capability(access, "<cap>")` instead of testing `is_editor`.

```
identify_principal(request):
    if bearer token        -> TokenPrincipal(issuer, scopes)
    elif share token       -> ViewerPrincipal(audience, version_scope)   # client | certifier
    elif session cookie    -> UserPrincipal(user)
    else                   -> ViewerPrincipal(audience="client", version_scope="latest")   # anonymous default

capabilities_for(principal, project):
    ViewerPrincipal(aud)  -> AUDIENCE_CAPS[aud]                 # CLIENT_CAPS | CERTIFIER_CAPS (code constants)
    TokenPrincipal(t)     -> t.scopes ∩ capabilities_for(t.issuer, project)   # never widen
    UserPrincipal(u):
        caps  = ROLE_CAPS[ role_in(u, project) ]               # owner|admin|member -> bundle
        caps |= grants_for(u, project)                         # user_grants @ global|team|project
        caps |= STAFF_CAPS if u.is_staff else {}
        return caps

role_in(user, project):
    if user.id == project.owner_id            -> "owner"   # T2 on this project
    elif admin of project.team_id             -> "admin"   # T2 on all team projects
    elif member of project.team_id            -> "member"
    else (and is_staff)                       -> handled by STAFF_CAPS
```

`require_capability` raises 401 (`not_authenticated`) for a viewer principal that
lacks the cap, or 403 for a logged-in user that lacks it — preserving today's
error contract for the anonymous case. Response **redaction** (street address,
metadata fields, version list) is driven by the same `capabilities_for` result,
not by ad-hoc `access_mode` checks.

### Beta collapse

Until `teams` / `project_shares` are populated, the resolver yields today's
behavior:
- no cookie → `ViewerPrincipal("client", "latest")` → `CLIENT_CAPS`.
- cookie → `UserPrincipal`; with no team row, the user is treated as `member`
  of every project (and `owner` where `owner_id` matches); `is_staff` and
  `user_grants` are honored if present.

So `CLIENT_CAPS` ≈ today's viewer, `MEMBER_CAPS` ≈ today's editor — the binary is
a special case of the capability model, and the beta diff is only the specific
deltas in the punch-list (version-pin, export gating, metadata redaction, the
catalog grant).

## 5. Schema (additive, nullable, behavior-neutral defaults)

All new columns/tables default to reproducing today's behavior. Audit columns
match the existing convention (`created_at/updated_at/deleted_at` +
`created_by/updated_by/deleted_by`). Token tables mirror `mcp_tokens`
(SHA-256 `token_hash`, `issued_by`, `expires_at`, `revoked_at`).

### 5.1 Tenancy

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  membership_status TEXT NOT NULL DEFAULT 'active',   -- active|suspended|lapsed
  seat_limit INTEGER,                                  -- NULL = unlimited
  membership_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID, updated_by UUID, deleted_by UUID
);

CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',                 -- admin|member
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
-- Start one-team-per-user: UNIQUE (user_id). Drop the unique later for multi-team.
CREATE UNIQUE INDEX uq_team_members_one_team_per_user ON team_members(user_id);

ALTER TABLE projects ADD COLUMN team_id UUID REFERENCES teams(id);   -- NULL = legacy/bldgtyp-internal
ALTER TABLE users    ADD COLUMN is_staff BOOLEAN NOT NULL DEFAULT false;
```

### 5.2 Fine-grained per-user grants (Ed's choice — future-proof now)

```sql
CREATE TABLE user_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,                  -- a capability key, e.g. 'catalog.edit'
  scope_type TEXT NOT NULL,                  -- global|team|project
  scope_id UUID,                             -- team_id or project_id; NULL when global
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_user_grants_active
  ON user_grants(user_id, capability, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'))
  WHERE revoked_at IS NULL;
```

- **First use — catalog-admin:** a grant `(user, 'catalog.edit', 'global', NULL)`.
  The catalog write routes check `has_capability(user, 'catalog.edit')`, satisfied
  by this grant OR `is_staff`. (Closes security-review C-4.)
- The mechanism generalizes to any future fine-grained permission (e.g.
  `(user, 'document.edit', 'project', X)` for per-project collaborators) without
  new tables — this is the "fine-grained permissions eventually" insurance.

### 5.3 Viewer shares (certifier vs client + version scope)

```sql
CREATE TABLE project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audience TEXT NOT NULL,                     -- client|certifier
  version_scope TEXT NOT NULL DEFAULT 'latest', -- latest|pinned
  pinned_version_id UUID REFERENCES versions(id),
  token_hash TEXT NOT NULL,                   -- SHA-256 of the link secret (mirror mcp_tokens)
  label TEXT,                                 -- "Client: the Smiths" / "Certifier: PHI R2"
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
```

- Beta can ship with **no shares created** (anonymous → `client` + latest). The
  table + the seam's `audience`/`version_scope` inputs exist so the certifier
  link and version-pinning are a fill-in, not a re-architecture.
- A share token in the URL resolves to a row → `(audience, version_scope)`. Every
  token check runs through the **same seam** as cookie auth (multi-tenant PRD §4
  cross-cutting rule: two enforcement paths = two places to leak).

### 5.4 Migration posture

| Migrate **now** (behavior-neutral) | Hold as finalized DDL (apply at trigger) |
|---|---|
| `projects.team_id` (nullable), `users.is_staff`, `user_grants` table | `teams`, `team_members` (v2.0 tenancy) |
| | `project_shares` (first certifier link) |

`user_grants` migrates now because catalog-admin is a beta need (C-4) and the
table is the chosen mechanism. `teams`/`team_members`/`project_shares` are
authored now but applied when their feature lands, to avoid empty unused tables
in a public repo before they have a consumer.

## 6. Enforcement boundary — beta vs future

| Concern | Beta (ships now) | Future (schema ready) |
|---|---|---|
| Resolver `capabilities_for` | yes — defaults to binary | unchanged shape |
| `CLIENT_CAPS` / `MEMBER_CAPS` bundles | yes | + `CERTIFIER_CAPS`, `ADMIN_CAPS`, `STAFF_CAPS` |
| `user_grants` + `catalog.edit` grant | yes (closes C-4) | more grant types |
| Client version-pin, export gating, metadata redaction | yes (punch-list §5) | unchanged |
| `teams`/`team_members`/role scoping | no (treated as member) | yes |
| `project_shares` / certifier links / pinned shares | no (anon = client) | yes |
| Token-as-principal through the seam | MCP already; audit | + downstream API tokens |

## 7. Non-goals / out of scope

- In-app billing (RBC owns it — multi-tenant PRD).
- Account lifecycle (invite/password-reset/email) — v2.0 R4/R5.
- A big-bang rewrite of every `is_editor` call in one phase — the resolver lands
  first and call sites migrate incrementally (see PLAN.md).
- Per-persona client/certifier read splits beyond those in the decisions ledger.

## 8. Success criteria

1. The seam exposes `capabilities_for` / `require_capability`; `is_editor` becomes
   a derived convenience, not the authority.
2. Cross-tenant denial is provable by test once teams land (multi-tenant R1).
3. Beta behavior is observably identical to today **except** the punch-list
   deltas, and the metadata leak + anon-export gaps are closed.
4. Adding the certifier principal later touches the seam bundles + `project_shares`
   only — no per-route edits.
