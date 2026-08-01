---
DATE: 2026-08-01
TIME: 08:41 EDT
STATUS: Blocked — auth content needs Phases 01–02 shapes final (§D-6)
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: `bldgtyp` Claude Code plugin — MCP entry + `phn` skill + slash commands.
RELATED: ../PRD.md §5.1, ../decisions.md §D-7/D-8, context/mcp.md
---

# Phase 04 — Claude Code plugin

## Goal

One `claude plugin install` gives any machine (Ed's, John's) the PHN MCP
server, the `phn` workflow skill, and helper slash commands — present in
every folder Claude Code opens.

## Deliverables

1. **Marketplace repo** `github.com/bldgtyp/claude-plugins`, **public**
   (§D-12 — so the PRD §6 no-secrets/no-client-data rule is a hard gate on
   every commit): standard marketplace layout, one `bldgtyp` plugin to start.
2. **MCP server entry `phn`** → `https://api.ph-nav.com/mcp` (streamable
   HTTP), bearer from `~/.config/phn/credentials.json`. Design decision
   here: env-var expansion in the header config vs. a thin stdio launcher
   that reads the file and proxies (launcher also gives a natural place to
   trigger the device flow on 401). Credential file path is the fixed
   contract with Phase 02.
3. **`phn` skill** — distilled from `context/mcp.md` (§D-8: generated or
   CI-checked against it, never a third hand-copy):
   - project resolution: `.phn.json` marker → null-id bootstrap →
     `list_projects` fallback;
   - read tools and when to use which (`get_project`, `get_document`,
     `get_table`, report/query tools);
   - write discipline: semantic commands first, `replace_table` as the
     lower-level primitive, etag rules, `save_draft`/`save_draft_as`/
     `discard_draft`;
   - error envelope + recoverability table;
   - credential bootstrap: missing/expired credential → device flow;
   - safety: client projects are production data — prefer drafts, never
     `save_draft` unless asked, `hard_delete_project` is off-limits.
4. **Slash commands**: `/phn-login` (device flow), `/phn-status` (project +
   active version + `list_status_items` + `query_unfinished_envelope_work`
   summary). Keep the set minimal.
5. **Canonical template text** for the Phase-03 Dropbox files lives here too,
   so plugin + template regenerate from one source.

## Naming

The plugin server is `phn` (production data, any folder); the in-repo dev
server stays `phn-local`. The skill must tell agents in *this* repo to keep
using `phn-local` for local dev work.

## Done when

Fresh `claude` session in a marker-stamped folder on a machine with the
plugin: `/phn-status` answers from production with no per-session setup.
