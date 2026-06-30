# MCP Write-Loop — Planning

Tracked planning packet for **closing the PH-Navigator MCP write loop**: let an
MCP agent not only *edit* a draft (already possible for envelope / apertures /
custom-field schema) but also **write the flat data tables** (`replace_table`)
and **commit or discard** the draft (`save_draft` / `discard_draft`), so an
agent can complete an edit→persist task without a human in the browser.

Read order:

1. `STATUS.md` — current state, next step, blockers, verification.
2. `PRD.md` — why, the write-architecture investigation, the decisions
   (finish `replace_table`, kill `update_document`), scope in/out.
3. The active phase file under `phases/` named in `STATUS.md`.
4. Source review that triggered this work:
   `planning/code-reviews/2026-06-30/mcp-review.md` (§5 = the decision).

Stable contracts this feature touches / must keep honest:

- `context/technical-requirements/llm-mcp-schema.md` — MCP tool contract
  (currently **stale**; reconciled in Phase 4).
- `context/technical-requirements/save-versioning.md` — draft/save model
  (§8.2/§8.3 carry **stale JSON-Patch language**; fixed in Phase 4).
- `context/mcp.md` — **does not exist yet**; created in Phase 1 as the canonical
  live tool inventory and kept current every phase.

## Standing requirement — docs & discoverability as we go

This feature is as much a **docs-truth** effort as a code effort. The MCP
surface already drifted badly from its spec because tools were added without
updating the contract. Every phase here therefore has a **non-optional docs
closeout**: the same PR that adds/edits a tool updates `context/mcp.md` and any
contract it changes. Phase 4 is the dedicated reconciliation + drift-guard so
this can't rot again. Do not mark a phase done with its doc closeout unchecked.
