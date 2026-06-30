# MCP Write-Loop — PRD / behavior contract

DATE: 2026-06-30
TIME: 14:40 EDT
STATUS: Proposed — not yet implemented. Decisions below are accepted (from the
        2026-06-30 MCP review); the phase plans are proposals pending build.
AUTHOR: Claude (Opus 4.8) with Ed May
SOURCE: planning/code-reviews/2026-06-30/mcp-review.md §5

## 1. Problem

The MCP server can read everything and can *write* the two relational-geometry
surfaces (envelope, apertures) plus custom-field DDL and attachments — all of
which mutate a **draft**. But:

1. **No flat-table writes.** `replace_table` is registered as an
   always-rejecting stub (`mcp_write_deferred`). It is the only write path for
   **14 of 17 project-document tables** — `rooms`, `space_types`,
   `thermal_bridges`, `pumps`, `fans`, `ventilators`, `appliances`,
   `electric_heaters`, `hot_water_heaters`, `hot_water_tanks`, and the four
   `heat_pumps_*` tables. An agent literally cannot edit a Room or a heat pump.
2. **No commit/discard.** There is no `save_draft` / `discard_draft` MCP tool,
   so even the writes that *do* work (envelope/aperture/custom-field) dead-end
   in the draft — a human must open the browser and Save.

Net: the MCP write loop is broken end-to-end. This blocks the exact use cases
PRD §10.1 names as MCP's reason to exist ("list every Room with occupancy > 4 …
update every equipment spec … then persist").

## 2. Write-architecture investigation (the basis for the decision)

Read `features/project_document/routes.py`, `tables/registry.py`, and the
envelope/aperture command routes. Findings:

- The PRD's original **JSON-Patch** write vision (`update_document`) **never
  shipped.** There is no JSON-Patch write path anywhere — browser or MCP
  (`grep json_patch|apply_patch|patch_draft` is empty).
- What shipped is a **hybrid the browser uses every day**:

  | Write surface | Mechanism | REST route | Tables |
  |---|---|---|---|
  | Semantic commands | domain command → validated service | `POST /draft/envelope/commands`, `POST /apertures/command` | `assembly_segments`, `project_materials`, `apertures` (3) |
  | Custom-field DDL | typed `FieldSchemaMutation` | `POST /draft/tables/{t}/custom-fields:mutate` | field-config tables |
  | **Generic whole-table replace** | replace rows wholesale, `draft_etag`-guarded, `:preview-replace` cascade dry-run | **`PUT /draft/tables/{name}`** → `replace_table_slice` | the other 14 |

- `save_draft` / `save_draft_as` / `discard_draft` / `patch_version` (project
  metadata) / `get_project_diff` all already exist as REST routes + service
  functions. MCP just doesn't wrap them.
- **Investigated 2026-06-30 (resolves Q1):** `replace_table_slice`
  (`drafts.py:48`) has **no allow-list and rejects no table** — it accepts all 17
  registered tables and calls `contract.apply_replace`. There is no `replaceable`
  flag. Each table's `replace_request_model` (`extra="forbid"`) + a full
  `validate_document` pass is the only guard. The 3 "semantic" tables have real,
  purpose-scoped replace models (`assembly_segments` = evidence fields only;
  `project_materials` = full validated rows; `apertures` = full validated
  `ApertureTypeEntry` list), and **the browser already PUTs `/draft/tables/
  apertures`** (`frontend/.../apertures/api.ts:28`) — generic replace and the
  command routes coexist by design.

## 3. Decisions (accepted)

1. **Finish `replace_table`** (not superseded — it is the browser's own generic
   write and the only write path for 14/17 tables). Wire the stub to the
   existing `replace_table_slice` service; reuse its etag concurrency and the
   `:preview-replace` cascade dry-run. Thin wrapper, no new infrastructure.
2. **Add `save_draft` + `discard_draft`** MCP tools (wrap existing services).
   Together with #1 this closes the loop: replace edits the draft, save commits.
3. **Kill `update_document` (JSON-Patch).** Dead architecture; whole-table
   replace won. Remove from `llm-mcp-schema.md`.
