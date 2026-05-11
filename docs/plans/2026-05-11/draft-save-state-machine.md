---
DATE: 2026-05-11
TIME: -
STATUS: Accepted planning decision
AUTHOR: Codex
SCOPE: Draft / Save / Save As / conflict state machine for browser and MCP writers.
RELATED:
  - docs/plans/architecture-prd.md
  - docs/plans/2026-05-11/architecture-planning-review.md
---

# Draft / Save State Machine

## Decision

V2 v1 uses one canonical server-side draft per `(version_id, user_id)`.
All mutating project-document writes from the browser and MCP go through
that draft. The saved `project_versions.body` changes only through
explicit **Save** or **Save As** operations.

V1 does not attempt merge UI. When conflict is detected, the system
preserves the user's draft and offers conservative choices: reload,
Save As, discard, or inspect diff.

## Draft identity

Draft key:

```sql
PRIMARY KEY (version_id, user_id)
```

Implications:
- Browser edits and MCP edits issued by the same editor token share the
  same draft for the same version.
- Ed and John can each have independent drafts on the same version.
- A second browser tab for the same logged-in user should default to
  read-only advisory mode, but server correctness still relies on ETags,
  not tab detection.

## Draft row shape

Add these fields to the PRD sketch:

```sql
project_version_drafts (
    version_id          UUID NOT NULL REFERENCES project_versions(id),
    user_id             INTEGER NOT NULL REFERENCES users(id),
    body                JSONB NOT NULL,
    schema_version      INTEGER NOT NULL,
    base_version_etag   TEXT NOT NULL,
                         -- saved version etag when the draft was created
    draft_etag          TEXT NOT NULL,
                         -- changes on every accepted patch/replace
    last_patched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_via         TEXT NOT NULL DEFAULT 'browser',
                         -- 'browser' | 'mcp'
    PRIMARY KEY (version_id, user_id)
)
```

`version_body_etag` is derived from the saved version row. It can be a
hash of `body` + `schema_version` + `updated_at`, or a stored generated
value if implementation proves that cleaner. `draft_etag` may be a hash
or monotonically replaced random token. It must change on every accepted
draft mutation.

## Normal browser open

1. User opens `/projects/{id}/{tab}`.
2. Frontend fetches version metadata + saved document + current user's
   draft, if present.
3. If no draft exists, the in-memory document starts from saved body.
4. If a draft exists and differs from saved body, show restore prompt:
   Restore draft / Discard draft / View saved version.
5. If restored, frontend uses draft body + draft etag.

Opening a project does not create a draft row. The first successful
draft mutation creates it lazily from the current saved body.

## Draft patch

Every patch request includes:
- `If-Match: <draft_etag>` if a draft already exists.
- `If-Match-Version: <version_body_etag>` when creating a draft from a
  saved body.
- `Idempotency-Key` for retry safety.

Patch handling:
1. Resolve writer from session cookie or MCP token.
2. Verify `require_project_access(project_id, mode='edit')`.
3. Reject if the target version is locked, unless the operation is
   Save As from an existing draft.
4. Load or lazily create the user's draft.
5. Compare ETags.
6. Apply patch.
7. Validate full `ProjectDocumentV*`.
8. Store new body, new `draft_etag`, `last_patched_at`, `updated_via`.

On draft ETag mismatch: return `409 draft_etag_mismatch`. Do not apply
the patch.

## JSON-Patch guardrails

V1 accepts standard JSON-Patch, but table/entity mutations must be
guarded against stale array indexes.

Rules:
- `replace`, `remove`, and move-like operations against arrays must be
  preceded by `test` ops that confirm the target entity's stable `id`.
- Backend rejects unguarded entity-array mutation with
  `400 unguarded_array_patch`.
- MCP helpers should prefer higher-level tools (`replace_table`,
  `update_rows`, `attach_asset`) that generate safe JSON-Patch with
  ID tests.
- Whole-table replacement is allowed only through explicit
  `replace_table` / draft replace endpoints and validates the full
  table plus the full document after replacement.

This keeps JSON-Patch standard while making stale-index mistakes fail
closed.

## Save

Save flushes the user's draft into the active version body.

Request includes:
- `If-Match-Version: <base_version_etag>`
- `If-Match-Draft: <draft_etag>`
- `Idempotency-Key`

Rules:
- If version is locked: `409 version_locked`. Save is unavailable.
- If no draft exists: no-op success or `204 No Content`; UI should keep
  Save disabled.
- If draft ETag changed: `409 draft_etag_mismatch`.
- If saved version ETag differs from draft `base_version_etag`:
  `409 version_etag_mismatch`. Do not overwrite.
- On success: validate draft, update `project_versions.body`,
  `schema_version`, `body_size_bytes`, `updated_at`, `updated_by`; update
  `projects.last_saved_at`; delete draft row; write action log.

