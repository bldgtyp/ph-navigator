---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
RELATED: context/PRD.md §8, context/user-stories/00-foundation-shell.md
---

# PH-Navigator V2 — Save / Versioning Requirements

This file preserves implementation-level requirements that were formerly
embedded in `context/PRD.md`. Load it on demand when touching this surface;
do not make it part of default startup context.

## 8. Save / version model

### 8.1 Mental model — explicit Save / Save As (file-app style)

A project has a list of named **versions**. The user opens one version
at a time. Edits flow into a **session draft** held by the frontend and
mirrored to a server-side draft buffer; they do **not** modify the
version body. To persist, the user explicitly clicks:

- **Save** — overwrite the active version's body with the draft.
- **Save As** — create a new version from the draft, switch active.

This is the Word / Photoshop / classic-desktop-app model. Autosave is a
**crash-recovery backup**, not a persistence step. Closing the browser
with unsaved changes triggers a `beforeunload` warning. On reopen, the
user is offered the recovered draft ("you had unsaved changes from
2026-05-09 14:23 — restore or discard?").

For high-stakes versions (cert submits), the user can **lock** a
version. Save against a locked version returns 409 with a prompt to
Save As. To edit a locked version, the user must Save As into a new
unlocked version.

### 8.2 Operations

| Operation | Effect |
|---|---|
| **Edit** | Mutates frontend in-memory document. Accepted browser/MCP writes sync to the server-side draft buffer. Version body untouched. |
| **Save** | Flush draft to active version body. Lock check: locked → 409 with Save-As suggestion. Clear draft. |
| **Save As** | Create new `project_versions` row from draft body; set as active version. User supplies name. Clear draft. |
| **Discard changes** | Drop draft, reload version body. Confirm dialog. |
| **Switch active version** | If draft is dirty, prompt: Save / Save As / Discard. Then switch. |
| **Lock / unlock** | Toggle `locked` on a version. Lock = save-protected. Unlock requires confirm. |
| **Submit / close** | Save As with `kind='submitted'`/`'closed'`, auto-locked. Lifecycle is metadata on the version. |
| **Delete version** | Soft-delete (`deleted_at`). Cannot delete the active version; switch first. |
| **Rename version** | Update `name`. Allowed even on locked versions (label-only). |

There is no single project-level "lifecycle state." The project's
status is "the kind of its most recent submitted/closed version, if
any." Versions are the unit of state.

### 8.2.1 Denormalized save metadata

Decision confirmed 2026-05-11: denormalized version metadata is owned
by the service layer, not database triggers.

The version-save service is the only code path allowed to insert or
overwrite `project_versions.body`. Repository modules should expose
specific Save / Save As helpers, not generic "update body" functions.

On **Save**, one transaction:

- validates draft body, lock state, and ETags;
- overwrites `project_versions.body`;
- sets `project_versions.schema_version`;
- computes and sets `project_versions.body_size_bytes`;
- sets `project_versions.updated_at` / `updated_by`;
- sets `projects.last_saved_at` to the same timestamp;
- deletes the server-side draft;
- appends the action-log event.

On **Save As**, one transaction:

- validates draft body and ETags;
- inserts the new `project_versions` row with computed
  `body_size_bytes`;
- sets the new row as `projects.active_version_id`;
- sets `projects.last_saved_at` to the same timestamp;
- deletes the source draft;
- appends the action-log event.

Draft patch, view-state changes, status edits, HBJSON uploads, asset
uploads, and catalog edits do not update `projects.last_saved_at`.
Tests must cover that Save / Save As update the denormalized fields and
draft patch does not.

### 8.3 Server-side draft buffer (crash-recovery, not persistence)

```sql
project_version_drafts (
    version_id          UUID NOT NULL REFERENCES project_versions(id),
    user_id             INTEGER NOT NULL REFERENCES users(id),
    body                JSONB NOT NULL,     -- WIP document
    schema_version      INTEGER NOT NULL,
    base_version_etag   TEXT NOT NULL,
                         -- saved version etag when the draft was created
    draft_etag          TEXT NOT NULL,
                         -- changes on every accepted draft mutation
    last_patched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_via         TEXT NOT NULL DEFAULT 'browser',
                         -- 'browser' | 'mcp'
    PRIMARY KEY (version_id, user_id)
)
```

Properties:
- One draft per `(version_id, user_id)`. Different users editing the
  same version each have their own draft (rare in practice; single-user
  expectation per §4). Browser edits and MCP edits issued by the same
  editor token share the same draft for the same version.
- Frontend and MCP write through table replacement, semantic command tools,
  custom-field schema mutations, or other typed service boundaries. The backend
  applies accepted writes to the draft body and is authoritative.
- Drafts are **not** versions: they don't appear in version lists or
  the diff `from`/`to` selectors.
- Save: server reads draft body → writes to version body in one
  transaction → deletes draft.
- Save As: server reads draft body → INSERTs new version → deletes
  draft.
- Discard: deletes draft.
- MCP counterparts are `replace_table` for whole-table draft writes,
  semantic command/custom-field tools for structured draft writes,
  `save_draft`, `save_draft_as`, and `discard_draft`.
- Stale-draft GC: **intended/planned, not yet built.** No scheduled job
  or code path deleting drafts by age was found in
  `backend/features/project_document/`. The design intent (drafts
  untouched for >30 days are deleted by a scheduled job; user is warned
  on reopen if a draft is older than N days) is recorded here as a
  backlog item, not a shipped guarantee.
- Frontend on load: GET draft for active version. If draft exists and
  differs from version body, show recovery prompt. User chooses
  restore (load draft) or discard (delete draft, load version body).
- Opening a project does not create a draft row. The first accepted
  mutation creates the draft lazily from the saved version body and
  records `base_version_etag`.
- Whole-table replacement uses `PUT /draft/tables/{name}` and the shared
  `replace_table_slice` service. Browser and MCP callers send the complete
  table payload or row envelope, guarded by `If-Match` / `draft_etag` after a
  draft exists and `If-Match-Version` / `base_version_etag` for first draft
  creation. Stale etags return 409 and preserve the draft.
- **Immediate draft validation for field-config writes and schema
  mutations.** Cell writes (built-in and custom) and
  `FieldSchemaMutation` ops (see `data-table.md` "Write Pipeline" and
  `data-model.md` §6.6) are validated by the backend at the moment the
  draft mutation is accepted, **not** deferred to Save. The validator
  checks the affected table envelope (rebuilt `{ field_defs, rows }`)
  and whole-document references touched by the change — duplicate
  field names across the registry, `field_key` existence, value
  coercion against each field's declared type, type-conversion
  legality, option-list reference integrity, and formula parse /
  cycle / dependency rules. Rejected mutations do not modify the
  stored draft. Save re-runs full-document validation as a final gate.
- **Read-time forward-only upgrade is the live schema-migration
  mechanism.** Drafts and saved versions tag the body with
  `schema_version: N`; current is `6`
  (`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`,
  `backend/features/project_document/document.py`), up from the
  pre-launch clean-baseline squash. `backend/features/project_document/store.py`
  upgrades a stale `version`/`draft` body at read time
  (`upgrade_document_with_errors` → `upgrade_project_document`); when a
  draft is upgraded, `repository.rewrite_draft_body` persists the
  upgraded body and bumps the draft's `schema_version` / `draft_etag`
  so the stale cached row doesn't keep re-triggering the shim on every
  read. Bodies the upgrade chain cannot bring to the current shape are
  rejected with a structured `invalid_project_document` error on write;
  see §10.5 in `llm-mcp-schema.md` for the golden-fixture / audit-CLI
  discipline that gates each schema bump.

The draft/save state machine is consolidated here in §§8.3–8.6. The
former standalone decision note is archived in `planning/archive/dated/2026-05-14/REMOVED.md`.

### 8.4 Diff

Two diff surfaces, both v1:

- **Version vs version** — pick two versions, see field-level changes
  across all tables.
- **Live vs last save** — while editing the active version, see what's
  changed since the parent version was forked. (Cheap to implement: the
  parent's body is the baseline.)

Diff is computed in the backend from the two JSONB bodies. UI displays
a per-table changed-row list with field-level deltas.

### 8.5 Concurrency

PHN is optimized for sequential editing by a tiny team, but the same
editor may legitimately have multiple browser tabs open against one
project. Example: Window-Frame Element catalog in one tab while the
project Windows builder is open in another, or Rooms in one project
workspace tab and Windows in another. V2 must support this without a
global "takeover" lock.

Implementation:

- **Draft writes:** patches send `If-Match: <draft_etag>` when a draft
  exists, and `If-Match-Version: <version_body_etag>` when creating a
  draft. Mismatch → 409. Client reloads the draft or discards local
  queued edits; v1 does not merge.
- **Save / Save As:** sends `If-Match: <version_body_etag>` taken at draft
  open. Mismatch (someone else saved over the version while this user
  was drafting) → 409 for Save. Save As remains allowed because it does
  not overwrite the source version. Conflict UI: keep my draft as Save
  As / discard my draft / show diff.
- **Same-editor browser tabs are allowed.** A second browser tab opening
  the same project/version loads the same server draft and remains
  editable. Tabs coordinate accepted browser patches and new
  `draft_etag` values through a browser-tab channel (BroadcastChannel or
  equivalent). If a received patch is outside the current tab's active
  UI scope, apply it in memory and continue. If it overlaps the active
  dirty scope, freeze that scope and show a reload/review banner; v1
  does not attempt field-level merge.
- **MCP/browser collision policy.** MCP mutating tools share the token
  issuer's draft, but MCP writes acquire a short draft edit lease. While
  the lease is active, open browser editors show an "MCP editing" visual
  indicator and freeze write controls. After the MCP write completes,
  the browser does not silently merge into an active editor: it shows a
  banner offering Review changes / Reload draft. Read-only navigation
  and viewing remain available during the lease.
- **MCP token revocation.** Revocation blocks the token's next request.
  A request that already passed auth may complete atomically; PHN does
  not promise to cancel an in-flight DB transaction. Any follow-up or
  commit step (for example `complete-upload`, `attach_asset`,
  `save_draft`) must re-check token state and return a structured auth
  error if revoked.
- **Lock while a draft is open.** Locking a version is authoritative
  immediately. Any open browser or MCP draft for that version is
  preserved, but further draft patch and Save requests return
  `409 version_locked`. Browser tabs downgrade to the locked-version
  banner on the next lock-status poll, broadcast, or rejected write.
  The user's exit paths are Save As into a new unlocked version,
  discard, or wait for an explicit unlock.
- **Version switch after dirty-draft Save.** When a user chooses Save in
  the dirty-draft prompt before opening another version, the frontend
  does not switch its current view until the target version body has
  been fetched successfully. If Save succeeds but the target fetch
  fails, the user remains on the saved source version in a clean state
  with a retryable "couldn't open target version" toast.
- **Whole-draft ETag for table replacement.** `replace_table` is not
  table-scoped concurrency in v1. It consumes and bumps the same
  `draft_etag` as other accepted draft writes. If two clients replace unrelated tables
  from the same base ETag, the first wins and the second receives 409.
  The loser must refetch and retry intentionally.
- Locked versions reject draft patch and Save with `409 version_locked`.
  Save As from a locked version is allowed and creates a new unlocked
  copy unless the user explicitly chooses locked.

This is sufficient for two-person sequential workflow; no document
locks or merge UI needed in v1.

### 8.6 Draft / save acceptance tests

MVP backend tests must cover:

- first patch lazily creates a draft;
- draft ETag mismatch returns 409 and preserves the stored draft;
- Save deletes the draft and updates the version body;
- Save against a locked version returns 409;
- Save As from a locked version succeeds;
- stale Save returns 409 and preserves the draft;
- unguarded array patch returns 400;
- guarded stale-index patch fails closed;
- same-editor browser tabs can edit disjoint UI scopes against one draft;
- same-scope browser-tab conflicts freeze the stale tab and preserve its
  local edits until reload/review;
- MCP edit lease freezes browser write controls and surfaces a visual
  indicator;
- MCP token revocation blocks the next token request and blocks any
  post-upload/commit step after revocation;
- locking a version with open drafts rejects subsequent draft patch and
  Save requests while preserving the drafts for Save As / discard;
- dirty-draft Save before version switch does not switch the visible
  version until the target body fetch succeeds;
- stale `replace_table` returns 409 even when the prior accepted write
  touched a different table;
- MCP token patch uses the issuer's `(version_id, user_id)` draft;
- session-cookie and MCP writers conflict through the same ETag rules.
