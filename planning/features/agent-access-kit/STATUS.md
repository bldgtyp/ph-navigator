---
DATE: 2026-08-01
TIME: 12:22 EDT
STATUS: Active — Phases 01–03 complete; Phase 04 next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and blockers for the agent-access-kit.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Phases 01–03 complete on `codex/agent-access-kit`.** User-scoped bearer tokens
now share `mcp_tokens` with project tokens (`project_id IS NULL` identifies the
user principal), default to a 365-day expiry, and expose account-level
issue/list/revoke REST routes plus the **My agent tokens** list/revoke page.
`list_projects` returns the issuer's current owner-or-`projects.access.all`
reach; every other MCP tool reuses the existing project-access seam. Project
tokens remain unchanged.

Device login now uses a 10-minute hashed grant, signed-in `/approve-agent`
decision, database-enforced poll cadence, and single redemption into the same
365-day user-token rows. The reference `backend/scripts/phn_login.py` client
stores the result atomically at `~/.config/phn/credentials.json` with mode
`0600`; plaintext never reaches the approving browser or terminal output.

The generic Dropbox kickoff template now carries a null-id `.phn.json` plus
thin Claude/Codex project-folder instructions. The Linde Residence folder has
the exact instruction copies and a stamped production project id. The template
contains no client name, project id, or credential material.

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

Implement Phase 04: create and publish the public `bldgtyp/claude-plugins`
marketplace with the `phn` MCP launcher, skill, minimal commands, and canonical
generator/source for the Phase-03 Dropbox files.

## Dependency status

- Phase 01 dependency is merged on `main`; Phase 01 is implemented and locally
  verified.
- Phases 02–03 are complete and locally verified. Phase 04 is unblocked and can
  target the concrete user-token and device-login contract.

## Open questions for Ed

None — the three initial questions were answered 2026-08-01 and recorded as
`decisions.md` §D-11 (365-day revocable token expiry), §D-12 (plugin repo
public), §D-13 (Codex parity first-class; Ed uses both runtimes, John is
Claude-primary).

## Verification

Phase 01 evidence:

- `cd backend && uv run pytest tests/test_mcp.py -q` — 29 passed.
- `cd backend && uv run ty check` — passed.
- `cd frontend && pnpm exec vitest run src/App.test.tsx` — 33 passed.
- `cd frontend && pnpm exec tsc -b` — passed.
- `make agent-browser-ready`, then authenticated `/account/agent-tokens`
  screenshot — correct account route, empty state, and no application-console
  error after sign-in (the helper's initial unsigned session probe returned its
  expected 401).
- `make ci` — 1,758 backend tests passed (7 skipped), 2,370 frontend tests
  passed, and the production build completed.

Phase 02 evidence:

- `cd backend && uv run pytest tests/test_mcp.py tests/test_phn_login.py -q` —
  37 passed; Ty and focused Ruff passed.
- `cd frontend && pnpm exec vitest run src/App.test.tsx` — 34 passed;
  TypeScript and focused ESLint passed.
- Authenticated local `/approve-agent?code=...` browser flow — exact label,
  scopes, user code, expiry, elevated-account warning, approve state, and zero
  console errors verified.
- Live local grant redeemed with the reference client functions, temporary
  credential written as `0600`, token authenticated/revoked, and temporary
  credential removed.

Phase 03 evidence:

- Template `.phn.json` parses with a null id and exact production URLs; Linde
  parses with project id `2f2b0cbd-19b7-41cb-9e38-72593c34d699`.
- A scratch copy of `0000 Folder Tree` preserved all `01_Reference` through
  `14_HBJSON` directories and carried the three new generic files unchanged.
- Template hygiene scan found no Linde name, number, or project id; `cmp`
  verified both Linde instruction files are exact template copies.
- Three-lens simplify review found no correctness or reuse defects. Its one
  maintenance note—the intentional four Dropbox copies—remains owned by the
  Phase-04 canonical generator required by §D-8.

Per PRD §7. The two easiest to skip and most important:

- Criterion 3 (write round-trip on Linde via draft + `discard_draft`) — the
  remote write path with a user token is the part nothing exercises today.
- Criterion 6 (cross-user scope regression) — a user token must not become a
  bypass of ownership enforcement; test rides on that refactor's fixtures.

## Dependents / dependencies

- Depends on: `planning/archive/dated/2026-08-01/project-ownership-enforcement/`
  (complete, verified, and archived).
- Related: `planning/archive/dated/2026-08-01/admin-all-projects-dashboard/` (same
  enforcement dependency; no direct coupling).
