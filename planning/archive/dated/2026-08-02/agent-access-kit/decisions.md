---
DATE: 2026-08-02
TIME: 10:25 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Accepted and rejected decisions for the agent-access-kit.
RELATED: ./PRD.md, ./README.md
---

# Decisions

## D-1 — User-scoped agent tokens (Ed, 2026-08-01)

One credential per person per machine, valid across that user's projects.
Rejected as the primary mechanism: per-project tokens for Ed/John's own
agents — minting and storing N tokens across dozens of projects/year does not
scale, and `list_projects` returning one project cripples project resolution.

## D-2 — Project-scoped tokens stay

They remain the least-privilege / external-sharing mechanism, unchanged. The
user-token work adds a principal type; it does not migrate or deprecate
anything.

## D-3 — Device-authorization login flow

Agent requests a code, Ed approves in the already-signed-in PHN web UI, agent
polls and stores the token. Chosen because it satisfies the absolute
no-terminal-secrets rule (browser-only for Ed, Claude-executed otherwise)
with zero copy-paste. Rejected: web-UI mint + paste-into-terminal (violates
the rule); scratchpad-file handoff (works — Linde precedent — but is a
per-project manual ritual, not infrastructure).

## D-4 — `.phn.json` folder marker with null-id bootstrap

Deterministic folder→project mapping lives in a marker file, not in
name-matching heuristics. The template ships `phn_project_id: null`; the
first agent contact resolves and stamps it. Rejected: requiring a manual
kickoff stamping step (will be forgotten); pure name-matching every session
(fragile, slow, ambiguous).

## D-5 — Template folder gets CLAUDE.md + AGENTS.md (Ed, 2026-08-01)

`/Users/em/Dropbox/bldgtyp/0000 Folder Tree` (the copy/rename kickoff
template) gains `.phn.json`, `CLAUDE.md`, and `AGENTS.md`. Files stay
generic — copy/rename must need no editing. Thin pointers only; the skill
carries the workflow.

## D-6 — Sequencing: token model first, distribution second

Phase 01 gates on `planning/archive/dated/2026-08-01/project-ownership-enforcement/` Phase 2
(user tokens are only meaningful once per-project access is enforced).
Plugin/skill auth instructions are written once, against user tokens, rather
than shipped against project tokens and rewritten.

## D-7 — Claude distribution is a plugin, not loose config

A `bldgtyp` plugin (marketplace repo) bundles MCP entry + skill + slash
commands; one install, every folder, and John gets the identical setup.
Rejected: hand-edited `~/.claude.json` + skills copied into `~/.claude/skills`
(drifts between machines/people, nothing versions it).

## D-8 — One source of truth for agent-facing workflow docs

The `phn` skill, the Codex `AGENTS.md` section, and the template files derive
from `context/mcp.md` (which is already CI-guarded against the registered
tool set). Generator or checked-distillation — decided in phase-04 — but
never three hand-maintained copies.

## D-9 — Linde Residence is the acceptance test case (Ed, 2026-08-01)

Folder `/Users/em/Dropbox/bldgtyp/2524_Linde_Residence`, production project
`2f2b0cbd-19b7-41cb-9e38-72593c34d699`. Real folder, real production data,
real approval click. Write-path verification uses draft + `discard_draft`
only — no saved-version mutation on a live client project.

## D-10 — claude.ai connector deferred

OAuth on `/mcp` (for claude.ai web/desktop/mobile) is explicitly out of
scope. Revisit when PHN-from-phone is actually wanted; the device flow is a
stepping stone.

## D-11 — User-token expiry: 365 days, revocable (Ed, 2026-08-01)

Low-ceremony: one re-approval click a year via the device flow. Revocation
stays available from "My agent tokens" but is not expected to be routine.
Rejected: short fixed expiries (90 days) — needless re-issuance churn for a
two-person firm; non-expiring — a yearly rollover is cheap insurance.

## D-12 — Plugin marketplace repo is public (Ed, 2026-08-01)

`bldgtyp/claude-plugins` is public, consistent with the org's other repos.
Consequence: the PRD §6 hygiene rule is a hard gate — no tokens, no project
ids, no client-identifying data ever land in the plugin/skill/template
sources; anything project-specific stays in Dropbox-side files.

