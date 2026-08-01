---
DATE: 2026-08-01
TIME: 08:25 EDT
STATUS: Active — D-1..D-6 accepted by Ed 2026-08-01
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Accepted and rejected decisions for project-ownership enforcement.
RELATED: ./README.md, ./PRD.md, ./phases/
---

# Decisions

## D-1 — Fix enforcement before shipping the admin dashboard

**Accepted (Ed, 2026-08-01).** Two separate plans; this one lands first.

The admin all-projects dashboard reads as a privilege grant. If the underlying
gap stays open, it grants nothing — it only surfaces what every signed-in user
could already reach by URL. Shipping the feature first would also make the
eventual fix look like a regression ("why can't I open that project any more?")
rather than a correction.

*Rejected:* one bundled plan (mixes a security fix with a product feature in one
branch and one review); feature-only with the gap documented as a risk.

## D-2 — Non-owners get 404, not 403

**Accepted.** Matches the existing `_ensure_project_owner` behavior, so the
codebase has one rule rather than two. A 403 discloses that a project with that
ID exists, which is exactly what a stranger should not learn.

## D-3 — A distinct `projects.access.all`, derived from `is_staff` **or** the Admin preset

**Accepted (Ed, 2026-08-01), revised after the v2.0 review.**

Kept as a separate capability key rather than gating directly on an existing
flag, because "may manage users", "is bldgtyp staff", and "may reach every
project" are three different authorities. Call sites gate on the key; only the
derivation changes as the model matures.

### Derivation

```
PROJECT_ACCESS_ALL  ⟸  principal.is_staff  OR  ADMIN_USERS_MANAGE ∈ grants
```

Plus: set `is_staff = true` for current admins using the existing
`backend/scripts/manage_user_access.py set-staff --email …`. No new migration,
no schema change.

### Why not `admin.users.manage` alone (the original draft)

The v2.0 review caught a naming collision. In
`planning/features_v2.0/access-capability-enforcement/PRD.md` §3, `admin` is a
**team** admin — team-wide visibility only — and **cross-tenant reach belongs to
`staff`**. The live migration
(`backend/alembic/versions/20260627_0003_access_capability_foundation.py:11`)
calls `users.is_staff` the "bldgtyp cross-tenant flag" in exactly those terms.

Deriving all-project reach from `admin.users.manage` alone would mean that when
teams land, the Admin preset has to be **demoted** from all-projects to
team-projects — a behavior regression designed in on purpose.

### Why not `is_staff` alone

Semantically purest, but `is_staff` has no admin UI. Its only write path is
`backend/scripts/manage_user_access.py` (plus test helpers) — so nobody would
hold the new capability until that script is run, and the feature would appear
broken in the meantime.

### Forward path

When teams land, delete the `ADMIN_USERS_MANAGE` clause. `is_staff` remains,
`admin` becomes the team-scoped role v2.0 describes, and no call site changes.
The `OR` is a dated bridge, not the model.

**Precedent:** `backend/features/catalogs/access.py:5` already describes this
exact tri-source shape ("an explicit grant, the Admin preset, or `is_staff`").

## D-4 — Admin gets read + write reach, but **not** delete

**Accepted.** `delete_project`, `restore_project`, and `hard_delete_project`
keep their owner-only `_ensure_project_owner` check unchanged. An admin can open
and correct another user's project; destroying it stays with the owner.

This is deliberately asymmetric. It is also a one-line change to extend if Ed
later wants admin delete — the helper would take the same
`_may_reach_project` predicate. Flagged here so the asymmetry is a decision on
the record rather than an oversight.

**Diverges from the v2.0 endpoint, knowingly.** The `admin` bundle in
`planning/features_v2.0/access-capability-enforcement/PRD.md` §3 *does* include
delete for team projects ("T2: rename/delete/metadata/MCP-token management").
This decision is deliberately more conservative than the target state, not a
different target — an admin who can edit but not destroy is the safer default
while there is no team model, no undo beyond the soft-delete grace window, and
no audit UI for cross-user destructive actions.

**Consequence for the dependent feature:** on the admin dashboard, the
select/bulk-delete checkbox must be **disabled** for projects the admin does not
own, or admins will select rows that then 404. Carried into
`planning/features/admin-all-projects-dashboard/PRD.md` §4.

## D-5 — The anonymous path is out of scope

**Accepted.** An anonymous caller can `GET` any project by ID today, read-only
and with private metadata redacted. Verified 2026-08-01: `client=None`,
`phius_dropbox_url=None`, `access_mode='viewer'`, `PATCH` → 401.

