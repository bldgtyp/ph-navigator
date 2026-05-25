---
DATE: 2026-05-24
TIME: planning (detailed implementation phasing)
STATUS: In progress. Phase 2 of plan-13 (custom fields). 4/8 sub-
        phases shipped (P2.0 scaffold + ADR, P2.1 backend mutation
        DTOs + apply service, P2.2 REST endpoint, P2.3 MCP write
        tools). All backend Phase-2 surfaces are now live; the
        frontend slate (P2.4–P2.7) and acceptance pass (P2.8) are
        what remains. Next up: P2.4 — frontend `schemaMutation`
        WriteOp + dispatcher. See **Progress log** at the bottom
        for the latest checkpoint, what's green, and the resume
        pointer.
        Builds on the completed Phase 1 envelope (plan-14): Rooms
        already carries
        `{custom_fields, rows}`, `CustomFieldDef` is closed, the
        `CustomFieldCapability` block on Rooms exposes the accessors
        Phase 2 needs, the frontend `useTableSchema` hook synthesizes
        `FieldDef`s for custom columns, and persisted view state is
        schema-fingerprinted. Phase 2 lights up the **schema-editor
        UX** for the four simple types (`short_text`, `long_text`,
        `number`, `url`): typed `FieldSchemaMutation` DTOs end to end,
        header context menu, add / rename / delete / duplicate /
        describe popovers, the locked/unlocked indicator, MCP schema-
        mutation tools, and the structured-error taxonomy from
        llm-mcp-schema.md §10.3. Eight sub-phases, each one PR that
        leaves `make typecheck`, `make test`, `make lint`, `make smoke`
        green. Single-select and formula custom fields are out of
        scope (Phase 3 / 4).
PARENT-PLAN: docs/plans/2026-05-24/plan-13-custom-fields-overview.md
PARENT-STORY: context/user-stories/32-custom-fields.md
              (US-CF-1, US-CF-2, US-CF-3, US-CF-5, US-CF-6, US-CF-9,
               US-CF-10 write criteria 5 & 6, US-CF-11, US-CF-12,
               US-CF-13, US-CF-14)
RELATED:
  - context/technical-requirements/data-table.md
    (FieldSchemaMutation DTO surface, WriteOp pipeline,
     locked/unlocked indicator, tail "+" cell)
  - context/technical-requirements/data-model.md §6.6
    (custom-field-capable table contract)
  - context/technical-requirements/llm-mcp-schema.md §10.3
    (MCP custom-field schema tools + structured error taxonomy)
  - context/technical-requirements/save-versioning.md §8.3
    (immediate draft validation for schema mutations)
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md §3 D5/D7/D10/D12/D14/D15/D16/D18
  - docs/plans/2026-05-24/plan-14-custom-fields-phase-1-document-shape.md
  - backend/features/project_document/custom_fields.py
    (CustomFieldDef / CustomFieldType / coerce_custom_value)
  - backend/features/project_document/tables/contracts.py
    (CustomFieldCapability — Phase 2 adds apply_schema_mutation +
     validate_schema_mutation)
  - backend/features/project_document/tables/rooms.py
  - backend/features/project_document/drafts.py
    (replace_table_slice — schema mutations slot into the same
     draft-write pipeline)
  - backend/features/mcp/server.py
    (Phase 2 adds five `*_custom_field` tools alongside the existing
     read tools; rejects unauthenticated MCP)
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
    (Phase 2 grows `mutate(op)` API + `CustomFieldDef` write helpers)
  - frontend/src/shared/ui/data-table/components/AddFieldTailCell.tsx
    (Phase 2 wires the click handler — layout already in place)
  - frontend/src/shared/ui/data-table/components/ColumnHeaderMenu.tsx
    (Phase 2 supersedes the existing `Edit options…` menu with the
     full custom-field menu when the field is custom; keeps the
     reduced menu for core fields per US-CF-6)
  - frontend/src/features/equipment/components/RoomsTable.tsx
    (Phase 2 wires the schema-mutation dispatcher and the new
     editor popovers)
BACKWARDS-COMPAT: none required (pre-deployment, CLAUDE.md §16,
                  plan-13 §4.1). `schema_version` stays at 2; Phase 2
                  does not reshape the document. The
                  `WriteOp.fieldDefMutation` shape that already exists
                  for the single-select option editor is **renamed
                  and generalized** to the discriminated
                  `WriteOp.schemaMutation` per data-table.md "Write
                  Pipeline" — single-select option edits become one
                  case among many, and the legacy alias is removed in
                  the same PR (P2.4).
---

# Plan 15 — Phase 2: schema-editor UX + MCP schema tools (Rooms, four simple types)

## Goal

Editors can create, rename, delete, duplicate, and describe custom
fields on the Rooms table from the browser **and** from MCP, for the
four simple Phase 2 types (`short_text`, `long_text`, `number`,
`url`). Every mutation rides a single typed `FieldSchemaMutation`
DTO through one validated backend service path; the header context
menu, the field-editor popover, the locked/unlocked indicator, and
the field-description tooltip ship together. Viewers see custom
fields and descriptions but never the schema-mutation surface.
Single-select and formula custom fields remain on the Phase 3 / 4
roadmap.

Exit criteria from plan-13 §5 phase 2 drive the acceptance tests in
P2.8:

- Rooms can be extended end-to-end through the UI with the four
  simple types, including duplicate + description.
- Viewer mode hides the menu and the `+` tail cell but renders
  descriptions and the locked/unlocked indicator.
- MCP tools `add_custom_field`, `rename_custom_field`,
  `delete_custom_field`, `duplicate_custom_field`, and
  `set_custom_field_description` call the same backend service the
  browser uses, share the same structured error envelope, and
  audit-log the action like every other draft write.
- Duplicate-name enforcement runs on the client and is re-validated
  on the server; rejections roll the table back to the last
  acknowledged snapshot.
- Schema mutations are validated immediately on accept (no malformed
  custom-field state in the draft); stale-fingerprint mutations are
  rejected with a structured error.

## Phase summary

| Phase | Title | Visible change | Risk |
|-------|-------|----------------|------|
| 2.0 | Story promotion + scaffold + ADR | None | Trivial |
| 2.1 | Backend: `FieldSchemaMutation` DTOs + per-mutation apply on `CustomFieldCapability` | None (service-internal) | Medium — pins the typed mutation surface every later phase consumes |
| 2.2 | Backend: REST schema-mutation endpoint + immediate draft validation + structured errors | New endpoint visible; no UI driving it yet | Medium |
| 2.3 | Backend: five MCP `*_custom_field` write tools | MCP token can mutate Rooms schema | Medium — first MCP write tool family (R6) |
| 2.4 | Frontend: rename `fieldDefMutation` → `schemaMutation` WriteOp + dispatcher + `useTableSchema.mutate` | None visible; option editor still works | Medium — touches every existing `fieldDefMutation` callsite |
| 2.5 | Frontend: locked indicator + description tooltip + `<HeaderContextMenu>` skeleton (right-click + Shift+F10) | Lock glyph on every header; right-click on a header opens a menu | Low |
| 2.6 | Frontend: add-field popover + tail "+" cell wire-up | Editors can add `short_text` / `long_text` / `number` / `url` fields | Medium — new popover, new write path |
| 2.7 | Frontend: rename inline + delete confirm + duplicate | Full schema-editor parity for the four simple types | Medium |
| 2.8 | Exit-criteria acceptance tests + Playwright smoke + a11y pass on the editor surfaces | None new — verification only | Low |

Each phase is a PR. Halting between phases leaves Rooms working:
the option editor still uses the (renamed) WriteOp in 2.4, the
header menu in 2.5 ships read-only ops first (sort / hide / etc.
already exist in the toolbar; the menu just exposes them), and the
add / rename / delete / duplicate flows layer on in 2.6 / 2.7.

---

## Phase 2.0 — Story promotion + scaffold + ADR

**Goal.** Zero-behavior preamble. Promote the user-story rows that
go live in Phase 2 from Draft to "Phase 2", record the structured
error taxonomy in one place, and create empty files so subsequent
PRs only touch behavior.

### Tasks

1. **Promote user stories** in `context/user-stories/32-custom-fields.md`
   from Draft → "Phase 2" for: US-CF-1, US-CF-2 (four simple types
   only — leave `single_select` / `formula` rows as Draft notes
   inside the criteria block), US-CF-3, US-CF-5, US-CF-6, US-CF-9,
   US-CF-11, US-CF-12, US-CF-13, US-CF-14. US-CF-10 already shows
   `Phase 2 (write)` for criteria 5 & 6 — leave it as-is.
2. **Promote `data-table.md` "Write Pipeline"** — flip the
   `FieldSchemaMutation` discriminated DTO and the structured
   error codes from forward-looking spec language to active
   requirements. Add a one-line note that the legacy
   `WriteOp.fieldDefMutation` alias used by the single-select
   option editor is renamed to `WriteOp.schemaMutation` in
   plan-15 P2.4 (no shim chain, pre-deploy).