## D-13 — Codex parity is first-class, not best-effort (Ed, 2026-08-01)

Ed uses both Claude Code and OpenAI Codex regularly; John is Claude-primary.
Phase 05 is therefore a required deliverable at the same quality bar as the
plugin — the Phase-06 acceptance run keeps its Codex cold/warm criteria, and
the §D-8 generator (one source → plugin skill + Codex AGENTS.md) is
mandatory, not optional.

## D-14 — Cross-user failures are `project_not_found`, not `forbidden` (Ed, 2026-08-01)

**Corrects an inconsistency found in a cross-plan review.** This packet
originally specified `403` / `recoverability: "forbidden"` for a user token
aimed at another user's project — in three places (phase-01 tasks + done-when,
phase-06 §6, PRD §7.6). Its declared dependency,
`planning/archive/dated/2026-08-01/project-ownership-enforcement/` §D-2, specifies **`404
project_not_found`**. Since this packet's tests explicitly "ride the
ownership-enforcement fixtures" (§D-6), the two would have collided the first
time Phase 01 ran.

Resolved in favor of `project_not_found`:

- **Security.** A distinguishable 403 lets a leaked or curious token enumerate
  which project ids exist even where it cannot read them. 404 is the existing
  behavior of `_ensure_project_owner` and of the browser surface, so MCP and
  REST stay on one contract.
- **No new code.** `backend/features/mcp/tools_shared.py:29` already maps
  `project_not_found → "refresh"`.
- **Better agent behavior.** `refresh` tells the agent to re-resolve via
  `list_projects` — exactly the fallback phase-01 already defines. A wrong id
  in a `.phn.json` marker and a project belonging to someone else produce the
  same answer and the same correct next move.

Consequence for the skill/AGENTS copy: never phrase this as "you lack
permission." The agent genuinely cannot distinguish a stale marker from a
permissions boundary, and should re-resolve rather than guess.

`forbidden` remains correct for its actual meaning elsewhere — a *reachable*
project where the principal lacks a specific capability (e.g. a
`project:read`-only token attempting a write).

## D-15 — One stdlib bridge and generated contract own Claude/Codex distribution

Phase 04 chose a thin Python stdio bridge over embedding a bearer in Claude
configuration. It reads the Phase-02 credential file, performs device login on
missing/rejected credentials, and translates stdio JSON-RPC to PH-Navigator's
stateless Streamable HTTP endpoint. The same published bridge will serve Codex
in Phase 05; no third-party proxy or runtime dependency is required.

`plugins/bldgtyp/config/phn.json`, `source/phn-workflow.md`, and the shared
`source/project-resolution.md` are the canonical distribution inputs. They
generate the plugin skill, Codex AGENTS section, and Dropbox instructions.
Public CI checks a vendored `context/mcp.md` snapshot for required tools,
recoverability, device/credential protocol values, and draft-safety anchors.

Claude plugin skills are namespaced, so the user-facing commands are
`/bldgtyp:phn`, `/bldgtyp:phn-login`, and `/bldgtyp:phn-status`; the packet's
earlier unqualified shorthand is superseded.

Phase 05 installs the same bridge for Codex as an immutable content-hashed
release under the user's data directory. Managed marker blocks update global
Codex TOML/AGENTS content without owning the rest of either file; config is the
final activation write and AGENTS is rolled back if it fails. An existing
unmanaged `phn` server is a hard error rather than an overwrite. The installed
instructions contain the absolute release-local `phn-login` command, avoiding
an implicit `PATH` dependency.

## D-16 — Claude cold start gets an explicit machine timeout

Production acceptance exposed two launcher assumptions that local sideload
testing had not exercised: Claude's default 30-second MCP startup window is
shorter than the 10-minute device grant, and the launcher can resolve macOS's
system Python 3.9 instead of a newer shell Python. Public plugin `0.1.1`
therefore supports Python 3.9 and adds `make configure-claude`, which
idempotently raises `MCP_TIMEOUT` to at least 660,000 ms while preserving the
rest of `~/.claude/settings.json`.

The setting is machine-wide because it governs Claude's MCP process startup,
not a PH-Navigator project. It is intentionally explicit during installation;
the plugin does not silently rewrite Claude settings when it loads.
