---
DATE: 2026-05-13
TIME: 12:30 EDT
STATUS: Code review of P1-02 deliverable
SCOPE: Backend document/draft summary API + frontend `features/project_document`
       feature for table-neutral version chrome. Reviews un-committed
       changes representing the P1-02 phase implementation against the
       planning docs, PRD, code-review synthesis, and context technical
       requirements. Does not review against final-app completeness.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md (P1-02 row)
  - docs/plans/2026-05-13/phase-1-full-buildout-plan.md (P1-02 scope)
  - docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md (P0.3 origin)
  - docs/code-reviews/2026-05-13/p1-01-code-review.md (preceding slice)
  - context/PRD.md
  - context/CODING_STANDARDS.md
  - context/technical-requirements/api.md
  - context/technical-requirements/save-versioning.md
  - context/user-stories/00-foundation-shell.md
---

# Code Review — P1-02 Document Summary And Header Decoupling

## Scope Check

P1-02's stated scope from the roadmap:

> Make project header/version chrome table-neutral.
>
> Includes: Document-level draft summary state; table-neutral Save, Save
> As, Discard, Lock/Unlock, diff, and dirty/clean indicators; remove direct
> Rooms/Equipment coupling from project shell controls.

This maps to the code-review synthesis P0.3 (document/draft summary API
+ frontend feature). Explicitly **not** in P1-02 scope (per the
phase-1-full-buildout-plan):

- P1-03: Read-safe-mode for invalid/unsupported saved documents.
- P1-04: BLDGTYP design-system tokens / Tailwind / shadcn migration.
- P1-08–P1-11: Shared DataTable extraction, single-select option manager,
  Rooms full MVP, draft/version/concurrency UX completion (including
  restore/discard prompt, dirty-switch prompt, beforeunload warning,
  stale ETag UI).
- P1-12: Diff visual polish, OpenAPI/JSON Schema endpoints.

This review evaluates only against the P1-02 scope.

## Diff Summary

| File | Status | Notes |
|---|---|---|
| `backend/features/project_document/models.py` | Modified | Added `ProjectDraftSummary` model. |
| `backend/features/project_document/routes.py` | Modified | Added `GET /draft` returning `ProjectDraftSummary`. |
| `backend/features/project_document/service.py` | Modified | Re-exported `get_draft_summary`. |
| `backend/features/project_document/store.py` | Modified | Added `get_draft_summary`, `dirty_tables` helper. |
| `backend/tests/test_project_document.py` | Modified | +55 lines: 2 summary tests (clean/dirty, locked). |
| `frontend/src/features/project_document/api.ts` | New | Draft summary, save, save-as, discard, diff, downloads. |
| `frontend/src/features/project_document/hooks.ts` | New | TanStack Query hooks + `projectDocumentQueryKeys`. |
| `frontend/src/features/project_document/types.ts` | New | `ProjectDraftSummary`, `SaveDraftResponse`, `SaveAsPayload`, `DiffSummary`. |
| `frontend/src/features/project_document/components/VersionControls.tsx` | New | 336 lines: replaces `ProjectHeaderControls`. Reads `useDraftSummaryQuery`. |
| `frontend/src/features/projects/components/ProjectHeaderControls.tsx` | Deleted | 342 lines removed. |
| `frontend/src/features/projects/api.ts` | Modified | Stripped `saveDraft`/`saveDraftAs`/`discardDraft`/`fetchDiff`/`projectDownloadUrl`/`tableDownloadUrl`. |
| `frontend/src/features/projects/hooks.ts` | Modified | Removed save/save-as/discard/diff hooks; removed `roomsQueryKeys` import. |
| `frontend/src/features/projects/types.ts` | Modified | Removed save/save-as/diff types (moved to `project_document`). |
| `frontend/src/features/projects/routes/ProjectShell.tsx` | Modified | Imports `VersionControls` from `project_document`. |
| `frontend/src/features/equipment/hooks.ts` | Modified | Rooms write now invalidates `projectDocumentQueryKeys.draftSummary`. |
| `frontend/src/features/equipment/routes/EquipmentTab.tsx` | Modified | Rooms JSON download moved here from header. |
| `frontend/src/App.test.tsx` | Modified | +91 lines: header state tests + draft-URL mocks. |
| `frontend/src/App.css` | Modified | Added `.table-actions` flex container. |
| `docs/plans/01_IMPLEMENTATION-ROADMAP.md` | Modified | P1-02 status + lessons entry. |

