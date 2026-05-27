---
DATE: 2026-05-13
TIME: 09:30 EDT
STATUS: Review of TB-05 (Save, Save As, Lock, Diff Stub, Downloads)
        uncommitted changes, with follow-up disposition.
AUTHOR: Claude (code-review)
SCOPE: Code review of the uncommitted working-tree changes against
       the TB-05 scope as outlined in
       planning/ROADMAP.html. Not a completeness
       audit against the final app — flags only architectural,
       security, performance, and PRD-divergence issues that matter
       at this slice.
RELATED: planning/ROADMAP.html (TB-05 row),
         context/technical-requirements/save-versioning.md
         (§§8.1–8.6),
         context/technical-requirements/api.md (§§9.3, 9.4, 9.5,
         9.6, 9.7),
         context/user-stories/00-foundation-shell.md (US-3.1,
         US-Versions-Lifecycle),
         context/CODING_STANDARDS.md (Required Feature Shape).
FILES REVIEWED:
  backend/features/project_document/models.py (modified)
  backend/features/project_document/repository.py (modified)
  backend/features/project_document/routes.py (modified)
  backend/features/project_document/service.py (modified)
  backend/main.py (modified)
  backend/tests/test_project_document.py (modified)
  planning/ROADMAP.html (modified)
  frontend/src/App.css (modified)
  frontend/src/features/equipment/routes/EquipmentTab.tsx (modified)
  frontend/src/features/projects/api.ts (modified)
  frontend/src/features/projects/components/ProjectHeaderControls.tsx (modified)
  frontend/src/features/projects/hooks.ts (modified)
  frontend/src/features/projects/types.ts (modified)
---

# TB-05 Code Review

## Bottom line

The backend faithfully implements the §8 file-app save model with a
reasonable transactional shape, and the test suite covers the named
§8.6 acceptance cases for the Rooms slice. The frontend ships the
header controls and a diff stub, but it diverges from US-3.1 /
US-Versions-Lifecycle on three load-bearing UX flows. Architecturally
the `project_document` feature has crossed into "versions"
responsibilities in a way that should probably be split before TB-06.

## High-priority findings

### 1. Frontend "Open" writes the project's default version with no dirty-draft guard

`ProjectHeaderControls.tsx:98-106` calls
`patchVersionMutation.mutateAsync({ versionId, makeActive: true })`
directly with no confirmation. Two distinct gaps from US-3.1:

- **No dirty-draft prompt** before switching versions. Spec calls for a
  Save / Save As / Discard / Cancel modal (US-3.1 acceptance criterion
  2). A user with unsaved Rooms edits can silently lose orientation
  when clicking the wrong row.
- **Open == Make default.** US-3.1 #4 is explicit:
  "`projects.active_version_id` does not change unless the user
  explicitly chose 'Make default'." The lessons log acknowledges this
  as a TB-06 follow-up, but the current behavior also affects what
  *every other reader* sees (including unauth viewers loading via
  `/projects/{id}/...`). That is a destructive multi-user side effect
  from a button labeled "Open." At minimum: confirm with the user
  before merging, or rename to "Make default" until session-scoped
  open lands.

### 2. No restore / discard prompt for an existing draft

US-Versions-Lifecycle sub-flow #2 + AC #4 require a Restore / Discard
prompt before the editor becomes editable when a draft already exists.
Today `EquipmentTab.tsx:90-92` just shows an
`Unsaved Rooms draft restored` banner and silently uses the draft
body. The user has no chance to discard before mutating further. This
is an MVP-scope spec divergence even though "draft restore" is in
TB-05's stated browser check.

### 3. "Compare versions…" is wired to the same draft-only diff

