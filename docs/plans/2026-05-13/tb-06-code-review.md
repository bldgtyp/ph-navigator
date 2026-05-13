---
DATE: 2026-05-13
TIME: 10:30 EDT
STATUS: Review of TB-06 (Same-Editor Tabs And Stale Draft Boundaries)
        uncommitted changes, with follow-up disposition.
AUTHOR: Claude (code-review)
SCOPE: Code review of the uncommitted working-tree changes against
       the TB-06 scope as outlined in
       docs/plans/01_IMPLEMENTATION-ROADMAP.md. Not a completeness
       audit against the final app — flags only architectural,
       security, performance, and PRD-divergence issues that matter
       at this slice.
RELATED: docs/plans/01_IMPLEMENTATION-ROADMAP.md (TB-06 row),
         context/technical-requirements/save-versioning.md
         (§§8.3, 8.5),
         context/user-stories/00-foundation-shell.md
         (US-Concurrency, US-Errors-SchemaFallback,
         US-Versions-Lifecycle),
         context/CODING_STANDARDS.md (Required Feature Shape).
FILES REVIEWED:
  backend/features/project_document/routes.py (modified)
  backend/features/project_document/service.py (modified)
  backend/tests/test_project_document.py (modified)
  context/user-stories/00-foundation-shell.md (modified)
  docs/plans/01_IMPLEMENTATION-ROADMAP.md (modified)
  frontend/src/App.css (modified)
  frontend/src/features/equipment/components/RoomModal.tsx (modified)
  frontend/src/features/equipment/hooks.ts (modified)
  frontend/src/features/equipment/lib.test.ts (modified)
  frontend/src/features/equipment/lib.ts (modified)
  frontend/src/features/equipment/routes/EquipmentTab.tsx (modified)
  frontend/tests/e2e/health.spec.ts (modified)
---

# TB-06 Code Review

## Scope check

TB-06 promises:

1. Same-editor tab coordination
2. Stale ETag handling
3. Dirty-draft warning
4. Restore/discard prompt
5. Read-safe-mode fallback for older/invalid schema bodies

Items 1, 2, and 5 are implemented. Items 3 and 4 are deferred (`The
full Restore / Discard prompt and dedicated draft-status endpoint
are still deferred`, per the new lessons entry). The deferral is
explicit and acceptable for the slice.

Overall the slice is focused and still inside the TB-06 boundary.
The follow-up simplify pass added two guardrails that are worth
keeping in-slice: accepted broadcasts now carry the previous
Rooms ETag guard so receivers cannot roll their cache backward,
and no-op Rooms replacements return the current slice without
creating or touching a draft row. Tests and E2E look solid.

## Disposition after follow-up pass

Address now:
- **H2** — tightened the Rooms conflict rule so a remote write only
  freezes an active edit when the active room row, deletion state, or
  referenced option changed. Disjoint same-table writes can update the
  cached slice and continue.
- **M1 / M2** — stabilized the `BroadcastChannel` subscription with a
  callback ref and removed the dead sender self-filter.
- **M3** — guarded Rooms replacement so an absent active version cannot
  generate `/versions//...` requests.
- **M4** — tightened the backend raw JSON type boundary with a JSON
  value alias.
- **M5** — stale-write handling now preserves the original
  `ApiRequestError` instead of replacing it with a generic `Error`.
- **Simplify pass** — added a causal guard to Rooms broadcasts so
  out-of-order tab messages invalidate/refetch instead of replacing
  newer local cache, and added a backend no-op replacement guard so
  unchanged saves do not create a draft row or broadcast a phantom
  edit.

Defer:
- **H1** — workspace-level schema fallback is larger than TB-06. The
  safety valve shipped here is raw Project JSON download from invalid
  saved bodies; the persistent shell-wide fallback banner, dedicated
  schema error codes, MCP fallback, and global lifecycle disabling
  should land as a later schema-migration/read-safe-mode slice.
- **L1 / L2 / L3 / L4 / L5 / L6** — keep as follow-up design/test notes.
  They matter before generalizing this pattern to larger tables, MCP
  write tools, or production import hardening, but they do not block the
  TB-06 local implementation.

---

## Findings — most-to-least important

### H1 — Read-safe-mode is far narrower than PRD `US-Errors-SchemaFallback` requires

The PRD calls for a workspace-level fallback when a saved body
fails validation:

- API returns `schema_version_unsupported: true` with the raw body
  (PRD §10.5)
