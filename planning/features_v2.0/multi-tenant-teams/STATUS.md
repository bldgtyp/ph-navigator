---
DATE: 2026-06-14
TIME: 15:52 EDT
STATUS: Deferred (v2.0 — speculative)
AUTHOR: Claude (for Ed)
SCOPE: State tracker for the multi-tenant-teams feature.
RELATED:
  - README.md
  - PRD.md
---

# STATUS — Multi-Tenant Teams

**State:** Deferred / speculative. Thinking captured; **no code, no schema, no
schedule.** Recorded 2026-06-14 from a feasibility review of auth/user/team +
the RBC partnership idea.

## Where things stand

- Feasibility reviewed against the live codebase (auth, projects access seam,
  schema). Conclusion: **feasible**, and not a scale problem.
- The individual-owner half of the architecturally significant tenant-
  isolation hurdle is now enforced at `backend/features/projects/access.py`.
  Team scoping remains absent surface area and is still this feature's R1.
- RBC partnership offloads payment → in-app billing is **out of scope**;
  replaced by a lighter provisioning/entitlement concern.
- Favored model recorded in `PRD.md`: team = firm = tenant; admin (firm-wide
  visibility + user/access management) vs. member (own-scope only); downstream
  API + MCP tokens extend the existing `mcp_tokens` per-project model.

## Blockers / dependencies

- **Business:** RBC partnership + billing contract must actually firm up. This
  is speculative until then.
- **Decision:** the open questions in `PRD.md §7` (lapse behavior, bldgtyp
  consultant cross-tenant role, peer sharing, identity/SSO source) should be
  answered before real planning.

## Update 2026-08-01 — R1's owner-half completed early

The archived `project-ownership-enforcement` refactor completed **part of R1**,
ahead of and independent of the RBC trigger. It was driven by
`planning/archive/dated/2026-08-01/admin-all-projects-dashboard/`, which needed a real privilege
boundary to mean anything.

It closes the §2 hurdle **for individual ownership only** — the seam now uses
"caller is the owner, or holds `projects.access.all`", matching §3's rule (a)
with a global escape hatch in place of rule (b). It also carries the
route-breadth audit and token-path coverage R1 demands.

**Still owned by this feature, untouched:** `teams` / `team_members`, the
`projects.team_id` FK and team scoping, genuine cross-tenant denial, removing
anonymous view access, provisioning/seats, account lifecycle, email, and the
downstream-token story.

Caveat when this folder is next picked up: §2's historical line references
(`access.py:62-66`, `routes.py:110-127`) are stale. The current enforcement
entry points are `require_project_access`, `_may_reach_project`, and
`project_access_for_user`; re-verify their live lines before quoting them.

## Next step (only if pursued)

1. Confirm the partnership is real and gather RBC's identity/seat/lapse
   constraints (answers to `PRD.md §7`).
2. If green-lit, **first build = R1 tenant isolation** at the access seam +
   cross-tenant denial tests, independent of teams/email/tokens. It is the
   prerequisite for everything and is shippable on its own as a hardening pass.
   *(The owner-half is complete; what remains is the team dimension.)*
3. Promote this folder from `features_v2.0/` to `planning/features/` and write
   real phase plans + schema DDL at that point.

## Verification

None — nothing built.
