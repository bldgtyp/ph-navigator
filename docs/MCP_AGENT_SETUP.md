---
DATE: 2026-06-30
STATUS: LOCAL AGENT SETUP GUIDE
RELATED: context/mcp.md, context/PRODUCTION_DEPLOYMENT.md, backend/scripts/mcp_stdio.py
---

# MCP Agent Setup

PH-Navigator exposes its app MCP server from the FastAPI backend:

- Local Streamable HTTP: `http://localhost:8000/mcp/`
- Production Streamable HTTP: `https://api.ph-nav.com/mcp`
- Local stdio wrapper: `cd backend && uv run python -m scripts.mcp_stdio`

The repo-local `.mcp.json` is for Claude/Playwright browser tooling only. It
does not configure PH-Navigator's own MCP server.

## Token Model

PHN MCP is never anonymous. A token is scoped to one project and is attributed
to the editor who issued it.

Scopes:

- `project:read` is always required.
- `project:write` allows document/project mutations.
- `asset:read` allows asset lookup and signed URL tools.
- `asset:write` allows attach/detach tools.

Writes land in the token issuer's draft. A write-capable agent should read the
current document/table, write with the latest etag, then call `save_draft` or
`discard_draft`.

## Local One-Time Setup

Agents do not need Ed to run token scripts. Project config registers a local
stdio MCP server that auto-issues its own local fixture token when needed:

- Codex: `.codex/config.toml` registers `phn_local`.
- Claude: `.mcp.json` registers `phn-local`.
- Launcher: `backend/scripts/mcp_agent_stdio.py`.

The launcher is local-dev only because it uses the same guarded fixture seeder
as `make seed-agent-browser`.

When debugging manually, start local services:

```bash
make dev
make backend
```

In another shell, issue a local full-scope token for the Codex agent fixture:

```bash
make seed-agent-mcp
```

Copy the printed export line into the shell that launches Codex or Claude:

```bash
export PHN_MCP_TOKEN='phn_mcp_...'
```

Smoke the Streamable HTTP endpoint:

```bash
make smoke-mcp-local
```

For a write-loop smoke with the same token:

```bash
cd backend
uv run python -m scripts.smoke_mcp_read --token "$PHN_MCP_TOKEN" --write-round-trip
```

## Codex Config

Codex reads MCP servers from `~/.codex/config.toml`, or from trusted project
config at `.codex/config.toml`. This repo already includes:

```toml
[mcp_servers.phn_local]
command = "uv"
args = [
  "--directory",
  "/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2/backend",
  "run",
  "python",
  "-m",
  "scripts.mcp_agent_stdio",
]
startup_timeout_sec = 30
tool_timeout_sec = 120
enabled = true
```

Optional local HTTP config for manual debugging:

```toml
[mcp_servers.phn_local]
url = "http://localhost:8000/mcp/"
bearer_token_env_var = "PHN_MCP_TOKEN"
startup_timeout_sec = 20
tool_timeout_sec = 120
enabled = true
```

Alternative local stdio config if you want to use a pre-issued token instead of
the auto-token launcher:

```toml
[mcp_servers.phn_local_stdio]
command = "uv"
args = ["run", "python", "-m", "scripts.mcp_stdio"]
cwd = "/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2/backend"
env_vars = ["PHN_MCP_TOKEN"]
startup_timeout_sec = 20
tool_timeout_sec = 120
enabled = true
```

Production HTTP config:

```toml
[mcp_servers.phn_prod]
url = "https://api.ph-nav.com/mcp"
bearer_token_env_var = "PHN_MCP_TOKEN"
startup_timeout_sec = 20
tool_timeout_sec = 120
enabled = true
```

Check active servers in Codex with `/mcp`.

## Claude Code Config

Claude Code can use local, user, or project MCP config. For this repo, prefer
local or user scope for PHN MCP tokens so secrets are not checked in.

This repo's `.mcp.json` already registers the no-secret local stdio launcher as
`phn-local`.

Optional local HTTP:

```bash
claude mcp add --transport http --scope local phn-local http://localhost:8000/mcp/ \
  -H "Authorization: Bearer $PHN_MCP_TOKEN"
```

Local stdio:

```bash
claude mcp add --transport stdio --scope local phn-local-stdio \
  -e PHN_MCP_TOKEN="$PHN_MCP_TOKEN" \
  -- uv --directory /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2/backend run python -m scripts.mcp_stdio
```

Production HTTP:

```bash
claude mcp add --transport http --scope local phn-prod https://api.ph-nav.com/mcp \
  -H "Authorization: Bearer $PHN_MCP_TOKEN"
```

Verify in Claude Code:

```bash
claude mcp list
claude mcp get phn-local
```

Inside Claude Code, run:

```text
/mcp
```

## Browser Token Issuance

For a real project token, sign in as an editor, open Project Settings, and use
the "MCP tokens" section. The plaintext token is shown once. Store it outside
the repo, then use it through `PHN_MCP_TOKEN`.

Equivalent REST route:

```http
POST /api/v1/projects/{project_id}/mcp-tokens
```

Example payload:

```json
{
  "label": "Local Codex refactor",
  "scopes": ["project:read", "project:write", "asset:read", "asset:write"],
  "expires_at": null
}
```

## Operating Rules

- Use local tokens for local development and production tokens only for
  deliberate production inspection.
- Never commit plaintext `phn_mcp_...` tokens.
- Revoke stale tokens from Project Settings.
- For agent refactors, ask the agent to start with `list_projects`,
  `get_project`, and `get_document` before write tools.
- For DataTable edits, prefer semantic command tools where available; otherwise
  use `get_table` -> `replace_table` -> `save_draft`.
