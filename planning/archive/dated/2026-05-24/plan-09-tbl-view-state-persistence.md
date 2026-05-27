---
DATE: 2026-05-24
TIME: planning
STATUS: Revised draft. Ninth and final in the 9-plan AirTable-parity
        polish series. Sequenced 9/9 (depends on the ViewState shape
        that plans 06-08 finalize).
SCOPE: Persist per-user project-table `ViewState` for every
       (user, project, table) across sessions and devices. Frontend
       loads the saved view before rendering the table; debounced
       auto-save writes user view changes; reset deletes the saved row.
       Replaces Phase 4's "session-only" rule
       (US-Builder-Tables criterion 3) without changing the controlled
       in-memory DataTable contract.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-VIEW-1)
PRECEDING-PLANS:
  - planning/archive/dated/2026-05-24/completed/plan-06-tbl-summary-bar.md
    (`ViewState.aggregations` shape finalized - null for explicit-
    clear)
  - planning/archive/dated/2026-05-24/plan-07-tbl-hide-show-fields.md
    (`ViewState.hiddenColumns` + `columnOrder` introduced)
  - planning/archive/dated/2026-05-24/plan-08-tbl-column-reorder.md
    (header drag writes to `columnOrder`; same field)
RELATED:
  - backend/features/ (FastAPI feature folders; new feature
    `table_views/`)
  - backend/alembic/versions/ (new migration for the persistence
    table)
  - frontend/src/shared/ui/data-table/types.ts (`ViewState`)
  - frontend/src/features/table_views/ NEW (project-table persistence
    adapter and hook)
  - context/CODING_STANDARDS.md (backend/frontend feature layout)
---

# Plan 09 - Persist table view state across sessions

## 1. Why this plan exists

Today, per-table `ViewState` is held by the table consumer. In the
Rooms slice this is local React state in `EquipmentTab`, so switching
sub-tabs can preserve state while reload, sign-out, or another device
resets to defaults. That was a deliberate Phase 4 simplification
(Q-TBL-1 in `30-tables-equipment.md`) that deferred persistence until
the AirTable-parity polish pass.

This revision keeps the original story scope: one last-used view per
authenticated user per project table. It does **not** implement named
or shareable views. The durable design goal is to make user preference
persistence boring now while leaving a clean path to NEW-TBL-1 later.

The architectural rule is important: `<DataTable>` remains a controlled,
reusable table primitive. Project-table persistence is a feature-layer
adapter that loads, sanitizes, saves, and clears `ViewState` for the
parent. Shared DataTable code may own pure sanitization helpers, but it
must not import project IDs, auth/session state, or REST clients.

## 2. Binding constraints

1. **Backend feature folder per current repo layout.** New folder
   `backend/features/table_views/` with `routes.py`, `models.py`,
   `service.py`, and `repository.py`. Register the router in
   `backend/main.py`. Strict typing, Pydantic v2, raw parameterized
   SQL through repository modules.

2. **Storage: one bounded Postgres table for project tables.**
   ```sql
   CREATE TABLE user_table_views (
     user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     project_id                UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     table_key                 TEXT NOT NULL,
     view_state_schema_version INTEGER NOT NULL DEFAULT 1,
     view_state                JSONB NOT NULL,
     view_state_size_bytes     INTEGER NOT NULL,
     updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, project_id, table_key),
     CHECK (view_state_schema_version = 1),
     CHECK (view_state_size_bytes <= 65536),
     CHECK (table_key ~ '^[a-z][a-z0-9_]*$')
   );

   CREATE INDEX idx_user_table_views_project_lookup
     ON user_table_views (project_id, table_key);
   ```
   `65536` bytes is intentionally generous for sort/filter/group,
   column order, hidden columns, widths, aggregations, and expanded
   group state. If a real view approaches that size, something else is
   wrong.

3. **Scope is project-document tables only.** The key is
   `(user_id, project_id, table_key)`. Do not wire global catalog
   manager tables through this table unless/until a separate
   `scope_type/scope_id` design is accepted. This plan should wire
   Rooms first and any other project-document tables only when they
   actually use the shared DataTable path.

4. **API surface - three endpoints under `/api/v1`.**
   - `GET /api/v1/projects/{project_id}/table-views/{table_key}`:
     returns `{ "view_state": {...} | null, "view_state_schema_version": 1, "updated_at": "..." | null }`.
     Missing saved row returns 200 with `view_state: null`.
   - `PUT /api/v1/projects/{project_id}/table-views/{table_key}`:
     idempotent upsert of a bounded schema-versioned view body.
   - `DELETE /api/v1/projects/{project_id}/table-views/{table_key}`:
     reset-to-default persistence operation. Delete is required because
     a stored copy of today's defaults becomes stale when tomorrow's
     defaults or fields change.

