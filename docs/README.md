# `docs/` — feature specs and dated plans

- `features/` — per-feature PRDs and design docs. As V2 features land,
  spec docs that we want LLM agents to keep loading on every session
  should be moved to `context/`. Feature docs that capture history but
  aren't agent-targeted stay here.
- `plans/<YYYY-MM-DD>/…` — dated planning docs. Add `DATE` and `TIME`
  headers at the top of each file (per `CLAUDE.md`).

The initial PRD set was authored under `docs/features/` in V1 and lives
in `context/` for V2 (`architecture-prd.md`, `tech-stack.md`, etc.).