4. **`query_table` is out of scope here** — it is a *read* ergonomics item
   (server-side filtering vs. whole-table `get_table` pulls), tracked separately
   in the review backlog. Not part of the write loop.
5. **Docs/discoverability is in scope and non-optional** (see §6).

## 4. Behavior contract for the new write tools

All new tools follow the established MCP helper pattern (`current_token` →
`project_access_or_error(..., scope)` → call service in `try/except
HTTPException` → `raise_http_exception_as_mcp_error` with a recoverability map).
All gate on `project:write`. All physical quantities stay SI-canonical.

- **`replace_table(project_id, version_id, table_name, rows, draft_etag? |
  base_version_etag?)`** → updated `RegisteredTableResponse` envelope.
  - Calls `replace_table_slice`. `draft_etag` → `If-Match`; `base_version_etag`
    → `If-Match-Version` (lazy-draft create). Mirrors the browser PUT exactly.
  - **No table allow-list / no rejection** (Q1 resolved — see §2). Pass through to
    `replace_table_slice` for **all** registered tables, exactly like the browser
    PUT. The per-table `replace_request_model` (`extra="forbid"`) +
    `validate_document` already constrain what each table accepts — e.g.
    `assembly_segments` only takes evidence fields, so a structural edit there is
    rejected as a validation error, not a special MCP guard. **Do not** reject the
    semantic tables; that would break parity (the browser replaces `apertures`).
  - **Read-before-replace contract.** `replace_table` is a *whole-table* replace:
    an agent must `get_table` first and submit the full intended row set, or it
    will drop rows. Document this in the tool docstring and `context/mcp.md`.
  - **Command-vs-replace guidance (docs, not code).** For envelope/aperture
    *structural* edits the command tools (`apply_envelope_command` /
    `apply_aperture_command`) are the preferred, easier-to-express surface;
    `replace_table` is the lower-level whole-table primitive. State this in
    `context/mcp.md`.
  - Recoverability: `version_locked`, `draft_etag_mismatch`,
    `version_etag_mismatch`, `project_version_not_found` → `refresh`; validation
    failures → `fatal`.
- **`preview_replace_table(...)`** (optional, Phase 2) → `TableReplacePreviewResponse`.
  Wraps `preview_table_replace` so an agent can see the dependent-link cascade
  (e.g. deleting a heat-pump row other rows link to) before committing.
- **`save_draft(project_id, version_id, if_match?)`** → `SaveDraftResponse`.
  Wraps `save_draft`; `if_match` = version_body_etag taken at draft open.
  Locked version → `409 version_locked` (recoverability `refresh`, agent should
  `save_draft_as`). **Token re-check on commit** (§8.5) is satisfied by
  `current_token`, which re-resolves the active token by id and fails closed on
  revocation — note this explicitly in the tool and a test.
- **`discard_draft(project_id, version_id)`** → `DiscardDraftResponse`. Wraps
  `discard_draft`. Discarding when no draft exists is a benign no-op result, not
  an error.

Phase 3 (round-out parity, lower priority):

- **`save_draft_as` / `create_version`** → wraps `save_draft_as`
  (`POST /draft/save-as`); the agent supplies a name (+ optional kind). This is
  the locked-version escape hatch and the "save as new version" primitive.
- **`update_project`** → wraps `patch_version` (`PATCH ""`); relational metadata
  (name, lock, …) for REST parity.
- **`diff_versions`** → wraps `get_project_diff` (`GET /diff`); the higher-value
  read add Ed named ("diff cert rounds 1 vs 2"). (Read, but cheap and lands the
  parity story; can move to the read backlog if it bloats this feature.)

## 5. Concurrency / lease / safety notes

- Etag rules are the shared draft-etag model in `save-versioning.md` §8.5
  ("Whole-draft ETag for table replacement" — `replace_table` consumes and bumps
  the same `draft_etag` as the semantic writes). No table-scoped concurrency.
