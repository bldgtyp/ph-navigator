---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Ninth and final in the 9-plan AirTable-parity polish
        series. Sequenced 9/9 (depends on the ViewState shape that
        plans 06–08 finalize).
SCOPE: Persist per-user `ViewState` for every (user, project, table)
       across sessions. Frontend loads the saved view on table
       mount; debounced auto-save on every view change. Replaces
       Phase 4's "session-only" rule (US-Builder-Tables criterion 3)
       with backend-backed persistence — without changing in-memory
       ViewState semantics.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-VIEW-1)
PRECEDING-PLANS:
  - docs/plans/2026-05-24/plan-06-tbl-summary-bar.md
    (`ViewState.aggregations` shape finalized — null for explicit-
    clear)
  - docs/plans/2026-05-24/plan-07-tbl-hide-show-fields.md
    (`ViewState.columnVisibility` + `columnOrder` introduced)
  - docs/plans/2026-05-24/plan-08-tbl-column-reorder.md
    (header drag writes to `columnOrder`; same field)
RELATED:
  - backend/app/ (FastAPI feature folders; new feature
    `table_views/`)
  - backend/alembic/versions/ (new migration for the persistence
    table)
  - frontend/src/shared/ui/data-table/types.ts (`ViewState`)
  - frontend/src/shared/ui/data-table/hooks/useGridViewState.ts NEW
  - context/CODING_STANDARDS.md (backend feature layout pattern)
---

# Plan 09 — Persist table view state across sessions

## 1. Why this plan exists

Today, per-table `ViewState` lives in an in-memory Zustand store
keyed by `(project_id, table_key)`. Switching sub-tabs preserves
state; reloading or signing out resets to defaults. This is a
deliberate Phase 4 simplification (Q-TBL-1 in
`30-tables-equipment.md`) that punted persistence to "when needed."

The 2026-05-24 review flagged this as needed: Ed reviews multiple
projects on a weekly cadence, and re-applying the same filter every
time he opens a table is friction. Persistence is the unlock.

Scope is the smallest version of the parent story
(NEW-TBL-1 — shareable named views — stays post-parity): one
canonical view per user per (project, table). Saved
transparently; loaded on mount; reset clears the saved record.

This is the only plan in the series that touches the backend.

## 2. Binding constraints

1. **Backend feature folder per `context/CODING_STANDARDS.md`.**
   New folder `backend/app/table_views/` with `routes.py`,
   `models.py`, `service.py`, `repository.py`. Strict typing,
   Pydantic v2.
2. **Storage: one Postgres table.** Columns:
   ```
   user_id     TEXT NOT NULL
   project_id  UUID NOT NULL
   table_key   TEXT NOT NULL
   view_state  JSONB NOT NULL
   updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   PRIMARY KEY (user_id, project_id, table_key)
   ```
   Alembic migration adds the table.
3. **Raw parameterized SQL through repository.** No SQLAlchemy ORM
   in app code (per project convention).
4. **API surface — two endpoints.**
   - `GET /api/projects/{project_id}/table-views/{table_key}` →
     `{ view_state: {...} | null }`. 404 → returns 200 with
     `{ view_state: null }` (frontend treats null as "use
     defaults").
   - `PUT /api/projects/{project_id}/table-views/{table_key}` →
     `{ view_state: {...} }` — idempotent upsert.
   - `DELETE` not required for v1; "reset view" is implemented as
     `PUT` with the default `ViewState`. (DELETE could be added
     later if storage hygiene matters.)
5. **Frontend save trigger: debounced 500 ms** on any
   `ViewState` change. No save button.
6. **Frontend load trigger: on table mount.** Before first paint,
   `useGridViewState` fetches the saved view and applies it. If
   load is slow, show defaults during fetch and swap when ready
   (acceptable; documented).
7. **Authentication: existing JWT / session cookie.** No new auth
   surface.
8. **Viewer (anonymous) mode: no persistence.** The frontend
   skips the save/load entirely when no authenticated user.
9. **Backward-compatible.** Stored ViewState may reference columns
   or single-select options that no longer exist in the schema.
   On load, the frontend silently drops missing references (the
   sort / filter / group rule is removed, the column-order entry
   is skipped). No error to the user.
10. **MCP equivalent.** Per US-Builder-Tables "Cross-cutting hooks
    for LLM-friendliness," the MCP server exposes `get_table_view`
    and `set_table_view` tools. Out of scope for this plan beyond
    the API design — MCP wrapping lands in the existing MCP
    server's own roadmap.
11. **No frontend feature-flag.** Plan is on for everyone once it
    ships; defaults preserve current behavior for fresh users.

## 3. Acceptance criteria

1. **Apply view → reload page → view restored.** Apply a filter
   on Rooms (`floor_level = 1st`). Reload. Filter is still active.
2. **Sign out / sign in → view restored.** Same as above across
   auth.
3. **Per-user.** User A applies a filter on project X's Rooms;
   user B opens the same project's Rooms — sees default view (no
   inherited filter).