`useDiffQuery` (`hooks.ts:118-125`) hard-codes `to="draft"` in both the
query function and the cache key. The version popover's "Compare
versions…" link opens the same modal
(`ProjectHeaderControls.tsx:227-229`), so version-vs-version diff
(US-Versions-Lifecycle AC #6, spec §8.4 first bullet) is effectively
absent in the UI even though the backend supports it.

### 4. Route ownership starts to drift from CODING_STANDARDS

`features/project_document/routes.py` now owns:

- `PATCH /api/v1/projects/{pid}/versions/{vid}` (rename / lock /
  set-active per api.md §9.3)
- `GET /api/v1/projects/{pid}/diff` (api.md §9.6)
- `GET /api/v1/projects/{pid}/versions/{vid}/download[...]`
  (api.md §9.7)

Per `CODING_STANDARDS.md` "Required Feature Shape," these belong with
the resource they describe (a `versions` feature for PATCH/diff,
possibly an `exports`/`downloads` feature for downloads — or a
conscious "versions owns version + diff + download" decision). Putting
them inside `project_document` makes the module straddle two feature
domains and creates the dual-router pattern in `routes.py` (`router` +
`diff_router`) that hints at the discomfort. Worth resolving before
TB-06 piles on stale-draft handling and TB-17 piles on MCP write paths.

### 5. `download_table` validates the document twice and ignores its own path parameter

`routes.py:130-141`:

```python
content = (
    ProjectDocumentV1
    .model_validate(document.model_dump(mode="json"))
    .model_dump(mode="json")["tables"]["rooms"]
)
```

- `get_saved_document` already validates;
  `model_validate(model_dump(...))` on the result is a redundant
  round-trip on a body that can grow large (envelope tables,
  materials).
- The route accepts `{table_name}` and validates it via
  `require_rooms_table`, then **always returns rooms** regardless of
  the param. Today there is only one supported table, but this will
  silently return rooms for any future table name added to the
  allowlist. Either iterate `document.tables` keys or make the literal
  explicit.

Suggested rewrite uses the typed model directly:
`[room.model_dump(mode="json") for room in document.tables.rooms]`.

## Medium-priority findings

### 6. `UniqueViolation` catch in `save_draft_as` is over-broad

`service.py:256-261` translates *any* `UniqueViolation` to
`version_name_taken`. Today the only conflicting unique constraint on
insert is `(project_id, name)`, so it is correct in practice. But this
is a fragile coupling — adding a unique constraint anywhere in the
future (e.g. on `parent_version_id` + `kind` or a slug column) would
mislabel the error. Consider checking
`exc.diag.constraint_name == "uq_project_versions_project_name"` or
pre-checking the name with a SELECT before insert.

### 7. Global rooms cache invalidation

`useSaveDraftMutation`, `useSaveDraftAsMutation`,
`useDiscardDraftMutation`, and `usePatchVersionMutation` all call
`queryClient.invalidateQueries({ queryKey: roomsQueryKeys.all })`. That
key prefix matches **every project's** rooms slice in cache. For a
single-editor MVP it is harmless, but it will cause needless refetches
as soon as a user has more than one project loaded in a session. Scope
to `roomsQueryKeys.slice(projectId, versionId, "editor")`.

### 8. `ProjectHeaderControls` runs `useRoomsSliceQuery` on every tab

The header is mounted on Status, Windows, Envelope, Equipment, and
Model — all five tabs. Today it issues a `/draft/tables/rooms` request
on every project load just to compute `hasDraft` for the Save
indicator. As more tables ship (Materials, Window Types, Assemblies),
this pattern does not scale: each table-shaped `hasDraft` lookup would
multiply. Consider a dedicated `useDraftStatusQuery` returning
`{ has_draft, draft_etag, version_etag }` without the rows, or compute
dirty state from a server-side draft-existence endpoint.

### 9. `diff` endpoint mixes view-access and editor-only execution paths

`routes.py:155-162` declares `ProjectViewAccess` (open to public
viewers), but for `to=draft` the service path calls
`require_editor_user(access)` inside `get_current_document_view`. So a
public `GET /diff?from=...&to=draft` returns 401 with
`not_authenticated`, which is surprising for a "view" route. Either
gate `to=draft` at the route layer with `ProjectEditAccess`, or split
into two routes.

### 10. Spec asks for "Unlock requires confirm"; UI does not confirm

Per `save-versioning.md` §8.2:
"Lock / unlock | Toggle locked on a version. Lock = save-protected.
**Unlock requires confirm.**" `toggleLock` in
`ProjectHeaderControls.tsx:88-96` runs without a `window.confirm`.
Discard and Delete-room get confirmations; Unlock should too — it is
the only operation that opens a previously frozen cert milestone to
mutation.

## Low-priority / nits

- **`patch_version` race on `active_version_id`** (`service.py:278-301`):
  the `FOR UPDATE` lock is on the targeted version row, not on the
  project. Two concurrent "Open" calls could race the
  `active_version_id` write. Acceptable for single-editor MVP; flag
  for TB-06.
- **`save_draft` returns `document_etag(draft_body)` as
  `version_etag`** (`service.py:218-220`): semantically fine because
  the saved body equals the draft body after Save, but reading
  `document_etag(draft_body)` where the natural source is the
  freshly-saved version body is slightly indirect. A reader has to
  think about why the draft body's etag is the right answer.
- **`body_size_bytes` uses `model_dump_json()` (non-canonical) while
  `document_etag` uses
  `json.dumps(..., sort_keys=True, separators=(",",":"))`
  (canonical)**: the size and the etag are not computed from the same
  byte sequence, so the stored `body_size_bytes` will not match the
  etag input length. Today nothing depends on that equality;
  documenting it in a docstring or unifying via one canonical helper
  would prevent future surprises.
- **Audit logging always passes `session_id=None`**
  (`service.py:362-373`): traceability would benefit from threading
  the active session id through. Same shape as TB-04b's read-only
  audits; not introduced here, but worth noting because Save / Save As
  are now mutating actions where session attribution matters more.
- **Tests do not cover Save As name-collision (`version_name_taken`)**:
  the catch path exists but has no test. Cheap to add.
- **Tests do not cover Save As when no draft exists**: the lessons say
  "Save As from locked versions remains available and copies the
  existing draft when present, otherwise the saved body" — only the
  "draft present" branch is tested.
- **CSS color choices use `#8a5a00` / `#8a2d22` directly**: minor, but
  the `App.css` palette would benefit from variables given the
  addition of new semantic states (dirty, action error). Not a TB-05
  blocker.
- **Download filenames use raw UUIDs** (`project-{uuid}.json`,
  `rooms-{uuid}.json`): users cannot distinguish downloads. Consider
  including the `bt_number` or version `name` (sanitized).

## What lines up with the spec well

- Save / Save As transaction shape matches `save-versioning.md` §8.2.1
  line-for-line: validates, overwrites or inserts, sets
  `body_size_bytes` / `schema_version` / `updated_*`, mirrors
  `projects.last_saved_at`, deletes the draft, appends the action log.
- `save_draft_as` correctly auto-locks `submitted` / `closed` even if
  the client submits `locked: false`, and Save As from a locked source
  is allowed (matches §8.5 + US-Versions-Lifecycle AC #3).
- ETag policy matches §8.5: Save uses `If-Match` against the saved
  version body etag; draft replace continues to use `If-Match` /
  `If-Match-Version` from TB-04. Stale Save returns 409 and preserves
  the draft (test included).
- Locked versions reject draft writes and Save with `version_locked`.
  The Equipment banner correctly nudges to Save As.
- The diff response returns a per-table
  `change_count + changed_paths` sorted summary keyed by stable row id
  (`rooms[rm_living].field`), which is exactly the "structured
  per-table delta" intended by §8.4 + the TB-05 "structured text
  summary in v1" decision.
- Repository helpers stay narrow (`save_draft_to_version`,
  `insert_version_from_body`, `patch_version_metadata`) per §8.2.1
  ("expose specific Save / Save As helpers, not generic
  update-body").
- All draft-write helpers parameterize SQL and stay free of FastAPI
  types — boundary discipline holds.

## Suggested ordering for follow-ups before TB-06

1. **(High)** Either confirm the "Open == Make default" semantics with
   the user, or rename today's button to "Make default" and stub a
   real session-scoped open.
2. **(High)** Add the dirty-draft Save / Save As / Discard / Cancel
   modal on version switch (US-3.1 AC #2).
3. **(High)** Add the Restore / Discard prompt when a draft already
   exists on load (US-Versions-Lifecycle AC #4).
4. **(Medium)** Decide where versions / diff / download routes live
   (split into a `versions` feature, or add a written exception in
   TB-05 planning notes referencing CODING_STANDARDS).
5. **(Medium)** Wire `useDiffQuery` to take a `to` argument so the
   popover's "Compare versions…" can actually compare versions.
6. **(Medium)** Scope `roomsQueryKeys` invalidation to the active
   project; clean up `download_table`'s double-validation and
   hardcoded "rooms"; add the missing two save-as tests.

## Verification status carried forward from the slice ledger

Follow-up verification is no longer blocked on Docker. After Docker
was started, the TB-05 path passed `make migrate`, backend lint,
format check, `ty check`, full backend pytest, frontend lint, format,
unit tests, production build, `make seed-dev-user`, and `make e2e`.
The roadmap ledger records the exact command set and browser evidence.

## Follow-up disposition

Addressed in the TB-05 follow-up before this review was closed:

- Open/version navigation is URL-scoped and no longer mutates the
  project default just by clicking **Open**.
- Version-vs-version diff is wired into the modal.
- Unlock now requires confirmation.
- Table download avoids redundant document validation and uses the
  typed Rooms model directly.
- `save_draft_as` maps only the version-name unique constraint to
  `version_name_taken`.
- Rooms cache invalidation is scoped by project, and version metadata
  changes no longer invalidate Rooms data.
- Save As name-collision and no-draft copy paths are covered by tests.

Simplify-pass cleanup after the functional fixes:

- Reused the existing project `body_size_bytes` helper instead of a
  project-document duplicate.
- Centralized project-version public SQL columns in the repository.
- Added a local test helper for repeated Rooms-draft setup.
- Disabled the header's Rooms query for public viewer mode.
- Added small header constants/action helpers for repeated local
  strings and mutation error handling.

Still deferred to TB-06 / TB-06 prep:

- Restore / Discard prompt when a draft already exists on load.
- Dedicated draft-status endpoint or hook for the project header, so
  save-state does not depend on loading the Rooms slice as more tables
  land.
- Route-module ownership cleanup for version lifecycle, diff, and
  download endpoints before stale-draft and MCP write paths expand this
  surface.
