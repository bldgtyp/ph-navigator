---
DATE: 2026-06-05
TIME: 15:25 EDT
STATUS: Partially shipped (additive variant) — see "Implementation note" below
AUTHOR: Codex
SCOPE: Cut over the frontend route from `/windows` to `/apertures`,
       ship the V2 page layout (header / sidebar / main placeholder),
       wire the sidebar's add / rename / duplicate / delete actions
       through `applyApertureCommand`, enforce trim + case-insensitive
       uniqueness, ship empty / locked / viewer states, and delete
       the Phase 01 alias module.
RELATED:
  - planning/features/apertures/PRD.md §6, §7, §8, §22
  - planning/features/apertures/PLAN.md (Phase 02 row)
  - frontend/src/features/envelope/components/EnvelopeSidebar.tsx
    (sidebar pattern precedent)
  - frontend/src/features/envelope/routes/EnvelopePage.tsx
    (page layout precedent)
  - phase-01 (delivers ApertureCommand seam this phase consumes)
---

# Phase 2 — Apertures shell + sidebar

## Implementation note (2026-06-05, additive variant)

Phase 02 shipped **additively alongside** the existing Windows tab —
the new `Apertures` tab is registered in `PROJECT_TABS` next to
`Windows` rather than replacing it, and the legacy
`frontend/src/features/windows/` folder and `WindowTypeEntry` backend
classes are kept untouched. This unblocks Phase 03+ (the route, the
sidebar, the command pipeline, and the catalog adapter all exist)
without the disruption of deleting the still-functional tracer-bullet.

What shipped in this commit (`make ci` green):

- Backend
  - `POST /api/v1/projects/{id}/versions/{vid}/apertures/command`
    route + `apply_aperture_command_to_draft` service wrapper
    (ETag preflight via shared `load_draft_context`, audit-log
    persistence using `AUDIT_KIND_BY_APERTURE_COMMAND`).
  - `DatabaseDefaultsCatalog` adapter
    (`apertures/default_refs.py`) — fetches the seeded
    `PHN-Default-Frame` / `PHN-Default-Glazing` rows from the
    catalog tables and bookshelf-copies them through the existing
    `build_default_aperture_type` factory. Returns the
    `aperture_default_refs_missing` envelope when the seed rows
    are absent.
  - Renamed `_load_draft_context` → `load_draft_context` (now a
    public seam reused by aperture-command + assets services).
- Frontend
  - New `frontend/src/features/apertures/` feature folder:
    `types.ts`, `api.ts`, `query-keys.ts`, `hooks.ts`, `lib.ts`,
    `lib.test.ts`, `apertures.css`, `components/`
    (`ApertureSidebar`, `AperturesHeader`,
    `ApertureBuilderPlaceholder`, `RenameApertureDialog`,
    `DeleteApertureDialog`), `routes/AperturesTab.tsx`.
  - `'apertures'` added to `PROJECT_TABS` (alongside
    `'windows'`); `TAB_LABELS["apertures"] === "Apertures"`.
  - `ProjectTabContent` renders the new `<AperturesTab />` for
    `tab === "apertures"`.
  - Sidebar: list (natural-sorted), select, `+ Add aperture
    type`, hover-revealed Edit / Dup / Del row actions; rename
    dialog with collision helper; delete dialog with descriptive
    body. All actions drive the new
    `POST .../apertures/command` endpoint via
    `useApplyApertureCommandMutation`.
  - Viewer / locked state hides edit affordances.
- Full `make ci` green: 525 backend tests, 1122 frontend tests,
  build successful.

Deferred (still folded into a future cleanup phase):

- Renaming `WindowTypeEntry` / `WindowElement` /
  `WindowElementFrames` to `Aperture*` with legacy aliases.
- Renaming `body.tables.window_types` → `body.tables.apertures`
  with a `@computed_field` alias.
- Document-load migration shim in `validation.py` that rewrites
  `win_` / `winel_` ids to `apt_` / `aptel_`.
- Alembic migration that munges existing JSON documents in
  Postgres and seeds the `PHN-Default-Frame` /
  `PHN-Default-Glazing` catalog rows.
- Deleting `frontend/src/features/windows/` and the legacy
  `Windows` tab from `PROJECT_TABS`.
- `/projects/:id/windows` → `/projects/:id/apertures` redirect.
- Sidebar collapse / chevron, sticky `+ Add`, V1-pixel-parity
  styling. The current sidebar is functional but plainer than
  V1 — Phase 03 picks up the canvas next; styling polish lives
  alongside or in a follow-on cleanup commit.