That is the documented public client-viewer contract
(`context/ui/pages/viewer-public.md`). Restricting *which* projects are publicly
reachable requires the per-project `access_mode` column identified in the
2026-06-27 access-model review, which is its own piece of work. This refactor
must not change anonymous behavior, and carries a regression test to prove it
(PRD §5 criterion 4).

**Not permanent.** Two deferred plans intend to remove this:
`planning/features_v2.0/multi-tenant-teams/` R1 says "reconsider/remove
anonymous view access", and
`planning/features_v2.0/access-capability-enforcement/` §4.3 replaces
anonymous-by-URL with `project_shares` tokens carrying an audience
(`client` / `certifier`), a version scope, and revocation. Preserving today's
behavior here is a *scoping* choice, not an endorsement — do not read the
regression test as a commitment that anonymous-reaches-any-project is
permanent.

## D-6 — Enforce at the seam, not per route

**Accepted.** Ordinary REST reads/writes resolve through
`require_project_access`; MCP/GH authenticated read paths resolve through
`project_access_for_user`. Project-destructive paths deliberately keep the
stricter owner-only service guard, and anonymous GH reads use the explicit
public-viewer path. These centralized boundaries cover the surface more
reliably than per-route checks. Phase 3's deeper sweep found and fixed MCP
metadata/list tools that had checked token scope without re-checking issuer
ownership; `implementation-report.md` owns the current counts and verdicts.

Both deferred v2.0 packets independently reached the same conclusion, which is
worth noting as corroboration rather than coincidence:
`multi-tenant-teams` §2 ("**One seam.** `access.py` is explicitly the
'forward-compatible project access seam' — the single chokepoint"), and ACE
§4.2 ("do it at `projects/access.py`, not per-route") and §4.6 ("every token +
share check flows through the one seam — no bespoke per-route auth").

## D-7 — This executes `multi-tenant-teams` R1's owner-half, early

**Accepted, added 2026-08-01 after reviewing the deferred v2.0 packets.**

This refactor is **not new work**. The gap it closes is documented in
`planning/features_v2.0/multi-tenant-teams/PRD.md` §2 ("the tenant-isolation
hurdle — the load-bearing change"), and **R1 owns it**: *"Ownership/membership
enforced at the `access.py` seam for every project-scoped route AND every token
path… nothing ships without it."*

We are doing the **owner half now, without teams**, because the admin dashboard
needs it and because RBC is not real yet. That is explicitly sanctioned by
`planning/features_v2.0/access-capability-enforcement/PRD.md` §7: *"tenant
isolation is the prerequisite and is shippable on its own as a hardening pass,
independent of shares."*

What stays deferred: `teams` / `team_members`, the `projects.team_id` FK,
`project_shares`, the `certifier` principal, and scoped (`team` / `project`)
grant resolution.

### Forward-compatible predicate

`multi-tenant-teams` §3 specifies the target rule:

> Caller may access project *P* if **(a)** `P.owner_id == caller.id`, **or**
> **(b)** caller is an **admin** of `P.team_id`.

`_may_reach_project` implements (a) plus a global-reach escape hatch; (b) slots
in as a third branch. Write it as an ordered sequence of independent clauses, so
the team clause is an insertion rather than a rewrite.

Relevant live schema the original draft missed — **`projects.team_id` already
exists** as a nullable column with no FK, and the migration docstring states a
NULL `team_id` means "a legacy/bldgtyp-internal project". Every project is NULL
today. Do not add, backfill, or read the column in this refactor; just do not
write a predicate that would have to be torn up to accommodate it.

## D-8 — Catalog writes: record the drift, change nothing

**Accepted (Ed, 2026-08-01).** Discovered during the v2.0 review, not caused by
this refactor.

`MEMBER_CAPS` includes `CATALOG_EDIT` (`capabilities.py:80`), so **any signed-in
user can write the shared catalogs** — materials, glazing, frame elements. Two
documents describe that as gated and are stale:

- `planning/features_v2.0/access-capability-enforcement/PRD.md` §2 claims a
  `STAFF_EXTRA_CAPS` bundle holds `catalog.edit`. **No such symbol exists** in
  the codebase.
- `backend/features/catalogs/access.py:5` says `catalog.edit` "can come from an
  explicit grant, the Admin preset, or `is_staff`" — true of the *intended*
  model, not of the running one, where every member holds it.

The live behavior is deliberate and commented ("held by every signed-in
member"). With two trusted users it is harmless; with external tenants it is
not, and ACE's model already says it should be staff-gated by then.

**Action:** correct the two stale docstrings in Phase 4. Change **no** behavior
— gating catalog writes would widen this refactor's blast radius into the
catalog surface and the agent-browser fixture for no benefit today.