Net additions concentrated in the new frontend feature (~520 lines) and
balanced by the deletion of `ProjectHeaderControls` (342 lines) plus
trimmed `projects` api/hooks/types. The `VersionControls.tsx` module is
at 336 lines, just past the 300-line soft limit in
`CODING_STANDARDS.md` §"Component Size And Splitting"; see Finding M5.

## Verdict

**Approve with minor amendments.** The P1-02 deliverable meets its
stated completion gate:

- ✅ The header detects a dirty draft regardless of which registered
  table caused it (via `dirty_tables`/`source`, not Rooms query state).
- ✅ Current Rooms workflows still save, discard, lock, unlock, diff,
  and download (existing e2e covers the path; Rooms JSON link moved to
  Equipment as the deliverable describes).
- ✅ `features/projects/hooks.ts` no longer imports from
  `features/equipment` (no more `roomsQueryKeys` reverse-dependency).
- ✅ `features/projects/routes/ProjectShell.tsx` imports the new
  `VersionControls` from `features/project_document/` rather than from
  the now-deleted `ProjectHeaderControls`.
- ✅ Save uses `draftSummary.version_etag` (saved-body ETag) for
  `If-Match`, which is correct per save-versioning §8.5 (vs the
  previous reliance on the Rooms slice ETag).
- ✅ Existing P1-01 boundaries respected: the summary computation
  iterates `iter_table_contracts()` rather than touching Rooms
  directly, so adding Windows or another table later will Just Work
  (modulo Finding H2 below).

The findings below are concerns to flag for follow-up slices, not
blockers for accepting P1-02.

## Architectural Alignment

### Strong matches with the synthesis

The implementation follows the recommended shape in
`phase-1-code-review-synthesis.md` P0.3 almost exactly:

- Backend endpoint at `GET /api/v1/projects/{pid}/versions/{vid}/draft`
  with the suggested response fields (`source`, `version_etag`,
  `draft_etag`, `dirty_tables`, `last_patched_at`, `is_locked`,
  `can_edit`).
- Frontend feature directory at
  `frontend/src/features/project_document/` with `api.ts`, `hooks.ts`,
  `types.ts`, and a `components/VersionControls.tsx`.
- `features/projects` owns project shell/navigation; the new
  `features/project_document` owns document draft/version state and
  version chrome controls.

The roadmap's "Lessons" line in `01_IMPLEMENTATION-ROADMAP.md` for
P1-02 captures the new boundary correctly:

> Document chrome state is owned by `features/project_document`: the
> header reads `/draft` summary for dirty state and save ETags, while
> table-specific downloads live with the table surface.

### Naming alignment

- `source` field is `"version" | "draft"`, not the synthesis's
  suggested `"saved" | "draft"`. The chosen name matches the existing
  `ProjectDocumentSource` literal in `models.py`, so it is internally
  consistent. Worth a one-line note in `save-versioning.md` if the
  decision is permanent. Not a blocker.

## High-Priority Findings

### H1. `api.md` is now out of sync with the new `GET /draft` semantics

**Severity:** High (PRD vs implementation drift)
**File:** `context/technical-requirements/api.md` (§9.5), lines 126–127

Current PRD text:

```
GET    /api/v1/projects/{pid}/versions/{vid}/draft                   current user's draft
                                                                     body (404 if none)
```

Implementation in `routes.py:77–82` and `store.py:67–100` now returns
`ProjectDraftSummary` always (200 even when there is no draft, with
`source="version"` and empty `dirty_tables`). The synthesis explicitly
recommended this shape, so the implementation choice is correct — but
the canonical API spec was not updated to match.

