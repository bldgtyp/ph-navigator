@import "CLAUDE.md"

## Local browser access

Before any localhost UI/browser check, run `make agent-browser-ready`. It starts
or reuses the strict `5173`/`8000` services, verifies PH-Navigator-specific
health markers plus Vite's same-origin `/api` proxy, seeds the `AGENT-BROWSER`
fixture for the current agent task, and prints its login plus sign-in URL.
Fixtures are isolated by `CODEX_THREAD_ID`; set `PHN_AGENT_BROWSER_ID` when a
different agent runtime needs an explicit stable identity. Development client
requests must remain same-origin through that proxy; do not point browser code
directly at `:8000`.
Do not reuse a tab that has shown `ERR_CONNECTION_REFUSED`, another network
error, or an internal `data:` error URL: discard it and open the printed route
in a fresh tab. Use `make agent-browser-check` for a non-mutating readiness
check. Full details and logs are in `context/ENVIRONMENT.md`.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community
structure, and cross-file relationships.

When the user invokes `$graphify`, `/graphify`, or otherwise asks to use
Graphify, load the local Graphify skill before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when
  `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for
  relationships and `graphify explain "<concept>"` for focused concepts.
  These return a scoped subgraph, usually much smaller than
  `GRAPH_REPORT.md` or raw grep output.
- Dirty `graphify-out/` files are expected after hooks or incremental updates;
  dirty graph files are not a reason to skip graphify. Only skip graphify if
  the task is about stale or incorrect graph output, or the user explicitly
  says not to use it.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead
  of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or
  when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current
  (AST-only, no API cost).