- A persistent project-shell banner ("This version uses an older
  project format…")
- Save, Save As, edits, catalog picks, MCP writes, lifecycle
  transitions all disabled
- Switching to another version remains available
- Backend emits `error_code='schema_migration_failed'` or
  `'schema_validation_failed_after_migration'`

Current implementation:

- `backend/features/project_document/service.py:445-454` still
  returns generic `invalid_project_document` (422). No
  `schema_version_unsupported` envelope, no dedicated error codes.
- The user-visible fallback (`EquipmentTab.tsx:64-77`) is a small
  inline link in the Rooms tab error UI. The project header,
  version dropdown, diff modal, MCP reads
  (`features/mcp/server.py:227-241` → `get_current_document_view`
  validates → 422), and Save/Save As paths still hit raw validation
  errors with no graceful banner.
- Only `download_document` was switched to raw; everything else
  (`get_saved_document`, `get_current_document_view`,
  `get_project_diff`, save paths) still validates strictly.

TB-06 only commits to "read-safe-mode fallback for older or invalid
schema bodies," so this is partial coverage — the raw-body recovery
download works, which is the core safety valve. But the PRD's
documented contract and workspace-level UX are still missing. Flag
the gap explicitly in the lessons / follow-up so it isn't forgotten
by TB-19 hardening.

### H2 — Disjoint-scope "apply in memory and continue" is collapsed to "any modal open → freeze"

PRD `save-versioning.md` §8.5 and `US-Concurrency` criterion 2:

> If a received patch is outside the current tab's active UI scope,
> apply it in memory and continue. If it overlaps the active dirty
> scope, freeze that scope and show a reload/review banner.
> Editing disjoint project surfaces in two tabs succeeds without a
> takeover prompt.

`EquipmentTab.tsx:28-35` freezes when **any** modal is open,
regardless of whether the incoming broadcast affects the room
currently being edited. Two tabs editing different rooms
simultaneously will collide visibly even though the writes are
semantically disjoint. Within TB-06's Rooms-only surface this may
be acceptable (the room you're editing is dirty and the table is
whole-replaced on save), but the freeze rule should at least gate
on "is the dirty draft id touched by the incoming slice" before
TB-07+ adds more surfaces. Otherwise every future table inherits
this overly aggressive UX.

The Decision Queue's "MVP supports single-active-editor per
project" note arguably covers this, but PRD §8.5 still requires
disjoint scopes to coexist. Worth tightening the scoping when the
next table lands.

### M1 — BroadcastChannel is reopened on every modal open/close

`hooks.ts:63-86` puts `onRemoteSlice` in the `useEffect` deps, and
`onRemoteSlice` is a `useCallback` keyed on `roomModal`
(`EquipmentTab.tsx:28-35`). Result: every modal mount/unmount tears
down and rebuilds the BroadcastChannel. BroadcastChannel doesn't
queue, so a broadcast that lands during the reopen gap is silently
dropped. The server-side ETag check is the safety net (so no data
loss), but the cross-tab UX can intermittently miss the freeze.

Standard fix: keep the channel stable, store `onRemoteSlice` in a
ref, and read `ref.current(slice)` from the message handler.
Mention since the broadcast is the whole point of the slice.

### M2 — `senderId === tabId.current` self-filter is dead code

`BroadcastChannel` does not deliver to the posting instance, so
`message.senderId === tabId.current` in `hooks.ts:72` is impossible
in practice. Harmless, but every cross-tab review reader will
wonder what it guards against. Either drop the field, or comment
that it's a belt-and-braces guard for tabId reuse across remount.

### M3 — `useReplaceRoomsSliceMutation` accepts an empty version id and would call a malformed URL

`EquipmentTab.tsx:42-46` passes `activeVersionId` (which is
`string | null` per `ProjectDetail.active_version_id`) into the
mutation. The hook does `versionId ?? ""` (`hooks.ts:45`) and then
constructs the request URL. When `active_version_id` is null (which
can legitimately happen for a freshly-created project before the
first version is set — unlikely in practice, but it's the type),
the PUT goes to
`/api/v1/projects/{id}/versions//draft/tables/rooms` which is a
404. The mutation should be disabled or guarded the same way
`useRoomsSliceQuery` is
(`enabled: enabled && resolvedVersionId.length > 0`).

### M4 — Raw-download endpoint trusts `json.dumps(object)` with no schema check

`routes.py:135-143` calls
`json.dumps(document, separators=(",", ":"))` where `document` is
annotated `object` (`service.py:89`). In practice psycopg returns a
`dict`/`list` from JSONB, so this works — but the contract loss is
a real maintenance hazard. Tighten the return type to e.g.
`dict[str, Any]` (or `JsonValue` if you keep one centrally) and let
the type checker enforce it. Same applies in `service.py:89` —
`object` is too loose for a value the caller will immediately
JSON-serialize.

### M5 — `saveRoom` swallows the structured `ApiRequestError` on conflict

`EquipmentTab.tsx:88-97` re-throws
`new Error("Rooms draft changed…")` instead of the original
`ApiRequestError`. The `request_id` and `error_code` context is
lost by the time `RoomModal`'s `errorMessage` helper renders it.
For TB-06 the freeze banner is already informative, but if any
future telemetry tries to read request_ids from action errors,
this path will look opaque. Cheap fix: rethrow `error` and let
`RoomModal` render the freeze banner from `frozenReason` (already
happening anyway).

### L1 — Raw download exposes any fields stored in JSONB that the schema would normally strip

The PRD documents the public-readable contract for project URLs
(US-1.5, PRD §4), so this is intentional. Still worth a note: an
invalid body could include keys from removed schema versions that
the validated path never surfaces. If any of those keys ever held
internal-only data, the raw download would leak them to
unauthenticated viewers. No action needed today, but worth
recording in the lessons follow-up so future schema migrations
consider it.

### L2 — `BroadcastChannel` payload is the entire slice, not just the new `draft_etag`

`hooks.ts:88-100` posts the whole slice over the channel. PRD §8.5
says tabs "coordinate accepted browser patches and new `draft_etag`
values" — sending the full slice is correct for "non-overlapping
apply in memory" since the receiver needs the row data, but it
grows with the table. For Rooms this is fine; for a larger future
table (Materials, Assemblies) the channel post becomes expensive.
Decide whether the channel becomes `{etag, summary}` plus a refetch
trigger, or stays as full-slice fan-out. Either is defensible;
pick before TB-07.

### L3 — `useRoomsDraftBroadcast` always pushes for editors, never for viewers

`EquipmentTab.tsx:36-41` passes `isEditor` as `enabled`. Correct,
but the receive side also requires it — meaning a viewer tab open
alongside an editor tab won't get the cache update. That's fine
(viewers don't refetch live), but worth confirming the viewer
always reads the saved body anyway (which `useRoomsSliceQuery`
does via `accessMode`). Sanity-check this with a viewer-paired E2E
if you ever care.

### L4 — Channel name `phn-rooms-draft-v1` is table-specific by design

Fine for TB-06. Establish the per-table naming convention (or a
generalized `phn-document-draft-v1` with a `table` field) before
TB-07 / TB-18 adds Envelope / ERV / Fan tables, so each table
doesn't reinvent its own freeze plumbing.

### L5 — No frontend component test for the schema-fallback UX

`lib.test.ts` covers the classifiers (good), but the actual "show
raw-download link when query errors with
`invalid_project_document`" rendering is only covered indirectly.
The E2E doesn't exercise it either (the new E2E test is for the
two-tab freeze). Targeted RTL test for the error rendering would
lock in the read-safe path.

### L6 — Backend test mutates the row with `Jsonb` directly — good, but isolated

`test_project_document.py:400-435` is a clean, well-scoped
regression. Worth a sibling that asserts MCP `get_document` returns
the same "fails strict validation" behavior so the MCP contract is
documented (or the lessons follow-up calls out that MCP fallback
is still TODO).

---

## Doc / PRD alignment

- `context/user-stories/00-foundation-shell.md` change is aligned
  with PRD §10.5 and the new raw-download behavior. ✓
- `docs/plans/01_IMPLEMENTATION-ROADMAP.md` status and lessons
  entry accurately describe what shipped and what was deferred. ✓
- The Decision Queue still has the pre-TB-06 wording "MVP supports
  single-active-editor per project; cross-editor conflict UX
  deferred to v1.1". Confirm this still matches reality (it does,
  since the freeze is in fact aggressive), but the *same-editor*
  multi-tab disjoint-edit guarantee from PRD §8.5 is not fully met
  — worth a one-line addendum.

---

## Recommended follow-ups before marking TB-06 complete

1. Tighten the freeze rule (or document that disjoint same-table
   edits intentionally collide in v1).
2. Stabilize the BroadcastChannel across modal open/close, or
   document that the server ETag is the only authority.
3. Tighten `get_raw_saved_document` return type and the
   `download_document` JSON-dumps boundary.
4. Add the workspace-level schema-fallback banner to the project
   shell (currently per-tab only), or explicitly defer in the
   lessons + a new ticket.
5. Add the missing staging browser check (already noted as
   pending).

No blockers — the slice does what TB-06 says it does. The main
architectural risk is letting H1/H2 settle as the de-facto pattern
when TB-07+ tables land.
