---
DATE: 2026-05-24
TIME: ADR
STATUS: Accepted. Canonical sheet for the structured error envelope
        emitted by Phase 2 custom-field schema-mutation endpoints
        (REST + MCP). Subsequent sub-phases (P2.1–P2.8) reference
        this table when raising `api_error` / `raise_mcp_error` so
        the wire codes, HTTP statuses, recoverability values, and
        the user-facing message templates the field editor renders
        all stay in one place.
PARENT-PLAN: docs/plans/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
RELATED:
  - context/technical-requirements/llm-mcp-schema.md §10.3
    (custom-field MCP rules + structured error code list)
  - context/technical-requirements/data-table.md "Write Pipeline"
    (rollback rule on backend validation failure)
  - context/technical-requirements/save-versioning.md §8.3
    (immediate draft validation — malformed mutations never reach
     the persisted draft)
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md §3 D5/D15/D16,
    §4.7 (MCP error envelope), §7 R6 (MCP token blast radius)
---

# ADR — Phase 2 custom-field structured error taxonomy

## Context

Plan-13 §3 D15 / §4.3.2 settled that every custom-field schema
mutation rides one typed `FieldSchemaMutation` DTO through one
validation path; plan-13 §3 D16 / save-versioning.md §8.3 settled
that validation is **immediate** (the draft never accumulates
malformed custom-field state). llm-mcp-schema.md §10.3 enumerated
the seven custom-field-specific error codes Phase 2 must return.

This ADR fixes — once — the wire-level contract every subsequent
Phase 2 PR (P2.1 service, P2.2 REST, P2.3 MCP, P2.5–P2.7 editor UI)
will honor:

- the `error_code` string,
- its HTTP status (REST) and `recoverability` value (MCP),
- the small `details` keys the editor / MCP client reads to render
  inline guidance or to drive an automatic retry,
- the user-facing message template the field editor renders inline.

Keeping the table here means later PRs can quote a row instead of
re-deriving the contract every time, and the security checkpoint at
the end of P2.3 has one canonical place to audit.

## Decision

Phase 2 emits exactly the following codes from the schema-mutation
service. Codes already in use elsewhere (`version_locked`,
`draft_etag_mismatch`, `version_etag_mismatch`) are **reused** as-is
on the schema-mutation paths; do not introduce parallel
custom-field-specific variants for the same condition.

| Code | HTTP | MCP `recoverability` | Phase introduced | `details` keys | User-facing template (field editor) |
|---|---|---|---|---|---|
| `custom_field_duplicate_name` | 422 | `fatal` | P2.1 | `field_name`, `colliding_field_id`, `colliding_field_origin` (`"core"` / `"custom"`) | "Field name '{field_name}' already exists in this table ({colliding_field_origin} field). Pick a different name." |
| `custom_field_stale_schema_fingerprint` | 409 | `refresh` | P2.1 | `expected_fingerprint`, `actual_fingerprint` | "Someone else added or changed a field on this table. Refresh and try again." |
| `custom_field_invalid_field_id` | 422 | `fatal` | P2.1 | `field_id`, `table_key` | "That custom field no longer exists in this table. Refresh to see the current fields." |
| `custom_field_unsupported_table` | 422 | `fatal` | P2.1 | `table_key` | "This table does not support custom fields." |
| `custom_field_unsupported_mutation` | 422 | `fatal` | P2.1 | `kind`, `available_in_phase` | "{kind} for custom fields is not available yet (planned for {available_in_phase})." |
| `custom_field_schema_write_unauthorized` | 403 | `fatal` | P2.2 / P2.3 | `required_scope` | "You don't have permission to change this table's fields." |
| `custom_field_illegal_type_conversion` | 422 | `fatal` | **Reserved (Phase 3)** — Phase 2 does not raise it | `field_id`, `from_type`, `to_type` | (Phase 3 will own this copy) |
| `custom_field_formula_parse_error` | 422 | `fatal` | **Reserved (Phase 4)** — Phase 2 does not raise it | `field_id`, `parse_error`, `offset` | (Phase 4 will own this copy) |
| `custom_field_formula_cycle` | 422 | `fatal` | **Reserved (Phase 4)** — Phase 2 does not raise it | `field_id`, `cycle_path` | (Phase 4 will own this copy) |
| `version_locked` (reused) | 409 | `refresh` | existing | `version_id` | "This version is locked. Save As to start an editable copy and try again." |
| `draft_etag_mismatch` (reused) | 409 | `refresh` | existing | `expected_etag`, `actual_etag` | "Your draft is out of date. Refresh and try again." |
| `version_etag_mismatch` (reused) | 409 | `refresh` | existing | `expected_etag`, `actual_etag` | "This version was updated since you loaded it. Refresh and try again." |