3. **Append a short ADR** at
   `docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md`
   listing the eight error codes from llm-mcp-schema.md §10.3
   (`custom_field_duplicate_name`,
   `custom_field_stale_schema_fingerprint`,
   `custom_field_invalid_field_id`,
   `custom_field_illegal_type_conversion`,
   `custom_field_formula_parse_error`,
   `custom_field_formula_cycle`,
   `custom_field_schema_write_unauthorized`, and the existing
   `version_locked` / `draft_etag_mismatch` reused for schema
   mutations on locked / stale drafts) with their HTTP status,
   `recoverability` value, and the user-facing message template
   the field editor displays. This is the canonical sheet
   subsequent PRs reference.
4. **Backend scaffold** (one-line placeholder so typecheck stays
   green):
   - `backend/features/project_document/schema_mutations.py` —
     will hold the `FieldSchemaMutation` Pydantic union, the
     `apply_schema_mutation` service entry, and the
     `validate_schema_mutation` preflight.
   - `backend/tests/test_project_document_schema_mutations.py` —
     empty pytest module with a single `def test_module_imports()`
     smoke.
5. **Frontend scaffold:**
   - `frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`
     — placeholder default-export with a `// TODO P2.5` body, so
     callers can import without breaking typecheck.
   - `frontend/src/shared/ui/data-table/components/AddFieldPopover.tsx`
     — placeholder for P2.6.
   - `frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx`
     — placeholder for P2.5.
   - `frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`
     — placeholder for the typed `FieldSchemaMutation` builder
     functions (P2.4).

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Diff is doc + empty files only.

---

## Phase 2.1 — Backend: `FieldSchemaMutation` DTOs + per-mutation apply on `CustomFieldCapability`

**Goal.** Land the typed Pydantic mutation union and a single
`apply_schema_mutation` service entry that dispatches on
discriminator and produces `(next_body, audit_payload)`. Extend the
existing `CustomFieldCapability` block on the Rooms contract with
the two Phase 2 hooks (`apply_schema_mutation`,
`validate_schema_mutation`) that the data-model contract gate
already reserves. No REST route yet — service-internal only.
Phase 2 ships five of the seven mutation kinds; `changeType`
(Phase 3) and `setFormula` (Phase 4) get a placeholder branch that
raises `NotImplementedError` with a structured error code (kept out
of the public surface in P2.2).

### Backend changes

**`backend/features/project_document/schema_mutations.py`** — new
discriminated union mirroring data-table.md "Write Pipeline":

```python
class AddFieldMutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["addField"]
    table_key: str
    after: CustomFieldDef
    insert_after_field_id: str | None = None
    expected_schema_fingerprint: str

class RenameFieldMutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["renameField"]
    table_key: str
    field_id: str
    display_name: str
    expected_schema_fingerprint: str

class DeleteFieldMutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["deleteField"]
    table_key: str
    field_id: str
    clear_values: Literal[True] = True
    expected_schema_fingerprint: str

class DuplicateFieldMutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["duplicateField"]
    table_key: str
    source_field_id: str
    after: CustomFieldDef            # caller supplies the fresh cf_* id, copied config
    expected_schema_fingerprint: str

class SetDescriptionMutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["setDescription"]
    table_key: str
    field_id: str
    description: str | None
    expected_schema_fingerprint: str

# Phase 3/4 only — declared now so the discriminator is closed
# from day one. P2.2 rejects them at the route boundary.
class ChangeTypeMutation(BaseModel): ...
class SetFormulaMutation(BaseModel): ...

FieldSchemaMutation = Annotated[
    AddFieldMutation | RenameFieldMutation | DeleteFieldMutation
    | DuplicateFieldMutation | SetDescriptionMutation
    | ChangeTypeMutation | SetFormulaMutation,
    Field(discriminator="kind"),
]
```

**`apply_schema_mutation(body, mutation, *, actor_user_id) -> ProjectDocumentV1`**:

1. Look up the table contract via `get_table_contract(mutation.table_key)`.
2. If `contract.custom_fields is None`, raise
   `api_error("custom_field_unsupported_table", ...)`.
3. Compute the **current** schema fingerprint via
   `contract.custom_fields.compute_schema_fingerprint(body)`. If it
   does not match `mutation.expected_schema_fingerprint`, raise
   `custom_field_stale_schema_fingerprint` with both values in
   `details`. This is the optimistic-concurrency gate plan-13 D15
   requires.
4. Dispatch on `mutation.kind`:
   - `addField` — reject if `mutation.after.id` already exists in
     `read_custom_fields(body)`; reject on duplicate display name
     (per-table, case-insensitive trimmed, across core + custom —
     reuse the existing `validate_document_references` helper but
     in preflight form so the structured error is the one in the
     ADR, not the generic `invalid_project_document`); compute the
     insertion position from `insert_after_field_id` (`None` →
     append at end; unknown id → reject with
     `custom_field_invalid_field_id`); call
     `replace_custom_fields(body, next_list)`. The added field's
     `created_by` is the `actor_user_id` (D11 — `None` permitted
     only for the developer-seed path, which does not go through
     this service).
   - `renameField` — reject when `field_id` is not in
     `read_custom_fields(body)`; reject when the trimmed
     `display_name` collides with another core/custom name; produce
     a new `CustomFieldDef` with the updated display name (and
     optional `field_key` if the caller derived a fresh slug —
     stays advisory per D12); replace.
   - `deleteField` — reject on unknown `field_id`; remove the
     field from `custom_fields`; iterate every row via
     `read_row_custom` / `set_row_custom` and strip the `field_id`
     key from each row's `custom` dict. The "cleared cell count"
     is returned in the audit payload for the response shape.
   - `duplicateField` — reject on unknown `source_field_id`;
     reject on `after.id == source_field_id` (must be fresh);
     reject on duplicate display name (the client uniquifies with
     `copy 2`, `copy 3` per US-CF-13 — the server still
     re-validates); deep-copy `config` and `description`
     (untouched here — `single_select` option-list deep-copy is
     Phase 3); insert immediately after the source position.
     Row values are **not** copied (US-CF-13 criterion 2).
   - `setDescription` — reject on unknown `field_id`; clamp
     `description` length to `CUSTOM_FIELD_DESCRIPTION_MAX` (280);
     replace the def with updated description.
   - `changeType` / `setFormula` — raise `NotImplementedError`
     mapped to `custom_field_unsupported_mutation` (HTTP 422). The
     REST route in P2.2 returns 422 with a clear "deferred to
     phase 3/4" message so an MCP client doesn't think the tool
     simply broke.
5. Re-run `validate_document` on the updated body. **Immediate
   draft validation** (save-versioning.md §8.3) — the
   per-table-envelope + whole-document references check happens
   right here, not at Save.
6. Return `(next_body, audit_payload)` where `audit_payload` is a
   small dict with the mutation kind, table key, field id, and any
   `cleared_row_count` (for delete). Drafts/audit log consume it.

**`backend/features/project_document/tables/contracts.py`** —
extend `CustomFieldCapability` with the two new hooks promised in
the Phase 1 dataclass docstring:

```python
@dataclass(frozen=True)
class CustomFieldCapability:
    # ... existing fields ...
    apply_schema_mutation: Callable[
        [ProjectDocumentV1, FieldSchemaMutation, str],   # actor_user_id
        tuple[ProjectDocumentV1, dict[str, object]],
    ]
    validate_schema_mutation: Callable[
        [ProjectDocumentV1, FieldSchemaMutation],
        None,                                            # raises api_error on rejection
    ]
```

For Rooms, both hooks delegate to the generic
`apply_schema_mutation` / `validate_schema_mutation` in
`schema_mutations.py` — the per-table differences live in the
existing accessors (`read_custom_fields`,
`replace_custom_fields`, `read_row_custom`, `set_row_custom`,
`compute_schema_fingerprint`). Future tables (ERVs / Pumps /
Fans) reuse the generic functions; no per-table branching is
required.

### New tests

`backend/tests/test_project_document_schema_mutations.py`:

- `test_add_field_rejects_stale_fingerprint` — caller's
  `expected_schema_fingerprint` differs from
  `compute_schema_fingerprint(body)` → `custom_field_stale_schema_fingerprint`.
- `test_add_field_rejects_duplicate_display_name` (case-insensitive,
  trimmed) — both vs an existing custom field and vs the Rooms core
  `Name` field.
- `test_add_field_inserts_after_specified_field`.
- `test_add_field_appends_when_anchor_omitted`.
- `test_rename_field_preserves_cf_id_and_row_values`.
- `test_rename_field_rejects_duplicate_name`.
- `test_delete_field_strips_row_values` — every row's `custom`
  dict loses the deleted key; the returned audit payload reports
  the count of rows that actually had a value.