- E2E Playwright tests for the new route. Unit + structural
  tests cover the lib helpers; component tests for the sidebar
  / dialog can land alongside Phase 03 once the visual surface
  stabilises.

---


## P0. Why this slice

Phase 02 is the **route cutover + sidebar rebuild**. The user
visibly lands in the Apertures tab; the sidebar matches the V1
shape (`Window Builder.png` left rail); add / rename / duplicate /
delete work end-to-end through the Phase 01 commands. The main
area still renders a placeholder — the canvas lands in Phase 03.

This phase also deletes the Phase 01 deprecation aliases so the
codebase no longer carries a `WindowTypeEntry` symbol.

By the end of Phase 02:

- `/projects/:id/apertures` is the canonical route. `/windows`
  redirects to `/apertures` (308) for one release; existing links
  and bookmarks survive.
- Tab label in the global project nav reads `Apertures` (no longer
  `Windows`).
- A new top-level `frontend/src/features/apertures/` feature folder
  exists with the same internal shape as
  `frontend/src/features/envelope/` (`api.ts`, `types.ts`,
  `hooks.ts`, `lib.ts`, `query-keys.ts`, `apertures.css`,
  `components/`, `routes/`, `__tests__/`).
- The page is laid out per PRD §6: tab header (active aperture name,
  Uw placeholder chip, overflow menu), left sidebar, main area.
- The sidebar lists `body.tables.apertures[]` in natural sort,
  highlights the active type, exposes hover-revealed Edit / Duplicate
  / Delete row actions plus a sticky `+ Add aperture type` button.
- Add / rename / duplicate / delete drive
  `applyApertureCommand` from Phase 01. Auto-suffix uniqueness for
  Add and Duplicate; rename dialog with collision detection.
- Delete uses a shadcn `Dialog`, never `window.confirm`.
- Empty list shows the V1 empty state in both the sidebar
  (`+ Add aperture type` button only) and the main area.
- Locked versions and Viewer access render every edit affordance
  hidden; the list stays navigable read-only; the header Uw chip
  stays visible (it will start showing real values in Phase 09).
- The `frontend/src/features/windows/` folder is **deleted**. All
  callers have been migrated. The Phase 01 backend aliases on
  `ProjectDocumentTables.window_types` and
  `tables/window_types.py` are removed in the same PR.

Phase 02 does **not** ship the canvas, dimensions, cards,
operations, U-Value, or any in-builder editing affordance beyond
the sidebar and the (still empty) header. The main area renders a
muted "Aperture Builder lands in Phase 03" placeholder for
non-empty selections; selecting an empty project still shows the
empty state.

## P1. Acceptance — Phase 2 done when

1. `frontend/src/features/apertures/` is created with the standard
   feature shape; the legacy `frontend/src/features/windows/` is
   removed. No surviving imports of `features/windows/*` anywhere
   in the frontend tree.
2. `App.tsx` (or the equivalent route composition entry) wires:
   - `/projects/:id/apertures` → `<AperturesPage />`.
   - `/projects/:id/windows` → `Navigate` to the apertures route
     (308 redirect on the server side mirrors this for the API
     contract). The redirect is gated by a feature flag default-on
     so it can be ablated if a Rhino client still hits the old
     path during the same release window.
3. The global project nav renders `Apertures` (icon + label) and
   the tab is active when the URL matches.
4. `<AperturesPage />` composes:
   - `<AperturesHeader />` — active aperture name display, Uw
     placeholder chip (`Window U-Value: --`), info icon (renders
     PRD §8 tooltip text), aperture-type overflow menu (Phase 02
     surfaces: Rename, Duplicate, Delete; Phase 10 adds Export
     HBJSON; Phase 11 adds Manufacturer filters; Phase 12 adds
     View picked frames & glazings).
   - `<ApertureSidebar />` — V1-style left rail (≈260 px wide,
     collapsible to a chevron).
   - `<ApertureBuilderPlaceholder />` — empty-aperture or
     "Phase 03 will land here" copy.
