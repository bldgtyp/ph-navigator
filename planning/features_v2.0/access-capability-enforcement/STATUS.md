---
DATE: 2026-06-27
TIME: 22:55 ET
STATUS: Deferred (v2.0 — gated on the RBC trigger)
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: State tracker for the deferred access-capability enforcement (Phase 5).
RELATED:
  - README.md, PRD.md
  - planning/archive/dated/2026-06-27/access-capability-model/
  - planning/features_v2.0/multi-tenant-teams/
---

# STATUS — Access-Capability Enforcement (deferred Phase 5)

**State:** Deferred / speculative. The access-capability-model **beta**
(Phases 1–4b) is complete and archived; this captures the enforcement work it
left for the trigger. **No new code, no schema applied, no schedule.**

## Where things stand

- The resolver (`backend/features/access/`) and reserved schema (held DDL +
  live `projects.team_id` / `users.is_staff` / `user_grants`) were shaped *for*
  this during the beta — it is a fill-in, not a redesign (decision D9).
- The exact fill-in points are enumerated in `PRD.md` §2; the work items in §4.
- The business trigger and tenant-isolation hurdle are owned by
  [[multi-tenant-teams]]; this feature is the capability enforcement on top.

## Blockers / dependencies

- **Business:** the RBC partnership / first external member (tenancy) or first
  certifier link (shares) must actually be needed. Speculative until then.
- **Decision:** the open questions in `multi-tenant-teams` PRD §7 should be
  answered before real planning.

## Next step (only if pursued)

1. Confirm the trigger is real; answer `multi-tenant-teams` PRD §7.
2. Promote this folder to `planning/features/`, write phase plans, and apply the
   held DDL in a real migration (re-validate FKs against the live schema first).
3. Ship **tenant isolation first** (PRD §4.2) as a standalone hardening pass;
   certifier shares (§4.3–4.4) can follow independently.

## Verification

None — nothing built.
