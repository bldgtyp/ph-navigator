# mcp feature

This feature manages **MCP (Model Context Protocol) project tokens** — issuance,
listing, and revocation. It currently has **no UI surface** of its own: tokens
are surfaced to the user through other features' settings panes, and this
feature provides only the API + TanStack Query hooks.

The empty `routes/` and `components/` directories (with `.gitkeep`) and the
no-op `lib.ts` are kept for **structural consistency** with the canonical
feature shape established by `features/catalogs/` and `features/projects/`
(see `planning/archive/dated/2026-05-25/plan-23-frontend-refactor-phased.md` §Phase 6).
They are placeholders — populate them when MCP grows a dedicated UI.