5. `<ApertureSidebar />` acceptance:
   - List source: `body.tables.apertures[]` from the current draft
     or saved version per project document semantics.
   - Sort: `naturalSortCompare` ascending by `name` (`AA_2` <
     `AA_10`).
   - Each row: name only. No thumbnail, no Uw, no element count
     in v1.
   - Active row highlighted with the existing
     `--list-row-active-bg` CSS token.
   - Sticky `+ Add aperture type` button at the top.
   - Hover-revealed row actions (Edit, Duplicate, Delete) gated by
     `canEdit` (logged-in editor + unlocked version + not a viewer).
   - Sidebar collapsible to a zero-px rail with a chevron toggle;
     default collapsed on first visit (UX parity with V1
     §3.3 / US-WIN-1 criterion 1).
   - Sidebar scroll-only; no virtualization or type-to-filter in
     v1.
6. `+ Add aperture type` button:
   - Dispatches `createApertureType` with no `proposed_name`.
   - Backend autoname returns the new aperture entry; UI selects
     it (mutates the active-aperture state).
   - On 503 `aperture_default_refs_missing`, shows a Sonner toast:
     `Default frame or glazing missing in the catalog. Ask an
     admin to seed the PHN defaults.` and does not change
     selection.
7. Rename dialog (shadcn `Dialog`):
   - Title: `Aperture Type Name`.
   - Single text field labelled `Aperture Type Name`, autofocus,
     full-select on focus, Enter to submit, Escape to cancel.
   - Save disabled when: empty / whitespace-only OR equal to the
     current trimmed name OR collides with another aperture's
     trimmed lowercased name in the active version.
   - Collision helper line: `An aperture type named '<value>'
     already exists in this version.` (red, persistent while the
     collision holds).
   - On Save, dispatches `renameApertureType` and closes on 200.
   - On structured collision error from the server (race), the
     dialog stays open with the same helper line.
8. Duplicate action:
   - Dispatches `duplicateApertureType` (no proposed_name; backend
     auto-suffixes `(Copy)` then `(Copy) (2)`, ... per PRD §7).
   - On success, selects the new aperture and toasts
     `Duplicated as '<new name>'`.
9. Delete confirmation (shadcn `Dialog`):
   - Title: `Delete aperture type?`
   - Body: `This will remove '<name>' and all its elements from
     this version. Save or Save As to persist. Cancel keeps it in
     your draft.`
   - Buttons: Cancel / Delete (Delete is the destructive variant).
   - No name re-typing.
   - On confirm, dispatches `deleteApertureType`. Active selection
     moves to the next type in sort order, or back to the empty
     state.
10. Empty state:
    - When `body.tables.apertures.length === 0`, the sidebar shows
      only the `+ Add aperture type` button. The main area shows
      centered: `No aperture types yet.` and a primary `+ Add
      aperture type` button mirroring the sidebar action.
11. Locked-version + Viewer state:
    - `+ Add` button hidden.
    - Hover row actions hidden.
    - Rename dialog trigger hidden.
    - Active row still highlightable; list still scrollable.
    - Header shows the active aperture name (read-only); overflow
      menu hidden (export and configure-filters surfaces are
      editor-only in v1; Phase 10 will revisit for viewer export).
12. Backend cleanup in the same PR:
    - Delete `backend/features/project_document/tables/window_types.py`.
    - Remove the `window_types` registry alias in
      `tables/registry.py`.
    - Remove the `window_types` `@computed_field` from
      `ProjectDocumentTables`.
    - Remove the legacy `WindowTypeEntry` / `WindowElement` /
      `WindowElementFrames` aliases from `document.py`.
    - Update any backend tests still importing the legacy names.
13. `make ci` is green.

## P2. Files

### New (frontend)

- `frontend/src/features/apertures/routes/AperturesPage.tsx`
- `frontend/src/features/apertures/routes/page-helpers.ts`
- `frontend/src/features/apertures/components/AperturesHeader.tsx`
- `frontend/src/features/apertures/components/ApertureSidebar.tsx`
- `frontend/src/features/apertures/components/ApertureBuilderPlaceholder.tsx`
- `frontend/src/features/apertures/components/RenameApertureDialog.tsx`
- `frontend/src/features/apertures/components/DeleteApertureDialog.tsx`
- `frontend/src/features/apertures/api.ts`
- `frontend/src/features/apertures/hooks.ts`
- `frontend/src/features/apertures/types.ts`
- `frontend/src/features/apertures/lib.ts`
- `frontend/src/features/apertures/query-keys.ts`
- `frontend/src/features/apertures/apertures.css`
- `frontend/src/features/apertures/__tests__/AperturesPage.test.tsx`
- `frontend/src/features/apertures/__tests__/ApertureSidebar.test.tsx`
- `frontend/src/features/apertures/__tests__/sidebarCommands.test.ts`