**Why it matters:** This is the canonical PRD-extracted spec. Future
MCP tools, generated OpenAPI clients, or future contributors reading
the spec will assume `GET /draft` returns the draft body. The previous
contract (return the draft body, 404 when none) is also still a
plausible thing to want (e.g., raw draft download in P1-12 downloads
work). Decide which:

- Option A: rewrite the §9.5 row to read "draft summary
  (source/etags/dirty_tables/lock state)" and note that there is no
  whole-draft body endpoint in v1.
- Option B: keep `GET /draft` returning the summary, but expose the
  draft body under a different path (e.g.,
  `GET /draft/document` mirroring `GET /document` for saved bodies),
  and update §9.5 to enumerate both.

**Recommendation:** Option A. The Phase 1 frontend doesn't need a
whole-draft body fetch (Rooms uses the per-table draft slice), and
MCP's `get_document` already returns the merged draft view. If a
future slice needs raw draft body, add it then. Either way, the API
spec must be updated in this slice or in a P1-12 docs pass.

### H2. `dirty_tables` is blind to single-select option-only changes

**Severity:** High (functional correctness; also affects diff output)
**Files:** `backend/features/project_document/tables/rooms.py:93–104`,
`backend/features/project_document/store.py:156–161`,
`backend/features/project_document/diff.py:39–46`

`dirty_tables` iterates registered contracts and compares each
contract's `extract_diff_value(version_body)` against
`extract_diff_value(draft_body)`. For Rooms, `extract_diff_value` is
aliased to `extract_room_rows`, which only returns
`[room.model_dump(mode="json") for room in body.tables.rooms]`.

But the Rooms slice contract semantically spans **rows + single-select
options** — see `apply_rooms_replace` at `rooms.py:58–71`, which
correctly compares both rows and options when detecting no-ops, and
`RoomsSliceResponse` which serializes both.

Consequence:

- If a user opens the Rooms tab, renames the "Ground" floor-level
  option to "Grade", and does not touch any room, the draft is
  created. `GET /draft` will return `source="draft"` and
  `dirty_tables=[]`. The frontend's `hasDraft = source === "draft"`
  still flips to true, so the header dirty indicator works for the
  current MVP — but `dirty_tables` is the wrong shape going forward.
- The same bug surfaces in the per-table diff. The Rooms diff in
  `/diff?from=…&to=…` will report `0 changed paths` for an option-only
  edit. The existing E2E (`health.spec.ts:99–104`) doesn't exercise
  this because both versions there have the same options.

**Recommendation:** `extract_diff_value` for Rooms should return a
composite shape that includes both rows and the rooms-scoped option
lists, e.g.:

```python
def extract_room_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "rooms": [room.model_dump(mode="json") for room in body.tables.rooms],
        "single_select_options": {
            key: [opt.model_dump(mode="json") for opt in body.single_select_options.get(key, [])]
            for key in ROOM_OPTION_KEYS
        },
    }
```

`extract_rows` (used by downloads/MCP) can stay row-only; only
`extract_diff_value` needs the broader shape. Add a regression test
that creates an option-only diff and asserts `dirty_tables == ["rooms"]`
and that the per-table diff reports the option path.

Technically this is also a P1-01 carryover (the row/option mismatch
in `extract_diff_value` was introduced when the registry shipped),
but P1-02 is the first user-visible consumer of `dirty_tables`, so
this is the right slice to fix it in.

### H3. Cross-tab regression: another tab's edit no longer dirties the header

**Severity:** High (cross-tab UX regression vs the prior implementation)
**File:** `frontend/src/features/equipment/hooks.ts:71–128`,
`frontend/src/features/project_document/hooks.ts:15–28`

Before P1-02, the header read `useRoomsSliceQuery` to compute the
dirty indicator. When Tab A wrote, `useRoomsDraftBroadcast` posted the
new slice on `BroadcastChannel`; Tab B's `onmessage` handler called
`queryClient.setQueryData(roomsQueryKeys.slice(...), message.slice)`,
which the header observed directly.

