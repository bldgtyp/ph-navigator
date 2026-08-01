---
DATE: 2026-08-01
TIME: 08:41 EDT
STATUS: Active — contract accepted, implementation not started
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Product/behavior contract for the agent-access-kit.
RELATED: ./README.md, ./decisions.md, ./phases/, context/mcp.md,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/PRD.md
---

# Agent Access Kit — PRD

## 1. Target experience

Ed (or John) opens a terminal in any BLDGTYP project folder and starts
`claude` or `codex`. Without any setup in that session:

1. The agent knows PH-Navigator exists (plugin skill / global AGENTS.md).
2. The agent resolves which PHN project the folder is (`.phn.json` marker,
   falling back to `list_projects` name-matching + stamping the marker).
3. The agent has, or can obtain, credentials: a stored user-scoped token on
   disk, or a one-click browser-approval flow when none exists. Ed never
   copies a secret into a terminal.
4. The agent reads, queries, and writes project data through the production
   MCP surface (`api.ph-nav.com/mcp`) following the `context/mcp.md` draft
   lifecycle.

The same experience must work identically for Claude Code and Codex, from the
same source of truth.

## 2. Token model (§D-1: user-scoped)

### 2.1 Current state

MCP tokens are **project-scoped** bearer tokens issued by a logged-in editor
via `POST /api/v1/projects/{project_id}/mcp-tokens`. `list_projects` returns
the single project visible to the token (`context/mcp.md`).

### 2.2 Target state

Add a **user-scoped agent token** as a second principal type:

- Issued to a user account, not a project. Authorizes every project that user
  can access under the project-ownership-enforcement rules — the access check
  per tool call routes through the same seam
  (`project_access_for_user` / `require_project_access`), never a parallel
  one.
- Carries the same scope strings (`project:read`, `project:write`,
  `asset:read`, `asset:write`); scopes now apply across the user's projects.
- `list_projects` under a user token returns all projects the user can
  access — this is the agent's project-resolution fallback and makes the tool
  genuinely useful.
- Stored like project tokens: hash + prefix + scopes + issuer + optional
  expiry + revocation; plaintext shown/delivered exactly once. Storage shape
  (extend `mcp_tokens` with a nullable `project_id` vs. new table) is a
  phase-01 design decision.
- **Project-scoped tokens remain** unchanged, as the least-privilege /
  external-sharing mechanism (§D-2). Nothing about their issuance, scope
  checks, or revocation changes.

### 2.3 Revocation & expiry

User tokens expire after **365 days** (§D-11) and are revocable from the web
UI (a "My agent tokens" surface, account-level, mirroring the per-project
token UI). Rollover is one device-flow re-approval click a year; revocation
exists but is not expected to be routine.

## 3. Device-flow login (§D-3)

The only new interactive surface. Modeled on OAuth 2.0 Device Authorization
Grant, minimally:

1. Agent calls `POST /api/v1/agent-tokens/device` (unauthenticated) →
   `{device_code, user_code, verification_url, interval, expires_in}`.
2. Agent prints/opens `verification_url` (e.g.
   `www.ph-nav.com/approve-agent?code=XXXX-XXXX`); Ed, already signed in,
   sees the request (user code, requested scopes, machine label) and clicks
   **Approve**.
3. Agent polls `POST /api/v1/agent-tokens/device/poll` with the device code;
   on approval it receives the plaintext user token once and writes it to
   `~/.config/phn/credentials.json` (mode 600).
4. Denied / expired codes fail closed; polling respects `interval`.

Constraints: short-lived device codes (≤15 min), single redemption, rate
limited, approval page shows exactly what is being granted. No secret ever
transits Ed's clipboard or keyboard.

## 4. Folder marker + project-folder template (§D-4, §D-5)

### 4.1 `.phn.json`

One small file at the project-folder root:

```json
{
  "phn_project_id": "2f2b0cbd-19b7-41cb-9e38-72593c34d699",
  "phn_api": "https://api.ph-nav.com",
  "phn_web": "https://www.ph-nav.com"
}
```

- The skill's first instruction: look for `.phn.json` in cwd and ancestors;
  that is the project. All MCP tool calls pass its `phn_project_id`.
- **Bootstrap rule**: the template ships the marker with
  `"phn_project_id": null`. An agent finding a null id resolves the project
  via `list_projects` (name-match against the folder name / Ed confirmation)
  and stamps the id back into the marker. New folders therefore self-heal on
  first agent contact; no kickoff step can be forgotten.

### 4.2 Template folder

`/Users/em/Dropbox/bldgtyp/0000 Folder Tree` is the kickoff template — Ed and
John copy/rename it per project. Add to it:

