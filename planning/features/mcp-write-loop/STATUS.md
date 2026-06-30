# MCP Write-Loop — Status

DATE: 2026-06-30
TIME: 14:40 EDT
STATUS: Proposed / not started. Planning packet written; no code changed.
AUTHOR: Claude (Opus 4.8) with Ed May

## Current state

Decisions accepted (PRD §3). Nothing implemented. The MCP `replace_table` tool
is still the always-rejecting `mcp_write_deferred` stub; there are no
`save_draft` / `discard_draft` MCP tools; `context/mcp.md` does not exist;
`llm-mcp-schema.md` and `save-versioning.md` still carry the stale JSON-Patch
contract.

## Next step

Start **Phase 1 — draft commit/discard** (`phases/phase-01-draft-commit.md`):
smallest unlock, makes the already-working semantic/custom-field writes
persistable. Create the `context/mcp.md` skeleton + CLAUDE.md MCP row in the
same PR.

## Phase map

| Phase | Title | Priority | Lands |
|---|---|---|---|
| 1 | Draft commit/discard | P0 | `save_draft`, `discard_draft`; `context/mcp.md` skeleton; CLAUDE.md MCP row |
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

- New backend tests per phase (round-trip read→replace→save; discard; locked
  version; revoked-token-on-commit; semantic-table rejection).
- `make ci` green at each phase closeout.
- `context/mcp.md` drift guard test (Phase 4).
- Optional isolated browser/MCP smoke per `planning/features/.instructions.md`
  ("Isolated Smoke When The Dev Stack Is Busy") — do not take over Ed's ports.