### Modified (frontend)

- `frontend/src/App.tsx` (or routes composition) — add the new route
  and the `/windows → /apertures` redirect.
- The global project nav component (existing tab list) — relabel
  `Windows` to `Apertures`, swap icon if needed.
- Any cross-feature import that still points at
  `features/windows/*` — migrate to `features/apertures/*` or
  delete if dead.

### Deleted (frontend)

- `frontend/src/features/windows/` (entire folder).

### Modified (backend)

- `backend/features/project_document/document.py` — remove legacy
  alias exports; drop the `window_types` computed field.
- `backend/features/project_document/tables/registry.py` — drop
  the alias entry.

### Deleted (backend)

- `backend/features/project_document/tables/window_types.py`.

## P3. Component shapes

```tsx
// AperturesPage.tsx — sketch

export function AperturesPage() {
  const projectId = useProjectId();
  const versionId = useActiveVersionId();
  const { canEdit, isLocked, isViewer } = useDocumentMode();
  const { data: doc } = useProjectDocument(projectId, versionId);
  const [activeApertureId, setActiveApertureId] = useState<string | null>(null);

  const apertures = useMemo(
    () => naturalSortApertures(doc?.body.tables.apertures ?? []),
    [doc],
  );

  const active = apertures.find((a) => a.id === activeApertureId) ?? apertures[0] ?? null;

  return (
    <div className="apertures-page">
      <AperturesHeader
        activeAperture={active}
        canEdit={canEdit}
        onRename={() => openRenameDialog(active)}
        onDuplicate={() => duplicate(active)}
        onDelete={() => openDeleteDialog(active)}
      />
      <div className="apertures-page__body">
        <ApertureSidebar
          apertures={apertures}
          activeApertureId={active?.id ?? null}
          onSelect={setActiveApertureId}
          canEdit={canEdit}
          isViewer={isViewer}
          onAdd={addAperture}
        />
        <main className="apertures-page__main">
          {active ? (
            <ApertureBuilderPlaceholder aperture={active} />
          ) : (
            <ApertureEmptyState canEdit={canEdit} onAdd={addAperture} />
          )}
        </main>
      </div>
    </div>
  );
}
```

```tsx
// ApertureSidebar.tsx — sketch

export function ApertureSidebar(props: ApertureSidebarProps) {
  const { apertures, activeApertureId, onSelect, canEdit, isViewer, onAdd } = props;
  const [collapsed, setCollapsed] = useUserPreference("aperture_sidebar_collapsed", true);

  return (
    <aside
      className={collapsed ? "aperture-sidebar aperture-sidebar--collapsed" : "aperture-sidebar"}
    >
      <div className="aperture-sidebar__chevron">
        <button onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
          <ChevronLeftIcon />
        </button>
      </div>
      {!collapsed && (
        <>
          {canEdit && !isViewer && (
            <button className="aperture-sidebar__add" onClick={onAdd}>
              + Add aperture type
            </button>
          )}
          <ul className="aperture-sidebar__list">
            {apertures.map((a) => (
              <li
                key={a.id}
                className={a.id === activeApertureId ? "is-active" : undefined}
                onClick={() => onSelect(a.id)}
              >
                <span className="aperture-sidebar__name">{a.name}</span>
                {canEdit && !isViewer && (
                  <ApertureRowActions aperture={a} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
```

```ts
// frontend/src/features/apertures/lib.ts — sketch

export function naturalSortApertures(apertures: ApertureTypeEntry[]): ApertureTypeEntry[] {
  return [...apertures].sort((a, b) =>
    naturalSortCompare(a.name.trim(), b.name.trim()),
  );
}

export function nameCollides(
  apertures: ApertureTypeEntry[],
  candidate: string,
  excludingId?: string,
): boolean {
  const norm = candidate.trim().toLowerCase();
  if (!norm) return false;
  return apertures.some(
    (a) => a.id !== excludingId && a.name.trim().toLowerCase() === norm,
  );
}
```

## P4. Sequence

1. **Commit 1 — feature folder + types + api.** Scaffold the
   `features/apertures/` folder. Copy the minimum types from
   the deleted `features/windows/types.ts` into the new module
   without behaviour change. Wire `applyApertureCommand` from
   Phase 01.