After P1-02, the header reads `useDraftSummaryQuery` instead. The
broadcast handler still updates the rooms slice cache but never
invalidates or updates the draft-summary cache. So:

1. Tab A creates a Rooms draft. `useReplaceRoomsSliceMutation`
   correctly invalidates the local summary
   (`equipment/hooks.ts:58–60`).
2. The broadcast fires.
3. Tab B receives it, updates its rooms slice cache, but the header
   in Tab B keeps showing "Clean" until window focus / reconnect /
   manual refetch causes a `/draft` refetch.

This was the exact scenario TB-06 set out to make safe; the P1-02
header refactor reopens a small piece of it.

**Recommendation:** In `useRoomsDraftBroadcast`'s `onmessage`
handler (`equipment/hooks.ts:90–107`), after applying the slice,
invalidate the draft summary for the same `(projectId, versionId)`:

```ts
queryClient.invalidateQueries({
  queryKey: projectDocumentQueryKeys.draftSummary(projectId, versionId),
});
```

Add a frontend unit test that mocks two `BroadcastChannel` listeners
and asserts the second tab's draft summary is invalidated after a
remote slice arrives. This also future-proofs the pattern: P1-11
should hoist the broadcast helper out of equipment, and the summary
invalidation belongs in that shared primitive (synthesis P0.5).

### H4. `invalidateProjectDocumentQueries` hardcodes the Rooms query key

**Severity:** High (recreates the coupling P1-02 is intended to remove)
**File:** `frontend/src/features/project_document/hooks.ts:15–28`

```ts
export function invalidateProjectDocumentQueries(
  queryClient: QueryClient,
  projectId: string,
  { detail = true, tables = true }: { detail?: boolean; tables?: boolean } = {},
) {
  if (detail) {
    queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) });
  }
  queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
  queryClient.invalidateQueries({ queryKey: projectDocumentQueryKeys.project(projectId) });
  if (tables) {
    queryClient.invalidateQueries({ queryKey: ["rooms", "project", projectId] });
  }
}
```

The `["rooms", "project", projectId]` literal is the inverse of the
coupling P1-02 was supposed to remove. The frontend `project_document`
feature now bakes in knowledge of every table feature's query-key
shape. Adding Windows in Phase 2 would require editing this helper
plus every future table feature.

This is **the same coupling shape as before**, just moved. P1-02's
acceptance criterion was "project shell no longer imports
`features/equipment`" — that is satisfied at the import-graph level
(no `import` statement) but is structurally violated by the literal
key reference.

**Recommendation:** Pick one of:

- (Lightweight) Have `equipment/hooks.ts` export
  `roomsQueryKeys.project` from a tiny shared location (e.g.,
  `shared/state/project-document-tables.ts`) and import it into
  `project_document/hooks.ts`. Either way the dependency exists; this
  at least makes it explicit at the import graph and avoids stringly
  hardcoded keys.
- (Phase-2 aligned) Introduce a small frontend table registry that
  mirrors the backend `iter_table_contracts()`. Each table feature
  registers its query key prefix on load (or via a static import map),
  and the document feature iterates registered prefixes. Aligns with
  the backend registry direction.
- (Acceptable interim) Add a `// TODO(P1-08): replace with table
  registry` comment so future readers know this is intentional debt,
  and remove the `tables` parameter so all callers opt in
  consistently. The current `{ detail: false, tables: true }` shape
  is also asymmetric — discard skips `detail` invalidation but still
  invalidates Rooms; save/save-as invalidate everything.

This doesn't have to land in P1-02. Flag it explicitly in the lessons
entry for the slice so it doesn't get lost.

## Medium-Priority Findings

### M1. Whole-document validation runs on every `/draft` GET

**Severity:** Medium (performance; acceptable at MVP scale)
**File:** `backend/features/project_document/store.py:67–100`

`get_draft_summary` calls `validate_document(version["body"])` and,
when a draft exists, `validate_document(draft["body"])`. Each call
runs the full Pydantic v2 model validation over the entire document.
Then `dirty_tables` calls `extract_diff_value` twice per registered
contract, which for Rooms does another `model_dump(mode="json")` per
room.

