---
DATE: 2026-08-01
TIME: 12:58 EDT
STATUS: Active — Phases 01–04 complete; Phase 05 next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Router for the agent-access-kit feature — make PH-Navigator trivially
  usable by agents (Claude Code / Codex) launched in any BLDGTYP project folder.
RELATED: ./PRD.md, ./decisions.md, ./STATUS.md, ./phases/,
  context/mcp.md, context/PRODUCTION_DEPLOYMENT.md,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/
---

# Agent Access Kit

When Ed or John opens Claude Code or Codex inside a BLDGTYP Dropbox project
folder (e.g. `~/Dropbox/bldgtyp/2524_Linde_Residence/`), the agent should
already know that PH-Navigator exists, which PHN project that folder maps to,
how to authenticate, and how to read/query/write project data through MCP —
with zero per-session setup and zero secret copy-pasting by a human.

## What already exists (the hard 80%)

- **Remote MCP is live in production.** `backend/main.py` mounts the MCP
  server at `api.ph-nav.com/mcp` via streamable HTTP. Any agent with a URL and
  a bearer token can reach it today.
- **Local dev MCP** (`phn-local` stdio, self-healing token bootstrap) — solved,
  in-repo only.
- **A CI-guarded tool contract** — `context/mcp.md`, ~60 tools, draft/etag
  write lifecycle, error-recoverability envelope.

## The gap this feature closes

Distribution and identity, not tools:

1. **Discovery** — nothing outside this repo registers the PHN MCP server.
2. **Project resolution** — nothing in a Dropbox project folder says
   "this folder = PHN project `<id>`".
3. **Credentials** — tokens are project-scoped, minted per-project in the web
   UI, shown once. Manual ritual per project × per machine, and it collides
   with the no-terminal-secrets rule.

## The kit (five components + one deferral)

| # | Component | Phase |
|---|---|---|
| 1 | **User-scoped agent tokens** — one credential per person per machine, valid across that user's projects (Ed's decision, `decisions.md` §D-1) | 01 |
| 2 | **Device-flow login** — agent requests, Ed clicks Approve in the already-logged-in PHN web UI, token lands on disk; no human touches a secret | 02 |
| 3 | **Folder marker + template files** — `.phn.json` + `CLAUDE.md` + `AGENTS.md` in `0000 Folder Tree`, so every new project folder is born agent-ready | 03 |
| 4 | **`bldgtyp` Claude Code plugin** — MCP server entry + `phn` skill + slash commands, installed once at user level, present in every folder | 04 |
| 5 | **Codex parity** — global `~/.codex/config.toml` MCP entry + `~/.codex/AGENTS.md` section, generated from the same source as the plugin skill | 05 |
| — | claude.ai **connector** (OAuth on `/mcp`) — deferred until PHN-from-phone is actually wanted | deferred |

## Test case

The **Linde Residence** project, end to end (`phases/phase-06-linde-e2e.md`):

- Dropbox folder: `/Users/em/Dropbox/bldgtyp/2524_Linde_Residence`
- Production project: `https://www.ph-nav.com/projects/2f2b0cbd-19b7-41cb-9e38-72593c34d699`

## Dependency

Phase 01's dependency is satisfied by
`planning/archive/dated/2026-08-01/project-ownership-enforcement/` Phase 2. A
token valid "across the user's projects" is now grounded in enforced project
reach. Phases 03–05 have no backend dependency and can proceed in parallel
against project-scoped tokens if wanted, but the auth story in the plugin/skill
should be written once, against user tokens (`decisions.md` §D-6).

## Read order

1. **`PRD.md`** — the contract: target agent experience, token model, marker
   spec, distribution surfaces, acceptance criteria.
2. **`decisions.md`** — accepted decisions and rejections.
3. **`STATUS.md`** — current state, next step, blockers.
4. **`phases/`** — phase-01 → phase-06.