4. **Per-(project, table).** Apply view on project X Rooms; open
   project Y Rooms → defaults (independent record).
5. **Auto-save trigger.** Change a sort → 500 ms later, the PUT
   API call fires. Confirmed in network tab.
6. **Debounce.** Rapidly change sort 5 times within 500 ms → only
   one PUT fires after the final change.
7. **Load before paint.** Open Rooms — no flash of unfiltered
   table before the filtered view applies (or, if unavoidable, a
   brief skeleton + then the persisted view).
8. **Reset view in toolbar clears the saved record.** Click
   "Reset view" → frontend resets to defaults AND saves the
   default view (effectively clearing).
9. **Missing-column tolerance.** Manually set a stored view whose
   sort references a non-existent column (use a SQL admin tool).
   Reload → sort rule silently dropped; rest of view applies.
10. **Viewer mode no persistence.** Open Rooms as anonymous /
    Viewer — no GET fires (or it fires + ignores 401); no PUT
    fires on change.
11. **All ViewState fields persist:** sort, filter, group,
    expandedGroups, aggregations, columnVisibility, columnOrder.
12. **Locked version inherits same view.** Switching to an older
    locked version of the project uses the same view-state
    record; the user's filter/sort applies.
13. **No regression** to in-memory ViewState behavior across
    sub-tab navigation.
14. **Backend tests pass:** route + service + repository unit
    tests; smoke test end-to-end.
15. **Frontend tests pass:** load + save + debounce + missing-
    column tolerance.

## 4. Target architecture

### 4.1 Backend file changes

```
backend/app/table_views/
  __init__.py          NEW
  routes.py            NEW — FastAPI router. GET + PUT endpoints.
  models.py            NEW — Pydantic v2: `TableViewModel` (view_state
                       as `dict[str, Any]` — opaque blob from
                       backend's POV; frontend owns the shape).
                       `TableViewResponse` (wraps the model).
  service.py           NEW — thin layer: validate (user has access to
                       the project), call repository.
  repository.py        NEW — raw SQL: `get(user_id, project_id,
                       table_key)`, `upsert(user_id, project_id,
                       table_key, view_state)`.
  __tests__/           NEW — unit tests for service + repository;
                       integration test for routes.

backend/app/main.py    EXTENDED — register the new router.

backend/alembic/versions/<timestamp>_add_user_table_views.py
                       NEW migration:
                       ```sql
                       CREATE TABLE user_table_views (
                         user_id TEXT NOT NULL,
                         project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                         table_key TEXT NOT NULL,
                         view_state JSONB NOT NULL,
                         updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                         PRIMARY KEY (user_id, project_id, table_key)
                       );
                       CREATE INDEX idx_user_table_views_lookup
                         ON user_table_views (user_id, project_id);
                       ```
```

### 4.2 Frontend file changes