For the current empty-Rooms document this is microseconds. For a
project with thousands of Rooms rows (or once Windows / Envelope
land), the header poll on every page open / focus refetch will
re-validate and re-serialize the entire document twice. TanStack
Query's default `staleTime: 0` plus refetch-on-focus means this fires
frequently.

For Phase 1 with a single Rooms table this is fine. Flagging because
the cost compounds linearly with table count and document size.

**Recommendation:** Defer until profiling shows real cost. If a fix is
wanted now:

- Cache `dirty_tables` and `version_etag` per version body hash on a
  small in-memory dict, or denormalize a `draft_etag` and
  `dirty_tables` snapshot into `project_version_drafts` and update
  them on accepted writes. The latter mirrors the
  `projects.last_saved_at` denormalization pattern in
  `save-versioning.md` §8.2.1.

### M2. Two sources of truth for "is locked" in the frontend

**Severity:** Medium
**File:** `frontend/src/features/project_document/components/VersionControls.tsx:41–45`

```ts
const activeVersion = project.active_version;
const activeVersionId = activeVersion?.id ?? null;
const isEditor = project.access_mode === "editor";
const isLocked = activeVersion?.locked ?? false;
const draftSummaryQuery = useDraftSummaryQuery(project.id, activeVersionId, isEditor);
const draftSummary = draftSummaryQuery.data;
```

The component derives `isLocked` from the project detail
(`active_version.locked`) but the summary also returns `is_locked` and
`can_edit`. The component never reads `draftSummary.is_locked` or
`draftSummary.can_edit`.

This is a minor inconsistency: after `usePatchVersionMutation`
returns, the project detail cache is updated immediately
(`projects/hooks.ts:75–78`), and `VersionControls.tsx:119` also
explicitly refetches the summary. So they typically converge. But:

- The lock UI only reflects the lock state from the project detail.
- If a future MCP write or another tab locks the version, the
  summary will be the first thing to notice (it refetches on focus);
  the project detail may lag.
- `can_edit` is computed server-side and would naturally extend to
  factor in things like "MCP edit lease active" (US-Concurrency 9 /
  save-versioning §8.5). The frontend doesn't surface this signal at
  all today.

**Recommendation:** Move `isLocked` to read from `draftSummary` when
available, falling back to `activeVersion.locked` when the summary
hasn't loaded yet (or for viewers, where the summary is
intentionally not fetched). Use `draftSummary.can_edit` for any
write-control enable/disable instead of `!isLocked`, so future
lease/permission signals can be added server-side without frontend
fan-out.

### M3. `VersionControls.tsx` is at 336 lines; soft limit is 300

**Severity:** Medium (CODING_STANDARDS §"Component Size And Splitting")
**File:** `frontend/src/features/project_document/components/VersionControls.tsx`

The file is right past the 300-line soft limit. The natural splits
exist already:

- The Save As modal (lines ~251–296) is its own concern;
  `SaveAsModal.tsx` was specifically called out in the synthesis
  recommended shape.
- The Diff modal (lines ~297–332) is also its own concern;
  `DiffModal.tsx` was called out in the synthesis.
- The version popover (lines ~216–250) is structurally separate.

The synthesis's suggested frontend shape:

```text
frontend/src/features/project_document/
  components/
    VersionControls.tsx
    SaveAsModal.tsx
    DiffModal.tsx
```

was explicitly listed. The current implementation lands all three in
one file.

**Recommendation:** Extract `SaveAsModal.tsx` and `DiffModal.tsx` as
separate components, passing the small set of props each needs. Each
extracted file will be well under 100 lines; the parent drops to
under 200. Not a blocker.

### M4. `last_patched_at` is exposed but unused

