# MCP Write-Loop — Status

DATE: 2026-06-30
TIME: 18:00 EDT
STATUS: Complete / archived — Phases 1–4 implemented and verified on `codex/mcp-write-loop`.
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

**Phase 2 is implemented on the same branch:**

- MCP `replace_table` now wraps the existing `replace_table_slice` service for
  every registered table; there is no MCP-side semantic-table rejection.
- MCP `preview_replace_table` wraps `preview_table_replace` and returns the same
  dependent-link cascade dry-run as REST.
- `replace_table` accepts full browser PUT payloads, `get_table(...).rows`
  envelopes, or bare row arrays where current side payload is sufficient.
- `context/mcp.md` now documents the whole-table replace contract, etag
  handshake, read-before-replace rule, payload shapes, and command-vs-replace
  guidance.

**Phase 3 is implemented on the same branch:**

- MCP `save_draft_as` wraps the existing Save As service and is the
  locked-version escape hatch.
- MCP `update_project` wraps the shipped `patch_version` REST parity surface:
  `locked` and `make_active`. Historical rename/name language remains a Phase 4
  docs reconciliation item because the backend does not accept a name field here.
- MCP `diff_versions` wraps `get_project_diff` for version-vs-version and
  version-vs-draft table deltas.
- `context/mcp.md` documents the Phase 3 tools, scopes, save-as lifecycle role,
  and `update_project` field limitation.

**Phase 4 is implemented and verified on the same branch:**

- `context/mcp.md` is the canonical live MCP contract and includes a
  CI-guarded registered tool inventory.
- `tests/test_mcp.py` compares the actual MCP `list_tools()` result to the
  `context/mcp.md` inventory, so undocumented tool drift fails CI.
- `llm-mcp-schema.md` is demoted to historical planning intent for its original
  tool list and no longer lists `update_document` / JSON-Patch writes.
- `save-versioning.md` now describes typed service writes and whole-table
  `replace_table_slice` instead of stale JSON-Patch draft sync.
- `build_mcp_server(instructions=...)` and `scripts/smoke_mcp_read.py` now
  describe/enforce the full live tool surface; the smoke has an opt-in write
  round trip.

## Next step

None. Feature packet archived after Phase 4 verification.

## Phase map

| Phase | Title | Priority | Lands |
|---|---|---|---|
| 1 | Draft commit/discard | P0 | **Implemented on branch** — `save_draft`, `discard_draft`; `context/mcp.md` skeleton; CLAUDE.md MCP row |
| 2 | Generic table writes | P0 | **Implemented on branch** — `replace_table` wraps `replace_table_slice`; `preview_replace_table`; no MCP-side rejection |
| 3 | Lifecycle & read parity | P1 | **Implemented on branch** — `save_draft_as`, `update_project` (`locked`/`make_active`), `diff_versions` |
| 4 | Docs truth + discoverability | P1 | **Implemented on branch** — canonical `context/mcp.md`; tool-set drift guard; smoke hardening; stale contract reconciliation; `instructions=` polish |

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

## Verification

- Phase 1 focused checks passed:
  - `cd backend && uv run ruff check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/drafts.py tests/test_mcp.py`
  - `cd backend && uv run ty check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/drafts.py tests/test_mcp.py`
  - `cd backend && uv run pytest tests/test_mcp.py` — 14 passed.
- Phase 1 closeout gate passed:
  - `make format`
  - `make ci` — backend 1241 passed / 2 skipped; frontend 215 test files / 1985
    tests passed; production build completed.
- Phase 2 focused checks passed:
  - `cd backend && uv run ruff check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py`
  - `cd backend && uv run ty check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py`
  - `cd backend && uv run pytest tests/test_mcp.py` — 22 passed.
- Phase 2 closeout gate passed:
  - `make format`
  - `make ci` — backend 1249 passed / 2 skipped; frontend 215 test files / 1985
    tests passed; production build completed.
- Phase 3 focused checks passed:
  - `cd backend && uv run ruff check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/versions.py tests/test_mcp.py`
  - `cd backend && uv run ty check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/versions.py tests/test_mcp.py`
  - `cd backend && uv run pytest tests/test_mcp.py` — 27 passed.
- Phase 3 closeout gate passed:
  - `make format`
  - `make ci` — backend 1254 passed / 2 skipped; frontend 215 test files / 1985
    tests passed; production build completed.
- Phase 4 focused checks passed:
  - `cd backend && uv run ruff check features/mcp/server.py tests/test_mcp.py scripts/smoke_mcp_read.py`
  - `cd backend && uv run ty check features/mcp/server.py tests/test_mcp.py scripts/smoke_mcp_read.py`
  - `cd backend && uv run pytest tests/test_mcp.py` — 27 passed.
  - `cd backend && uv run python -m py_compile scripts/smoke_mcp_read.py`
- Phase 4 closeout gate passed:
  - `make format`
  - `make ci` — backend 1254 passed / 2 skipped; frontend 215 test files / 1985
    tests passed; production build completed.
- `make ci` green at each phase closeout.
- Optional isolated browser/MCP smoke per `planning/features/.instructions.md`
  ("Isolated Smoke When The Dev Stack Is Busy") — do not take over Ed's ports.
