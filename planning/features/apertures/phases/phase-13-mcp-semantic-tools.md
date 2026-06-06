---
DATE: 2026-06-05
TIME: 17:20 EDT
STATUS: Done — shipped Phase 13 with the deviations noted in STATUS.md
AUTHOR: Codex
SCOPE: Surface the Apertures-feature semantic MCP tools:
       `list_aperture_types`, `get_aperture_type`,
       `report_aperture_catalog_drift`,
       `calculate_aperture_u_values`, and
       `apply_aperture_command`. Wrap the existing
       `ApertureCommand` seam (Phase 01) rather than introducing
       a parallel mutation path. Honor the same draft / etag /
       locked-version / viewer policy as browser writes.
RELATED:
  - planning/features/apertures/PRD.md §16, §22, §21 decisions
    1, 4
  - planning/features/apertures/PLAN.md (Phase 13 row, parallel
    after Phase 01)
  - context/technical-requirements/llm-mcp-schema.md
  - phase-01 (delivers the ApertureCommand seam this phase
    wraps)
  - phase-09 (delivers the U-Value service this phase reads)
  - phase-10 (delivers the export read tool; this phase only
    augments)
  - phase-12 (delivers the drift detector this phase reads)
---

# Phase 13 — Semantic MCP write tools

## P0. Why this slice

Phase 13 brings the Apertures feature into the LLM-driven
workflow. An MCP client can list aperture types, fetch one,
calculate U-Values, report drift, and apply a single semantic
command — all through the same draft buffer / ETag / audit /
edit-lease infrastructure that browsers use.

This phase is intentionally last because every shipped Apertures
behavior should be reachable from the browser first; the MCP
layer wraps proven primitives instead of inventing parallel ones.

By the end of Phase 13:

- Five MCP tools live in
  `backend/features/apertures_mcp/`. Each is a thin wrapper
  over a service or command-dispatcher call.
- Every mutating call (`apply_aperture_command`) honors the
  same ETag preflight and the same edit-lease policy as
  browser writes.
- Every tool emits the same structured error envelope as the
  REST API.
- The audit log carries an `mcp_actor_id` field whenever a
  command originates from the MCP surface.
- `context/technical-requirements/llm-mcp-schema.md` is
  updated with the five tool signatures.

Phase 13 does **not** ship: new browser UI, new aperture
commands, new catalog filters, or any new validation rules.
This phase is wiring.

## P1. Acceptance — Phase 13 done when

1. `backend/features/apertures_mcp/` ships:
   - `tools.py` — five registered tools:
     - `list_aperture_types(project_id, version_id, source?)`
       → `[{ id, name, element_count }, ...]`.
     - `get_aperture_type(project_id, version_id,
       aperture_type_id, source?)` → full
       `ApertureTypeEntry`.
     - `report_aperture_catalog_drift(project_id, version_id,
       source?)` → drift report (wraps Phase 12 service).
     - `calculate_aperture_u_values(project_id, version_id,
       aperture_type_ids?, source?)` → U-Value results (wraps
       Phase 09 service). If `aperture_type_ids` is null,
       returns all.
     - `apply_aperture_command(project_id, version_id,
       command, if_match?, if_match_version?)` → returns
       `{ next_etag, audit }`. Wraps the Phase 01 dispatcher.
   - `schemas.py` — input / output Pydantic schemas for each
     tool, lifted directly from existing models.
   - `auth.py` — MCP token / project scope / editor-lease
     enforcement.
   - `__tests__/` — per-tool happy path + per-tool error
     surface tests.
2. **`apply_aperture_command`** behavior:
   - Validates the `command` payload against
     `ApertureCommand` (the same union the browser uses).
   - Enforces `if_match` against the current draft ETag.
     Mismatch → 412.
   - Enforces `if_match_version` against the saved version
     ETag for `Save`-style commands. Mismatch → 412.
   - On locked versions: writes rejected (423) unless the
     command targets a `Save As` flow (out of scope for v1 —
     reject all writes on locked versions).
   - On Viewer access: 403.
   - Audit log entry includes `actor_id`, `mcp_token_id`,
     `mcp_actor_id` (the human or LLM identity the token is
     bound to), `command.kind`, full audit envelope from the
     dispatcher.
3. **Tool schemas** follow the convention in
   `context/technical-requirements/llm-mcp-schema.md`:
   - SI canonical in all requests / responses.
   - Stable ids for every target.
   - Structured error envelope identical to REST.
   - Edit-lease policy: an MCP-driven mutation acquires a
     lease before the dispatcher runs; the lease holder name
     is `f"mcp:{token_id}"`. Browser writes acquire
     `f"browser:{user_id}"`. Other browsers see the lease
     name on conflict toasts.