- **MCP edit-lease (§8.5) — investigated 2026-06-30 (resolves Q2): the lease is
  UNBUILT.** It exists only as a planned primitive in comments (`drafts.py:146`
  "lease semantics (lease_id, expiration window …)"; `mcp/helpers.py:279`). There
  is no lease table, no acquire/release, no `lease_id`. `updated_via="mcp"` is
  written to the draft row + audit log but **`ProjectDraftSummary` does not even
  expose it**, and the **frontend has zero** lease/indicator/banner/write-freeze
  code.
  - **Not a blocker — correctness is already covered by the shared `draft_etag`.**
    MCP writes land in the *same* draft row as the issuing editor's browser (draft
    PK `(version_id, user_id)`; the MCP token acts as `issued_by_user_id`). After
    an MCP write, the browser's next write gets `409 draft_etag_mismatch` and must
    reload — no lost writes. The only gap is **proactive awareness** (the browser
    won't passively notice until its next write fails or it re-polls). Low risk
    for a 2-person sequential team.
  - **Deferred, with a cheap middle option.** Full lease (lease_id / expiry /
    control-freeze + Review-Reload banner) is a separate follow-up. A lighter
    partial step — surface `updated_via` (+ last-writer/timestamp) on
    `ProjectDraftSummary` so the browser shows a passive "draft updated by an MCP
    agent — reload" hint on its existing poll — needs no lease table. Both are
    **out of scope for this feature**; revisit when a real collision is reported.

## 6. Docs & discoverability (in scope, woven through every phase)

The MCP surface drifted from its spec precisely because tools shipped without
doc updates. This feature fixes that and hardens against recurrence:

- **`context/mcp.md` (new, Phase 1):** canonical live tool inventory grouped by
  area, the **scope matrix** (which scope each tool needs), the **draft→save
  lifecycle** an agent must follow, the structured-error envelope +
  recoverability, the `ToolError`-JSON-in-message caveat, and a pointer to token
  issuance. Updated in the **same PR** as every tool change.
- **Drift guard (Phase 4):** a test asserting the registered `@mcp.tool()` set
  matches the documented inventory (or generate the doc list), so the doc cannot
  silently fall behind the code again.
- **CLAUDE.md dispatch row (Phase 1):** add a "writing/reviewing **MCP tools**"
  row to the working-by-area table → `context/mcp.md` (+ `llm-mcp-schema.md`).
  There is currently **no** MCP row, which is itself a discoverability gap.
- **Reconcile `llm-mcp-schema.md` (Phase 4):** remove `update_document` /
  JSON-Patch; demote the §10.3 "initial tool surface" list to "original intent —
  see `context/mcp.md` for the live surface"; keep `query_table` only as a read
  backlog note; state that `replace_table` is the live generic write.
- **Fix `save-versioning.md` §8.2/§8.3 (Phase 4):** replace the stale
  "JSON-Patch ops sync to the draft buffer / `unguarded_array_patch`" language
  with the actual whole-table-replace mechanism. §8.5 is already correct.
- **Server `instructions=` string + tool docstrings (Phases 1–2):** make them
  agent-actionable — explain that writes land in a draft and must be saved, the
  read-then-write-then-save pattern, and the scope each tool needs. These are
  in-band discoverability (the MCP client reads them).
- **Smoke hardening (Phase 4):** tighten `smoke_mcp_read.py` to assert the full
  registered tool set (catch silent drops); add a write round-trip smoke once
  writes land.

## 7. Out of scope / related (not this feature)

- `query_table` (typed filtered read) — read backlog, separate.
- `update_document` (JSON-Patch) — **killed**, not built.
- Catalog writes via MCP — deferred per `llm-mcp-schema.md`.
- Phase-5 token-scope intersection — separate known limitation.
- `render.yaml` prod MCP-URL drift verification — ops item, tracked in the
  review §3.2.4.

## 8. Acceptance

- An MCP agent can: read a flat table → `replace_table` rows → read back the
  bumped draft → `save_draft` → see the change in the saved version. And
  `discard_draft` drops a dirty draft.
- `replace_table` rejects the 3 semantic-owned tables with a redirect message.
- Locked-version save returns `version_locked`; `save_draft_as` (if built)
  escapes it.
- Revoked token fails closed on the commit step.
- `context/mcp.md` exists and matches the registered tool set (drift-guarded);
  `llm-mcp-schema.md` and `save-versioning.md` no longer describe JSON-Patch
  writes; CLAUDE.md routes MCP work.
- Backend tests cover the new tools; `make ci` green.