```
frontend/src/shared/ui/data-table/
  hooks/
    useGridViewState.ts      NEW — orchestrator hook. Inputs:
                             `(projectId, tableKey, defaults,
                             isAuthenticated)`. Returns:
                             `{ viewState, setViewState, isLoading,
                             reset }`. Internals:
                             - On mount: fetch GET; apply response
                               (sanitized) on success; apply
                               defaults on 404 / null.
                             - On every `setViewState`: debounce
                               500 ms then PUT.
                             - On `reset`: setViewState(defaults);
                               PUT immediately (no debounce — user
                               action).
    useDebouncedCallback.ts  NEW (small) — generic 500 ms debounce
                             helper. Possibly already exists; check
                             during Step 1.
  lib.ts                     extended:
                             - `sanitizeViewState(viewState,
                                columns, fieldDefByKey)` → drop
                                rules whose `fieldKey` doesn't exist
                                in the current `columns` list.
                                Returns the cleaned view.

frontend/src/features/equipment/  (or wherever consumers live)
  ConfigureGridForTable.tsx  ANY consumer of `<DataTable>` swaps
                             from passing `view` from local state
                             to using `useGridViewState`. This is
                             the only consumer-visible change in
                             this plan — and it's a one-line swap.
```

### 4.3 API contract details

**GET response:**
```json
{ "view_state": { ... } | null }
```

**PUT request body:**
```json
{ "view_state": { ... } }
```

**PUT response:**
```json
{ "view_state": { ... }, "updated_at": "2026-05-24T..." }
```

Auth: existing JWT / session. 401 if missing.

Errors: 404 (project doesn't exist), 403 (user has no access to
project), 400 (malformed body). 5xx surfaces as
"View persistence unavailable" toast on frontend; in-memory state
continues to work.

### 4.4 useGridViewState sketch

```ts
// useGridViewState.ts — sketch
export function useGridViewState(args: {
  projectId: string;
  tableKey: string;
  defaults: ViewState;
  isAuthenticated: boolean;
  columns: DataTableColumnDef[];
  fieldDefByKey: Map<string, FieldDef>;
}): UseGridViewStateResult {
  const [viewState, setViewStateInternal] = useState<ViewState>(args.defaults);
  const [isLoading, setIsLoading] = useState(args.isAuthenticated);
  const initialLoadDone = useRef(false);

  // On mount / projectId / tableKey change: load.
  useEffect(() => {
    if (!args.isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchTableView(args.projectId, args.tableKey)
      .then((stored) => {
        const sanitized = stored
          ? sanitizeViewState(stored, args.columns, args.fieldDefByKey)
          : args.defaults;
        setViewStateInternal(sanitized);
        initialLoadDone.current = true;
      })
      .catch(() => {
        // Network or 5xx: stay on defaults; toast.
        setViewStateInternal(args.defaults);
      })
      .finally(() => setIsLoading(false));
  }, [args.projectId, args.tableKey, args.isAuthenticated]);

  // Debounced save on every change after initial load.
  const debouncedSave = useDebouncedCallback((next: ViewState) => {
    if (!args.isAuthenticated || !initialLoadDone.current) return;
    saveTableView(args.projectId, args.tableKey, next).catch(() => {
      // Silent — toast on PUT failure.
    });
  }, 500);

  const setViewState = useCallback((next: ViewState) => {
    setViewStateInternal(next);
    debouncedSave(next);
  }, [debouncedSave]);

  const reset = useCallback(() => {
    setViewStateInternal(args.defaults);
    if (args.isAuthenticated) {
      saveTableView(args.projectId, args.tableKey, args.defaults).catch(() => {});
    }
  }, [args.defaults, args.projectId, args.tableKey, args.isAuthenticated]);

  return { viewState, setViewState, isLoading, reset };
}
```

### 4.5 Test plan

**Backend:**
- **`backend/app/table_views/__tests__/test_repository.py`:**
  - `upsert` inserts new record.
  - `upsert` updates existing record (idempotent).
  - `get` returns None for missing record.
  - `get` returns row for existing record.
- **`backend/app/table_views/__tests__/test_service.py`:**
  - Service rejects request when user has no project access.
- **`backend/app/table_views/__tests__/test_routes.py`:**
  - GET 404'd project → 404.
  - PUT with malformed JSON → 400.
  - GET / PUT happy path.
  - Anonymous → 401.

**Frontend:**
- **`useGridViewState.test.ts`:**
  - Mount calls GET; success applies response.
  - 404 → applies defaults.
  - Change → calls PUT after 500 ms.
  - Rapid changes debounce to a single PUT.
  - `reset()` calls PUT immediately.
  - Anonymous mode → no GET / PUT calls.
  - Missing-column sanitization drops invalid rules.