4. **MCP registration**: each tool is registered with the
   MCP server through the existing registration pattern
   (matches the Phase 10 read tool's registration). Schemas
   are exposed via the standard MCP introspection surface.
5. **Documentation update**:
   - `context/technical-requirements/llm-mcp-schema.md` adds
     a section per tool with the signature, error codes, and
     example usage.
   - `planning/features/apertures/STATUS.md` records the
     `Complete` status with verification evidence.
6. `make ci` is green.

## P2. Files

### New (backend)

- `backend/features/apertures_mcp/__init__.py`
- `backend/features/apertures_mcp/tools.py`
- `backend/features/apertures_mcp/schemas.py`
- `backend/features/apertures_mcp/auth.py`
- `backend/features/apertures_mcp/__tests__/test_list_aperture_types.py`
- `backend/features/apertures_mcp/__tests__/test_get_aperture_type.py`
- `backend/features/apertures_mcp/__tests__/test_calculate_aperture_u_values.py`
- `backend/features/apertures_mcp/__tests__/test_report_aperture_catalog_drift.py`
- `backend/features/apertures_mcp/__tests__/test_apply_aperture_command.py`

### Modified

- `backend/main.py` — register the new tools.
- `context/technical-requirements/llm-mcp-schema.md` — add a
  section per tool.
- `backend/features/project_document/audit.py` — extend the
  audit envelope to carry `mcp_actor_id` when set.
- `backend/features/project_document/aperture_commands/dispatcher.py`
  - Accept an optional `mcp_actor_id` parameter that propagates
    into the audit envelope.

### Deleted

None.

## P3. Tool sketches

```python
# backend/features/apertures_mcp/tools.py — sketch

@mcp_tool(
    name="apply_aperture_command",
    description=(
        "Apply one semantic aperture command (createApertureType, "
        "pickFrame, editDimension, mergeElements, ...). Writes go "
        "through the draft buffer; explicit Save / Save As must be "
        "performed via the project-document tool surface."
    ),
)
async def apply_aperture_command(
    project_id: UUID,
    version_id: UUID,
    command: ApertureCommand,
    if_match: str | None = None,
    if_match_version: str | None = None,
    ctx: MCPContext = ...,
) -> ApplyApertureCommandResponse:
    auth.require_editor(ctx, project_id)
    auth.acquire_edit_lease(ctx, project_id, holder=f"mcp:{ctx.token_id}")
    body, audit = apply_aperture_command_dispatcher(
        body=load_draft_body(project_id, version_id, if_match),
        command=command,
        actor_user_id=ctx.actor_id,
        catalog=catalog_reader(),
        mcp_actor_id=ctx.mcp_actor_id,
    )
    next_etag = store_draft_body(project_id, version_id, body)
    return ApplyApertureCommandResponse(next_etag=next_etag, audit=audit)
```

```python
# backend/features/apertures_mcp/schemas.py — sketch

class ApplyApertureCommandResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    next_etag: str
    audit: dict[str, object]


class CalculateApertureUValuesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: UUID
    version_id: UUID
    aperture_type_ids: list[str] | None = None
    source: ProjectDocumentSource = "draft"


class ApertureUValueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    apertures: list[ApertureUValueResult]
```

## P4. Sequence

1. **Commit 1 — Schemas + auth.** Lift Pydantic models, wire
   the auth helper.
2. **Commit 2 — Read tools (list / get / drift / u-values).**
3. **Commit 3 — `apply_aperture_command` write tool.** Wire
   ETag preflight, edit-lease, audit propagation.
4. **Commit 4 — Documentation.** Extend
   `llm-mcp-schema.md`.
5. **Commit 5 — `STATUS.md` advancement + closeout.**

## P5. Tests

### Per-tool

- `list_aperture_types` returns the expected ids + element
  counts.
- `get_aperture_type` returns the full entry; unknown id →
  404.
- `report_aperture_catalog_drift` matches the Phase 12
  detector output.
- `calculate_aperture_u_values` matches the Phase 09 service
  output for each requested id.
- `apply_aperture_command` happy paths for one command per
  category (sidebar, element, dimension, pick, merge, paste,
  manufacturer-filters, refresh).
- ETag mismatch → 412.
- Locked version → 423.
- Viewer → 403.
- Audit log carries `mcp_actor_id` for every MCP-driven
  command.

### Integration

- A round-trip scripted from an MCP client mock: list
  apertures, get one, apply a `pickFrame`, recalculate
  U-Values, verify the change reflected. Validates the same
  draft buffer browsers see.

### Browser

- No new browser surface; existing flows must continue to
  work end-to-end with the lease policy in place. Browser
  conflict toast names `mcp:<token>` when applicable.

## P6. Out of scope (lands in later work)

- MCP-driven Save / Save As. v1 requires a browser to commit;
  v2 may add an explicit MCP tool once the locked-version /
  Save As policy stabilizes.
- Bulk MCP commands. v1 enforces one command per call.
- MCP write tools for catalogs / manufacturer filters
  outside the aperture command surface — they live in their
  own MCP features.
- Read-safe drift status for viewers — needs a non-editor
  endpoint first (Phase 12 noted this).

## P7. Risks

- **R-13-1. Edit-lease conflicts between browser and MCP.**
  Mitigation: explicit holder names (`browser:` vs `mcp:`) on
  every lease; conflict messages name the other holder so
  the user knows whether the LLM or another tab holds the
  edit.
- **R-13-2. MCP token-scope creep.** Mitigation: every
  Apertures tool checks editor capability per project; tokens
  scoped narrower than editor cannot mutate.
- **R-13-3. Validation drift between browser and MCP write
  paths.** Mitigation: both wrap the same
  `apply_aperture_command_dispatcher`; no parallel validation
  logic. New rules added in later work touch the dispatcher
  once.
- **R-13-4. Audit envelope grows.** Mitigation: the
  `mcp_actor_id` field is optional; browser writes leave it
  null. Existing audit consumers ignore unknown keys.
- **R-13-5. The MCP feature is wiring; the failure mode is
  surface-area gaps.** Mitigation: tool-by-tool tests above
  cover every surface explicitly. Documentation update is
  part of the phase, not a follow-up.