5. **Authentication/access.** All three endpoints require an
   authenticated editor identity via the existing project access seam.
   Public Viewer mode must never read or write saved user view state.
   Locked versions are still allowed because this is user preference
   state, not project-document mutation.

6. **Backend validates the envelope, frontend owns ViewState shape.**
   Backend validates auth, project access, table-key syntax, JSON
   serializability, schema version, and byte size. Backend does not
   reimplement DataTable field semantics. It stores the opaque JSONB
   payload after those envelope checks.

7. **Frontend persistence lives in feature code.** Add
   `frontend/src/features/table_views/` for API client, types, and
   `useProjectTableViewState`. The hook accepts project/table IDs,
   defaults, columns/field defs for sanitization, and returns the
   controlled `{ view, onViewChange, isLoading, reset }` values the
   parent passes into `<DataTable>`.

8. **Load gate avoids default flash.** Authenticated project-table
   consumers must render a compact table skeleton/loading state until
   the saved view GET resolves or fails. Do not render defaults first
   and then swap to the saved view.

9. **Save trigger: debounced 500 ms with an in-flight queue.** Every
   user-originated mutation to view state schedules a save after 500 ms.
   At most one save request may be in flight per mounted table view. If
   a newer view arrives while an older save is in flight, keep only the
   latest pending view and flush it after the in-flight request settles.
   Last user intent wins even when network responses complete out of
   order.

10. **Sanitization is render-safe, not destructive.** Stored view state
    may reference columns or single-select options that no longer exist
    in the currently rendered schema. The frontend sanitizes before
    render by dropping invalid field refs, option refs, hidden/order/
    width entries, aggregation entries, and incompatible group
    expansion keys. Do **not** auto-save the sanitized view just because
    a stale reference was dropped; opening an older locked version or a
    partial schema must not destroy a useful head-version preference.
    Sanitized state is saved only after the user makes a new explicit
    view change or clicks reset.

11. **No frontend feature flag.** The feature is on for authenticated
    project tables once shipped. Fresh users get defaults because no row
    exists.

12. **Docs must be reconciled after implementation.** The stable
    DataTable requirements still describe session-only v1 behavior.
    After this lands, update `context/technical-requirements/data-table.md`
    and any story text that still says persisted table views are
    deferred.

## 3. Acceptance criteria

1. **Apply view -> reload page -> view restored.** Apply a filter on
   Rooms (`floor_level = 1st`). Reload. The filtered view renders
   without an unfiltered flash.
2. **Sign out / sign in -> view restored.** Same view is restored
   across auth and on another browser/device for the same user.
3. **Per-user isolation.** User A applies a filter on project X Rooms;
   user B opens the same project Rooms and sees defaults.
4. **Per-project isolation.** User A applies a view on project X Rooms;
   project Y Rooms still opens with defaults.
5. **Per-table isolation.** User A applies a view on Rooms; ERVs/Fans or
   another project table opens with its own default/saved view.
6. **Debounced save.** Rapidly change sort five times within 500 ms.
   Only one PUT fires after the final change.
7. **Out-of-order save safety.** Simulate a slow older PUT resolving
   after a newer view change. Reload restores the newest user intent.
8. **Reset deletes persistence.** Click "Reset view"; local state resets
   to current defaults and a DELETE fires. Reload still uses current
   defaults because no saved row exists.
9. **All persisted ViewState fields round-trip:** `filter`, `sort`,
   `group`, `expandedGroups`, `aggregations`, `hiddenColumns`,
   `columnOrder`, and `columnWidths` if column widths are active in
   this slice. If column widths are not user-editable yet, document that
   they remain dormant but schema-compatible.
10. **Missing-column tolerance.** Manually seed a stored view whose sort
    references a non-existent column. Reload drops that sort for render,
    preserves the rest of the view, and does not immediately overwrite
    the stored row.
11. **Missing-option tolerance.** Manually seed a single-select filter
    with a deleted option id. Reload drops or prunes the invalid option
    reference without crashing.
12. **Locked version inherits same view.** Switching to an older locked
    version uses the same saved view record, sanitized only for render.
13. **Viewer mode no persistence.** Open a public/anonymous Viewer URL:
    no table-view GET, PUT, or DELETE fires.
