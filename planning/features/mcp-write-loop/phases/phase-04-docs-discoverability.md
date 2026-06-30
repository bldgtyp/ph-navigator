# Phase 4 — Docs truth + discoverability hardening

DATE: 2026-06-30
STATUS: Proposed. P1. The cross-tool contract reconciliation + the guard that
        keeps the docs honest going forward. Do this once the tool surface from
        Phases 1–3 has settled (so the reconciled docs describe the final shape).

GOAL: The MCP surface drifted from its spec because tools shipped without doc
      updates. Land the canonical doc, reconcile the stale contracts, and add a
      guard so it can't rot again.

## Build / edit

1. **Finalize `context/mcp.md`** (started in Phase 1). It is the canonical live
   reference: full tool inventory grouped by area, the scope matrix, the
   draft→save lifecycle, the structured-error envelope + recoverability, the
   `ToolError`-JSON-in-message caveat, transport/stdio, and a token-issuance
   pointer. This is the doc the new CLAUDE.md row points at.

2. **Tool-set drift guard (the anti-rot mechanism).** Add a test that the set of
   registered `@mcp.tool()` names equals a single source-of-truth list (and that
   `context/mcp.md` documents exactly that set). Options: assert the registered
   names against a constant the doc is generated from, or parse the inventory
   table. The point: adding a tool without documenting it must fail CI. Mirror
   the existing `smoke_mcp_read.py` "required tools" idea but make it exhaustive
   and enforced in the test suite, not just the smoke.

3. **Reconcile `llm-mcp-schema.md`:**
   - Remove `update_document` and all JSON-Patch write language (dead — see
     PRD §2/§3).
   - Demote the §10.3 "Tool surface (initial)" block to "original intent — the
     live, authoritative inventory is `context/mcp.md`."
   - Keep `query_table` only as a **read** backlog note (not a write).
   - State that `replace_table` (whole-table replace) is the live generic write,
     wrapping the same `replace_table_slice` service as the browser PUT.

4. **Fix `save-versioning.md` §8.2/§8.3:** replace the stale "JSON-Patch ops sync
   to the draft buffer" / `unguarded_array_patch` language with the actual
   whole-table-replace mechanism (`PUT /draft/tables/{name}` →
   `replace_table_slice`, draft-etag guarded). §8.5 already describes this
   correctly — make §8.2/§8.3 consistent with it. Note the MCP `replace_table` /
   `save_draft` / `discard_draft` tools as the MCP counterparts.

5. **Server `instructions=` string** in `build_mcp_server`: expand beyond
   "Project-scoped PH-Navigator tools…" to an agent-actionable summary — writes
   land in a draft and must be `save_draft`'d; read-then-write-then-save; the
   semantic vs. flat-table write split; scopes. This is in-band discoverability
   (the MCP client surfaces it).

6. **Harden `smoke_mcp_read.py`:** assert the full registered tool set is present
   (catch silent drops, not just the 11-name subset). Add a minimal **write
   round-trip smoke** (read flat table → replace → save → verify → optionally
   discard) gated behind a write-capable token, now that Phases 1–2 exist.

## Done when

`context/mcp.md` is canonical and drift-guarded; `llm-mcp-schema.md` and
`save-versioning.md` no longer describe JSON-Patch writes; CLAUDE.md routes MCP
work (row added in Phase 1, verified here); the server `instructions=` and smoke
reflect the real surface; `make ci` green.

## Note for closeout

Per `planning/.instructions.md` rule #4, fold these accepted decisions into
`context/` in this same pass and update the source review
(`planning/code-reviews/2026-06-30/mcp-review.md`) status pointer to reference
this feature folder. When the feature completes, archive per the feature
contract and leave one line in `planning/archive/README.md`.
