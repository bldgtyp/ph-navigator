---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
RELATED: context/PRD.md §10, planning/archive/user-stories/50-settings-ops-llm.md
---

# PH-Navigator V2 — LLM / MCP / Schema Requirements

This file preserves implementation-level requirements that were formerly
embedded in `context/PRD.md`. Load it on demand when touching this surface;
do not make it part of default startup context.

## 10. LLM-friendliness — designed in from day 1

### 10.1 Why this matters

Ed already drives bulk operations on PHN data via Claude (Code, Desktop)
and will increasingly want to: "in Project Foo, update every Material in
the Wall A assembly to use Walltite ECO version 2026"; "list every room
in Project Bar with occupancy > 4"; "diff the cert submit between
rounds 1 and 2 and summarize what changed for the certifier response."
Building this in retroactively is expensive; building it in from the
start is cheap.

### 10.2 What makes V2 LLM-friendly

| Property | Implementation |
|---|---|
| **Whole-document fetch** | One GET returns the full project. LLM has full context. |
| **Stable IDs** | Every entity has a ULID; LLM can reference precisely across edits. |
| **JSON Schema published** | LLM can validate edits before submitting; server rejects invalid. |
| **Draft writes** | LLM writes use semantic command tools or whole-table `replace_table`, guarded by draft/version etags. |
| **OpenAPI spec** | LLM tools can introspect the API. |
| **Structured errors** | Validation errors include JSON Pointer paths and machine-readable codes. |
| **Idempotency keys** | LLM retries don't double-apply. |
| **Hand-written context docs** | `context/` folder targeted at LLMs (see §10.4). |
| **MCP server** | First-class tool surface for Claude clients. |

### 10.3 MCP server

Ships in v1 and is **read/write capable from day 1**. Lives at
`backend/features/mcp/`. Thin wrapper around the REST API; it uses the
same service layer and `require_project_access(project_id,
mode='view'|'edit')` dependency as REST routes.

MCP auth is **not anonymous**, even though normal project URLs are
public-readable in the browser. MCP clients authenticate with
project-scoped bearer tokens from `mcp_tokens` (§6.1). Tokens are issued
by logged-in editors, shown once, stored hashed, revocable, and
audit-logged. Write-capable project tokens include `project:read` plus
`project:write`; write-only project tokens are rejected. A token with
`project:write` scope can mutate only its own `project_id`; a token
with read-only scopes cannot call mutating tools. All tool calls are
attributed to the issuing editor. Mutating tools obey the MCP/browser
edit-lease rules in §8.5.

**The authoritative shipped MCP tool inventory is `context/mcp.md`.** Do
not maintain a second tool roster here — the one that used to live in
this section (original planning-era tool names/signatures) had already
drifted from the live surface and has been removed. Read `context/mcp.md`
for the current tool list, request/response shapes, and per-tool scope
requirements.

Custom-field MCP rules:

- Cell writes to custom fields go through the existing `patch_draft` /
  table-row tools unchanged — no new write surface is needed for
  values. Only schema mutation gets dedicated tools.
- Each schema-mutation tool requires `project:write` and the same
  draft-edit-lease semantics as browser writes (§8.5). The token's
  user id is the `created_by` for added/duplicated fields.
- Structured error codes the Phase 2 implementation must return
  (mapped onto the common error envelope described in §10.3):
  `custom_field_duplicate_name`, `custom_field_stale_schema_fingerprint`,
  `custom_field_invalid_field_id`, `custom_field_illegal_type_conversion`,
  `custom_field_formula_parse_error`, `custom_field_formula_cycle`, and
  `custom_field_schema_write_unauthorized`.
- Custom-field schema mutations are validated immediately on accept,
  not deferred to Save; the draft never accumulates malformed
  custom-field state. See `save-versioning.md` §8.3.

Tools return Pydantic-validated structured results.

MCP and REST share one structured-error baseline, but V2 planning does
not predefine an exhaustive error taxonomy. Before the first MCP write
tool ships, the backend must have a common error envelope with at least
`code`, `message`, `request_id`, and a coarse `recoverability` value.
Route/tool-specific `details`, `next_action` hints, and final code names
are defined as the implementation lands. MCP tools should return
recoverable domain failures in this structured shape where the protocol
allows; reserve hard protocol/runtime failures for malformed tool calls,
unhandled server errors, or infrastructure failure.