14. **Invalid/oversized payloads fail closed.** Bad table keys,
    malformed JSON, unsupported schema versions, and over-limit payloads
    return structured 400 responses and do not write rows.
15. **Backend tests pass:** repository, service, routes, auth/access,
    DELETE reset, payload bounds.
16. **Frontend tests pass:** load gate, save debounce, in-flight queue,
    reset DELETE, sanitization, anonymous no-op, project/table switch
    cancellation.
17. **No regression** to controlled in-memory DataTable behavior across
    sub-tab navigation while the component remains mounted.

## 4. Target architecture

### 4.1 Backend file changes

```
backend/features/table_views/
  __init__.py          NEW
  models.py            NEW - Pydantic v2 request/response envelopes:
                       TableViewUpsertRequest,
                       TableViewResponse.
  repository.py        NEW - raw SQL:
                       get(conn, user_id, project_id, table_key)
                       upsert(conn, user_id, project_id, table_key,
                              schema_version, view_state, size_bytes)
                       delete(conn, user_id, project_id, table_key)
  service.py           NEW - validate authenticated editor access,
                       compute JSON byte size, call repository.
  routes.py            NEW - APIRouter at
                       /api/v1/projects/{project_id}/table-views
                       with GET, PUT, DELETE.

backend/main.py        EXTENDED - include the new router.

backend/alembic/versions/<timestamp>_add_user_table_views.py
                       NEW migration for the table above.

backend/tests/test_table_views.py
                       NEW tests for repository/service/routes.
```

Route dependencies should mirror the existing project-scoped feature
style: use `require_project_edit_access` or equivalent authenticated
editor access, then derive `user_id` from `access.user`. Do not use
anonymous-capable public view access for these endpoints.

### 4.2 Frontend file changes

```
frontend/src/features/table_views/
  api.ts                       NEW - fetchTableView, saveTableView,
                               deleteTableView via shared fetchJson.
  types.ts                     NEW - TableViewResponse,
                               TableViewUpsertRequest.
  useProjectTableViewState.ts  NEW - feature-layer persistence hook.
  __tests__/
    useProjectTableViewState.test.ts

frontend/src/shared/ui/data-table/
  lib.ts                       EXTENDED with pure
                               sanitizeViewStateForSchema(...)
                               if no existing helper fits.
  __tests__/sanitizeViewState.test.ts

frontend/src/features/equipment/routes/EquipmentTab.tsx
                               UPDATE Rooms wiring from local
                               useState(emptyViewState) to
                               useProjectTableViewState.
```

The shared DataTable package stays storage-agnostic. If the hook shape
later needs to support global catalog tables, add a different adapter or
generalize the storage key deliberately; do not smuggle catalog tables
through a fake project id.

### 4.3 API contract details

**GET response with a saved row:**
```json
{
  "view_state_schema_version": 1,
  "view_state": {
    "filter": [],
    "sort": [],
    "group": [],
    "aggregations": {},
    "columnOrder": [],
    "columnWidths": {},
    "hiddenColumns": [],
    "expandedGroups": {}
  },
  "updated_at": "2026-05-24T15:30:00Z"
}
```

**GET response without a saved row:**
```json
{
  "view_state_schema_version": 1,
  "view_state": null,
  "updated_at": null
}
```

**PUT request body:**
```json
{
  "view_state_schema_version": 1,
  "view_state": {
    "filter": [],
    "sort": [],
    "group": [],
    "aggregations": {},
    "columnOrder": [],
    "columnWidths": {},
    "hiddenColumns": [],
    "expandedGroups": {}
  }
}
```

**PUT response:** same shape as saved-row GET.

**DELETE response:** `204 No Content`.

Errors:
- `401` when unauthenticated.
- `404` when project does not exist.
- `400` for malformed body, unsupported `view_state_schema_version`,
  invalid `table_key`, non-object `view_state`, or over-limit payload.
- `5xx` surfaces as "View persistence unavailable"; in-memory state
  continues to work, but the UI should not pretend the view was saved.

### 4.4 `useProjectTableViewState` sketch