- `test_duplicate_field_creates_independent_def_with_empty_row_values`.
- `test_duplicate_field_rejects_id_collision`.
- `test_set_description_round_trips_and_clamps_max_length`.
- `test_change_type_and_set_formula_raise_unsupported`.
- `test_apply_schema_mutation_runs_full_document_validation` —
  fabricate a mutation whose result would still pass per-table
  checks but violate a whole-document reference (e.g. a custom
  field whose id collides with an unrelated identifier the
  validator rejects); confirm the existing
  `validate_document_references` validator fires.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- No HTTP / MCP surface change yet; all tests are direct service
  calls.

---

## Phase 2.2 — Backend: REST schema-mutation endpoint + immediate draft validation + structured errors

**Goal.** Expose the Phase 2.1 service through a new draft-scoped
HTTP endpoint that the browser will call. Slot it into the same
draft-write pipeline `replace_table_slice` already uses (ETag
gating, locked-version check, draft creation, audit log). Return
the updated table envelope so the client can refresh state in one
round trip. Map every `api_error` raised by the service to the
structured envelope in the P2.0 ADR.

### Backend changes

**`backend/features/project_document/routes.py`** — new endpoint:

```python
@router.post(
    "/draft/tables/{table_name}/custom-fields:mutate",
    response_model=RegisteredTableResponse,
)
def post_schema_mutation(
    version_id: UUID,
    table_name: str,
    payload: FieldSchemaMutation,
    access: ProjectEditAccess,
    request: Request,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> Any:
    return apply_schema_mutation_to_draft(
        version_id, table_name, payload, access,
        if_match=if_match, if_match_version=if_match_version,
        request=request,
    )
```

The `:mutate` URL suffix follows REST sub-action style and keeps
the endpoint distinct from the existing `PUT /draft/tables/{table_name}`
replace path so the two write surfaces don't tangle in the OpenAPI
spec. The route accepts the discriminated `FieldSchemaMutation`
union directly; FastAPI's Pydantic v2 integration handles the
discriminator.

**`backend/features/project_document/drafts.py`** — add
`apply_schema_mutation_to_draft` that mirrors `replace_table_slice`'s
structure:

1. `require_editor_user(access)`.
2. Reject when `table_name != payload.table_key` with
   `custom_field_invalid_field_id` (sanity gate).
3. Open transaction; load version row; reject when locked
   (`version_locked`).
4. Read draft if present; ETag-gate against `if_match` (draft) or
   `if_match_version` (no draft yet, creating one from saved body)
   — reuse the existing ETag rules.
5. Call `contract.custom_fields.apply_schema_mutation(base_body,
   payload, actor_user_id=user.id)`. Per save-versioning.md §8.3,
   validation is immediate: a rejected mutation does not mutate
   the stored draft.
6. If `next_body == base_body`, short-circuit and return the
   current envelope (defensive; the only mutation that can be a
   true no-op is `setDescription` to the same value).
7. `upsert_draft(...)` with a fresh `draft_etag`.
8. `log_document_action(conn, "project_version_custom_field_<kind>",
   ...)` — distinct audit kinds per mutation discriminator so the
   action log is filterable; emit the `audit_payload` from P2.1
   into the log's `details`.

**Locked-version semantics.** Same as a normal draft write:
locked → 409 `version_locked`. The conflict UI then routes the
user to Save As (existing path).

**Structured errors.** Every `api_error` raised by P2.1 carries
the codes from the P2.0 ADR. The REST handler does **not** need
to remap — the existing `api_error` envelope already encodes
`error_code` / `message` / `details`. Add an explicit pytest case
per code to confirm the HTTP status mapping in the ADR:

| Code | HTTP |
|---|---|
| `custom_field_duplicate_name` | 422 |
| `custom_field_stale_schema_fingerprint` | 409 |
| `custom_field_invalid_field_id` | 422 |
| `custom_field_unsupported_table` | 422 |
| `custom_field_unsupported_mutation` | 422 |
| `version_locked` (reused) | 409 |
| `draft_etag_mismatch` (reused) | 409 |
| `version_etag_mismatch` (reused) | 409 |

`custom_field_illegal_type_conversion`, `custom_field_formula_parse_error`,
and `custom_field_formula_cycle` are reserved by P2.0's ADR but
**not** raised by Phase 2 (the corresponding mutations are
unsupported here); Phase 3 / 4 light them up.

### New tests

`backend/tests/test_project_document.py` — extend with a
`describe("custom-field schema mutations")` block:

- `test_post_schema_mutation_adds_field_round_trip` — POST a
  well-formed `addField`; response is the updated `RoomsSliceResponse`
  carrying the new field; subsequent `GET /draft/tables/rooms`
  returns the same envelope.
- `test_post_schema_mutation_returns_409_on_stale_fingerprint`.
- `test_post_schema_mutation_returns_422_on_duplicate_name`.
- `test_post_schema_mutation_returns_409_on_locked_version`.
- `test_post_schema_mutation_returns_409_on_stale_draft_etag`.
- `test_post_schema_mutation_rejects_change_type_in_phase_2` →
  422 `custom_field_unsupported_mutation`.
- `test_post_schema_mutation_emits_audit_log` — verify a row
  appears in the action log with the per-mutation kind.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Manual: hit the new endpoint with `curl` against a dev project;
  confirm 200 / 409 / 422 paths.

### Rollback

Revert the PR. The schema-mutation service from P2.1 remains
unreachable from the network until P2.2 lands again. No frontend
caller exists yet.

---

## Phase 2.3 — Backend: MCP `*_custom_field` write tools

**Goal.** Add the five Phase 2 MCP tools from llm-mcp-schema.md
§10.3 alongside the existing read tools. Each tool delegates to
the same P2.1 service the REST endpoint calls — one validation
path, one audit path. Wire the structured error envelope through
FastMCP's `ToolError` JSON-encoded shape (current TB-04b
mechanism per server.py docstring). Plan-13 R6 (MCP token blast
radius) is mitigated here by routing every schema mutation
through the same `project_access_for_token(..., "project:write")`
gate the eventual `patch_draft` write tool already uses.

### Backend changes

**`backend/features/mcp/server.py`** — five new tools:

```python
@mcp.tool()
def add_custom_field(
    project_id: str,
    version_id: str,
    table_key: str,
    after: dict[str, object],                   # CustomFieldDef dict
    expected_schema_fingerprint: str,
    ctx: Context,
    insert_after_field_id: str | None = None,
) -> dict[str, object]:
    """Append (or insert-after) a custom field in the token owner's draft."""
    ...
```

Mirror signatures for `rename_custom_field`,
`delete_custom_field`, `duplicate_custom_field`,
`set_custom_field_description` per llm-mcp-schema.md §10.3.

Each tool:

1. `parse_uuid` for `project_id` and `version_id`.
2. `current_token(ctx, allow_env_token)` and
   `project_access_or_error(token, project_id, "project:write", ctx)`.
3. Build the typed `FieldSchemaMutation` Pydantic model from the
   call args (`AddFieldMutation` etc.); validation failure →
   `raise_mcp_error("validation_error", ..., "fatal", ctx)`.
4. Call `apply_schema_mutation_to_draft(...)` from `drafts.py`
   with the MCP-derived `ProjectAccess`. Phase 1 left `create_by`
   accepting `None` for fixtures only — MCP supplies the token's
   user id, matching D11.