Rules:

- **`recoverability` value taxonomy.** Per
  llm-mcp-schema.md §10.3 the common envelope uses a coarse
  `recoverability` field. Phase 2 uses only two values:
  - `"refresh"` — the caller should refetch the table envelope (and
    its fingerprint) and retry the same gesture. The field editor
    surfaces a retry affordance.
  - `"fatal"` — the caller (or its agent) needs human intervention;
    a blind retry will fail the same way.
- **`details` is a small typed dict.** Phase 2 never leaks the
  document body, full diff snapshots, or any other sensitive
  content into the envelope. The keys above are the entire allowed
  surface for these codes; new keys require an ADR amendment.
- **One translation point.** REST raises through
  `features/shared/errors.py::api_error(...)`; MCP raises through
  `raise_mcp_error(...)` (via
  `raise_http_exception_as_mcp_error`). Neither path repeats the
  message template — the editor / MCP client owns rendering. The
  template column above is the **default** the editor uses when no
  more-specific inline message exists.
- **Editor rollback behavior.** Per data-table.md "Write Pipeline",
  any rejection rolls the table back to the last server-
  acknowledged snapshot and clears undo. The editor then surfaces
  the message from this table in the popover / dialog that triggered
  the mutation; the table itself does not show a generic toast for
  these failures (the popover has more context).
- **Audit log.** Every accepted mutation appends a per-kind row to
  the action log (P2.2 / P2.3); rejections do **not** audit-log
  (consistent with the rest of the draft-write pipeline) — the
  request_id in the error envelope is the trace point.

## Consequences

- Subsequent Phase 2 PRs reference this table verbatim and do not
  re-define the contract. If a PR needs a new code or a new
  `details` key, this ADR is amended in the same PR (no silent
  expansion).
- The Phase 3 / 4 "Reserved" rows are placeholders so the wire
  contract is closed from day one and MCP clients can ship error
  handling that already knows about the deferred codes.
- The reused codes (`version_locked`, `draft_etag_mismatch`,
  `version_etag_mismatch`) keep their existing semantics on the
  schema-mutation paths. No "custom-field" variant is introduced
  for the same condition.

## Security checkpoint

P2.3 appends a one-paragraph note here after the security review
(plan-13 R6 / plan-15 §Phase 2.3 "Security review checkpoint"),
confirming:

- no MCP tool path skips `require_token_scope("project:write")`,
- cross-project schema mutations raise
  `mcp_project_scope_mismatch`,
- no envelope leaks body snapshots or diff content beyond the
  `details` keys above.

### Review notes — 2026-05-24 (P2.3 ship)

Reviewed `backend/features/mcp/server.py` (the five new
`*_custom_field` tools) and `_apply_mcp_schema_mutation_with_audit`
helper:

- **Scope gate.** Every tool calls `project_access_or_error(token,
  parsed_project_id, "project:write", ctx)` before touching the
  draft pipeline. `project_access_for_token` raises
  `PermissionError("mcp_scope_insufficient")` when the token
  scopes don't include `project:write` and
  `PermissionError("mcp_project_scope_mismatch")` when the token's
  `project_id` does not match the requested one; both are
  translated to structured MCP errors with `recoverability:
  forbidden`. Verified in
  `test_mcp_custom_field_tools_full_surface` (viewer-token
  rejection assertion).
- **Cross-project boundary.** `project_access_for_token` enforces
  the per-token project boundary inside the helper —
  cross-project requests can't reach `apply_schema_mutation_to_draft`.
- **Envelope payload.** `_apply_mcp_schema_mutation_with_audit`
  passes the `HTTPException.detail` straight through
  `raise_http_exception_as_mcp_error`, which only forwards
  `error_code` / `message` / `details`. The Phase 2 service
  raises only the `details` keys catalogued above — no body /
  diff snapshots. `_custom_field_response` reads the returned
  envelope's `custom_fields` list and emits a single
  `CustomFieldDef.model_dump(mode="json")` per the
  llm-mcp-schema.md §10.3 contract; no row data leaks.
- **Edit-lease channel.** MCP writes set `updated_via='mcp'` on
  the draft row and the audit log, so a browser draft-summary
  surface can react. The richer lease semantics (lease_id,
  expiration window, browser indicator UI) are deferred to a
  follow-up plan — documented in plan-15's P2.3 progress entry.

No blocking findings.