```ts
export function useProjectTableViewState(args: {
  projectId: string;
  tableKey: string;
  defaults: ViewState;
  enabled: boolean; // authenticated editor only
  columns: DataTableColumnDef<unknown>[];
  fieldDefs: FieldDef[];
}): {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  isLoading: boolean;
  reset: () => void;
  saveError: string | null;
} {
  // State:
  // - renderView: sanitized view used by DataTable
  // - loaded: false until GET settles when enabled
  // - saveInFlight: boolean/ref
  // - pendingSave: latest ViewState | null
  // - mounted scope token: `${projectId}:${tableKey}`
  //
  // Load:
  // - if !enabled, use defaults and never call the API.
  // - if enabled, render skeleton until GET settles.
  // - ignore stale GET responses after project/table changes.
  //
  // Save:
  // - onViewChange updates renderView immediately.
  // - debounce for 500 ms.
  // - flushSave(next) sends at most one PUT at a time.
  // - if a newer next arrives while saving, replace pendingSave.
  // - when current PUT settles, flush latest pendingSave if any.
  //
  // Reset:
  // - cancel pending debounce/save intent.
  // - set renderView(defaults).
  // - DELETE saved row immediately.
  //
  // Sanitization:
  // - sanitize loaded and user-provided views before render.
  // - do not save sanitized loaded state unless a user view change
  //   occurs after load.
}
```

## 5. Test plan

**Backend:**
- Repository upsert inserts and updates rows.
- Repository delete removes an existing row and is idempotent for a
  missing row.
- Repository get returns `None` for a missing row.
- Service computes byte size and rejects over-limit payloads.
- Service rejects unsupported schema versions.
- Routes require authentication for GET/PUT/DELETE.
- Routes reject invalid table keys.
- GET missing row returns 200 with `view_state: null`.
- PUT happy path returns the saved row.
- DELETE happy path returns 204 and subsequent GET returns null.
- Project not found returns 404.

**Frontend:**
- Enabled hook renders loading state until GET settles, then applies the
  saved view.
- Missing saved row applies defaults after load.
- Disabled hook (Viewer/anonymous) never calls GET/PUT/DELETE.
- `onViewChange` debounces PUT.
- Rapid changes collapse to one PUT with the final state.
- Slow older PUT cannot overwrite a newer pending state.
- Reset cancels pending save intent and calls DELETE immediately.
- Stale GET response after project/table switch is ignored.
- Missing field refs are dropped for render.
- Missing single-select option refs are pruned/dropped for render.
- Sanitized load does not auto-save until a user change occurs.

**Smoke / E2E:**
- Sign in as seed user.
- Open Rooms.
- Apply filter, sort, group, aggregation, hidden column, column order,
  and column width if enabled.
- Wait for save.
- Reload.
- Confirm the table first renders in the persisted state.
- Reset view.
- Reload.
- Confirm defaults from no saved row.

## 6. Execution order

Five steps. Keep the tree green after each step.

### Step 1 - Backend migration + repository

- Generate Alembic migration from `backend/`:
  `uv run alembic revision -m "add user_table_views"`.
- Edit migration to create `user_table_views` with UUID user FK,
  project FK, schema version, JSONB payload, byte-size column, and
  checks.
- Add `backend/features/table_views/repository.py`.
- Add repository tests.
- Run targeted backend tests.

### Step 2 - Backend service + routes

- Add `models.py`, `service.py`, and `routes.py`.
- Register router in `backend/main.py`.
- Enforce authenticated editor access for GET/PUT/DELETE.
- Add route/service tests for auth, malformed payloads, bounds, and
  reset DELETE.
- Confirm with `make backend` and manual `curl` against `/api/v1`.

### Step 3 - Frontend persistence adapter + sanitizer

- Add `frontend/src/features/table_views/api.ts`.
- Add `useProjectTableViewState.ts`.
- Add or extend pure DataTable sanitization helper.
- Add unit tests for load gate, debounce, save queue, reset, stale
  responses, and sanitization.
- Hook remains unconsumed until Step 4.

### Step 4 - Rooms consumer wiring

- Replace Rooms local `useState(emptyViewState)` with
  `useProjectTableViewState`.
- Gate rendering with a compact table skeleton while authenticated
  view state loads.
- Wire DataTable reset to hook `reset()`.
- Keep DataTable controlled and storage-agnostic.
- Add/extend consumer tests for Rooms integration.

### Step 5 - End-to-end demo + docs sync

- Run `make typecheck && make lint && make test && make smoke`.
- Run `make dev` and walk the demo script in §9.
- Update stable docs that still state view state is session-only:
  `context/technical-requirements/data-table.md` at minimum, plus any
  story text that should now point to US-TBL-VIEW-1 as implemented.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| First-render flash shows defaults before saved view applies. | Authenticated consumers render a skeleton until GET settles. No default table render before load. |
