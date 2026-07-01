# `docs/` - Stable Supporting Docs (non-canonical)

`docs/` is no longer the working-planning surface. Keep this folder for
stable supporting documents that are useful but are not canonical
contracts.

**Litmus test:** if a doc states a contract that other docs/agents treat
as ground truth (product behavior, architecture, data model, UI intent,
coding standards), it belongs in `context/`. If it's an operational
how-to/setup guide, or a running log/changelog that doesn't itself
define a contract, it belongs here in `docs/`.

- `MCP_AGENT_SETUP.md` - local/production PH-Navigator MCP setup for
  Codex and Claude agents, including token issuance and client config
  snippets.
- `SCHEMA_VERSIONS.md` - running log of `ProjectDocumentV1` schema bumps.

Stable product, architecture, UI, stack, table, and glossary reference
docs live in `context/`. Tracked feature planning, implementation
phasing, progress ledgers, reviews, and archives live in `planning/`.
Local scratch lives in gitignored `working/`.