2. **Commit 2 — route cutover + redirect.** Add the new route,
   add `/windows → /apertures` redirect, relabel the nav tab.
   Page renders the empty placeholder; the rest of the surface
   still functions.
3. **Commit 3 — sidebar shell.** Ship
   `ApertureSidebar`, `AperturesHeader`, and the collapsed-by-default
   state with a chevron toggle. List renders read-only with no
   actions.
4. **Commit 4 — sidebar actions + dialogs.** Wire add / rename /
   duplicate / delete through `applyApertureCommand`. Ship the
   rename + delete dialogs. Auto-suffix uniqueness is handled
   server-side; the client only needs to enforce the rename-time
   collision check.
5. **Commit 5 — empty state + locked/viewer states.**
6. **Commit 6 — backend cleanup.** Delete the legacy table file
   and aliases. Update remaining backend tests.
7. **Commit 7 — delete `features/windows/`.** Final removal of
   the legacy frontend folder. `make ci` green.

## P5. Tests

### Unit

- `naturalSortApertures` returns `AA, AA_2, AA_10, AB` for
  `[AA_10, AA, AB, AA_2]`.
- `nameCollides` is trim + case-insensitive; respects
  `excludingId`.
- `ApertureSidebar.test.tsx`:
  - Renders apertures in natural sort.
  - Highlights active row.
  - Hides `+ Add` and row actions when `canEdit=false` or
    `isViewer=true`.
  - Hover row reveals actions; click selects.
- `sidebarCommands.test.ts`:
  - `Add` dispatches `createApertureType` with no proposed name.
  - On 503 `aperture_default_refs_missing`, the toast fires
    and selection is unchanged.
  - `Rename` dispatches `renameApertureType` with trimmed
    `new_name`.
  - `Duplicate` dispatches `duplicateApertureType`.
  - `Delete` dispatches `deleteApertureType` and moves active
    selection to the next item in sort order.

### Component

- `AperturesPage.test.tsx`:
  - With empty `apertures`, the main area renders the
    `No aperture types yet.` empty state with the primary action.
  - With non-empty, the placeholder renders.
  - Locked version hides edit affordances everywhere.

### E2E (Playwright)

- Navigate to `/projects/<id>/windows` → redirected to
  `/projects/<id>/apertures`.
- From the empty state, click `+ Add aperture type`, verify the
  new aperture appears in the sidebar and is selected.
- Rename to a colliding trimmed-lower name; verify the helper
  line shows and Save stays disabled.
- Rename to a new unique name; verify the new label.
- Duplicate; verify the `(Copy)` suffix on the new entry.
- Delete; verify confirmation dialog, then sidebar updates.
- Lock the version; verify all edit affordances disappear and
  the list stays navigable.

### Regression

- Other tabs (Envelope, Equipment, Model) keep rendering and
  routing as before.
- Refresh-from-catalog continues to operate against the renamed
  `apertures` table.

## P6. Out of scope (lands in later phases)

- Canvas, geometry, view direction, zoom — Phase 03 / 04.
- Dimensions panel — Phase 05.
- Element cards, pickers, badges — Phase 06.
- Operations editor — Phase 07.
- Merge / split / copy/paste — Phase 08.
- U-Value chip values — Phase 09 (chip exists but shows `--`).
- HBJSON export overflow action — Phase 10.
- Manufacturer filters overflow action — Phase 11.
- View picked frames & glazings overflow action — Phase 12.

## P7. Risks

- **R-02-1. Route redirect breaks existing bookmarks / Rhino
  clients.** Mitigation: the `/windows` route stays redirecting
  for the whole V1 → V2 release window; the redirect is gated
  by a feature flag default-on so ops can disable it if a
  spike of confused traffic hits.
- **R-02-2. `features/windows/` deletion may strand cross-feature
  imports.** Mitigation: Commit 7 is intentionally the last commit;
  CI must be green before it lands. If any import surfaces, it
  shows up as a TypeScript error at build time, not a runtime
  surprise.
- **R-02-3. The sidebar's default-collapsed state conflicts with
  V1's default-collapsed-but-first-visit-open pattern.**
  Mitigation: ship default-collapsed and let user preference
  override per-visit. Reconsider only if user feedback flags it.
- **R-02-4. Rename collision check races the server.** The client
  validates locally for instant feedback, but the server is the
  arbiter. If two browsers race to rename to the same value, one
  wins, the other gets a structured error. Mitigation: on
  structured 409 / 422 collision from the server, keep the
  dialog open and surface the same helper line.
