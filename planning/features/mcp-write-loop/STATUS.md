# MCP Write-Loop — Status

DATE: 2026-06-30
TIME: 17:12 EDT
STATUS: Active — Phase 1 implemented on `codex/mcp-write-loop`; Phase 2 next.
AUTHOR: Claude (Opus 4.8) with Ed May; updated by Codex

## Current state

Decisions accepted (PRD §3). **Phase 1 is implemented on branch
`codex/mcp-write-loop`:**

- MCP tools `save_draft` and `discard_draft` are registered and wrap the existing
  project-document draft services.
- `save_draft` re-resolves the MCP token at commit time and writes
  `updated_via="mcp"` into the `project_version_save` audit details.
- `discard_draft` is a clean no-op when no draft exists (`discarded=false`).
- `context/mcp.md` now exists as the live MCP contract skeleton, and `CLAUDE.md`
  routes MCP tool work to it.

The MCP `replace_table` tool is still the always-rejecting
`mcp_write_deferred` stub. `llm-mcp-schema.md` and `save-versioning.md` still
carry stale JSON-Patch contract language; Phase 4 owns that reconciliation.

## Next step

Start **Phase 2 — generic table writes** (`phases/phase-02-replace-table.md`):
wire `replace_table` to `replace_table_slice`, add `preview_replace_table`, and
update `context/mcp.md` with read-before-replace + etag guidance.

## Phase map

| Phase | Title | Priority | Lands |
|---|---|---|---|
| 1 | Draft commit/discard | P0 | **Implemented on branch** — `save_draft`, `discard_draft`; `context/mcp.md` skeleton; CLAUDE.md MCP row |
| 2 | Generic table writes | P0 | `replace_table` (wire stub), `preview_replace_table`, table allow-list |
| 3 | Lifecycle & read parity | P1 | `save_draft_as`/`create_version`, `update_project`, `diff_versions` |
| 4 | Docs truth + discoverability | P1 | reconcile `llm-mcp-schema.md` + `save-versioning.md`; tool-set drift guard; smoke hardening; `instructions=` polish |

Phases 1 and 2 are the functional write loop; 3 rounds out parity; 4 is the
cross-cutting doc/discoverability hardening (but per the standing requirement,
each of 1–3 also updates `context/mcp.md` in its own PR — Phase 4 finalizes the
contracts that span tools).

## Blockers / open questions

Both prior open questions were investigated 2026-06-30 and **resolved** (code
evidence in PRD §2 and §5). No open blockers remain for Phases 1–2.

- **RESOLVED — `replace_table` allow-list:** there is none. `replace_table_slice`
  accepts all 17 tables; the per-table `replace_request_model` (`extra="forbid"`)
  + `validate_document` is the guard. The browser itself PUTs `/draft/tables/
  apertures`. → MCP `replace_table` mirrors the browser PUT for **all** tables;
  **do not** add a reject/redirect (it would break parity). Phase 2 corrected.
- **RESOLVED — MCP edit-lease (§8.5):** unbuilt (comments only; no lease table;
  `ProjectDraftSummary` doesn't expose `updated_via`; frontend has no indicator).
  Not a blocker — the shared `draft_etag` already prevents lost writes. Full lease
  + the lighter "passive reload hint" are **out of scope** for this feature;
  revisit on a real collision report.

## Verification (planned)

- Phase 1 focused checks passed:
  - `cd backend && uv run ruff check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/drafts.py tests/test_mcp.py`
  - `cd backend && uv run ty check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/drafts.py tests/test_mcp.py`
  - `cd backend && uv run pytest tests/test_mcp.py` — 14 passed.
- Phase 1 closeout gate passed:
  - `make format`
  - `make ci` — backend 1241 passed / 2 skipped; frontend 215 test files / 1985
    tests passed; production build completed.
- New backend tests per remaining phase (round-trip read→replace→save; stale
  replace etag; locked replace; validation failures; preview cascade).
- `make ci` green at each phase closeout.
- `context/mcp.md` drift guard test (Phase 4).
- Optional isolated browser/MCP smoke per `planning/features/.instructions.md`
  ("Isolated Smoke When The Dev Stack Is Busy") — do not take over Ed's ports.
