---
DATE: 2026-08-01
TIME: 11:12 EDT
STATUS: Complete — D-1..D-5 accepted and implemented
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Accepted and rejected decisions for the admin all-projects dashboard.
RELATED: ./README.md, ./PRD.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/decisions.md
---

# Decisions

## D-1 — Gate on `projects.access.all`, not `admin.users.manage`

**Accepted.** The dashboard branches on the capability introduced by the
enforcement refactor, so "which projects may I list" and "which projects may I
open" resolve from the same key. Gating the list on `admin.users.manage`
directly would let the two drift — a listing that shows projects the seam then
refuses.

`projects.access.all` is derived from **`is_staff` or the Admin preset**
(enforcement §D-3, revised after the v2.0 review). Reading the resolved
capability rather than either source is what makes this feature survive the
teams work: when `admin` becomes a *team* role and cross-tenant reach moves to
`staff` alone, the derivation changes and this feature does not.

**Naming caution for reviewers.** "Admin" in this feature means today's Admin
preset holder, which after the refactor sees *every* project. In
`planning/features_v2.0/access-capability-enforcement/PRD.md` §3, `admin` means
a **team** admin who sees only their team's projects. Same word, two scopes.
When teams land, this dashboard's grouping should follow
`projects.access.all` — whoever holds it sees everything they can reach, which
will then be team-bounded for admins and global for staff.

## D-2 — Flat sorted list + `grouped` flag, not nested groups

**Accepted.** The server owns the grouping key, the label, and the total
ordering; the client inserts a heading on owner change. One response shape for
both actors, and `CLAUDE.md`'s "manipulation in the backend" rule is satisfied
by the server deciding order and grouping key.

*Rejected:* `groups: [{owner, projects[]}]` — forks the response into two shapes
the frontend must branch on, and buys nothing the flag does not.

## D-3 — Deleted panel stays owner-scoped

**Accepted (Ed, 2026-08-01).** Admins see all live projects; the Deleted panel
keeps `list_deleted_projects_for_owner`.

The Deleted panel's affordance is **Restore**, and next to it sits bulk-delete.
Unscoping it puts destructive controls over other people's data on the primary
dashboard, which contradicts the enforcement plan's §D-4 (destructive stays with
the owner). If admins later need to recover someone else's project, that is a
deliberate admin-tools surface, not a panel on the dashboard.

*Rejected:* unscoping the panel with an owner column.

## D-4 — Admin's own group sorts first

**Accepted.** The dashboard is still primarily the admin's own workspace; their
projects should not be alphabetically buried under a colleague's. Own group
first, everyone else alphabetical.

Cheap to change and a pure presentation choice — recorded so it is not
re-litigated during review.

## D-5 — Grouping by owner survives the teams model

**Accepted, added 2026-08-01 after the v2.0 review.**

`planning/features_v2.0/multi-tenant-teams/` introduces `teams` as the tenant,
with `projects.team_id` alongside `owner_id` — and a firm admin whose visibility
is *team-wide*, not global. A reasonable worry: does grouping by **owner** now
paint us into a corner when the natural grouping becomes **team**?

No. `owner_id` survives the teams model unchanged — `multi-tenant-teams` §3 is
explicit: "Keep **individual project ownership** (`owner_id`) AND add a firm
pointer." Grouping by owner stays meaningful inside a team; a future team
dimension is a second grouping level, not a replacement.

Practical guard: keep the grouping key a single server-supplied field
(enforcement §D-2's ordering contract) so adding a team tier means the server
sends a different key, not the client learning a new model.
