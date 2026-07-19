> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.4 Project workspace (`/projects/{project_id}/{tab}`)

**Purpose:** One project's home. Workspace structure started from the V1
mental model the user already had and has since grown: Status / Climate /
Apertures / Envelope / Spaces / Equipment / Thermal Bridges / Model /
Documentation
(current tab set — see `frontend/src/features/projects/lib.ts`'s
`PROJECT_TABS`; matches `../../UI_UX.md` §1's tab list).

**Default landing:** `/projects/{id}/status` (the Status tab).
Dashboard click goes here.

**Layout:** global header (§1.1) → project header bar → tab bar →
tab content.

For dense tabs, prefer a workbench layout instead of a dashboard layout:

- left object browser/list where the tab has selectable domain objects;
- center table, builder, or model canvas as the primary work surface;
- right inspector/evidence panel where selection context matters;
- compact top/bottom tool rails for mode-specific actions.

White space should separate task zones. It should not appear simply
because the screen lacks a secondary information model.

## Project header bar (below the global header)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HILLANDALE NAR                                                          │
│  2426 · Acme Architects        Working ▾  ●  [Save] [⋯]    IP◐SI        │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Left:**
  - Project name (large, semibold).
  - Below: `bt_number · client` (smaller, secondary text).
- **Right (in order, right-to-left visually compact):**
  - **Version dropdown trigger** — currently-open version's name +
    kind icon (working/submitted/closed) + lock padlock if locked.
    Click opens the version picker (§2.4.1).
  - **Save status indicator** — green dot (clean) / amber dot
    (draft dirty) / red dot (sync error). Tooltip on hover.
  - **Save** button (primary). Disabled when no draft changes.
    On locked version, hidden / replaced with a Save-As-shortcut
    affordance.
  - **`⋯` overflow menu** — Save As, Discard changes, Lock / Unlock,
    Project settings.
  - **IP / SI units toggle** — segmented control bound to
    `users.units_preference`. Toggling re-renders all numeric
    values in the active tab. As of Phase 4 of the materials-catalog
    rollout the toggle lives in the global `<WorkspaceTopbar>`
    (`frontend/src/shared/ui/TopbarUnitToggle.tsx`) and is visible on
    every authenticated page — Dashboard, ProjectShell, and all three
    catalog managers — not only in the project header. **Display-layer
    only** — the preference round-trips to `/api/v1/auth/preferences`
    so it persists across sessions, but no per-cell value is ever
    rewritten; backend always speaks SI (PRD §11.5). Toggling while
    editing a value in a cell is OK; the cell's parser handles either
    input format (frontend converts to SI before sending to the
    server).
- **No "AirTable" button.** V2 has no AirTable surface.
- Sticky on vertical scroll.

## Tab bar (below the project header)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Status · Climate · Apertures · Envelope · Spaces · Equipment ·          │
│  Thermal Bridges · Model · Documentation                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

- Tabs started from the V1 mental model and have since grown (Climate,
  Spaces, and Thermal Bridges split out as their own top-level tabs).
  **No "Versions" tab** (header dropdown instead). **No "Settings" tab**
  (overflow menu).
- Selected tab shows an active-state underline / fill.
- Tab selection updates the URL:
  `/projects/{id}/status`, `/projects/{id}/climate`,
  `/projects/{id}/apertures`, `/projects/{id}/envelope`,
  `/projects/{id}/spaces`, `/projects/{id}/equipment`,
  `/projects/{id}/thermal-bridges`, `/projects/{id}/model`,
  `/projects/{id}/documentation`. Browser back/forward work.
- Each tab loads independently (no full-page reload between tabs;
  data fetches are scoped).

## 2.4.1 Version dropdown picker (US-3.1)

Trigger: the version pill in the project header bar.

**Panel layout (opens below the trigger):**

```
┌────────────────────────────────────────────────────────────┐
│  Versions                                  + Save As…       │
├────────────────────────────────────────────────────────────┤
│  ★ Working                              saved 2 hours ago   │
│    [Open]                                              ⋯    │
│  ───────────────────────────────────────────────────────── │
│  Round 1 Submit · 🔒                       saved Apr 23     │
│    [Open]                                              ⋯    │
│  ───────────────────────────────────────────────────────── │
│  Round 2 Submit · 🔒                       saved Oct 6      │
│    [Open]                                              ⋯    │
├────────────────────────────────────────────────────────────┤
│  3 versions                            Compare versions…   │
└────────────────────────────────────────────────────────────┘
```

- **★** marks the project's default version (`active_version_id` —
  what Dashboard click opens).
- **🔒** lock icon next to locked versions.
- **Open button** is the *only* mutating control. Clicking the row
  outside the button does nothing.
- **Row `⋯` menu** per version: Make default, Rename, Lock /
  Unlock, Delete.

**Open behavior:**
1. User clicks Open on a non-current version.
2. **Dirty-draft prompt** if current version has unsaved draft
   changes:
   ```
   ┌─────────────────────────────────────────────────────────┐
   │  You have unsaved changes in "Working"                  │
   │                                                         │
   │  What would you like to do before opening               │
   │  "Round 1 Submit"?                                      │
   │                                                         │
   │   [Save]   [Save As…]   [Discard changes]   [Cancel]    │
   └─────────────────────────────────────────────────────────┘
   ```
   - If current version is locked, **Save** is disabled with a
     tooltip ("This version is locked. Use Save As.").
3. **Switch:** URL updates (tab unchanged), editor reloads with the
   new version's body, dropdown closes, header trigger updates with
   a brief highlight to confirm the switch.

**Default-version stability:**
- Opening a version via dropdown does **not** change
  `active_version_id`.
- `active_version_id` only changes via:
  - Save As (the new version becomes default automatically).
  - A version row's `⋯` → "Make default" action.
  - Project create (initial Working version set as default).

**Locked-version edit lockout (cross-cutting):**

When the open version is locked:
- Editor table cells render read-only (no in-cell typing affordance).
- Persistent banner across the top of the tab content:
  ```
  ┌─────────────────────────────────────────────────────────────┐
  │  🔒 This version is locked.                                  │
  │  To edit, click Save As to copy it into a new version.      │
  │                                              [Save As…]     │
  └─────────────────────────────────────────────────────────────┘
  ```
- Save button is hidden / replaced by a Save-As shortcut.
- Eliminates "I typed for 10 min and got 409 at Save."