5. Map any `api_error` to `raise_mcp_error` via the existing
   `raise_http_exception_as_mcp_error` helper. Add a
   `recoverability_by_code` map so:
   - `custom_field_stale_schema_fingerprint` → `"refresh"`
     (client refetches the envelope and retries).
   - `custom_field_duplicate_name` /
     `custom_field_invalid_field_id` → `"fatal"` (caller error;
     retry won't help without a fix).
   - `version_locked` → `"refresh"` (caller should Save As).
   - `draft_etag_mismatch` → `"refresh"`.
6. Return `CustomFieldDef.model_dump(mode="json")` for add /
   rename / duplicate / set-description; return
   `{ "removed_field_id": ..., "cleared_row_count": ... }` for
   delete (per llm-mcp-schema.md §10.3 return shapes).

**MCP edit-lease integration.** Per save-versioning.md §8.5, MCP
writes acquire a short draft edit lease so the browser shows an
"MCP editing" indicator and freezes write controls. Phase 2
follows the same lease pattern the eventual `patch_draft` write
tool uses; if that lease primitive does not yet exist when
P2.3 lands, **add the lease primitive in this PR** and apply it
to the five schema-mutation tools. (The browser-side lease
indicator UI is owned by the existing draft summary surface and
is unchanged.)

### New tests

`backend/tests/test_mcp.py` — extend with:

- `test_add_custom_field_tool_round_trip` — call the tool with a
  valid `CustomFieldDef` dict; assert returned shape and confirm
  the draft envelope read via `get_table` reflects the change.
- `test_add_custom_field_rejects_viewer_token` →
  `mcp_scope_insufficient`.
- `test_add_custom_field_rejects_unauthenticated` →
  `not_authenticated`.
- `test_rename_custom_field_tool_preserves_cf_id`.
- `test_delete_custom_field_tool_returns_cleared_row_count`.
- `test_duplicate_custom_field_tool_independent_def`.
- `test_set_custom_field_description_tool_round_trip`.
- `test_mcp_schema_mutation_emits_audit_log` — the per-mutation
  audit kind from P2.2 appears with `updated_via='mcp'`.
- `test_mcp_schema_mutation_stale_fingerprint_recoverability_refresh`.
- `test_mcp_schema_mutation_duplicate_name_recoverability_fatal`.

### Security review checkpoint

Before merge, run a focused security review (plan-13 R6, plan-15
ADR). Confirm:

- No tool path skips `require_token_scope("project:write")`.
- The mutation is bounded to the token's project; cross-project
  table targets raise `mcp_project_scope_mismatch`.
- Error envelopes don't leak `body` snapshots or other sensitive
  diff content — only `code`, `message`, `request_id`,
  `recoverability`, and the small `details` dict in the ADR
  (`expected_fingerprint`, `actual_fingerprint`,
  `colliding_field_id`, etc.).

### Acceptance

- All MCP tests green.
- `make typecheck`, `make test`, `make lint`, `make smoke` green.
- Security checkpoint documented (one-paragraph note appended to
  the P2.0 ADR).

---

## Phase 2.4 — Frontend: `schemaMutation` WriteOp + dispatcher + `useTableSchema.mutate`

**Goal.** Generalize the existing `WriteOp.fieldDefMutation` shape
(currently consumed only by the single-select option editor) into
the discriminated `WriteOp.schemaMutation` per data-table.md
"Write Pipeline". Add a `dispatchSchemaMutation` helper that
serializes the typed `FieldSchemaMutation` and POSTs it to the
new endpoint from P2.2. Grow `useTableSchema` with a typed
`mutate(op)` API the editor popovers will call. **No new UI in
this PR** — Rooms still looks identical; the option editor still
works, just through the renamed WriteOp.

This sub-phase is the bridge between the typed backend surface
(P2.1–P2.3) and the editor UI (P2.5–P2.7). Keeping it as its own
PR makes the rename grep-trackable and surfaces any consumer that
was reaching into the legacy shape.

### Frontend changes

**`frontend/src/shared/ui/data-table/types.ts`:**

- Replace the `fieldDefMutation` variant with the
  `schemaMutation` variant from data-table.md "Write Pipeline":

  ```ts
  export type FieldSchemaMutation =
    | { kind: "addField"; tableKey: string; after: CustomFieldDef; insertAfterFieldId?: string; expectedSchemaFingerprint: string }
    | { kind: "renameField"; tableKey: string; fieldId: string; displayName: string; expectedSchemaFingerprint: string }
    | { kind: "deleteField"; tableKey: string; fieldId: string; clearValues: true; expectedSchemaFingerprint: string }
    | { kind: "duplicateField"; tableKey: string; sourceFieldId: string; after: CustomFieldDef; expectedSchemaFingerprint: string }
    | { kind: "setDescription"; tableKey: string; fieldId: string; description: string | null; expectedSchemaFingerprint: string };

  export type WriteOp =
    | { kind: "cell"; ... }
    | { kind: "paste"; ... }
    | { kind: "fill"; ... }
    | { kind: "rowInsert"; ... }
    | { kind: "rowDelete"; ... }
    | {
        kind: "schemaMutation";
        mutation: FieldSchemaMutation;
        // Legacy single-select-option editor stuffed cell writes
        // and FieldDef before/after in the same WriteOp; carry
        // those through as Phase-3 "edit single-select options"
        // until the option editor is migrated to its own
        // `editOptions` mutation kind in plan-16. For Phase 2
        // they sit unused on the schemaMutation variant.
        before?: FieldDef;
        after?: FieldDef;
        cellWrites?: CellWrite[];
      };
  ```

  Phase 2 does not split the single-select option editor into its
  own DTO — that is plan-16 / Phase 3. The legacy `before` /
  `after` / `cellWrites` slots stay on the `schemaMutation`
  variant so the existing option editor still type-checks and
  fires. Phase 2's editor popovers populate `mutation` instead
  and leave the legacy slots empty.

- `CustomFieldDef` (re-export from `useTableSchema.ts`) is the
  shared shape both branches consume — no separate frontend type.

**`frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`:**

Typed builder functions so callers never hand-roll the DTO:

```ts
export function buildAddFieldMutation(args: {
  tableKey: string;
  newField: CustomFieldDef;
  insertAfterFieldId: string | null;
  schemaFingerprint: string;
}): FieldSchemaMutation;

export function buildRenameFieldMutation(...): FieldSchemaMutation;
export function buildDeleteFieldMutation(...): FieldSchemaMutation;
export function buildDuplicateFieldMutation(...): FieldSchemaMutation;
export function buildSetDescriptionMutation(...): FieldSchemaMutation;
```

Each builder validates inputs the popover already pre-checked
(non-empty `display_name`, valid `cf_*` id pattern) and throws a
typed error the popover surfaces inline — the builders are the
single chokepoint where the wire format is constructed.

**`frontend/src/shared/ui/data-table/hooks/useTableSchema.ts`:**

Add a `mutate(op)` helper plus a fresh-id generator. The hook
itself does not call the network — it returns a callback the
parent (RoomsTable) plumbs to the dispatcher. Pattern matches
the existing `onWrite` slot on `DataTableProps`.

```ts
export function useTableSchema(args: UseTableSchemaArgs): TableSchema {
  // ... existing return shape ...
  mintCustomFieldId: () => string;            // returns `cf_<ulid>`
}
```

**`frontend/src/features/equipment/api.ts`** (or the existing
Rooms slice client — naming differs by codebase; check the
imports from `RoomsTable.tsx`):

```ts
export async function postRoomsSchemaMutation(
  args: {
    projectId: string;
    versionId: string;
    mutation: FieldSchemaMutation;
    ifMatch: string | null;             // draft etag
    ifMatchVersion: string | null;      // version etag (no draft yet)
  },
): Promise<RoomsSliceResponse>;
```

**`frontend/src/features/equipment/components/RoomsTable.tsx`:**

Wire the dispatcher into the existing `onWrite` handler. When the
WriteOp's `kind` is `schemaMutation` and `mutation` is set,
forward to `postRoomsSchemaMutation`; otherwise keep the existing
`PUT /draft/tables/rooms` path. The legacy option-editor WriteOp
(legacy `before` / `after` / `cellWrites` with `mutation`
unset) continues to route through the existing PUT.

### New tests

- `customFieldMutations.test.ts` — every builder produces the
  exact wire shape (string-equality JSON snapshot against the
  data-table.md "Write Pipeline" spec).
- `dispatchSchemaMutation.test.ts` — POSTs to the new endpoint
  with the right `If-Match` / `If-Match-Version` headers; maps a
  409 `custom_field_stale_schema_fingerprint` to a typed thrown
  error the caller (RoomsTable) can render.
- `RoomsTable.test.tsx` regression — single-select option editor
  still saves through the new `schemaMutation` WriteOp shape.

### Acceptance

- Vitest, typecheck, lint green.
- Manual Playwright MCP smoke: open Rooms, edit a single-select
  option, save — confirms the renamed WriteOp path still works.

---

## Phase 2.5 — Frontend: locked indicator + description tooltip + `<HeaderContextMenu>` skeleton

**Goal.** Close the **read-side** custom-field surface required
by US-CF-6, US-CF-9, US-CF-11, US-CF-14 before any add / rename /
delete UI lands. After this PR a Rooms header cell:

- shows a lock glyph for core fields and no glyph (or alternate
  glyph) for custom fields (US-CF-11);
- shows a `?` tooltip for any field with a non-empty
  `description` (US-CF-14, both core and custom — core
  descriptions are app-supplied);
- responds to right-click and the platform context-menu key with
  a popover menu that exposes the **existing** view-state items
  (sort, filter, group, hide) and one phase-2 schema item that is
  always available even in 2.5: `Delete field` for custom fields
  (US-CF-5). Add / rename / duplicate / edit-description ship in
  2.6 / 2.7.

This phase is deliberately read-leaning so the indicator + menu
infrastructure is in place before the add-field popover from
P2.6.

### Frontend changes

**`frontend/src/shared/ui/data-table/tokens/`** — add a
`--phn-header-border-locked` CSS token per data-table.md "Layout,
Styling, And Accessibility". Use a thin 2 px left border accent
plus a tiny lock glyph (Lucide `Lock` already in the bundle, or
the existing `RoomsTable` icon set — check `lib/icons.ts` first).

**`frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`:**

Replace the P2.0 placeholder with the real component:

```tsx
export type HeaderContextMenuProps = {
  fieldDef: FieldDef;
  isViewer: boolean;
  // Schema-mutation items the parent enables for custom fields.
  // Phase 2.5 ships only `onDeleteField`; 2.6/2.7 add the rest.
  onDeleteField?: () => void;
  // View-state items wired into the existing `onViewChange` path —
  // the parent passes already-bound callbacks so the menu stays
  // dumb. (Mirrors how `ColumnHeaderMenu` consumes `onEditOptions`.)
  onSortAsc: () => void;
  onSortDesc: () => void;
  onFilterBy: () => void;
  onGroupBy: () => void;
  onHide: () => void;
  // Phase 2.6 will add `onAddFieldLeft` / `onAddFieldRight` /
  // `onRenameField` / `onDuplicateField` / `onEditDescription`.
};
```

Rules:

- US-CF-9 — when `isViewer === true`, the menu does not render
  and right-click falls through to the browser default.
- US-CF-6 — when `fieldDef.read_only_schema === true`, only the
  view-state items render; schema items are absent (not
  greyed-out). `Add field left/right` will reappear in 2.6 — it
  is the one schema item core fields keep.
- US-CF-1 criterion 7 — Shift+F10 / the platform Menu key on a
  focused header opens the same menu. Use Radix's
  `DropdownMenu.Root` with `modal={false}` and a virtual anchor;
  bind `onContextMenu` + `onKeyDown` at the header cell level.
- US-CF-1 criterion 3 — every view-state callback routes through
  the existing `onViewChange` path on the parent (toolbar
  authority). Nothing in this component owns view state directly.

**Description tooltip.**
`frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx`
— a small Radix `Tooltip` rendering `?` next to the lock glyph in
the header cell. Visible only when `fieldDef.description` is a
non-empty trimmed string. Shows the trimmed description as plain
text (no markdown).

**`frontend/src/shared/ui/data-table/components/SortableHeaderCell.tsx`** —
hook in the indicator + tooltip + context-menu trigger so every
field benefits without per-consumer wiring. Pass `isViewer` /
`onWrite` through `DataTableProps` — they already exist.

**Delete field flow.** A modal confirm dialog (reuse
`ConfirmRowDeleteDialog` as the visual template) that shows
field name, type, current row-value count (computed from the
in-memory rows via the existing `optionReferenceCounts` helper
generalized for `getCustomValue`). On confirm:

1. Build `buildDeleteFieldMutation({ tableKey, fieldId,
   schemaFingerprint })`.
2. Wrap in `{ kind: "schemaMutation", mutation }`.
3. Dispatch via `onWrite` (already wired in P2.4).
4. Rely on the existing rollback semantics — a server rejection
   rolls the table to the last acknowledged snapshot per
   data-table.md "Write Pipeline" rules.

### New tests

`frontend/src/shared/ui/data-table/__tests__/HeaderContextMenu.test.tsx`:

- right-click on a core-field header opens menu with view-state
  items only;
- right-click on a custom-field header opens menu with view-state
  items **and** `Delete field`;
- viewer mode never opens the menu;
- `Shift+F10` on a focused header opens the same menu;
- `Delete field` dispatches a `schemaMutation` WriteOp whose
  `mutation.kind === "deleteField"` and carries the active
  `schemaFingerprint`.

`frontend/src/shared/ui/data-table/__tests__/CustomFieldDescriptionTooltip.test.tsx`:

- tooltip is hidden when `description` is missing or empty;
- tooltip shows the trimmed text on hover and on keyboard focus;
- tooltip is visible in viewer mode (US-CF-9 criterion 1 +
  US-CF-14 criterion 4).

`frontend/src/features/equipment/__tests__/RoomsTable.lockedIndicator.test.tsx`:

- every core column renders with the lock glyph;
- a seeded custom column (use the dev-seed helper from plan-14
  P1.6) renders **without** the lock glyph;
- both render under all four view-state tints layered on top.

### Acceptance

- Vitest, typecheck, lint green.
- Manual Playwright MCP smoke: open Rooms in editor mode,
  right-click a header, confirm the menu opens with the expected
  item set for core vs custom fields. Hover the `?` glyph on a
  field with a description; confirm tooltip. Repeat in viewer
  mode — confirm no menu, tooltip still visible.

---

## Phase 2.6 — Frontend: add-field popover + tail "+" cell wire-up

**Goal.** Editors can add new custom fields. Ship the full
`<AddFieldPopover>` for the four Phase 2 types (`short_text`,
`long_text`, `number`, `url`), wire it into the tail `+` cell
(which has been laid out since plan-12) and into the
`Insert field left` / `Insert field right` items in the
context menu from P2.5. Honor US-CF-2, US-CF-11, US-CF-12,
US-CF-14 (write side).

### Frontend changes

**`frontend/src/shared/ui/data-table/components/AddFieldPopover.tsx`:**

```tsx
export type AddFieldPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;     // header cell or tail `+`
  insertAfterFieldId: string | null;     // null = append
  tableKey: string;
  existingFieldNames: ReadonlyArray<string>;   // for client preflight
  schemaFingerprint: string;
  mintCustomFieldId: () => string;
  dispatchWrite: (op: WriteOp) => Promise<void>;
};
```

Fields:

1. **Field name** (required, max 120) — inline trimmed empty
   check; inline duplicate-name check against
   `existingFieldNames` (case-insensitive trimmed, US-CF-12); the
   colliding entry is named in the inline error message.
2. **Field type** picker — four pills:
   `short_text` / `long_text` / `number` / `url`. Disabled-with-
   tooltip rows for `single_select` (Phase 3) and `formula`
   (Phase 4) so the surface previews the eventual full set.
3. **Description** (optional, max 280) — collapsed by default;
   the `Add description` toggle expands a textarea (US-CF-14).
4. **Type-specific config panel** — Phase 2 ships placeholder
   panels:
   - `number` exposes a `precision` integer (0–10, default 2);
     stored in `config.precision`.
   - `url` exposes no config in Phase 2 (validation is on the
     coercion path, not user-tunable here).
   - `short_text` / `long_text` expose no config.

On submit:

1. Build a `CustomFieldDef` with `id = mintCustomFieldId()`,
   `created_at = new Date().toISOString()`, `created_by = null`
   (the backend overwrites with the actor user id).
2. Build `buildAddFieldMutation({ tableKey, newField,
   insertAfterFieldId, schemaFingerprint })`.
3. `dispatchWrite({ kind: "schemaMutation", mutation })`.
4. On success — close the popover and focus the first cell of
   the new column (US-CF-2 criterion 4). The parent
   (RoomsTable) holds the column-order state; the post-dispatch
   refresh updates `useTableSchema` which produces the new
   `FieldDef`, and a one-shot effect focuses the corresponding
   cell.
5. On `custom_field_stale_schema_fingerprint` — surface
   "Someone else added or changed a field; refresh and try
   again" with a retry button that refetches the slice and
   re-prefills the editor.
6. On `custom_field_duplicate_name` — surface the server
   message (which names the offending field per US-CF-12
   criterion 5).

**ViewState insertion order.** Custom fields land at the end of
`columnOrder` by default. When `insertAfterFieldId` is set, the
post-success effect splices the new `cf_*` id into
`columnOrder` immediately after the anchor id and fires a single
`onViewChange`. (data-table.md columnOrder rule: the parent owns
the order; we don't mutate the schema array order — backend
already inserted at the right position, but `columnOrder` is
view state, not schema, so we have to sync it once.)

**Tail `+` cell wire-up.**
`AddFieldTailCell.tsx` swaps its disabled-button rendering for an
editor-mode button that opens `<AddFieldPopover>` anchored to the
cell, with `insertAfterFieldId = lastVisibleColumn.fieldKey`.
Viewer mode keeps the existing hidden / disabled rendering
(US-CF-9 criterion 3 — hide the tail entirely in viewer mode;
the cell is `aria-hidden` and not focusable).

**Context-menu wiring.** P2.5's `HeaderContextMenu` grows two
new items: `Insert field left` and `Insert field right`.
Available on **both** core and custom fields (US-CF-6
criterion 3). Both anchor the popover to the clicked header
cell and pass `insertAfterFieldId` accordingly (`previous` for
left, `current` for right).

### New tests

`AddFieldPopover.test.tsx`:

- happy path for each of the four types — popover closes,
  dispatches `addField` mutation with correct shape;
- inline duplicate-name preflight blocks submit with the right
  message;
- inline empty-name preflight blocks submit;
- description shows up in the `after.description` on submit when
  the toggle is expanded;
- `number` precision config writes `config: { precision: 3 }`
  on the wire;
- server-side `custom_field_duplicate_name` rejection surfaces
  in the popover error band without closing the popover;
- server-side `custom_field_stale_schema_fingerprint` surfaces
  with a retry affordance.

`AddFieldTailCell.test.tsx`:

- editor mode renders the tail cell as a focusable button that
  opens the popover with `insertAfterFieldId =
  lastVisibleColumn.fieldKey`;
- viewer mode renders an `aria-hidden` non-focusable cell.

`RoomsTable.test.tsx`:

- after a successful add, the new column appears in the grid in
  the expected position and the first cell of the new column is
  focused.

### Acceptance

- Vitest + typecheck + lint green.
- Manual Playwright MCP smoke: open Rooms (editor), click the
  `+` tail cell, add `short_text` "Notes" with a description,
  confirm the column appears at the end, focus lands in the
  first cell, type a value, save. Repeat using
  `Insert field right` from a mid-table column; confirm the
  new column inserts at the right position.

---

## Phase 2.7 — Frontend: rename inline + delete confirm + duplicate + edit-description

**Goal.** Round out the editor surface. After this PR every
custom-field menu item from US-CF-1 (excluding type-change /
edit-formula, which are Phase 3 / 4) is wired and ships through
the `schemaMutation` WriteOp pipeline.

### Frontend changes

**Rename (US-CF-3).** Reuse the inline-edit primitive from the
existing `InlineCellEditor` pattern, but anchored to the header
label. Activate via:

- the `Rename field` item in the context menu (custom fields
  only — US-CF-6 hides it on core);
- double-click on a custom field's header label.

On submit:

1. Client preflights non-empty + duplicate-name against
   `existingFieldNames` (excluding the current field id).
2. Build `buildRenameFieldMutation({ tableKey, fieldId,
   displayName, schemaFingerprint })`.
3. Dispatch via `onWrite`. The `cf_*` id is unchanged — US-CF-3
   criterion 3 guarantees row values, view state, and (future)
   formula AST refs all survive untouched.

**Delete (US-CF-5).** Already wired in P2.5. P2.7 only refines
the confirm dialog copy to mention the row-value count and the
fact that older locked versions retain the field (US-CF-5
criterion 4).

**Duplicate (US-CF-13).** The `Duplicate field` menu item
(custom fields only — US-CF-13 criterion 1):

1. Compute a uniquified display name: `<source.display_name> copy`
   if free, else `<source.display_name> copy 2`, `copy 3`, ...
   (US-CF-13 criterion 2).
2. Mint a fresh `cf_*` id via `mintCustomFieldId()`.
3. Deep-copy `field_type`, `config`, `description` from the
   source (US-CF-13 criterion 2). For `single_select` and
   `formula` sources, Phase 2 does not expose duplicate (those
   fields can't be created in Phase 2; the source therefore
   doesn't exist; defensive: guard the menu item with a
   `is-phase-2-type` check and hide it on those fields if a
   developer-seeded one is present).
4. Build `buildDuplicateFieldMutation({ tableKey, sourceFieldId,
   after, schemaFingerprint })` and dispatch.

**Edit description (US-CF-14).** The `Edit description` menu
item (custom fields only) opens a small popover anchored to the
header cell with a single textarea pre-populated with the
current description, a max-280 counter, and Save / Cancel
buttons. Save dispatches
`buildSetDescriptionMutation({ tableKey, fieldId, description,
schemaFingerprint })`. An empty trimmed description sends
`description: null`. Core fields **do not** expose this menu
item (US-CF-14 criterion 4 — they are read-only descriptions).

### New tests

- `RenameFieldFlow.test.tsx` — happy path; duplicate-name
  rejection; cancel restores original.
- `DuplicateFieldFlow.test.tsx` — uniquified name picks `copy`,
  then `copy 2` on collision; row values are not copied;
  config is deep-copied.
- `EditDescriptionFlow.test.tsx` — round-trip; empty submits
  `null`; max-280 clamp.
- `RoomsTable.test.tsx` — full menu surface for a custom field
  (rename / delete / duplicate / edit-description / sort /
  filter / group / hide / insert-left / insert-right) renders
  exactly those items, in that order, with no others.

### Acceptance

- Vitest + typecheck + lint green.
- Manual Playwright MCP smoke: round-trip every menu item on a
  custom field in the live UI.

---

## Phase 2.8 — Exit-criteria acceptance tests + Playwright smoke + a11y pass

**Goal.** Verify the plan-13 §5 Phase 2 exit criteria
end-to-end, both browser and MCP, and run a focused a11y pass on
the new surfaces (context menu, add-field popover, edit-
description popover, locked indicator, description tooltip).

### Backend end-to-end tests

`backend/tests/test_project_document_custom_fields_phase_2.py`:

1. **Add → cell-write → save round-trip** through the new
   `POST /draft/tables/rooms/custom-fields:mutate` endpoint
   for each of the four types; confirm subsequent
   `PUT /draft/tables/rooms` writes that set `custom[<cf_id>]`
   for each new field round-trip cleanly.
2. **Duplicate-name protection** — the same scenario as P2.2
   but driven through a multi-step request sequence the UI
   would issue (add field "Notes"; attempt to add another
   "Notes" → 422; rename existing to "Notes 2"; re-attempt → 200).
3. **Stale fingerprint** — open two parallel drafts (simulated
   by holding the first fingerprint); after the first commits,
   the second's mutation returns 409 with the active
   fingerprint in `details`.
4. **Lock and Save As** — lock the version, attempt any
   mutation → 409 `version_locked`; Save As to a new version;
   mutation succeeds on the new (unlocked) version; the
   locked version remains unchanged.
5. **Delete with values** — add `short_text` "Notes", set
   values on three rows, delete the field; response reports
   `cleared_row_count == 3`; subsequent draft / saved-version
   reads show no `custom["<cf_id>"]` keys on any row.
6. **Audit log** — every mutation appends a per-kind audit row.
7. **Browser–MCP cross-talk** — add a field via REST; immediately
   read via the MCP `get_table` tool; confirm the new
   `custom_fields` entry is visible. Then rename via MCP;
   confirm REST `GET /draft/tables/rooms` reflects the rename.

### Frontend acceptance tests

`frontend/src/features/equipment/__tests__/RoomsTable.customFieldEditorE2E.test.tsx`:

- Add → rename → duplicate → edit description → delete, all
  through the rendered UI (not by calling the API client
  directly), all dispatched through `schemaMutation` WriteOps;
  assert the network mock saw exactly five POSTs in order with
  the expected payload shapes.
- Viewer mode renders the locked indicator on core fields, the
  `?` tooltip on fields with a description, and **no** context
  menu, **no** tail `+` cell, **no** rename / delete affordance.

### Playwright e2e

`frontend/tests/e2e/custom-fields-phase-2.spec.ts`:

- The full plan-13 §5 Phase 2 exit-criteria walkthrough against
  a running dev stack (`make dev` then `make e2e`). Screenshots
  filed under `docs/plans/2026-05-24/screenshots/plan-15-p2-8/`.

### A11y pass

Run an axe scan + manual keyboard walkthrough on:

- header context menu (focusable, escape-closeable, items
  reachable by Up/Down, Enter activates);
- add-field popover (focus traps inside; Tab order is
  Name → Type pills → Description toggle → per-type config →
  Cancel → Save);
- edit-description popover (same pattern);
- locked indicator and description tooltip have accessible
  names (US-CF-11 criterion 5; US-CF-14 has no a11y criterion
  but the tooltip must be focus-reachable not just hover-only);
- contrast of the lock glyph and the `?` glyph against the
  header background under each of the four view-state tints.

File the a11y findings in
`docs/plans/2026-05-24/plan-15-a11y-notes.md`. Any blocking
issue is fixed in this PR; non-blocking notes feed the Phase 5
a11y polish pass (plan-13 §5).

### Acceptance

- All Phase 2 acceptance tests pass.
- `make test`, `make e2e`, `make smoke` green.
- A11y notes filed; no critical findings remain open.
- Manual exit-criteria walkthrough complete; screenshots filed.

---

## Cross-cutting verification checks

After each phase, run:

- `make typecheck` (backend mypy + frontend tsc);
- `make test` (pytest + vitest);
- `make lint`;
- `make smoke` (lightweight end-to-end against the running
  stack);
- `make e2e` at phase boundaries that touch user-visible
  behavior (2.5, 2.6, 2.7, 2.8).

If `make smoke` exposes a regression after the WriteOp rename in
2.4, the most likely culprit is a consumer that was reaching
into the legacy `fieldDefMutation` shape — grep for the literal
string `"fieldDefMutation"` across `frontend/src/` should turn
up any stragglers (the rename is search-and-replace-able by
design).

## Rollback notes

- **Pre-deploy.** No production data exists. Rolling back any
  phase is a `git revert` plus a `make test` to confirm
  fixtures still align.
- **No schema_version bump.** Phase 2 only adds capability on
  top of the plan-14 Phase 1 envelope; the document shape is
  unchanged. Reverting any sub-phase does not orphan stored
  state.
- **MCP tools** (P2.3) can be feature-disabled by removing the
  `@mcp.tool()` decorators if a security finding surfaces
  post-merge; the underlying service remains intact for the
  REST surface.

## Progress log

| Sub-phase | Status | Landed |
|-----------|--------|--------|
| P2.0 — Story promotion + scaffold + ADR | ✅ Done | 2026-05-24 |
| P2.1 — Backend: `FieldSchemaMutation` DTOs + apply service | ✅ Done | 2026-05-24 |
| P2.2 — Backend: REST schema-mutation endpoint | ✅ Done | 2026-05-24 |
| P2.3 — Backend: MCP `*_custom_field` write tools | ✅ Done | 2026-05-24 |
| P2.4 — Frontend: `schemaMutation` WriteOp + dispatcher | ⏭️ Next | — |
| P2.5 — Frontend: locked indicator + tooltip + `<HeaderContextMenu>` skeleton | ⏳ Pending | — |
| P2.6 — Frontend: add-field popover + tail `+` cell wire-up | ⏳ Pending | — |
| P2.7 — Frontend: rename + delete + duplicate + edit-description | ⏳ Pending | — |
| P2.8 — Exit-criteria acceptance tests + Playwright + a11y pass | ⏳ Pending | — |

### Resume pointer

**Next sub-phase: P2.4 — Frontend: `schemaMutation` WriteOp +
dispatcher + `useTableSchema.mutate`** (see phase block above for
full spec). This is the bridge between the now-live backend
schema-mutation pipeline (REST + MCP) and the editor UI shipping in
P2.5–P2.7. Concretely:

1. Rename `WriteOp.fieldDefMutation` → `WriteOp.schemaMutation` in
   `frontend/src/shared/ui/data-table/types.ts`. Keep the legacy
   `before` / `after` / `cellWrites` slots on the renamed variant
   for the single-select option editor (plan-16 / Phase 3 splits
   that into its own kind).
2. Add the TS `FieldSchemaMutation` discriminated union matching
   the backend (`backend/features/project_document/schema_mutations.py`).
3. Build the typed builder functions in
   `frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`
   (placeholder shipped in P2.0).
4. Add `postRoomsSchemaMutation` API client targeting
   `POST .../draft/tables/{table_name}/custom-fields:mutate`.
5. Extend `useTableSchema` with `mintCustomFieldId()` and the
   `mutate(op)` helper.
6. Wire the dispatcher into `RoomsTable`'s `onWrite` handler.

No new UI in P2.4; the existing single-select option editor
should keep working through the renamed WriteOp.

### P2.0 (2026-05-24) — Story promotion + scaffold + ADR

**What landed:**

- `context/user-stories/32-custom-fields.md` — promoted US-CF-1,
  US-CF-2, US-CF-3, US-CF-5, US-CF-6, US-CF-9, US-CF-11, US-CF-12,
  US-CF-13, US-CF-14 from Draft → Phase 2 (US-CF-2 notes
  `single_select` Phase 3 / `formula` Phase 4 deferrals).
- `context/technical-requirements/data-table.md` — added
  implementation note flagging the P2.4 `WriteOp.fieldDefMutation`
  → `WriteOp.schemaMutation` rename.
- `docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md` —
  new ADR pinning the 8 Phase-2 structured error codes (5 active +
  3 deferred placeholders), HTTP statuses, MCP `recoverability`
  values, `details` keys, and user-facing message templates. The
  P2.3 security checkpoint paragraph is a TODO slot at the bottom
  of the ADR.
- Backend scaffold:
  `backend/features/project_document/schema_mutations.py` and
  `backend/tests/test_project_document_schema_mutations.py`
  (single `test_module_imports` smoke).
- Frontend scaffold:
  `frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`,
  `AddFieldPopover.tsx`, `CustomFieldDescriptionTooltip.tsx`, and
  `frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`
  (all inert placeholders so subsequent PRs only touch behavior).

**Gates green:** `make lint`, `make typecheck`,
`cd frontend && pnpm tsc --noEmit`, `make test`
(55 frontend test files / 595 frontend tests + full backend
suite).

### P2.1 (2026-05-24) — Backend: `FieldSchemaMutation` DTOs + apply service

**What landed:**

- `backend/features/project_document/schema_mutations.py`:
  - Discriminated `FieldSchemaMutation` Pydantic union with 7
    kinds — 5 active (`addField`, `renameField`, `deleteField`,
    `duplicateField`, `setDescription`) and 2 reserved
    (`changeType` Phase 3, `setFormula` Phase 4).
  - `apply_schema_mutation(body, mutation, *, actor_user_id,
    capability) -> (next_body, audit_payload)`. Runs the
    fingerprint optimistic-concurrency gate first, then dispatches
    on `kind`, then re-validates via `validate_document`
    (immediate validation per save-versioning.md §8.3).
  - Per-mutation rules: dup-name preflight (case-insensitive
    trimmed across core + custom, structured error names the
    offender + origin); id-collision check; `insert_after_field_id`
    resolution; `actor_user_id` stamped onto `created_by` for
    add/duplicate; row stripping for delete with `cleared_row_count`
    in audit; description clamp to 280; `setDescription` accepts
    `None` to clear.
  - `validate_schema_mutation` hook — Phase 2 has no caller yet;
    delegates to apply and discards so validation parity is
    enforced by one code path.
  - `AUDIT_KIND_BY_MUTATION` table for P2.2/P2.3 to consume.
- `backend/features/project_document/tables/contracts.py` —
  extended `CustomFieldCapability` with the two new callables,
  typed via `TYPE_CHECKING` forward reference to
  `FieldSchemaMutation` to keep contracts.py
  schema_mutations-independent.
- `backend/features/project_document/tables/rooms.py` — wired
  `_apply_rooms_schema_mutation` + `_validate_rooms_schema_mutation`
  onto `rooms_custom_fields`. **Lazy import** of
  `schema_mutations` inside the function bodies, because
  `tables/__init__.py` eagerly imports `rooms`, and a top-level
  import from `schema_mutations` (which itself imports
  `tables.contracts`) closes the cycle at `tables/__init__.py`
  load time.
- `backend/tests/test_project_document_schema_mutations.py` —
  22 service-internal tests covering every accept branch and
  every reject code from the ADR.

**Gates green:** `make lint`, `make typecheck`, backend pytest
(162 passed including the 22 new). Frontend test suite is
unchanged in P2.1 (no frontend code touched); one pre-existing
flake in `App.test.tsx` (status-timeline "Set CAD files received"
button) — clean on retry.

**Architectural notes for the next visitor:**

- The capability callable indirection (`capability.apply_schema_mutation`)
  is intentional. drafts.py / MCP can either call
  `contract.custom_fields.apply_schema_mutation(...)` (delegates
  to the generic via the Rooms-bound closure) or call
  `schema_mutations.apply_schema_mutation(..., capability=...)`
  directly. Both produce identical results.
- The `validate_schema_mutation` hook has no consumer in Phase 2 —
  it's reserved for a future LLM dry-run / preview-write surface.
  P2.3's MCP tools call `apply_schema_mutation` via drafts.py,
  not the validate hook.
- `CustomFieldDef.created_by` is overwritten by
  `actor_user_id` on add / duplicate — clients send `None` (or
  any value, it's ignored) and the server is authoritative.
- The dispatch is `isinstance(mutation, ...)` rather than
  `match mutation.kind: case ...` because ty (and mypy) narrow
  the union per-branch more reliably with isinstance. The final
  `else` branch is defensive; the union is closed.
- One pre-existing `HTTP_422_UNPROCESSABLE_ENTITY` deprecation
  warning surfaces in tests (Starlette 0.36+ renamed it to
  `_CONTENT`). Out of scope to fix in plan-15; the existing
  `drafts.py` and `validation.py` use the same constant.

### P2.2 (2026-05-24) — Backend: REST schema-mutation endpoint

**What landed:**

- `backend/features/project_document/drafts.py` —
  `apply_schema_mutation_to_draft(version_id, table_name,
  mutation, access, *, if_match, if_match_version, request)`.
  Mirrors `replace_table_slice`'s pipeline: editor-only auth,
  contract lookup, `custom_field_unsupported_table` 422 if the
  table has no `CustomFieldCapability`, sanity gate on
  `mutation.table_key == table_name`, locked-version 409, version
  / draft ETag gating, lazy draft creation, no-op short-circuit
  for `setDescription` to same value, fresh draft etag on
  upsert, per-mutation audit-log row.
- `backend/features/project_document/audit.py` —
  `log_document_action` grew an `extra_details` kwarg that merges
  into the base details (`project_id`, `version_id`) so the
  schema-mutation audit_payload from P2.1 lands in
  `user_action_log.details`.
- `backend/features/project_document/routes.py` — new endpoint
  `POST /api/v1/projects/{project_id}/versions/{version_id}/draft/tables/{table_name}/custom-fields:mutate`,
  body is the discriminated `FieldSchemaMutation` Pydantic union,
  headers `If-Match` (draft etag) and `If-Match-Version` (version
  etag, draft-not-yet-created path), response is
  `RegisteredTableResponse`. The `:mutate` URL suffix follows
  REST sub-action style and keeps this distinct from
  `PUT /draft/tables/{table_name}` in the OpenAPI spec; verified
  via `app.openapi()`.
- `backend/features/project_document/service.py` — re-exports
  `apply_schema_mutation_to_draft`.
- `backend/tests/test_project_document_schema_mutation_endpoint.py`
  — 7 end-to-end tests:
  - `test_post_schema_mutation_adds_field_round_trip` (also
    verifies server-side `created_by` stamping),
  - `test_post_schema_mutation_returns_409_on_stale_fingerprint`,
  - `test_post_schema_mutation_returns_422_on_duplicate_name`
    (against the core "Number" field),
  - `test_post_schema_mutation_returns_409_on_locked_version`
    (covers Save-As + sibling success on the unlocked version),
  - `test_post_schema_mutation_returns_409_on_stale_draft_etag`,
  - `test_post_schema_mutation_rejects_change_type_in_phase_2`
    (asserts the `available_in_phase: Phase 3` details key),
  - `test_post_schema_mutation_emits_audit_log` (selects
    `user_action_log` by action `project_version_custom_field_add`
    and asserts the audit_payload keys).

**Gates green:** `make lint`, `make typecheck`, backend pytest
(169 passed; 162 before P2.2 + 7 new).

**Notes for the next visitor:**

- The route uses `user.id.hex` as `actor_user_id`. UUID hex string
  is what existing audit log rows store; if MCP starts attributing
  schema mutations to a non-user actor (e.g. background job),
  decide on a separate convention then.
- The no-op short-circuit on `setDescription` to the same value is
  deliberate — it skips the draft upsert and the audit-log row.
  Other mutation kinds produce a structurally different
  `next_body` so the equality check fires only for true no-ops.
- The audit details payload is the raw `audit_payload` returned by
  `apply_schema_mutation`. P2.3 (MCP) and P2.8 (acceptance tests)
  both read these fields; do not rename keys without updating both
  surfaces.
- Test `test_post_schema_mutation_returns_409_on_locked_version`
  documents the recovery flow (Save-As to the unlocked version
  succeeds). This is the editor-mode mirror of save-versioning.md
  §"locked-version routing"; P2.5+'s frontend conflict UI should
  surface a Save-As affordance when this 409 lands in the popover.

### P2.3 (2026-05-24) — Backend: MCP `*_custom_field` write tools

**What landed:**

- `backend/features/mcp/server.py` — five new MCP tools:
  `add_custom_field`, `rename_custom_field`, `delete_custom_field`,
  `duplicate_custom_field`, `set_custom_field_description`. Each
  tool builds the typed `FieldSchemaMutation` Pydantic model from
  its args via `_build_schema_mutation` (centralizes
  `ValidationError → validation_error fatal` translation), then
  delegates to `_apply_mcp_schema_mutation_with_audit` which
  resolves the token, gates on `project:write`, dispatches through
  `apply_schema_mutation_to_draft` with `updated_via='mcp'` and
  `request=None`, and translates `HTTPException` via
  `raise_http_exception_as_mcp_error` with the
  `_SCHEMA_MUTATION_RECOVERABILITY` per-code map (pinned to the
  P2 ADR).
- `backend/features/project_document/audit.py` — `log_document_action`
  accepts `request: Request | None`. MCP callers pass `None`; the
  audit row stores `NULL` for `ip_address` / `user_agent`.
- `backend/features/project_document/drafts.py` —
  `apply_schema_mutation_to_draft` gained `updated_via:
  Literal["browser", "mcp"] = "browser"` (threaded through
  `repository.upsert_draft` and into the audit details), and its
  return type changed to `tuple[BaseModel, dict[str, object]]` so
  MCP tools can read `cleared_row_count` from the audit payload
  for `delete_custom_field`. The REST route now discards the
  audit payload (`response, _ = apply_schema_mutation_to_draft(...)`).
- `backend/tests/test_mcp_custom_fields.py` — one combined
  `test_mcp_custom_field_tools_full_surface` async test (single
  test per FastMCP instance — `StreamableHTTPSessionManager.run()`
  is single-shot). Builds a **fresh** FastMCP via
  `build_mcp_server()` so the new test stays isolated from the
  module-level `phn_mcp` consumed by `test_mcp.py`. The single
  test phases through: (1) add round-trip + server-stamped
  `created_by`, (2) stale fingerprint → `refresh`, (3) duplicate
  name → `fatal`, (4) rename preserves `cf_*` id, (5)
  `set_custom_field_description` round-trip, (6) duplicate
  produces independent def, (7) delete returns
  `cleared_row_count=1` against a populated row; viewer-token
  scope rejection in a second session; audit-log assertions
  outside the MCP context confirming `updated_via='mcp'` and
  `NULL` IP / user-agent.
- `docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md` —
  security-checkpoint paragraph filled in (no blocking findings).

**Gates green:** `make lint`, `make typecheck`, backend pytest
(170 passed; 169 before P2.3 + 1 new combined MCP test).

**Notes for the next visitor:**

- **MCP edit-lease scope.** The Phase-2 minimum-viable lease is
  the `updated_via='mcp'` channel — it tags the draft row plus
  the audit log so a browser-side draft-summary surface can react.
  Richer lease semantics (a real `lease_id`, expiration window,
  Browser-visible "MCP editing" indicator UI, mutual exclusion
  between browser + MCP writes inside the lease window) are
  **deferred** to a follow-up plan. Search for `updated_via` to
  find the integration points.
- **Two MCP test files coexist** because the second test (this
  one) builds a fresh FastMCP via `build_mcp_server()` and
  routes through that fresh ASGI app at `http://127.0.0.1:8000/`
  (no `/mcp/` prefix; the standalone app isn't mounted under
  `/mcp`). The token system is shared via the DB so cross-test
  state is consistent. The pytest-asyncio session-scoped-loop
  alternative was tried first and failed on the anyio cancel
  scope (cross-task exit); the fresh-MCP approach is simpler and
  test-isolated. If a third MCP test file is needed later, do
  the same — don't reuse `phn_mcp.session_manager`.
- **`build_mcp_server(allow_env_token=False)`** is the right
  call for tests — the env-token path is for local dev only.
- **Tool signatures.** All five tools take optional `if_match`
  and `if_match_version` kwargs. MCP clients pass the value they
  received from the most recent `get_table` / draft fetch. The
  draft pipeline rejects on stale etag with structured
  `draft_etag_mismatch` / `version_etag_mismatch`, both mapped
  to `recoverability: refresh`.
- **Audit row distinguishes browser vs MCP** via
  `details["updated_via"]`. If a future surface needs to filter
  the action log by channel, query
  `details->>'updated_via' = 'mcp'`.

---

## Out of scope (Phase 3+)

These belong to subsequent plans, not Phase 2:

- `single_select` custom fields and the per-field option-list
  lifecycle under `single_select_options["<table_path>.<cf_id>"]`
  (Phase 3 — plan-16).
- The full duplicate flow for `single_select` sources (deep-copy
  option list with fresh option ids) — Phase 3.
- `changeType` mutation + preflight + "convert anyway" dialog
  (Phase 3 — US-CF-4).
- `formula` custom fields, the grammar + AST + evaluator parity
  corpus, and the read-overlay computed shape (Phase 4 —
  US-CF-8, plan-13 §4.4).
- Fan-out to ERVs / Pumps / Fans / Thermal Bridges — the
  contract abstraction from plan-14 P1.2 already supports them;
  Phase 5 (plan-18+) wires them up.
- Granular per-field permissions (deferred — D9). Editor login
  remains the only gate on schema mutations in Phase 2.
- Splitting the legacy single-select option editor into its own
  `editOptions` mutation kind — kept on the `schemaMutation`
  variant as `before` / `after` / `cellWrites` slots in Phase 2;
  the cleanup happens in Phase 3 when option-list lifecycle is
  formalized.

## Open questions

None at plan-draft time. The architectural questions for Phase 2
were closed in plan-13 §3 (D5 duplicate-name rules, D7 popover
surface, D10 duplicate + description in v1, D12 cf_* identity,
D15 typed schema-mutation DTOs, D16 immediate draft validation).
The structured-error taxonomy is fixed in the P2.0 ADR.

If an implementation question surfaces — most likely candidates
are: (a) whether to ship the MCP edit-lease primitive in P2.3 or
defer to the first `patch_draft` write tool, (b) whether the
single-select option editor's WriteOp should split now or wait
for Phase 3, (c) any divergence between the chosen Radix menu
primitive and the Shift+F10 keyboard contract — raise it in chat
and amend this plan in place before continuing. Do not silently
make the call inside a sub-phase PR.
