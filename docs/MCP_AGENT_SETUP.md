---
DATE: 2026-08-02
STATUS: AGENT SETUP GUIDE
RELATED: context/mcp.md, context/PRODUCTION_DEPLOYMENT.md,
  backend/scripts/mcp_agent_stdio.py, backend/scripts/phn_login.py,
  https://github.com/bldgtyp/claude-plugins
---

# MCP Agent Setup

PH-Navigator has two deliberately separate agent paths:

| Server | Data | Use when |
| --- | --- | --- |
| `phn-local` | Local `AGENT-BROWSER` fixture | Developing or testing the PH-Navigator application in this repo |
| `phn` | Live production projects at `api.ph-nav.com` | Working in a BLDGTYP consulting project folder |

Do not use production client data to test app changes, and do not answer a real
project question from the local fixture. `context/mcp.md` is the canonical tool,
scope, error, and draft-lifecycle contract; this file covers installation and
day-to-day use.

## Local app development: `phn-local`

This repo already registers the local credential-aware stdio launcher:

- Claude: `.mcp.json` server `phn-local`.
- Codex: `.codex/config.toml` server `phn_local`.
- Launcher: `backend/scripts/mcp_agent_stdio.py`.
- Credential: `backend/.agent-mcp-token.json` (gitignored; mode `0600` where
  supported).

The launcher reuses its credential and, after a database reset or revocation,
repairs the local fixture and issues a replacement automatically. No human
token setup is part of the normal local workflow.

If the local server cannot connect, run:

```sh
make agent-browser-ready
```

This starts or repairs the supported `5173`/`8000` stack and the isolated local
fixture. Then reconnect or restart the MCP client. `make seed-agent-mcp` and
`make smoke-mcp-local` remain manual HTTP/debugging aids; the latter uses an
explicit `PHN_MCP_TOKEN` and is not the normal agent path. Never commit or paste
the generated local credential.

## Production project work: `phn`

