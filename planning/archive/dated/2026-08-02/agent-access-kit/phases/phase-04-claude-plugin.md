---
DATE: 2026-08-01
TIME: 12:58 EDT
STATUS: Complete — public marketplace/plugin published and locally verified
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
2. **MCP server entry `phn`** → a dependency-free stdio bridge to
   `https://api.ph-nav.com/mcp` (stateless Streamable HTTP), with the bearer
   read from `~/.config/phn/credentials.json`. The launcher triggers the
   device flow when credentials are missing or rejected, keeps bearer material
   out of configuration/arguments, reuses HTTPS connections, bounds concurrent
   requests, and never automatically replays an indeterminate POST.
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
4. **Namespaced commands**: `/bldgtyp:phn-login` (device flow),
   `/bldgtyp:phn-status` (project + active version + `list_status_items` +
   `query_unfinished_envelope_work` summary). Claude plugin skills are always
   namespaced by plugin; keep the set minimal.
5. **Canonical template text** for the Phase-03 Dropbox files lives here too,
   so plugin + template regenerate from one source.

## Naming

The plugin server is `phn` (production data, any folder); the in-repo dev
server stays `phn-local`. The skill must tell agents in *this* repo to keep
using `phn-local` for local dev work.

## Done when

Fresh `claude` session in a marker-stamped folder on a machine with the
plugin: `/bldgtyp:phn-status` answers from production with no per-session
setup. The local equivalent is verified here; the production run remains the
explicit Phase-06 acceptance gate after deployment.

## Completion evidence

- Public repo: `https://github.com/bldgtyp/claude-plugins`, initial commit
  `823148f`; GitHub Actions run `30709427461` passed.
- `make check` — generated outputs current, public-hygiene scan clean, 19
  tests passed, vendored MCP-contract drift check passed.
- `claude plugin validate . --strict` — passed against Claude Code 2.1.220.
- PH-Navigator `make ci` — 1,766 backend tests passed (7 skipped), 2,371
  frontend tests passed, and the production build completed.
- Direct local bridge smoke negotiated MCP `2025-06-18`, listed all 61 tools,
  and found `list_projects` through the `/mcp` → `/mcp/` redirect.
- Headless Claude with the sideloaded plugin called
  `mcp__plugin_bldgtyp_phn__list_projects` and returned the isolated local
  agent-browser fixture; the temporary user token was then revoked.
- Three-lens simplify review closed connection reuse, bounded concurrency,
  indeterminate-POST replay, negotiated-version, worker-error, config reuse,
  generation drift, and HTTPS findings. Final quality/efficiency review had no
  remaining findings; Dropbox instruction copies match generated templates.
- PH-Navigator production deployment and Linde reads/writes were deliberately
  not run; those remain Phase 06.
