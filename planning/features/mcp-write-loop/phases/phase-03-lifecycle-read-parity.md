# Phase 3 — Lifecycle & read parity (round-out)

DATE: 2026-06-30
STATUS: Proposed. P1 — valuable but not required for the core write loop
        (Phases 1–2). Each item is a thin wrapper over an existing REST service.

## Build

1. **`save_draft_as` / `create_version`** — wrap `service.save_draft_as`
   (`POST /draft/save-as`). Args: `project_id, version_id, name, kind?`. This is
   the **locked-version escape hatch** (the recoverability `refresh` answer to a
   `version_locked` save) and the "save as a new version" primitive
   (`create_version` in the old spec). `project:write`.
2. **`update_project`** — wrap `service.patch_version` (`PATCH ""` →
   `ProjectDetail`). Relational metadata edits (name, lock, …) for REST parity.
   `project:write`. Mind the locked-vs-label-only rules in
   `save-versioning.md` §8.2 (rename allowed on locked; lock toggle needs care).
3. **`diff_versions`** — wrap `service.get_project_diff` (`GET /diff`). Read
   tool; the cert-round-diff use case Ed named. `project:read`. *If this bloats
   the feature, move it to the read backlog with `query_table`.*

## Docs closeout (same PR)

- Add all three to `context/mcp.md` with their scopes and the lifecycle role of
  `save_draft_as` (the locked-version path).
- These names appear in the stale `llm-mcp-schema.md` §10.3 list
  (`create_version`, `update_project`, `diff_versions`) — Phase 4 reconciles
  that list; here, just ensure `context/mcp.md` is correct.

## Tests

- `save_draft_as` creates a new version from the draft, clears the source draft,
  sets it active (mirror the existing service tests through the MCP seam);
- `save_draft_as` succeeds against a **locked** source version (the escape path);
- `update_project` rename succeeds on a locked version; disallowed edits rejected;
- `diff_versions` returns the structured per-table delta for two versions.

## Done when

Tools registered, parity tests green, `context/mcp.md` updated, `make ci` green.
