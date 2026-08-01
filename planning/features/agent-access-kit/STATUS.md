---
DATE: 2026-08-01
TIME: 09:58 EDT
STATUS: Ready — ownership dependency implemented and verified
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and blockers for the agent-access-kit.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Planned. No code written.** Current-state survey done (remote streamable
HTTP MCP confirmed live at `api.ph-nav.com/mcp`; gap characterised as
discovery + project resolution + credentials). Contract, decisions D-1..D-14
(D-1, D-5, D-9, D-11, D-12, D-13, D-14 explicitly Ed's), and six phases written
2026-08-01.

**Amended 2026-08-01 (cross-plan review).** A conflict with this packet's own
dependency was found and resolved: three places specified `403` / `forbidden`
for cross-user access, while
`planning/archive/dated/2026-08-01/project-ownership-enforcement/` §D-2 specifies `404
project_not_found`. Since §D-6 has these tests riding the ownership-enforcement
fixtures, they would have collided on first run. Aligned to
`project_not_found` / `recoverability: "refresh"` in phase-01 (task 5 +
done-when + a new "Cross-user error contract" section), phase-06 §6, and PRD
§6/§7.6; rationale recorded as `decisions.md` §D-14.

Also flagged in PRD §6: the "a leaked token exposes one user's projects, not
the tenancy" claim does **not** hold for an admin/staff user, who resolves
`projects.access.all` and therefore reaches everything. Relevant to the
device-approval copy and to whether admins should mint 365-day tokens (§D-11).

## Next step

Phase 01 can begin as stacked work from the ownership implementation branch;
merge that dependency before starting from `main`. Phase 03 (folder marker +
template files) remains independently implementable.

## Dependency status

- **Phase 01 dependency satisfied on the implementation branch.** The owner-or-
  all seam, MCP surface sweep, and stale-token regression are complete. Phase
  01 still needs the dependency merged before it starts from `main`.
- Phase 03 is independently unblocked; 04–05 can be drafted but should not ship
  auth instructions until the user-token shape is real (§D-6).

## Open questions for Ed

None — the three initial questions were answered 2026-08-01 and recorded as
`decisions.md` §D-11 (365-day revocable token expiry), §D-12 (plugin repo
public), §D-13 (Codex parity first-class; Ed uses both runtimes, John is
Claude-primary).

## Verification

Per PRD §7. The two easiest to skip and most important:

- Criterion 3 (write round-trip on Linde via draft + `discard_draft`) — the
  remote write path with a user token is the part nothing exercises today.
- Criterion 6 (cross-user scope regression) — a user token must not become a
  bypass of ownership enforcement; test rides on that refactor's fixtures.

## Dependents / dependencies

- Depends on: `planning/archive/dated/2026-08-01/project-ownership-enforcement/`
  (Phase 2, implemented and verified on its branch).
- Related: `planning/features/admin-all-projects-dashboard/` (same
  enforcement dependency; no direct coupling).