| Slow/out-of-order PUT overwrites newer user intent. | Hook owns one in-flight save plus latest-pending queue. Tests simulate old PUT resolving last. |
| Reset stores stale defaults. | Reset uses DELETE, not PUT-with-defaults. Defaults are recomputed from current code/schema on next load. |
| Opening an old locked version drops fields/options and overwrites the head-version preference. | Sanitization is render-only on load. No auto-GC save occurs without a later explicit user view change. |
| Opaque JSONB becomes an unbounded write surface. | Backend enforces schema version, object shape, JSON byte size, table-key syntax, authenticated editor access, and origin middleware for mutating browser requests. |
| Shared DataTable becomes coupled to project/auth/API state. | Persistence hook lives under `features/table_views`; shared DataTable only exports pure types/helpers. |
| Catalog manager needs similar persistence later. | This plan explicitly scopes to project-document tables. A later design can add `scope_type/scope_id` or named views without fake project ids. |
| Schema renames make useful saved views partially stale. | Sanitizer drops stale refs for render. For planned field renames, add a one-off JSONB migration or a schema-version transformer. |
| User identity changes orphan rows. | `user_id` FK cascades on deleted users. Identity-provider migrations need explicit user-id preservation or a one-time row migration. |
| Storage grows over time. | One row per `(user, project, table)` plus 64 KB cap. Project/user FK cascades clean up most rows. |
| MCP wants equivalent operations. | REST API is small and explicit. MCP wrapper remains a separate roadmap item using the same authorization/scoping rules. |

## 8. What this plan explicitly does not do

- Does not implement named/shareable views (NEW-TBL-1 remains
  post-parity).
- Does not persist active-cell, selection, or scroll position.
- Does not persist anonymous Viewer mode preferences.
- Does not add catalog-manager table-view persistence.
- Does not migrate existing stored views because no production rows
  exist yet.
- Does not wrap the endpoints in the MCP server.
- Does not normalize ViewState into relational columns.
- Does not implement multi-device conflict UI beyond latest user intent
  winning in the save queue.
- Does not add a frontend feature flag.

## 9. Demo script

1. `make dev` -> DB up; backend up; frontend up.
2. Sign in as seed user.
3. Open Rooms. Apply a filter (`floor_level = 1st`), a sort
   (`number asc`), a group (`floor_level`), pick an aggregate in the
   summary bar (`Sum` on iCFA), hide a column (`notes`), reorder
   `iCFA factor` to second, and resize a column if widths are enabled.
4. Wait 600 ms.
5. Confirm one PUT to
   `/api/v1/projects/{id}/table-views/rooms` with schema version 1.
6. Reload the page. Confirm the first rendered table state is the saved
   view, not defaults.
7. Sign out. Sign back in. Open Rooms -> restored.
8. Open Rooms as a different seed user -> defaults.
9. Switch to another project table -> defaults or that table's own
   saved view.
10. Switch back to Rooms -> restored.
11. Open project Y's Rooms -> defaults.
12. Apply many rapid sort changes -> confirm only final state is saved.
13. Simulate a slow older PUT in test/dev tools -> confirm final state
    wins after reload.
14. Reset view via toolbar overflow -> local defaults and DELETE fire.
    Reload -> defaults confirmed with no saved row.
15. Manually seed a stored view with a non-existent column and deleted
    option id. Reload -> invalid refs are dropped for render; row is
    not rewritten until a new user view change.
16. Open a Viewer-mode URL anonymous -> no table-view API calls.
17. Switch to a locked older version -> same saved view applies,
    sanitized for render only.
18. Chrome + Safari - repeat 3, 6, 12, and 14.

## 10. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 - backend migration + repository | 2.0 | 3.0 |
| 2 - backend service + routes | 2.5 | 4.0 |
| 3 - frontend adapter + sanitizer | 3.5 | 5.5 |
| 4 - Rooms consumer wiring | 1.0 | 2.0 |
| 5 - E2E + docs sync | 1.5 | 2.5 |
| **Total** | **10.5** | **17.0** |

This is still roughly one to two workdays, but the previous estimate
was low because it omitted DELETE reset, save-queue correctness, payload
bounds, and docs reconciliation.

## 11. Commit plan

1. `feat(backend): add table view persistence store`
2. `feat(backend): expose project table view API`
3. `feat(frontend): add project table view state adapter`
4. `feat(equipment): persist Rooms table view state`
5. `docs(table-views): reconcile persisted view-state docs`

## 12. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 - backend migration + repository | | | |
| 2 - backend service + routes | | | |
| 3 - frontend adapter + sanitizer | | | |
| 4 - Rooms consumer wiring | | | |
| 5 - E2E + docs sync | | | |
| Plan 09 overall | | | |