- **`sanitizeViewState.test.ts`:**
  - Drops sort rule with missing fieldKey.
  - Drops filter condition with missing fieldKey.
  - Drops group rule with missing fieldKey.
  - Drops columnOrder entry with missing fieldKey.
  - Keeps everything else intact.

**Smoke test (`make smoke`):**
- Authenticate as seed user.
- Apply a filter.
- Wait 600 ms.
- Reload.
- Confirm filter still applied via Playwright.

## 5. Execution order

Five steps. Tree green after each.

### Step 1 — Backend migration + repository

- Generate Alembic migration: `cd backend && uv run alembic revision
  -m "add user_table_views"`. Edit per §4.1.
- `uv run alembic upgrade head` against local DB.
- Create `backend/app/table_views/repository.py` per §4.1.
- Tests: `test_repository.py`.
- Commit:
  `feat(backend): table_views repository + migration`.

### Step 2 — Backend service + routes

- Create `service.py` + `routes.py` + `models.py`.
- Register router in `main.py`.
- Tests: `test_service.py`, `test_routes.py`.
- Confirm `make backend` + `curl` against GET / PUT works.
- Commit: `feat(backend): table_views API endpoints`.

### Step 3 — Frontend `useGridViewState` + sanitize helper

- Add `sanitizeViewState` to `lib.ts`.
- Add `useDebouncedCallback` (if not already present).
- Create `useGridViewState.ts` per §4.4.
- Tests: `useGridViewState.test.ts`, `sanitizeViewState.test.ts`.
- Hook not yet consumed (Step 4).
- Commit: `feat(data-table): useGridViewState + sanitize helper`.

### Step 4 — Consumer wiring

- Find each consumer of `<DataTable>` (Rooms, ERVs, Fans, future
  catalog manager). Today most likely live in
  `frontend/src/features/equipment/*Table.tsx`.
- For each: swap the local `useState<ViewState>` for
  `useGridViewState`.
- One commit per consumer to keep diffs narrow.
- Tests: extend each consumer's existing test (if any) to cover
  the hook integration.
- Commit(s): `feat(equipment): Rooms view persists across sessions`
  + similar per consumer.

### Step 5 — End-to-end demo + smoke

- `make typecheck && make lint && make test && make smoke`.
- `make dev`, walk §10.
- Capture any post-walk fixes.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| First-render flash: defaults show briefly before saved view loads. | Acceptable for v1. Document in §7. Could mitigate with a `isLoading` gate that hides the table until load completes (~50 ms typical); evaluate during Step 5 demo. |
| `view_state` JSONB grows over time if it accumulates dead rules (missing columns). | `sanitizeViewState` runs on load; a successful load that drops rules triggers a save of the cleaned view, effectively garbage-collecting on every session. |
| Race: user changes view rapidly, debounce fires, PUT in flight, user changes again — the in-flight PUT could overwrite the newer state. | The debounce fires *after* the user stops; the next change resets the debounce timer. PUT requests are sequential, last-write-wins on the server. Test pins this. (For ultra-strict concurrency, switch to a "save in-flight" guard that queues the next PUT for after — overkill for v1.) |
| Backend latency: a slow PUT causes the toast / loading state to flicker. | PUT is fire-and-forget on the frontend; no UI affordance for "saving." Failure shows a toast. Latency is invisible to the user. |
| Storage: a project with 50 tables × 100 users × 50 KB view state = 250 MB. | View state is typically ~1 KB (sort/filter/group/visibility/order are small). Even at 10 KB each, a heavy project caps at 50 MB. Acceptable. |
| Cross-project isolation: a typo somewhere uses the wrong `project_id`. | Composite primary key + foreign key ensures records are scoped correctly. Tests pin the primary key. |
| Viewer (anonymous) mode: a non-authenticated user on a public Viewer URL — must NOT hit the API. | Frontend `isAuthenticated` check; if false, the hook short-circuits both GET and PUT. Tested. |
| Schema changes (e.g., renaming a `field_key`) break stored view states. | `sanitizeViewState` drops stale references silently. For renames, a one-off migration can rewrite stored JSONB if needed. |
| MCP (LLM) needs to set / get views. | This plan defines the HTTP API; MCP wrapping is the MCP server's job (already follows the same per-table pattern). Out of scope to wire here. |
| Authentication: existing JWT decodes to `user_id`. If a user's identity provider changes (rare), their old views become orphaned. | Orphaned rows are harmless (cleaned up on project delete via FK cascade). Not a v1 concern. |
| Locked-version views: switching between active and locked-version SHOULD share the same view-state record (per US-TBL-VIEW-1 criterion 6). | The `table_key` is the same regardless of version — no version_id in the primary key. Confirmed in tests. |
| Reset view per Phase 6 ViewMenuOverflow clears in-memory but doesn't yet trigger a PUT. | Step 4 wires Reset to `useGridViewState.reset()`, which saves defaults to backend immediately. |

