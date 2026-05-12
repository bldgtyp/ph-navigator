---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
RELATED: context/PRD.md §10, context/user-stories/50-settings-ops-llm.md
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
| **JSON-Patch writes** | LLM expresses edits as a list of ops; surgical, idempotent with key. |
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
audit-logged. A token with `project:write` scope can mutate only its
own `project_id`; a token with read-only scopes cannot call mutating
tools. All tool calls are attributed to the issuing editor. Mutating
tools obey the MCP/browser edit-lease rules in §8.5.

Tool surface (initial):

```
list_projects()                      → token-visible projects
                                        (v1 project-scoped token returns one)
get_project(project_id)              → metadata + version list
list_versions(project_id)            → [{id, name, kind, locked, ...}]
get_document(project_id, version_id) → full project JSON + version_body_etag
                                       + current draft_etag if present
update_document(project_id, version_id, json_patch, draft_etag | base_version_etag)
                                     → applies JSON-Patch to current draft,
                                       returns new draft etag
replace_table(project_id, version_id, table_name, rows, draft_etag | base_version_etag)
                                     → replace one table in the draft;
                                       stale etag returns 409
query_table(project_id, version_id, table_name, query)
                                     → filtered subset of one table using
                                       a typed query object, not expression text
diff_versions(project_id, from_version_id, to_version_id)
                                     → structured diff
list_catalog(table)                  → catalog browse
get_catalog_record(table, record_id) → record + version list
create_version(project_id, source_version_id, name, kind?)
                                     → save-as-new
save_draft(project_id, version_id)   → flush token owner's draft to version
discard_draft(project_id, version_id)
                                     → discard token owner's draft
update_project(project_id, patch)    → edit relational project metadata
download_project_json(project_id, version_id)
                                     → project JSON (via signed URL or inline)
download_table_json(project_id, version_id, table_name)
                                     → table JSON
list_hbjson_files(project_id)        → metadata only (file list)
get_hbjson_file_url(project_id, hbjson_file_id)
                                     → signed R2 URL + expires_at
                                       (LLM can fetch the body itself if needed)
create_asset_upload_intent(project_id, asset_kind, filename, content_type,
                           size_bytes, content_hash)
                                     → asset id + signed PUT URL + expires_at
complete_asset_upload(project_id, asset_id)
                                     → uploaded asset metadata
get_asset_url(project_id, asset_id)  → signed GET URL + expires_at
attach_asset(project_id, version_id, asset_id, target_path)
                                     → JSON-Patch attach into token owner's draft
detach_asset(project_id, version_id, asset_id, target_path)
                                     → JSON-Patch detach from token owner's draft
```

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

Browser behavior for MCP failures follows the same minimal rule set:
release any MCP edit lease, preserve local browser edits, keep the
browser from silently applying failed/partial MCP state, and surface a
concise banner or toast with the request id when the open project/draft
was affected.

`query_table` uses a constrained Pydantic query model. It does **not**
accept SQL-like text, JSONPath, Python expressions, or any other
string language that could be evaluated. The query shape is intentionally
small and LLM-friendly:

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
      "row_id": "win_...",
      "row_target": {
        "type": "table_row",
        "table_name": "windows",
        "row_id": "win_..."
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

`context/` is the stable reference layer. It should stay tight:
canonical product/architecture docs live here; dated working plans and
implementation phasing stay under `docs/plans/`.

Current hand-written docs:

```
context/
├── README.md                       reading order and doc routing
├── ENVIRONMENT.md                  local environment / command card
├── PRD.md                          concise canonical PRD
├── TECHNICAL_REQUIREMENTS.md       router for detailed contracts
├── technical-requirements/         on-demand technical contracts
├── TECH_STACK.md                   stack and persistence decisions
├── DATA_TABLE.md                   shared <DataTable> component contract
├── UI_UX.md                        UI narrative companion
├── USER_STORIES.md                 story routing + vertical-slice phasing map
├── user-stories/                   split canonical story bodies
├── GLOSSARY.md                     canonical PHN-V2 terms
└── schemas/
    ├── project-document-v1.json    JSON Schema (auto-generated)
    ├── material-v1.json
    ├── window-type-v1.json
    └── ...
```

Planned generated / implementation-adjacent docs, added only when the
corresponding code exists: `api.md`, `mcp.md`, `operations.md`,
`error-codes.md`, `llm-cookbook.md`, and schema files under
`context/schemas/`.

These docs are deliverables in the same way as code. CI should verify
generated schemas are in sync with Pydantic models once schema
generation exists.

### 10.5 Schema versioning — open-old-projects safety

**The hard guarantee:** a project version that was openable when it was
saved must remain openable forever. No release of PHN-V2 ships if it
breaks reads of any prior document `schema_version`.

Mechanisms — all in place from day 1, even when there is only one
schema version:

1. **`schema_version` integer in every document body.** Set at save
   time. Frozen on the row from then on.
2. **Forward-only upgrade shims.** Pure functions, one per version
   step: `upgrade_v1_to_v2.py`, `upgrade_v2_to_v3.py`, ... On read, if
   `body.schema_version < CURRENT`, apply shims in sequence and return
   the upgraded view. **The original row is not mutated.** Lazy
   migration — only when the user explicitly Saves does the new body
   land at `CURRENT`.
3. **Read-safe-mode fallback.** If a shim raises during read, the API
   still returns a response: `{ schema_version: N,
   schema_version_unsupported: true, body: <raw> }`. The frontend
   renders a read-only "this project version is from an older format
   we couldn't fully migrate — please contact admin" view that **still
   permits JSON download**. Users never lose access to their data
   because of a code bug.
4. **Golden-file corpus.** `tests/document_schema/fixtures/v1/*.json`,
   `v2/*.json`, etc. CI runs every fixture through every applicable
   shim chain on every PR. New shims must produce identical results
   to the previous CI run on the same corpus, and round-trip through
   Pydantic validation.
5. **Production-corpus drill before bumping schema_version.** Before
   merging a new `CURRENT`, a CI job runs the new shim against every
   live project body in a staging snapshot. Any failure blocks the
   merge.
6. **Deprecation marker on schema_version, never removal.** A version
   N's shims are kept indefinitely. We do not "drop support for old
   schema versions" — there's no upside, only risk.
7. **Pydantic models per schema version.** `ProjectDocumentV1`,
   `ProjectDocumentV2`, ..., living side-by-side. Code that reads
   "current" pins to the latest; code that handles raw old bodies
   uses the matching version model.

This is the **only** migration path for project-side schema. No
ALTER TABLE for project entities. All evolution flows through the
shim chain.
