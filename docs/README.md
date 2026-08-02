# `docs/` - Stable Supporting Docs (non-canonical)

`docs/` is no longer the working-planning surface. Keep this folder for
stable supporting documents that are useful but are not canonical
contracts.

**Litmus test:** if a doc states a contract that other docs/agents treat
as ground truth (product behavior, architecture, data model, UI intent,
coding standards), it belongs in `context/`. If it's an operational
how-to/setup guide, or a running log/changelog that doesn't itself
define a contract, it belongs here in `docs/`.

- `MCP_AGENT_SETUP.md` - when to use repo-local `phn-local` versus installed
  production `phn`, plus Claude plugin, Codex installer, device login, project
  marker, and safe draft-operation guidance.
- `SCHEMA_VERSIONS.md` - running log of `ProjectDocumentV1` schema bumps.

Stable product, architecture, UI, stack, table, and glossary reference
docs live in `context/`. Tracked feature planning, implementation
phasing, progress ledgers, reviews, and archives live in `planning/`.
Local scratch lives in gitignored `working/`.