- `.phn.json` (null id, prod URLs).
- `CLAUDE.md` — thin: what this folder is (BLDGTYP project), the folder-tree
  map (01_Reference … 14_HBJSON), pointer to the marker, and "use the `phn`
  MCP tools / `phn` skill for project data". No workflow duplication — the
  skill carries the how.
- `AGENTS.md` — same content, Codex-flavored (Codex reads AGENTS.md).

Both files must stay generic (no project names) so copy/rename needs no
editing.

## 5. Distribution surfaces

### 5.1 Claude Code plugin (§D-7)

A `bldgtyp` plugin in a marketplace repo (working name:
`github.com/bldgtyp/claude-plugins`), installed once at user level:

- **MCP server entry** `phn`: streamable HTTP to
  `https://api.ph-nav.com/mcp`, bearer token sourced from
  `~/.config/phn/credentials.json`. Mechanism (env-var expansion in headers
  vs. a thin stdio launcher that reads the file and proxies) is a phase-04
  design decision; the credential file location is the fixed contract.
- **`phn` skill**: distilled from `context/mcp.md` — project resolution via
  marker, read tools, draft/etag write lifecycle, semantic commands over
  `replace_table`, error-recoverability table, device-flow bootstrap when no
  credential exists. Generated/checked against `context/mcp.md` so there is
  one truth (§D-8).
- **Slash commands** (small, optional): e.g. `/phn-status` (project +
  version + unfinished-work summary), `/phn-login` (device flow).

The in-repo `phn-local` stdio server stays as-is for PHN development; the
plugin targets production data access from anywhere. Naming must keep the two
distinguishable.

### 5.2 Codex parity

- Global `~/.codex/config.toml` MCP entry for the same endpoint/credential.
- `~/.codex/AGENTS.md` section carrying the skill content.
- Both generated from the same source as the plugin skill — one generator,
  two outputs (§D-8).

### 5.3 claude.ai connector — deferred

OAuth on `/mcp` would let claude.ai web/desktop/mobile connect. Deferred
until wanted; the device-flow work is a stepping stone, not a substitute.

## 6. Security constraints

- This repo is public: the plugin/marketplace repo must contain no tokens,
  project ids, or client-identifying data. `.phn.json` lives in Dropbox, not
  git.
- Plaintext tokens: delivered once via the device flow, stored only in
  `~/.config/phn/credentials.json` (0600), never logged, never committed —
  same handling rules as `backend/.agent-mcp-token.json`.
- User tokens obey ownership enforcement; a leaked token exposes one user's
  projects, not the tenancy. Revocation is immediate (tokens re-checked at
  call time, per the existing MCP operating model).
- Cross-user attempts return `project_not_found`, never `forbidden` — a
  distinguishable 403 would let a leaked token enumerate which project ids
  exist even where it cannot read them (ownership-enforcement §D-2).
- Caveat on the blast-radius claim above: a user-scoped token held by an
  **admin/staff** user resolves `projects.access.all`, so it reaches *every*
  project, not one user's. Worth reflecting in the device-approval copy and in
  whether admins should be able to mint long-lived (365-day, §D-11) user
  tokens at all.
- The device-approval page must be unambiguous about what is granted and to
  which machine label.

## 7. Acceptance criteria

1. **Cold-start Linde test** (the definitive one, phase-06): on a machine
   with the plugin installed but no credential, open Claude Code in
   `/Users/em/Dropbox/bldgtyp/2524_Linde_Residence`, ask "what's the status
   of this project in PH-Nav?" — the agent discovers the marker, runs the
   device flow (Ed clicks Approve in the browser, nothing else), and answers
   from live production data for project
   `2f2b0cbd-19b7-41cb-9e38-72593c34d699`.
2. **Warm-path read**: with a stored credential, the same question requires
   zero interactive steps.
3. **Write round-trip**: agent applies a harmless draft edit on Linde,
   verifies via `diff_versions(to="draft")`, then `discard_draft` — draft
   lifecycle works over the remote surface with a user token. No saved
   version is mutated.
4. **Codex parity**: criteria 1–2 repeated under Codex.
5. **Template hygiene**: copying `0000 Folder Tree` to a fresh project folder
   and opening an agent there resolves/stamps the marker via the null-id
   bootstrap rule.
6. **Scope regression**: project-scoped tokens still behave exactly per
   `context/mcp.md`; a user token for user A cannot touch user B's projects,
   failing with `project_not_found` / `recoverability: "refresh"` rather than
   `forbidden` (test rides on the ownership-enforcement test fixtures; contract
   in phase-01 "Cross-user error contract").
7. **Docs**: `context/mcp.md` gains the user-token principal + device flow;
   token-issuance section updated; skill/AGENTS content generated from it.
