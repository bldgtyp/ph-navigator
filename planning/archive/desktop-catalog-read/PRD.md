---
DATE: 2026-09-08
TIME: 22:01 EDT
STATUS: In review
AUTHOR: Codex for Claude
SCOPE: Web side of the SketchUp shared material library connection
RELATED: README.md, STATUS.md, context/mcp.md, context/technical-requirements/api.md
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/90
---

# Product contract

A consultant approves a named **PH-Navigator for SketchUp** request in the
browser, then the desktop consumer reads active shared materials using that
revocable credential. It needs no project id or project permissions.

Source: `ph-navigator-sketchup/planning/features/shared-material-library/phases/phase-04-connection.md`,
**Web repository**, linked through [README.md](README.md).

Acceptance:

1. `catalog:read` is an allowed token/device scope and frontend type, with
   approval label **Read the shared material library**. Project-read defaults
   stay unchanged. The shared validator accepts a catalog-only grant, while
   retaining `project:read` for all existing project/asset combinations.
2. Migration `20260909_0014` extends both allowed-scope CHECK arrays without
   rewriting rows. Downgrade deletes only grants carrying the new scope before
   restoring old arrays; existing grants survive unchanged.
3. The two `/api/v1/desktop` GET routes use one `DesktopToken` dependency.
   It checks bearer validity, active issuer, null project id, and `catalog:read`,
   and uses the existing MCP last-use update. Invalid credentials return 401;
   wrong scope or project binding returns 403.
4. Session returns the specified safe metadata. Materials returns the existing
   active list projection in the stable library envelope. No new catalog SQL
   or inactive-row option. Existing device-poll rate limiting is reused.
5. Tests cover auth failures on both routes, active filtering, normal-member
   access, cookie-only rejection, approval/redemption, rate limiting, legacy
   scope validation, and a migration downgrade/upgrade with old-row preservation.
6. Required repository checks and database limitations are reported honestly.

Approval copy for catalog-only grants describes the library and omits the
project-reach warning. Existing project-grant copy is unchanged. This is a
necessary extension of the scope label so the consent page accurately describes
the new grant. The project token issuance UI keeps its existing scope choices.

Out of scope: desktop writes, frames/glazing, tenant isolation, extension code,
credential storage, production migration or deployment.