**Severity:** Low/Medium (forward-compatible; flag so it doesn't rot)
**Files:** `backend/features/project_document/models.py:30–41`,
`frontend/src/features/project_document/types.ts`,
`VersionControls.tsx`

The summary returns `last_patched_at`. The frontend type carries it
through. No component reads it.

US-3 criterion 2 (`context/user-stories/00-foundation-shell.md`)
mentions the save status indicator and overflow menu but doesn't yet
require a "last edited 5 min ago" string. The TB-04b lessons
explicitly call out "verify `expires_at`/keepalive behavior before
relying on long-lived editable draft state" — P1-11 will need this
metadata to drive stale-draft warnings.

**Recommendation:** Keep the field on the wire. Either add a test that
asserts `last_patched_at` is a parseable ISO 8601 timestamp matching
the Rooms write time (the current test only checks truthiness), or
document on the model that this field is reserved for P1-11. Either
prevents the field from silently rotting.

### M5. Discard / dirty-switch confirms still use `window.confirm`

**Severity:** Low (acknowledged tracer leftover; not in P1-02 scope)
**File:** `VersionControls.tsx:108, 116, 124–128`

The discard, unlock, and dirty-version-switch prompts use
`window.confirm`. The synthesis explicitly calls out (Table POC
carry-forward checklist): "POC `window.confirm` shortcuts must become
real dialogs." US-Versions-Lifecycle and US-Concurrency expect a real
restore/discard prompt, dirty-draft prompt before version switch, and
beforeunload warning.

This is P1-11 scope per the buildout plan and not a P1-02 blocker.
Flagging only so it doesn't get forgotten — the current header still
relies on `window.confirm` and the dirty-switch prompt does not
distinguish Save / Save As / Discard the way US-3.1 criteria 2
prescribes.

### M6. `get_draft_summary` fails closed on invalid saved bodies

**Severity:** Medium (cross-impact with P1-03)
**File:** `backend/features/project_document/store.py:67–100`

When `version["body"]` doesn't satisfy `ProjectDocumentV1.validate`,
`validate_document` raises `422 invalid_project_document`. That now
applies to the header poll for every project page load when the saved
body is older/invalid.

P1-03 is the slice that owns read-safe-mode. But P1-02 has expanded
the validation surface area: any read by the header now requires a
valid saved body. Before P1-02 the header read only the Rooms slice
(which already failed validation but is editor-side); with the new
summary the saved-body check happens on every editor's page load.

**Recommendation:** No action in P1-02. Mark this in the P1-03 plan so
read-safe-mode covers the summary endpoint as well as the table read
endpoints. Without that, an older project with an unmigrated body
would render the project shell with a broken header banner.

## Low-Priority Findings / Style

### L1. `extract_room_rows` does `model_dump(mode="json")` per row for comparison

**File:** `backend/features/project_document/tables/rooms.py:93–104`

Pydantic v2 model instances support `==` directly. Comparing
`body.tables.rooms` lists of `RoomRow` would short-circuit on the
first differing field and avoid building two parallel list-of-dicts
just to compare them. The same is true for the diff path computation
in `diff.py:60–73`, where comparing models would only fall through to
the JSON dict walker for the smallest possible subtree.

For Phase 1 row counts this is invisible. Flagging for the same M1
performance reason: it would compound with table count.

**Recommendation:** Defer. If H2 is addressed by returning a richer
shape, revisit `extract_diff_value` once to decide whether to keep
JSON-shaped or move to model-shaped comparison.

### L2. `invalidateProjectVersionQueries` signature inconsistency

**File:** `frontend/src/features/projects/hooks.ts:8–17`

```ts
function invalidateProjectVersionQueries(
  queryClient: QueryClient,
  projectId: string,
  detail = true,
) {
  // ...
}
```

This used to take an options object (`{ detail, rooms }`). It's now a
positional bool. Meanwhile,
`invalidateProjectDocumentQueries` in the new feature uses
`{ detail, tables }`. They diverged. Minor style nit; pick one.

**Recommendation:** Either inline `invalidateProjectVersionQueries`
into `usePatchVersionMutation` (it's the only caller and only does two
invalidations) or keep both helpers and align their signatures on the
options-object pattern.

### L3. Frontend lacks a test for cross-tab draft summary sync

Related to H3. Even if H3 is resolved, the new
`features/project_document` hooks have no unit tests of their own. A
small Vitest suite covering:

- `projectDocumentQueryKeys.draftSummary` shape;
- `invalidateProjectDocumentQueries` invalidation set;
- mutation `onSuccess` invalidation behavior;

…would cover the new feature on the same footing as the
`features/projects` hooks.

### L4. The new `useDraftSummaryQuery` enabled gate

**File:** `frontend/src/features/project_document/hooks.ts:30–37`

```ts
return useQuery({
  queryKey: projectDocumentQueryKeys.draftSummary(projectId, resolvedVersionId),
  queryFn: ({ signal }) => fetchDraftSummary(projectId, resolvedVersionId, signal),
  enabled: enabled && resolvedVersionId.length > 0,
});
```

Caller passes `enabled = isEditor`. The query also depends on
`resolvedVersionId.length > 0`. For a viewer that becomes an editor
mid-session (after sign-in), the query enables correctly. For an
editor whose session expires (and the next request gets a 401), the
header will surface a generic error toast through TanStack Query's
default retry. That's the right behavior, but the existing
session-expiry modal (TB-01 follow-up; still deferred) hasn't been
wired into this path yet.

Not a blocker; tracking with the session-expiry follow-up.

### L5. Tests only cover the happy/locked paths

**File:** `backend/tests/test_project_document.py:249–301`

The two new tests cover:

1. Clean → dirty after `create_rooms_draft`.
2. Locked + draft preserved.

Missing coverage worth adding:

- After `POST /draft/save`, the summary returns to
  `source="version"`, empty `dirty_tables`, and `draft_etag=null`.
- After `POST /draft/save-as`, the **source** version's summary
  returns to clean (the source draft was consumed).
- After `DELETE /draft`, the summary returns to
  `source="version"`.
- A second editor's summary on the same version reflects only their
  own draft (the `(version_id, user_id)` PK on
  `project_version_drafts`).
- A `dirty_tables` test that creates a Rooms draft with **only**
  option changes (no row changes) — would have caught H2.

## PRD / Context Alignment Check

| Doc / criterion | Status |
|---|---|
| `save-versioning.md` §8.2: Save/Save As/Discard/Lock as version operations | ✅ All five live on `VersionControls` and call into `project_document` hooks. |
| `save-versioning.md` §8.2.1: Service owns denormalized `last_saved_at` | ✅ Unchanged by P1-02; `save_draft`/`save_draft_as` in `drafts.py` still do this. |
| `save-versioning.md` §8.3 draft buffer properties | ✅ Implementation unchanged; summary reads `project_version_drafts.last_patched_at` directly. |
| `save-versioning.md` §8.5 concurrency: `If-Match: <version_body_etag>` on Save | ✅ `VersionControls.tsx:87` uses `draftSummary.version_etag`. |
| `save-versioning.md` §8.5 concurrency: dirty-draft prompt before version switch | ⚠️ Uses `window.confirm` only; full prompt with Save/Save As/Discard is P1-11. |
| `save-versioning.md` §8.5 concurrency: same-editor tab broadcast | ⚠️ See H3 — summary cache regression vs TB-06. |
| `api.md` §9.5 `GET /draft` documented contract | ❌ See H1 — doc drift. |
| `api.md` §9.6 diff endpoint | ✅ Unchanged. |
| `api.md` §9.7 downloads | ✅ `Project JSON` stays on header; `Rooms JSON` moves to Equipment, consistent with "document-level vs table-level" split. |
| `00-foundation-shell.md` US-3 criterion 2: header with version dropdown, save status, Save, overflow menu | ✅ All present in `VersionControls.tsx`. Overflow menu items (Save As, Discard, Lock/Unlock, Project settings) are inline buttons rather than a `⋯` menu — UI-polish work for P1-04/P1-05. |
| `00-foundation-shell.md` US-3.1 criterion 2: dirty prompt with Save / Save As / Discard | ⚠️ Single `window.confirm` only; P1-11 scope. |
| `00-foundation-shell.md` US-Errors-SchemaFallback | ⚠️ See M6; P1-03 scope. |
| `CODING_STANDARDS.md` backend feature shape | ✅ Routes-models-service-repository preserved; `store.py` adds the summary loader. |
| `CODING_STANDARDS.md` frontend feature shape | ✅ New `features/project_document/` has `api.ts`, `hooks.ts`, `types.ts`, `components/`. Missing `routes/` is fine — this feature has no page-level routes; it composes into the project shell. |
| `CODING_STANDARDS.md` 300-line component soft limit | ⚠️ See M5. |

## Security / Privacy Spot Check

- ✅ `GET /draft` requires editor access (`ProjectEditAccess` in
  `routes.py:80`). A public viewer cannot enumerate draft activity.
- ✅ The frontend gates `useDraftSummaryQuery` with `isEditor` so a
  viewer page never issues the request.
- ✅ Rooms JSON download via `tableDownloadUrl` still uses
  `ProjectViewAccess` (so public read works), and `Project JSON`
  download is also viewer-accessible — both consistent with §9.7.
- ✅ Save/Save As/Discard remain editor-only; the existing access
  checks were not touched.
- ✅ No new logged-in-user / cross-user data leakage: the
  `repository.get_draft` call filters on `(version_id, user_id)` so
  Editor A cannot see Editor B's draft. (Tested implicitly through
  the existing draft-create tests; explicit test recommended in L5.)