TB-04b implementation note: FastMCP domain failures are currently raised
as `ToolError` with the structured envelope JSON-encoded in the error
message string. MCP clients that need machine-readable error details
should JSON-decode that message. Replace this with first-class
structured error content if the SDK exposes a cleaner stable hook before
the TB-17 write path ships.

Browser behavior for MCP failures follows the same minimal rule set:
release any MCP edit lease, preserve local browser edits, keep the
browser from silently applying failed/partial MCP state, and surface a
concise banner or toast with the request id when the open project/draft
was affected.

**Backlog / not yet built.** `query_table` does not exist in the shipped
tool surface (`context/mcp.md`) — `get_table` (whole-table read) is the
only read primitive today. The design below is kept as the target shape
for when a typed filtered-read tool is built: a constrained Pydantic
query model that does **not** accept SQL-like text, JSONPath, Python
expressions, or any other string language that could be evaluated. The
query shape is intentionally small and LLM-friendly:

```
{
  "query": "optional substring / fuzzy text search",
  "where": {
    "and": [
      {"field": "frame_type_id", "op": "is_empty"},
      {"field": "orientation", "op": "in", "value": ["north", "east"]}
    ]
  },
  "sort": [{"field": "area_m2", "dir": "desc"}],
  "limit": 50,
  "offset": 0
}
```

Supported `where` nodes are `and`, `or`, and simple field comparisons.
Initial operators are `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`,
`contains`, `is_empty`, and `is_not_empty`. Fields are validated against
the table schema / field registry before execution; operators are
validated against the resolved field type; `limit` has a server-side
default and hard maximum. Results return compact row summaries plus
stable row targets for follow-up calls:

```
{
  "matches": [
    {
      "row_id": "apt_...",
      "row_target": {
        "type": "table_row",
        "table_name": "apertures",
        "row_id": "apt_..."
      },
      "summary": {"name": "W-101", "area_m2": 2.4}
    }
  ]
}
```

This follows the same broad pattern observed in the Ladybug Tools MCP:
domain-specific search tools expose explicit typed parameters, simple
substring search, compact reusable targets, and strict input validation
instead of arbitrary query-language strings.

Not included in v1 (defer): catalog writes via MCP. Catalog browsing is
read-only through MCP; catalog edits stay in the web UI/admin surface
until there is a concrete agent workflow and review policy for changing
the global library. All project-document writes, project metadata
writes, and project asset attach flows are MCP-callable in v1.

### 10.4 Documentation `context/` (LLM-targeted)

`context/` is the stable reference layer designed for both human and
LLM use: canonical product/architecture docs live here; dated working
plans and implementation phasing stay under `planning/archive/dated/`.
**`context/README.md` is the live, maintained index and router** — read
that for the current file tree and reading order rather than
maintaining a second copy in this doc.

Runtime JSON Schemas are served from `/api/v1/schemas/...` and OpenAPI from
`/api/v1/openapi.json`; static schema snapshots under `context/schemas/`
can be added later if CI starts checking committed generated artifacts.

### 10.5 Schema versioning — open-old-projects safety

**The hard guarantee** (live in production): a project version that was openable
when it was saved must remain openable forever. No production release
ships if it breaks reads of any prior document `schema_version`.

**Current state.** `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` is `6`
(`backend/features/project_document/document.py`) and has bumped
several times since the pre-launch baseline. Every bump uses the
project-document upgrade lane: a read-time forward-only shim chain
(live — see `save-versioning.md`), committed fixtures, an audit CLI
drill, and the schema-bump checklist in
`planning/features/beta-schema-evolution/schema-bump-checklist.md`.

Mechanisms:

1. **`schema_version` integer in every document body.** Set at save
   time. Frozen on the row from then on. In MVP this is metadata for
   strict validation and future migrations.
2. **Raw recovery download.** Project JSON download returns the raw
   saved body for the selected version, including bodies the current app
   cannot validate. This is the MVP safety valve.
3. **Typed surfaces fail closed.** Table reads/writes and draft writes
   remain current-schema validation-gated. Invalid or unsupported bodies
   are recoverable, not editable.