## 7. What this plan explicitly does not do

- Does not implement named / shareable views (NEW-TBL-1 stays
  post-parity). One view per (user, project, table).
- Does not persist active-cell / selection / scroll position
  (Q-VIEW-1: explicit no).
- Does not persist view state for anonymous Viewer mode
  (Q-VIEW-2: confirmed no).
- Does not provide a "view history" / "undo my reset" feature.
- Does not migrate stored view state across schema changes
  (sanitizer drops stale refs; renames need a one-off migration
  if necessary).
- Does not wrap the new endpoints in the MCP server (separate
  roadmap; the API is designed to be MCP-friendly).
- Does not optimize storage size (each row is one ViewState blob;
  no normalization).
- Does not provide cross-device sync conflict resolution beyond
  last-write-wins (acceptable for personal view state).
- Does not gate the feature behind a `Settings` flag.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — backend migration + repository  | 2.0 | 3.0 |
| 2 — backend service + routes        | 2.0 | 3.0 |
| 3 — frontend hook + sanitize        | 2.5 | 4.0 |
| 4 — consumer wiring                 | 1.0 | 2.0 |
| 5 — end-to-end + smoke              | 1.0 | 1.5 |
| **Total**                           | **8.5** | **13.5** |

About one to two workdays. Largest plan in the series; only one
that touches the backend.

## 9. Commit plan

1. `feat(backend): table_views repository + migration`
2. `feat(backend): table_views API endpoints`
3. `feat(data-table): useGridViewState + sanitize helper`
4. `feat(equipment): Rooms view persists across sessions`
   (repeat per consumer, e.g., ERVs, Fans, future catalog pages)
5. `chore(table-views): post-demo fixes` (only if needed)

## 10. Demo script

1. `make dev` → DB up; backend up; frontend up.
2. Sign in as seed user.
3. Open Rooms. Apply a filter (`floor_level = 1st`), a sort
   (`number asc`), a group (`floor_level`), pick an aggregate in
   summary bar (`Sum` on iCFA), hide a column (`notes`), reorder
   `iCFA factor` to be second.
4. Wait 600 ms (auto-save fires).
5. Open browser dev tools → Network tab → confirm one PUT request
   to `/api/projects/{id}/table-views/rooms` with the ViewState
   body.
6. Reload the page. Open Rooms → all six configurations restored.
7. Sign out. Sign back in. Open Rooms → still restored.
8. Open Rooms as a different seed user → defaults (per-user
   isolation).
9. Switch to ERVs → defaults (per-table isolation).
10. Switch back to Rooms → restored.
11. Open project Y's Rooms → defaults (per-project isolation).
12. Apply many rapid sort changes (5 in 1 second) → confirm only
    one PUT fires after the user stops.
13. Reset view via toolbar overflow → all config clears AND a
    PUT-with-defaults fires immediately. Reload → defaults
    confirmed.
14. Manually corrupt the stored view via SQL admin: set a sort
    rule on a non-existent column. Reload → sort rule silently
    dropped; rest of view applies; saved view is updated to drop
    the dead rule.
15. Open a Viewer-mode URL (anonymous) → no GET fires; defaults
    apply; no PUT on any change.
16. Switch to a locked older version → same view-state record
    applies; user's filter/sort active.
17. Chrome + Safari — repeat 3, 6, 12 in both.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — backend migration + repository  | | | |
| 2 — backend service + routes        | | | |
| 3 — frontend hook + sanitize        | | | |
| 4 — consumer wiring                 | | | |
| 5 — end-to-end + smoke              | | | |
| Plan 09 overall                     | | | |
