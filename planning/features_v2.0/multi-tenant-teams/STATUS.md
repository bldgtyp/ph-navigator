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
- One architecturally significant hurdle identified and **verified in code**:
  tenant isolation is not enforced at the project access seam
  (`backend/features/projects/access.py`). Everything else is absent surface
  area, not hard architecture.
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

## Next step (only if pursued)

1. Confirm the partnership is real and gather RBC's identity/seat/lapse
   constraints (answers to `PRD.md §7`).
2. If green-lit, **first build = R1 tenant isolation** at the access seam +
   cross-tenant denial tests, independent of teams/email/tokens. It is the
   prerequisite for everything and is shippable on its own as a hardening pass.
3. Promote this folder from `features_v2.0/` to `planning/features/` and write
   real phase plans + schema DDL at that point.

## Verification

None — nothing built.