4. **Document-level read-safe aid.** If a shim raises during read, or if the
   migrated body fails current-schema validation, document-level API
   reads still return a response: `{ schema_version: N,
   schema_version_unsupported: true, body: <raw> }`. In Phase 1 this
   applies to `GET /document` and the editor `GET /draft` summary;
   typed table reads/writes remain validation-gated. The frontend
   renders a read-only "this project version is from an older format
   we couldn't fully migrate — please contact admin" view that **still
   permits JSON download**. This is useful in Phase 1 but is not the
   full schema-migration product guarantee.
5. **Forward-only upgrade shims.** Pure dict-to-dict functions, one per
   version step. On read, if `body.schema_version < CURRENT`, apply shims in
   sequence and return the upgraded view. **The original saved version row is
   not mutated.** Lazy migration happens only when the user explicitly saves a
   draft or saves as a new version.
6. **Golden-file corpus.** `backend/tests/project_document_schema/fixtures/v1`,
   `v2`, etc. CI runs every fixture through every applicable shim chain on every
   PR. New shims must preserve old fixture inputs, produce committed upgraded
   snapshots, and round-trip through current Pydantic validation.
7. **Corpus drill before bumping schema_version.** Before merging a new
   `CURRENT`, run `scripts/check_project_document_upgrade.py` against fixtures
   and the available local/staging project bodies. Any failure blocks the bump.
8. **Deprecation marker on schema_version, never removal.** A version
   N's shims are kept indefinitely. We do not "drop support for old
   schema versions" — there's no upside, only risk.
9. **No per-version Pydantic model stack.** Upgrade steps operate on raw dicts
   and validation happens once against the current `ProjectDocument` model after
   all steps apply. Do not maintain `ProjectDocumentV1`, `ProjectDocumentV2`,
   ... side by side unless a future real-data recovery case proves the smaller
   lane insufficient.

This is the **only** migration path for project-side schema. No
ALTER TABLE for project entities. All evolution flows through the
shim chain.

### 10.6 Field-config read surface

Project-document tables that opt into the field-config registry
advertise their schema inline in the document body
(`tables.<name>.field_defs`) so an MCP client reading the document can
render and write field values — built-in or custom — without out-of-
band knowledge. See `data-model.md` §6.6 for the envelope and
`TableFieldDef` shape.

Contract gates for the read surface (v3):

- The published `ProjectDocumentV1` JSON Schema declares the
  `TableFieldDef` shape as **closed** (every field listed and typed)
  and leaves each row's `custom_values` dict as
  `additionalProperties: true` so user-defined keys plus mutable-type
  built-in keys are accepted without a per-project schema. There is
  no per-project schema endpoint in v1.
- Project-JSON downloads include each table's `field_defs` array
  inline at `tables.<name>.field_defs`. Each row's `custom_values`
  dict is keyed by the same `field_key`s that appear in
  `field_defs[*].field_key` — built-in slugs (`"number"`, `"name"`,
  …) for mutable-type built-ins and `cf_*` ids for custom fields.
- Locked-type built-in values (e.g. Rooms' `floor_level`,
  `icfa_factor`; Pumps' `device_type`, `phase`, `link`) remain typed
  Pydantic columns on the row, not in `custom_values`. The published
  schema documents which keys live in which slot.
- Formula computed values, when present, are inlined under a separate
  per-row `computed` overlay keyed by the same `field_key` (see
  `data-model.md` §6.6.6). Inbound writes that include `computed`
  are rejected or stripped; formula fields remain write-protected
  even though their values are visible in reads.
- Field descriptions are included in `TableFieldDef` downloads and in
  the published schema. Plain text, max 280 chars, no markdown
  rendering in v1.
- Catalog tables do not carry the field-config registry in v1; their
  documents and reads keep their rigid shape.
- **JSON Schema regression on mutable-type built-ins.** Mutable-type
  built-in fields (Rooms' `number`/`name`/`num_people`/
  `num_bedrooms`; Pumps' `tag`/`use`/`manufacturer`/etc.) advertise
  the `custom_values` union shape (`str | int | float | bool |
  null`) rather than tight per-field types. This is the accepted
  trade-off for AirTable-parity field-config editing (plan-31
  §P0.1 / §P2.3). Locked-type built-ins keep their tight types
  unchanged.