V1 conflict response offers:
- Save As from my draft.
- Discard my draft and reload saved version.
- Show diff between saved version and my draft.

No merge.

## Save As

Save As creates a new version from the draft body.

Rules:
- Save As is allowed when the source version is locked.
- Save As is allowed when the source version changed since the draft was
  created, because it does not overwrite the source.
- If no draft exists, Save As clones the saved source version body.
- On success: insert new `project_versions` row, set as
  `active_version_id`, delete the source draft for that user, update
  `projects.last_saved_at`, write action log.

Default behavior: new Save As version becomes the project default active
version. User can later change default in the version dropdown.

## Locked versions

Locked versions are read-only.

Rules:
- Browser UI hides edit affordances and shows the locked-version banner.
- MCP draft patch / replace-table calls against a locked version return
  `409 version_locked`.
- Save against a locked version returns `409 version_locked`.
- Save As from a locked version is allowed and creates an unlocked copy
  unless the user explicitly chooses locked.
- If a version is locked while a user already has a draft, the draft is
  preserved. On next open, the user is prompted: Save As draft / Discard
  draft / View locked saved version. Save remains unavailable.

## Second tab and takeover

V1 avoids server-side document locks.

Browser behavior:
- Same-browser tabs detect each other using `BroadcastChannel` /
  `localStorage` and show the second tab read-only by default.
- The second tab can explicitly **Take over editing**. That action does
  not mutate server state; it only enables local editing.
- ETags remain the real protection. If both tabs edit, the stale tab
  receives `409 draft_etag_mismatch`.

Cross-device same-user editing is mostly blocked by single-active-session
auth, but MCP tokens may still edit the same user's draft. The browser
treats MCP edits as external draft changes and resolves by ETag.

## Session expiry

When a browser write returns 401:

1. Freeze the local patch queue; do not discard it.
2. Show the sign-in-again modal in place.
3. After re-auth, refetch version metadata and current draft etag.
4. If both ETags still match, replay queued patches with the same
   idempotency keys.
5. If either ETag changed, do not replay blindly. Show conflict prompt:
   Reload current draft / Keep local edits as a new draft attempt /
   Discard local edits.

Data loss is bounded to unsynced in-memory edits, and those are retained
until the user chooses.

## Undo

Undo is local and session-scoped.

Invalidate the local undo stack when:
- version changes;
- draft is reloaded from server;
- draft ETag mismatch occurs;
- Save / Save As / Discard succeeds;
- a refetch replaces the in-memory document;
- MCP or another tab changes the draft.

On 409, rollback the optimistic local op, clear undo, and show a reload
or conflict prompt. V1 does not attempt compensating PATCH undo after a
conflict.

## API shape

Normal editing API:

```text
GET    /api/v1/projects/{pid}/versions/{vid}/document
GET    /api/v1/projects/{pid}/versions/{vid}/document/tables/{name}
GET    /api/v1/projects/{pid}/versions/{vid}/draft
PATCH  /api/v1/projects/{pid}/versions/{vid}/draft
PUT    /api/v1/projects/{pid}/versions/{vid}/draft/tables/{name}
DELETE /api/v1/projects/{pid}/versions/{vid}/draft
POST   /api/v1/projects/{pid}/versions/{vid}/draft/save
POST   /api/v1/projects/{pid}/versions/{vid}/draft/save-as
```

There is no normal `PUT /document` whole-body Save and no normal
`PUT /document/tables/{name}` saved-body mutation. Import/admin scripts
may use internal service functions, but user and MCP writes go through
drafts.

## Error codes

Minimum structured codes for v1:

| Code | Meaning | Default UX |
|---|---|---|
| `draft_etag_mismatch` | Draft changed since client loaded it | Reload draft / discard local queued edits |
| `version_etag_mismatch` | Saved version changed since draft was created | Save As / discard / show diff |
| `version_locked` | Target version is locked | Save As |
| `unguarded_array_patch` | JSON-Patch array mutation lacked stable-id `test` guard | Reject; developer/agent fixes patch |
| `document_validation_failed` | Patched draft failed Pydantic validation | Show field/path errors |
| `stale_schema_version` | Draft body schema is older than current and needs upgrade | Run read shim; Save only after validation |

## Acceptance tests

MVP backend tests should cover:
- first patch lazily creates draft;
- draft ETag mismatch returns 409 and preserves stored draft;
- Save deletes draft and updates version body;
- Save against locked version returns 409;
- Save As from locked version succeeds;
- stale Save returns 409 and preserves draft;
- unguarded array patch returns 400;
- guarded stale-index patch fails closed;
- MCP token patch uses issuer's `(version_id, user_id)` draft;
- session and MCP writers conflict via the same ETag rules.