- ✅ Token-revocation behavior unchanged (TB-04b path).
- ✅ No new SQL composition; the only new repository call is the
  existing parameterized `get_draft`.

No security regressions identified.

## Performance Spot Check

See M1 and L1. Net cost: one additional `GET /draft` request per
editor project page load and on window focus, returning a small
JSON payload (~200 bytes for an empty document). Backend cost is
two whole-document validations + N×table extractions. Acceptable
for Phase 1 scale; flagged for revisit before document size grows
or table count grows past Rooms.

## Suggested Follow-Up Actions Before Phase 2 Table Work

The P1-02 acceptance gate is met and the deliverable can be marked
complete. The following should be tracked as scope additions on
existing slices rather than as new slices:

1. **Resolve H1** in a P1-12 (or earlier) docs pass: update
   `api.md` §9.5 to document the summary shape and clarify there is
   no whole-draft body endpoint in v1.
2. **Resolve H2** in this slice or as a small follow-up: fix
   `extract_diff_value` for Rooms to include single-select options.
   Add a regression test. This is a real correctness bug, not a
   nice-to-have.
3. **Resolve H3** in this slice as a one-line fix to the broadcast
   handler. The whole point of P1-02 was a table-neutral dirty
   indicator — the cross-tab path should match.
4. **Roll H4 into P1-08** (DataTable extraction) or P1-11 (concurrency
   UX): introduce a shared way for tables to register their query
   keys with `project_document`, or to receive invalidate-after-save
   notifications. Until then, the hardcoded `["rooms", ...]` key is
   acceptable but should carry a `// TODO(P1-08)` marker.
5. **Address M2 and M3** as small polish items in either this slice or
   P1-04 (design-system foundation). M3 splitting is mechanical.
6. **Re-test M6** intersection with P1-03 before declaring P1-03
   complete: invalid saved bodies must not break the project shell
   header.

## Final Recommendation

P1-02 is approved for the slice's stated scope. The
`features/project_document` boundary is in the right place, the
backend endpoint shape matches the synthesis recommendation, and the
removal of Equipment→Projects coupling is real at the import-graph
level. The four "High" findings above are repairs to the new boundary
rather than rejections of it:

- H1 is a docs-pass fix.
- H2 is a single-function expansion plus a test.
- H3 is a one-line fix to a broadcast handler plus a test.
- H4 is a debt marker plus an alignment with the eventual table
  registry.

None of them block proceeding to P1-03. H2 and H3 should land as
amendments to this slice rather than carried as silent debt — they
both turn off existing behavior (option diff visibility, cross-tab
header sync) that worked before P1-02.