The public [`bldgtyp/claude-plugins`](https://github.com/bldgtyp/claude-plugins)
repo distributes one generated production workflow to Claude Code and Codex.
It installs a dependency-free stdio bridge that connects to
`https://api.ph-nav.com/mcp` and reads the shared user credential at
`~/.config/phn/credentials.json`.

### Install for Claude Code

Requires Claude Code 2.1.203 or newer and Python 3.11 or newer:

```sh
claude plugin marketplace add bldgtyp/claude-plugins --scope user
claude plugin install bldgtyp@bldgtyp --scope user
```

Restart Claude Code or run `/reload-plugins`. The plugin provides:

- production MCP server `phn`;
- `/bldgtyp:phn` — project resolution and safe read/write workflow;
- `/bldgtyp:phn-login` — explicitly replace or refresh this machine's
  credential; and
- `/bldgtyp:phn-status` — read-only status, active-version, and unfinished-work
  summary for the current folder.

Verify the installation with:

```sh
claude mcp list
claude mcp get phn
```

### Install for Codex

Requires Codex CLI and Python 3.11 or newer. From a checkout of the public
plugin repo:

```sh
make install-codex
codex mcp get phn
```

The idempotent installer:

- copies the bridge and `phn-login` into a content-hashed release under
  `~/.local/share/bldgtyp/phn-agent/releases/`;
- manages only its marked `mcp_servers.phn` block in
  `~/.codex/config.toml`;
- manages only its marked generated workflow in `~/.codex/AGENTS.md`;
- preserves unrelated content, permissions, and one prior runtime release; and
- refuses to overwrite an unmanaged MCP server already named `phn`.

Restart Codex after installation or update. Codex uses the generated global
workflow automatically; ask for project status in normal language. When an
explicit credential refresh is requested, follow the installed `phn-login`
path recorded in the generated global instructions. If Codex reports that the
configured model requires a newer CLI, update Codex or select a model supported
by that installed CLI before judging the PHN connection.

## Browser-approved machine login

On first production use, or after expiry/revocation, the `phn` bridge starts a
10-minute device authorization automatically:

1. The bridge opens PH-Navigator's `/approve-agent` page and polls at the
   server-provided interval.
2. The signed-in human checks the machine label, scopes, and expiry, then clicks
   **Approve** or **Deny**. This is the only required human action.
3. On approval, the bridge writes `~/.config/phn/credentials.json` atomically
   with mode `0600`. The plaintext token is returned once to the bridge and is
   never shown to the approving human.

The normal credential is user-scoped: it can reach every project the issuing
user can currently access, and every call re-checks that reach. Agent tokens
default to a 365-day expiry. Admin/staff credentials inherit tenant-wide
`projects.access.all`; the approval page warns about that larger blast radius.
Use the account menu's **My agent tokens** page to list or revoke machine
credentials.

Never ask the user to copy a token, inspect the credential's token field, put a
token in command arguments, or store one in a project folder or committed
configuration.

## Resolve a project folder

BLDGTYP project roots carry a `.phn.json` marker:

```json
{
  "phn_project_id": null,
  "phn_api": "https://api.ph-nav.com",
  "phn_web": "https://www.ph-nav.com"
}
```

For every production project task:

1. Search the current directory and its ancestors for `.phn.json`.
2. Read `phn_project_id`, `phn_api`, and `phn_web`; pass the id to each
   project-scoped MCP call.
3. When the id is `null`, call `list_projects`, compare the folder name with
   project names and BT numbers, and ask the user to choose if multiple matches
   are plausible. After confirmation, update only `phn_project_id`; preserve
   the URLs.
4. On `project_not_found` / `refresh`, call `list_projects` and resolve the
   marker again. That error does not prove the project exists or that access was
   denied.

The shared project-folder `CLAUDE.md` and `AGENTS.md` templates intentionally
stay thin: they identify the folder and point to the installed workflow instead
of copying its operational rules.

## Safe production operation

Use `phn` when a project task needs metadata, versions, status items,
document/table values, assets, focused QA reports, or an explicitly requested
draft edit.

- Resolve the marker and read current state before writing.
- Prefer `get_table` over `get_document` when one registered table is enough.
- Use the current `version_body_etag` for the first draft write and the latest
  `draft_etag` thereafter.
- Prefer semantic `apply_envelope_command` and `apply_aperture_command` tools.
  `replace_table` is a lower-level whole-table primitive: preserve the full
  payload and preview destructive replacements first.
- Writes affect the issuing user's real production draft. Never call
  `save_draft` or `save_draft_as` unless the user explicitly asks to persist
  the change.
- For a verification-only edit, inspect `diff_versions(to="draft")`, call
  `discard_draft`, and confirm the draft is gone.
- Never run `delete_project`, `restore_project`, or `hard_delete_project`
  without an explicit request for that exact operation. Treat hard delete as
  off-limits during autonomous work.

MCP is a data/tool surface, not a rendered-UI test. Use the repo's supported
browser workflow for DOM, layout, interaction, authentication, and visual
verification.

## Project-scoped tokens: optional least privilege

Project-scoped tokens remain supported for a deliberately one-project
credential or manual protocol debugging. An editor issues, lists, and revokes
them in **Project Settings → MCP tokens**. Plaintext is shown once; store it
outside the repo and never paste it into agent conversation or checked-in
config.

These tokens add a fixed project boundary to the issuer's current access and
remain subject to revocation, expiry, scopes, and per-call issuer reach checks.
They are not the default Claude/Codex setup; the installed `phn` bridge uses the
browser-approved user credential.

## Troubleshooting

| Symptom | Response |
| --- | --- |
| `phn-local` unavailable in this repo | Run `make agent-browser-ready`, then restart/reconnect the client. |
| `phn` missing in Claude | Run `claude mcp list` / `claude mcp get phn`; install or reload the plugin. |
| `phn` missing in Codex | Re-run `make install-codex` in the public plugin repo, verify with `codex mcp get phn`, then restart Codex. |
| Missing, expired, or revoked production credential | Let the bridge start device authorization, or use the explicit installed login workflow. |
| `project_not_found` with `refresh` | Re-run `list_projects` and re-resolve `.phn.json`; do not infer a permission failure. |
| Stale draft/version etag | Re-read current state and reconstruct the intended change; do not replay an old whole-table payload. |

Structured MCP errors include `code`, `message`, `request_id`,
`recoverability`, and `details` in a JSON `ToolError` string. The required
responses for `refresh`, `reauthenticate`, `forbidden`, `retry`, and `fatal`
are defined in `context/mcp.md` and in the installed generated workflow.
