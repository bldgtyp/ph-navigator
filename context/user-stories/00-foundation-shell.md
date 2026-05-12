---
DATE: 2026-05-10
TIME: -
STATUS: DRAFT — populated incrementally as Ed and Claude walk through
        each feature. Companion to context/PRD.md
        (architecture PRD) and context/UI_UX.md (UI/UX narrative).
AUTHOR: Ed May (with Claude)
SCOPE: Detailed user stories for PH-Navigator V2. Each story carries
       acceptance criteria, status, priority, and cross-references to
       the PRD and UI/UX docs.
RELATED: context/PRD.md (architecture PRD),
         context/UI_UX.md (UI/UX narrative)
---

# PH-Navigator V2 — User Stories

## 0. Conventions

**ID format:** `US-N` for stories, `US-N.M` for sub-stories.

**Status legend:**
- `Draft` — captured but not yet reviewed
- `Confirmed` — Ed has signed off; ready to implement
- `Implemented` — code exists; verify with success criteria
- `Deferred` — agreed to defer to v1.1 / Future

**Priority legend:**
- `MVP` — required for V2 v1 launch
- `v1.1` — planned, post-MVP
- `Future` — possible later; not committed

**Open question marker:** lines starting with `**Q:**` are questions for
Ed to answer. Lines starting with `**Lean:**` are Claude's default if
Ed doesn't override.

---

## US-0 — Sign in to PH-Navigator

**Status:** Confirmed (2026-05-10)
**Priority:** MVP
**PRD ref:** §4 (Users & access), §6.1 (Data model — `sessions`),
§13 (Auth)

### Story
> As an editor (Ed or John), I want to sign in to PH-Navigator with my
> email and password so that I can access my projects and the shared
> catalogs.

### Acceptance criteria
1. Visiting the V2 root URL while unauthenticated redirects to
   `/sign-in?next=<original-url>`.
2. Sign-in page presents a clean form: email, password, "Sign in"
   button.
3. Form inputs use HTML `autocomplete="email"` and
   `autocomplete="current-password"` so browser password managers
   (Apple Passwords, 1Password, Bitwarden, etc.) auto-fill
   correctly.
4. Successful sign-in establishes a server-side session
   (HTTP-only cookie referencing a row in the `sessions` table) and
   redirects to `?next=` if present, otherwise `/dashboard` (US-1).
   Session ids are cryptographically random UUIDv4 values.
5. Failed sign-in shows a generic "email or password is incorrect"
   error without revealing which field was wrong.
6. Password hashes use Argon2id by default. Bcrypt cost >= 12 is the
   only acceptable scaffold fallback if Argon2id creates dependency
   friction.
7. No social login. **No self-serve forgot-password flow.** Password
   reset is admin-only: Ed runs a CLI / admin script to set a new
   password hash. Confirmed two-person internal-tool scope.
8. No public sign-up. Accounts created by admin via one-shot script.
9. **Session lifetime:** 60-minute sliding expiration. Every
   authenticated API request resets the expiry timer. Idle for 60
   minutes → session expires; next request returns 401.
   Dirty editor tabs may send a lightweight keepalive while unsaved
   local state exists.
10. **Single active session per user** (no multi-device support).
   Signing in on a new device invalidates the existing session for
   that user (most-recent-wins). The previous device sees 401 on its
   next request. A database partial unique index enforces at most one
   non-invalidated session per user.
11. **401-handling pattern (both idle and device-collision):**
   instead of navigating away, the frontend opens an in-place
   **session-expiry modal** (UI/UX §1.5) so the current tab context
   and any in-memory document are preserved. The modal subtitle
   distinguishes the cause ("inactive for 60 minutes" vs. "signed
   in on another device"). On successful re-auth, the modal closes
   and the failed request is retried.
12. **Device-collision sign-in warning.** If the modal was opened
    because this session was displaced by a newer sign-in, the modal
    warns: "Signing in here will sign out your other PHN session."
    Buttons: **Sign in here** and **Cancel**. Cancel keeps the tab
    open in read-only mode until the user reloads or signs in later.
    This prevents an accidental back-and-forth session displacement
    loop between two devices.
13. **Mid-edit session-expiry UX.** If a session dies while the user
    has an open editor with unsaved in-memory changes:
    a. Frontend keeps the in-memory document; does not unmount.
    b. Modal: "Your session has expired. Sign in to continue editing."
       with email + password inputs (stays on the same URL).
    c. On successful re-auth, the modal closes and the most recent
       failed request is retried. The server-side draft (§8.3) already
       holds everything synced before idle, so worst-case data loss
       is one debounce window (~500ms of typing).
14. All mutating browser API requests include and pass the configured
    Origin policy. CORS is deny-by-default and credentialed requests are
    allowed only from configured local-dev and production frontend
    origins.
15. Successful sign-in is recorded in `user_action_log` with
   `action='login'`, IP, user-agent, timestamp (see C-1).
16. Failed sign-in attempts are recorded with `action='login_failed'`
   and the email attempted, for troubleshooting.
17. Session invalidations from device-collision sign-in are recorded
   with `action='session_invalidated_by_new_login'` on the
   superseded session.
18. Explicit sign-out (from header user menu) clears the session and
   logs `action='sign_out'`.

### UI/UX ref
See `context/UI_UX.md` §2.1 *Sign-in page*
and §1.6 *Session-expiry modal* (new).

---

## US-1 — Dashboard: list of my projects

**Status:** Confirmed (2026-05-10)
**Priority:** MVP (with Delete deferred — see US-1.4)
**PRD ref:** §4, §6.1, §11.1

### Story
> As a signed-in editor, I want a dashboard showing the projects I own
> so that I can quickly find and open my active work.

### Acceptance criteria
1. After sign-in, the user lands on `/dashboard`.
2. The dashboard lists projects **owned by the signed-in user**
   (`projects.owner_id = current_user.id`). Projects owned by the other
   editor do not appear (see Q1).
3. Each row shows: project number (`bt_number`), project name,
   client (new field — see PRD update), last-modified date.
4. Pinned projects appear at the top in a distinct section, in user-
   defined order. Unpinned projects appear below, sorted by
   last-modified descending by default (see Q3).
5. The user can pin / unpin a project from the row action menu.
6. The user can drag-reorder pinned projects within the pinned
   section.
7. Pin state and order are **per-user** (Ed's pins are independent
   of John's; even if they someday share access — see Q1).
8. The user can click a project row to open its landing page (US-3).
9. The user can click "New project" to create a project (US-1.3).
10. Each row carries a row-action menu (`⋯`) including Pin/Unpin,
    Open, and Delete (Delete is greyed-out / hidden until US-1.4
    ships).
11. The dashboard top nav header (consistent across the app) carries
    the PH-Nav logo (clicking returns to dashboard, but already there
    is a no-op), the user's name with a sign-out option, and links
    to the catalog manager(s) (US-2).

### Resolved questions (2026-05-10)
- **Q1 (Q-OWN-1):** Ownership = dashboard visibility filter only, not
  ACL. Either editor can edit any project they have a URL for.
  Confirmed. **Forward-compatible architecture commitment:** day-1
  code routes every project-scoped request through a
  `require_project_access(project_id, mode)` FastAPI dependency
  whose body today only checks authentication. When/if strict ACL is
  added, the dependency body changes; route signatures don't. See
  US-1.5 below and PRD §4.
- **Q2 (Q-OWN-2):** Ownership is transferable. Not MVP UI; data
  model already supports it (single `owner_id` column on `projects`).
  Transfer-ownership UI lands in Settings tab post-MVP.
- **Q3 (Q-DASH-1):** Default sort for unpinned section is by
  `bt_number` (4-digit BLDGTYP project number, stored as TEXT;
  string sort is numerically stable for fixed-width 4-digit codes),
  **descending** (largest number first; newest projects appear at
  the top). Pinning is the relief valve for old-but-active
  projects. Confirmed.
- **Q4 (Q-DASH-2):** "Last modified" = denormalized
  `projects.last_saved_at` = max(`updated_at`) across the project's
  `project_versions` rows. Updated by the version-save service on
  Save / Save As only; draft patch, status edits, HBJSON uploads, asset
  uploads, and catalog edits do not update it. Confirmed service-layer
  denorm 2026-05-11.
- **Q5 (Q-DASH-3):** "+ New project" lives as the primary button in
  the dashboard page-heading bar (top-right of the project list).
  Confirmed.

### Open questions
None — all US-1 questions resolved 2026-05-10.

### Sub-stories

#### US-1.1 — Pin and reorder projects
**Status:** Draft · **Priority:** MVP

> As an editor, I want to pin frequently-active projects to the top of
> my dashboard and reorder them so that they're always one click away.

- Pin/unpin via row action.
- Drag handle visible only on pinned rows, used to reorder within the
  pinned section.
- Pin state persists in `user_project_preferences` (per-user).

#### US-1.2 — See project metadata at a glance
**Status:** Draft · **Priority:** MVP

> As an editor, I want each row to show the project number, name,
> client, and last-modified date so that I can identify a project
> without opening it.

- Columns: bt_number, name, client, last_modified.
- Last-modified renders as relative time ("2 hours ago", "3 days
  ago") with hover-tooltip showing exact timestamp.

#### US-1.3 — Create a new project
**Status:** Confirmed (2026-05-10) · **Priority:** MVP

> As an editor, I want to create a new project from the dashboard so
> that I can begin working on it immediately.

**Form fields (modal):**
- Project name — required, free text.
- BT number — required, **must be globally unique across all projects
  (active and soft-deleted)**. 4-digit format expected (e.g. "2426")
  but stored as TEXT for forward flexibility.
- Client — optional, free text.
- Certification programs — optional checkbox group: PHI, Phius.
  Both may be selected because a building can pursue certification
  under both programs. Empty means no program selected yet or
  design-analysis-only.
- Phius number — optional, free text. Shown when Phius is selected;
  still nullable because the number may not exist at project create.

**Validation:**
- Frontend debounces a `GET /api/v1/projects/check-bt-number?value=2426`
  as the user types BT number; response returns `{available: bool}`.
- Submit button disabled when BT number is empty, non-unique, or
  required-name is empty.
- Backend re-validates uniqueness inside the create transaction; a
  race produces a 409 with `error_code='bt_number_taken'`.

**On submit:**
1. INSERT `projects` row with `owner_id = current_user`,
   `bt_number = ...`, `name = ...`, etc. UNIQUE constraint on
   `bt_number` enforces.
2. INSERT initial `project_versions` row: name = "Working",
   kind = `working`, locked = false, body = empty
   `ProjectDocumentV1` skeleton (see Q6 resolution below).
3. Set `projects.active_version_id` to the new version.
4. Log `action='project_create'` with project_id and bt_number.
5. Redirect to `/projects/{new_id}/status`.

### Resolved questions (2026-05-10)
- **Q6 (Q-CREATE-1):** Empty `ProjectDocumentV1` has empty arrays
  for every table:
  ```json
  {
    "schema_version": 1,
    "project": { "name": "<name>", "bt_number": "<num>",
                 "cert_programs": [],
                 "phius_number": null, "phius_dropbox_url": null },
    "tables": {
      "assemblies": [],
      "window_types": [],
      "rooms": [],
      "equipment": { "fans": [], "pumps": [], "ervs": [] },
      "manufacturer_filters": []
    }
  }
  ```
  Confirmed.
- **Q7 (Q-CREATE-2):** `bt_number` is **hard-unique**, never allowed
  to duplicate. Enforced as a `UNIQUE` constraint on
  `projects.bt_number` (no partial filter — soft-deleted projects
  retain their numbers; numbers are forever associated with a
  project). Confirmed.

#### US-1.5 — Forward-compatible access checks (architectural)
**Status:** Confirmed (2026-05-10) · **Priority:** MVP

> As a developer, I want every project-scoped API route to go through
> a single access-check seam so that adding strict ACL later is a
> change to one function, not 50 routes.

**Day-1 implementation (MVP):**
- A FastAPI dependency `require_project_access(project_id: UUID, mode: Literal['view', 'edit'])` is used on **every** project-scoped route — both REST and MCP.
- Today the dependency body is:
  - Resolve the current user from session OR MCP token (no separate public link token — project URLs are public-readable per PRD §4 updated 2026-05-10).
  - For `mode='edit'`: require an authenticated editor (signed-in user).
  - For `mode='view'`: **always passes.** Project URLs are public-readable; the dependency just resolves the visitor (authenticated editor OR Viewer sentinel) for downstream use.
  - Return the resolved user (or "Viewer" sentinel) for downstream use.
- The dashboard query (`SELECT * FROM projects WHERE owner_id = current_user.id AND deleted_at IS NULL`) is intentionally simple — ownership is the dashboard filter only.

**Day-N implementation (if/when strict ACL ships):**
- A `project_members (project_id, user_id, mode, granted_at, granted_by)` table is added.
- The dependency body grows: in addition to authentication, check `owner_id = user.id OR EXISTS (SELECT 1 FROM project_members ...)`.
- Dashboard query grows to include shared-with-me as a separate section.
- **No route signatures change.**

**Anti-patterns to avoid (so the seam holds):**
- Do not write `if user.id == project.owner_id` checks inline in routes. They bypass the seam.
- Do not query `projects` directly in route handlers without going through a service that respects the access check.
- Do not assume "any signed-in user can read any project" implicitly; always go through `require_project_access`.

**PRD ref:** §4 (commitment), §13 (auth flows pass through here).

---

#### US-1.4 — Delete a project (deferred from MVP)
**Status:** Confirmed-Deferred (2026-05-10) · **Priority:** v1.1

> As an editor, I want to delete a project I no longer need so that my
> dashboard stays clean. The action must be guarded against accident
> because deletion is rare and high-stakes.

- Delete is **planned but not implemented** for V2 v1.
- When implemented:
  1. Row action menu → Delete.
  2. Modal #1: "You are about to delete project [name]. This will
     soft-delete the project and all its versions, drafts, and
     HBJSON file metadata. R2 objects will be GC'd after a
     retention window. Are you sure?" Confirm / Cancel.
  3. Modal #2: "Type the project name `[name]` exactly to confirm."
     Confirm button is disabled until the typed name matches
     exactly.
  4. On final confirm, soft-delete the project (set `deleted_at`)
     and log `action='project_delete'`.
- Soft-delete only; no hard-delete UI in v1.1. Hard-delete (purging
  R2 objects, hard-removing rows) is an admin-only script if ever
  needed.

### Resolved questions (2026-05-10)
- **Q8 (Q-DEL-1):** 90-day retention window after soft-delete before
  any R2 GC sweep removes orphaned objects. Confirmed.
- **Q9 (Q-DEL-2):** Undelete is admin-only — no end-user trash-bin
  UI in v1.1. Admin runs a one-shot script to restore a soft-deleted
  project. v1.2+ may add a trash-bin UI if Ed/John ever request
  it. Confirmed.

### Notes
- Soft-deleted projects retain their `bt_number` permanently
  (UNIQUE constraint without partial filter — see US-1.3 Q7). A
  project number is never reused, even after deletion.
- 90-day window is for **R2 object cleanup**, not for the DB row.
  The `projects` row + all `project_versions` rows + draft rows
  remain in the DB indefinitely after soft-delete (cheap, and
  enables admin undelete forever). Only the storage-heavy R2
  objects (HBJSON files, photos) are GC'd after 90 days.

---

## US-2 — Access shared catalogs from the dashboard

**Status:** Confirmed (2026-05-10)
**Priority:** MVP (3 catalogs in v1; 9 deferred)
**PRD ref:** §7, §11.1

### Story
> As an editor, I want to access the shared catalogs (Materials,
> Window-Frame Elements, Window-Glazing) from the global app header so
> that I can curate the starting library used by all projects.

### Acceptance criteria
1. The global top header has a "Catalogs ▾" dropdown visible on every
   signed-in page.
2. Clicking opens a menu listing the available catalogs. v1 ships
   three:
   - **Materials**
   - **Window-Frame Elements**
   - **Window-Glazing**
   The roster will grow over time; see "Future catalogs" below.
3. Selecting a catalog navigates to `/catalog/{table_slug}` and
   shows the catalog manager surface (specced in a later
   US-Catalog story).
4. **All catalogs are global, shared across projects, and follow
   the bookshelf model** (PRD §7): the catalog is a starting library;
   when a project picks a row, values are copied into the project
   document. Catalog edits do not propagate into existing projects
   until the user explicitly runs refresh-from-catalog.

### Future catalogs (deferred — post-v1)

Each is a global shared catalog, same bookshelf model as the v1 three.
Each is a code-and-deploy event (new typed table, new TS table
component, new entry in the dropdown) rather than runtime config.

| Catalog | Sub-types / notes |
|---|---|
| ERV units | — |
| Pumps | — |
| Fans | sub-types: extract-for-trash, kitchen, laundry, other |
| Appliances | sub-types: fridge, dishwasher, etc. |
| Hot-Water Heaters | sub-types: heat-pump, direct-elec, gas |
| Hot-Water Storage Tanks | — |
| Heat-Pumps (heating/cooling) | — |
| Direct-Elec Heaters | backup unit-heaters |
| Boilers | sub-types: gas, oil, elec |
| (others TBD) | — |

Sub-types within a catalog are stored as a `sub_category` column on
the row, not as separate tables. (One table per high-level
category.)

### Resolved questions (2026-05-10)
- **Q1 (Q-CAT-1):** Future catalogs are **shared global**, same
  bookshelf model as v1's three. Not project-scoped + optional
  global. Confirmed. Roster captured above.
- **Q2 (Q-CAT-2):** No catalog activity surfacing on the dashboard
  in MVP. Catalog audit log is queryable from the catalog manager
  itself when it ships. Confirmed lean.

### Notes for later stories
- The "Catalogs ▾" dropdown UI works fine at v1's three entries.
  When future catalogs land, the menu may want grouping (Envelope:
  Materials/Frames/Glazings; MEP: ERVs/Pumps/Fans/Heaters/...; or
  a Command-K-style search). Defer the menu redesign until the 4th
  catalog actually lands.
- Each future catalog ships with: typed table + version table,
  Pydantic model, REST routes (CRUD per §9.8), MCP read tool, TS
  table component for the catalog manager, an entry in the
  Catalogs dropdown, and a corresponding project-document table
  schema_version bump.

---

## US-3 — Open a project (project workspace structure)

**Status:** Confirmed (2026-05-10)
**Priority:** MVP
**PRD ref:** §11.1
**UI/UX ref:** §2.4 *Project landing page*

### Story
> As an editor, I want to click a project on the dashboard and land in
> a workspace organized around the way I actually work — project
> status (lifecycle milestones) first, then the editing surfaces
> (Windows, Envelope, Equipment), and the 3D model viewer.

### Acceptance criteria
1. Clicking a project row navigates to `/projects/{project_id}/status`
   (Status tab is the default).
2. **Project header bar** (below the global app header) contains:
   - **Left:** project name (large), bt_number, client (smaller line).
   - **Right:**
     - **Version dropdown** (US-3.1) — shows the currently-open
       version with kind icon + lock badge; clicking opens the
       version picker.
     - **Save status indicator** (clean / draft-dirty / sync-error
       dot).
     - **Save** button (primary; disabled when no draft changes;
       disabled with explanatory tooltip when version is locked).
     - **`⋯` overflow menu:** Save As, Discard changes, Lock /
       Unlock, Project settings (US-Settings).
     - **IP / SI units toggle** (binds to `users.units_preference`;
       see Q-UNITS-1).
3. **Tab bar** (below the project header) with five tabs in this
   order:
   - **Status** — project lifecycle milestones (US-Status; new
     substantial feature).
   - **Windows** — window types (US-Builder-Windows).
   - **Envelope** — assemblies (US-Builder-Envelope).
   - **Equipment** — rooms + future MEP equipment tables
     (US-Builder-Equipment).
   - **Model** — 3D HBJSON viewer (US-Viewer).
4. Tab selection updates the URL: `/projects/{id}/status`,
   `/projects/{id}/windows`, etc. Browser back / forward work.
5. **No "AirTable" button.** V2 has no AirTable surface (PRD §3
   non-goals).
6. **No "Versions" tab.** Versions are in the header dropdown
   (US-3.1) — not in the tab bar — to keep "current version" always
   visible and to require an explicit Open gesture for switches.
7. **No top-level "Settings" tab.** Project settings live behind the
   `⋯` overflow menu (US-Settings). Catalog access stays in the
   global app header (US-2).
8. The PH-Nav logo in the global header returns to the dashboard.

### Resolved questions (2026-05-10)
- **Q1 (Q-LAND-1):** Project landing layout = tab bar (matches the
  V1 mental model the user already has). Status / Windows /
  Envelope / Equipment / Model. Confirmed.
- **Q2 (Q-LAND-2):** Default tab on project open = **Status**, not
  Builder. The Status page is the user-facing landing for "where is
  this project in its lifecycle." Confirmed (revised from earlier
  Builder-default lean).
- **Q3 (Q-LAND-3):** Versions are a **header dropdown**, not a tab.
  Detailed in US-3.1. Confirmed.

### Sub-stories

#### US-3.1 — Version dropdown in the project header
**Status:** Confirmed (2026-05-10) · **Priority:** MVP

> As an editor, I want a version picker in the project header that
> always shows which version I'm currently editing, requires an
> explicit "Open" gesture to switch, and protects me from accidental
> data loss when I have unsaved changes.

**Header trigger (always visible):**
- Renders the currently-open version's name + kind icon
  (Working / Submitted / Closed) + lock padlock if locked.
- Example: `Working ▾`, `Round 1 Submit · 🔒 ▾`,
  `Closed (Final) · 🔒 ▾`.
- Click opens the dropdown panel.

**Dropdown panel contents:**
- Header: "Versions" + small "+ Save As…" link (shortcut to the
  Save As flow without opening the menu).
- Vertical list of versions, ordered by `created_at` descending
  (newest first). Each row:
  - Version name (e.g. "Working", "Round 1 Submit")
  - Kind badge (Working / Submitted / Closed)
  - Lock icon if locked
  - Default-version star (★) if this version is
    `projects.active_version_id`
  - Last-saved relative time ("saved 2 hours ago")
  - **"Open" button** (the only mutating control on the row)
  - `⋯` row-action menu: Make default, Rename, Lock / Unlock,
    Delete
- Footer: total count ("8 versions") and a "Compare versions…"
  link (opens diff modal, US-Versions-Diff).

**Open behavior:**
1. User clicks "Open" on a row that is *not* the currently-open
   version.
2. **Dirty-draft check:** if the currently-open version has a draft
   with unsaved changes, prompt before switching:
   - "You have unsaved changes in [Working]. What would you like
     to do?"
   - Options: **Save** (writes draft to current version, then
     switches), **Save As…** (writes draft to a new version, then
     switches to the requested version), **Discard changes** (drops
     draft, then switches). **Cancel** closes the prompt without
     switching.
   - If the current version is locked, "Save" is unavailable
     (locked); only "Save As…" or "Discard."
3. **Switch:** URL updates to `/projects/{pid}/{tab}` (tab unchanged);
   editor reloads the new version's body. Header trigger updates to
   reflect the new version.
4. The `projects.active_version_id` does **not** change unless the
   user explicitly chose "Make default" on a row. Session-scoped
   open ≠ default-on-Dashboard-click.

**Locked-version edit lockout (cross-cutting):**
- When the open version is locked, the editor's table cells render
  read-only.
- A persistent banner across the top of the content area:
  "This version is locked. To edit, click **Save As** to copy it
  into a new version."
- Save button hidden / replaced by Save As shortcut.
- Prevents the "I typed for 10 min and got a 409 at Save" failure
  mode.

**Default-from-Dashboard:**
- Dashboard click → opens project at `active_version_id` (the
  version flagged as default).
- Default is set by:
  - Save As (the new version becomes active).
  - Manual "Make default" row action.
  - On project create, the initial "Working" version.

**PRD ref:** §8 (save / version model), §6.1
(`projects.active_version_id`).

#### US-Versions-Lifecycle — Save states, restore, diff, and downloads
**Status:** Confirmed (2026-05-11) · **Priority:** MVP Phase 2

> As an editor, I want project versions, drafts, diffs, and JSON
> downloads to behave predictably so that I can preserve certification
> milestones, recover interrupted work, and export the exact model data
> behind a review.

**Scope:** one compact implementation story covering PRD-promised
version lifecycle flows that are referenced by the shell and table
stories.

**Sub-flows:**

1. **Submit / Close.**
   - Submit and Close are implemented as Save As flows with
     `kind='submitted'` or `kind='closed'`.
   - The new Submitted / Closed version is auto-locked.
   - The source version remains unchanged except for normal draft
     clearing after successful Save As.
   - Submitted / Closed versions are readable and downloadable but
     reject direct Save.
   - To edit a Submitted / Closed version, user clicks Save As to make
     a new unlocked Working version.

2. **Draft restore on reopen.**
   - On opening a version, PHN fetches saved body and current user's
     draft.
   - If a server draft exists and differs from the saved body, show a
     restore prompt before the editor becomes editable.
   - **Restore** loads the draft, marks the UI dirty, and preserves the
     draft ETags.
   - **Discard** deletes the server draft and loads the saved body.
   - Viewers never restore drafts; they always see saved version bodies.

3. **Discard changes.**
   - Discard is available from the project header overflow and dirty
     version-switch prompt.
   - Requires destructive confirmation.
   - Deletes the server draft, clears local write queue + undo stack,
     and reloads the saved version body.
   - Does not create a version and does not update
     `projects.last_saved_at`.

4. **Diff / Compare.**
   - Version dropdown footer opens "Compare versions..." modal.
   - MVP supports version-vs-version and current-draft-vs-saved.
   - Backend computes structured deltas from the two JSON bodies.
   - MVP UI renders a per-table changed-row / changed-field list. No
     visual side-by-side table diff required in v1.
   - Drafts do not appear as named versions in the version list.

5. **Project / table JSON download.**
   - Project JSON download returns the selected saved version's
     `ProjectDocumentV1` body.
   - Per-table JSON download returns one table slice from that saved
     body.
   - Downloads are available to Editors and Viewers, including locked
     versions.
   - Draft download is not in v1; the user must Save / Save As first
     if they want a downloadable artifact of local changes.

**Acceptance criteria:**

1. Save As can create `working`, `submitted`, and `closed` versions.
2. Submitted / Closed versions are created locked and reject direct
   Save with `409 version_locked`.
3. Save As from a locked version creates a new unlocked Working version.
4. Restore-draft prompt appears only when a server draft differs from
   the saved body.
5. Discard deletes the server draft, clears local pending state, and
   leaves `projects.last_saved_at` unchanged.
6. Compare modal can show version-vs-version and draft-vs-saved deltas
   grouped by table.
7. Project JSON download validates against `ProjectDocumentV1`.
8. Per-table JSON download validates against that table's Pydantic
   model / JSON Schema.
9. Editors and Viewers can download saved JSON from locked versions.
10. Draft JSON download is hidden / unavailable in v1.

**PRD ref:** §8.2 (operations), §8.3 (draft buffer), §8.4 (diff),
§9.6 (diff API), §9.7 (download API), §16 (success criteria).

#### US-3.2 through US-3.5 — Per-tab placeholders
**Status:** Placeholder · **Priority:** MVP

Each tab is its own user story; specced when we walk it.

| Sub-story | Tab | Story ID |
|---|---|---|
| US-3.2 | Status | US-Status |
| US-3.3 | Windows | US-Builder-Windows |
| US-3.4 | Envelope | US-Builder-Envelope |
| US-3.5 | Equipment | US-Builder-Equipment |
| US-3.6 (model) | Model | US-Viewer |
| US-3.7 (settings) | Project settings (overflow menu) | US-Settings (Draft) |

### Resolved questions (2026-05-10, second batch)
- **Q-UNITS-1:** Units preference is **per-user**
  (`users.units_preference`). **Hard architectural rule:** backend
  is 100% SI; conversion is frontend-only. Same model as V1. See
  PRD §11.5 (new) for the rule and its implications. Confirmed.
- **Q-LANDDEFAULT-1:** Brand-new project's Status tab shows the
  empty state with **"Apply BLDGTYP default template"** as the
  primary CTA; no auto-populate at project create. Default template
  content (4 items, see Q-STATUS-1 below). Confirmed.

### Resolved questions (2026-05-11)
- **Q-UNITS-2:** TS units strategy = focused, quantity-specific
  frontend helpers under `frontend/src/lib/units/`, using V1
  unit-converter/context and Window Builder dimension parser files as
  research/templates. Do not port all of Python `PH_units` and do not
  add a generic units package for MVP. See PRD §11.5.3.

---

## US-Concurrency — Multi-tab, MCP, and stale-draft handling

**Status:** Draft, partial decisions confirmed 2026-05-11
**Priority:** MVP infrastructure
**PRD ref:** §8.3–§8.6 (drafts, ETags, concurrency), §10.3 (MCP),
§13 (auth/session)
**UI/UX ref:** §1.4 (toasts), §2.4.1 (locked-version banner)

### Story
> As an editor, I want PHN to tolerate the real ways I work — multiple
> browser tabs, a catalog tab beside a project tab, and Claude making
> draft edits — without silently losing work or surprising me with
> invisible changes.

### Confirmed decisions

1. **Same-editor browser tabs are allowed.** Opening the same project
   and version in two browser tabs is a normal workflow, not an error.
   Example: one tab editing Rooms while another tab edits Windows, or
   one tab editing the Window-Frame Element catalog while another builds
   project Window Types from the latest catalog entries.
2. **No global browser-tab takeover.** A second browser tab does not
   force the first tab read-only. Both tabs may remain editable as long
   as their writes pass draft ETag checks.
3. **Browser tabs coordinate draft updates.** Accepted browser writes
   broadcast their patch metadata and new `draft_etag` to sibling tabs
   for the same project/version. A tab receiving a non-overlapping
   change may apply it in memory and continue.
4. **Overlapping browser-tab edits fail visibly.** If a sibling-tab
   change overlaps the active dirty UI scope, PHN freezes that scope and
   shows a banner: "This draft changed in another tab. Review changes or
   reload draft." Local unsaved edits stay in memory until the user
   chooses.
5. **Catalog tabs are independent.** Catalog manager writes are not
   project-draft writes. A project tab should see newly created catalog
   entries through normal picker refresh / search reload, not through
   project-draft concurrency handling.
6. **MCP writes freeze browser editing while active.** MCP mutating
   tools acquire a short draft edit lease. Open browser editors show a
   visible indicator such as "Claude is editing this draft" and disable
   write controls until the lease clears. Viewing, navigation, and copy
   remain available.
7. **MCP changes are not silently live-applied.** After an MCP write
   completes, browser tabs show a persistent banner: "Claude changed
   this draft." Actions: **Review changes**, **Reload draft**,
   **Keep local state**. Choosing Keep local state leaves the tab
   stale; its next write must pass normal ETag conflict handling.
8. **MCP token revocation blocks the next request.** If a token is
   revoked, subsequent MCP calls fail with a structured auth error
   (`mcp_token_revoked` or equivalent). A request that already passed
   auth may complete atomically; PHN does not promise to cancel an
   in-flight DB transaction.
9. **Commit steps re-check revoked tokens.** Long-ish multi-step flows
   such as upload intent -> R2 PUT -> complete-upload -> attach must
   re-check token state at the PHN API boundary. If the token was
   revoked after the signed PUT URL was issued, `complete-upload`,
   `attach_asset`, or `save_draft` fails and does not mutate the
   project draft.
10. **Locking is authoritative immediately.** If another actor locks
    the version while a browser or MCP draft is open, the draft is
    preserved but further draft patch and Save requests fail with
    `409 version_locked`. Open browser tabs downgrade to the standard
    locked-version banner on the next poll, broadcast, or rejected
    write. The user can Save As into a new unlocked version or discard.
11. **Live lock downgrade uses the same UX as opening a locked version.**
    A tab that was editable five seconds ago does not keep stale edit
    affordances after learning the version is locked. Inputs freeze,
    Save is replaced by Save As, and a sticky banner explains that the
    version was locked elsewhere.
12. **Device-collision re-auth requires an explicit choice.** If a tab
    was signed out by a newer sign-in, signing in again from the stale
    tab warns that it will sign out the other session. This is an
    intentional loop-breaker for the single-active-session rule.
13. **Dirty-draft Save before version switch is not a visible limbo.**
    If the user chooses Save in the dirty-draft prompt before opening a
    different version, PHN saves the source draft first, then fetches the
    target version. The visible current version changes only after the
    target fetch succeeds. If the fetch fails, the user stays on the
    source version, now clean, with a retryable toast.
14. **`replace_table` uses whole-draft optimistic concurrency.** A
    table replacement consumes and bumps `draft_etag`. If two clients
    replace unrelated tables from the same base ETag, the first accepted
    write wins and the second receives 409. The second client must
    refetch and retry intentionally.

### Acceptance criteria

1. Two browser tabs can open the same project/version and both remain
   editable.
2. Editing disjoint project surfaces in two tabs succeeds without a
   takeover prompt.
3. A conflicting same-scope tab edit freezes the stale scope and offers
   Review changes / Reload draft / Keep local state.
4. Browser-tab coordination never bypasses backend ETag checks; the
   server remains authoritative.
5. MCP mutating calls display an editing indicator and freeze browser
   write controls while the MCP edit lease is active.
6. Revoking an MCP token causes the next MCP call to fail with a
   structured auth error and writes an `mcp_token_revoke` audit event.
7. A revoked token cannot complete or attach an uploaded asset after
   revocation, even if it had already received a signed upload URL.
8. Locking a version with open drafts preserves those drafts but blocks
   further patch/save until Save As, discard, or unlock.
9. A live lock downgrade freezes the active editor and shows the
   locked-version banner.
10. Device-collision re-auth warns before displacing the other active
    session.
11. A failed target-version fetch after a successful pre-switch Save
    leaves the user on the saved source version with no dirty draft.
12. A stale `replace_table` call returns 409 even if the prior accepted
    write touched a different table.

### Still to decide

- F4: idle-tab and Viewer-tab session-expiry behavior.

---

## US-Errors-SchemaFallback — Older document read-safe mode

**Status:** Draft
**Priority:** MVP
**PRD ref:** §10.5 (schema versioning), §16 (success criteria)
**UI/UX ref:** §1.4 (toasts), §4 (state indicators)

### Story
> As an editor or Viewer opening an older project version, I want PHN to
> preserve access to the raw project data even if the current app cannot
> fully migrate that document shape.

### Acceptance criteria
1. If a schema upgrade shim raises, or if the upgraded body fails
   `ProjectDocumentV{CURRENT}` validation, the API returns
   `schema_version_unsupported: true` with the raw body per PRD §10.5.
2. The project workspace renders a read-only fallback page instead of
   the normal tab UI.
3. A persistent banner says: "This version uses an older project format
   that PHN could not fully migrate. Editing is disabled, but the raw
   project JSON is still available."
4. Primary CTA: **Download raw project JSON**. It calls the normal
   project-version download endpoint and returns the unmigrated body.
5. Secondary CTA for signed-in Editors: **Contact admin / file issue**
   link or copyable diagnostic block containing `project_id`,
   `version_id`, saved `schema_version`, current schema version, and
   `request_id`.
6. Save, Save As, table edits, catalog picks, upload actions, MCP writes,
   and lifecycle transitions are disabled for that loaded version.
   Switching to another version remains available.
7. Viewers see the same fallback banner and JSON-download CTA, without
   admin diagnostics that expose internals beyond the request id.
8. The backend emits a structured error log with
   `error_code='schema_migration_failed'` or
   `error_code='schema_validation_failed_after_migration'`.

---

## US-Status — Project status / lifecycle tracker

**Status:** Draft · **Priority:** MVP (Status is the default
project landing tab per US-3 criterion 1; promoted from
Placeholder 2026-05-10 after all Q-STATUS-* resolved)
**PRD ref:** §6.1 (new `project_status_items` table — adds to
relational layer), §11.1 (project tabs)
**UI/UX ref:** §2.5 *Status tab*
**Reference image:** V1 Status page (provided by Ed, 2026-05-10).
Vertical timeline of certification milestones with state icons,
title, completion date or free-text description, optional in-app
links.

### Story
> As an editor, I want a per-project list of certification /
> lifecycle milestones (CAD files received, design model
> complete, cert review complete, certification complete, plus
> any custom items) that I can re-order, mark done, date, and
> annotate — so I always know where this project sits in its
> lifecycle without consulting an external tracker.

### Architectural decisions (2026-05-10)

- **Storage location: relational, NOT in the project document.**
  Reason: status is a project-level lifecycle concept, not a
  versioned property of the energy model. Opening Round 1
  Submit six months later should show *today's* status, not
  Round-1-time status. (Sibling pattern: `project_hbjson_files`
  in US-VIEW-1 + `project_airtightness` in US-ENV-14.)
- **Certification programs are project metadata, not template logic in
  v1.** Projects store `cert_programs: ['phi']`, `['phius']`,
  `['phi', 'phius']`, or `[]` because one building can pursue both PHI
  and Phius certification. The v1 Status template remains a single
  cert-agnostic basic template; program-specific template variants are
  deferred to v1.1+.
- **State enum** (per Q-STATUS-3 resolved): **`todo | done | na`**.
  No `in_progress`. The "current step" visual is **computed**:
  the first non-`done` item in `order_index` order gets a
  highlight style. This avoids ambiguity ("is `in_progress`
  distinct from `todo` for the active one?").
- **Templates pre-applied or empty-on-create?** Per
  Q-LANDDEFAULT-1 (resolved): **empty on create**, with the
  Status tab's empty state offering "Apply BLDGTYP default
  template" as the primary CTA.
- **Description rich text:** plain text + Markdown links in MVP.
  Internal anchor-link syntax (e.g.
  `[Airtightness](##airtightness)` linking to other tabs in the
  project) is v1.1+.
- **No per-item attachments in v1** (per Q-STATUS-5 resolved).
  Description Markdown can link to stable PHN asset download routes for files
  uploaded elsewhere (Site Photos, datasheets, etc.).
- **Reorder:** drag-and-drop with up / down keyboard fallback
  for accessibility. Fractional `order_index` makes reorder a
  one-row update, not a renumber.
- **Shared (not per-user):** the status list belongs to the
  project, visible identically to Ed and John.
- **Permissions:** any editor can mutate. Read-only for
  Viewers (per the access-check seam, PRD §4.1).

### Schema (PRD §6.1 amendment)

```sql
CREATE TABLE project_status_items (
    id              UUID PRIMARY KEY,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    order_index     DOUBLE PRECISION NOT NULL,
                    -- fractional indexing for cheap reorder
                    -- (insert between 1.0 and 2.0 → 1.5)
    title           TEXT NOT NULL,
    state           TEXT NOT NULL,
                    -- 'todo' | 'done' | 'na'   (per Q-STATUS-3; no 'in_progress')
    completion_date DATE,
                    -- nullable; auto-populated on state→'done' but user-editable (Q-STATUS-7)
    description     TEXT,
                    -- Markdown with hyperlinks; in-app anchor links v1.1+
    deleted_at      TIMESTAMPTZ,        -- soft delete
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
                    -- nullable so user deletion preserves project status history
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX project_status_items_project_id_order_idx
  ON project_status_items (project_id, order_index)
  WHERE deleted_at IS NULL;
```

### Default template content (Q-STATUS-1 resolved, amended 2026-05-11 for cert-program agnosticism)

The "Apply BLDGTYP default template" CTA populates these
**4 items** in order, **cert-program agnostic** (works for PHI, Phius,
dual-certified, or design-only projects):

| # | Title | Initial state |
|---|---|---|
| 1 | CAD files received | todo |
| 2 | Design Model complete | todo |
| 3 | Cert review complete | todo |
| 4 | Certification Complete | todo |

> **Amendment 2026-05-10:** item 3 renamed from "Phius review
> complete" → **"Cert review complete"** per Q-STATUS-2's
> cert-agnostic directive. The template ships identical for
> every certification-program selection in v1.

Template lives in code (e.g. `backend/features/project_status/
constants.py:DEFAULT_TEMPLATE`). No template-management UI in
v1.

### Acceptance criteria

1. **Tab placement.** The Status tab is the **default project
   landing tab** (per Q-LAND-2 resolved). Content area is a
   single vertical scroll surface — no sub-tabs.

2. **Empty state** (matches Q-LANDDEFAULT-1 resolution).
   Brand-new project with zero `project_status_items` rows:
   - Centered card with copy: *"Track this project's
     lifecycle milestones."*
   - Primary CTA: **"Apply BLDGTYP default template"** (adds
     the 4 default items).
   - Secondary CTA: **"+ Add custom item"** (opens the
     add-item form).
   - Tertiary link: **"Skip to Envelope"** for users who
     want to jump straight into modeling.

3. **Populated layout — vertical timeline.** Items render as
   a vertical list, sorted by `order_index` ascending. Each
   item row contains:
   - **State icon** (left rail): unchecked circle (`todo`),
     filled checkmark (`done`), or struck-through circle
     (`na`). Click to cycle through states (toggling order:
     `todo → done → na → todo`).
   - **Drag handle** (left rail, on hover): grip icon for
     drag-to-reorder.
   - **Title** (single-line text): editable inline (click
     to edit).
   - **Completion date** (right rail): shown for `done`
     items as a small date pill (`Apr 23, 2025`). Empty
     space for `todo` / `na`.
   - **Description** (below title, indented): Markdown-
     rendered. Empty placeholder text ("Add notes…") when
     no description. Click to edit (modal or inline-
     expanding textarea; implementer's call).
   - **`⋯` row-action menu**: Edit item (opens modal with
     all fields), Delete item, Mark N/A.

4. **Current-step visual** (Q-STATUS-3 computed style):
   - The **first `todo` item in `order_index` order** gets a
     subtle highlight (e.g. left-border accent + slightly
     larger title text) so the user sees at a glance "this
     is what we're working on now."
   - Computed on render; no state field stored.
   - When all items are `done`, no current-step highlight.

5. **State toggle behavior:**
   - Click the state icon cycles
     `todo → done → na → todo`.
   - **On flip to `done`:** auto-populate `completion_date`
     to today (per Q-STATUS-7 resolved). The date pill
     appears; user can click it to edit (criterion 6).
   - **On flip away from `done`** (`done → na`): keep the
     existing `completion_date` (don't auto-clear). The
     pill still renders on `na` items if a date was set —
     useful for "we completed this but it's no longer
     relevant" semantics. User can clear via the edit form.
   - **On flip to `todo` from `done`:** keep the existing
     `completion_date` (preserves history if the user flips
     a state by mistake and back).
   - All state changes flush a single `PATCH` to the
     backend (no draft buffer — relational table, direct
     write).

6. **Completion date editing** (per Q-STATUS-7 resolved):
   - Auto-populated to today on the first flip to `done`.
   - **Always user-editable** thereafter — click the pill
     to open a date picker. Useful for backdating ("I
     marked this done today but it really completed last
     week").
   - Date field accepts manual typing (ISO format or
     locale-formatted) and date-picker UI. Clear button
     to set to null (rare but supported).

7. **Add custom item** — primary `+ Add item` button at the
   bottom of the list:
   - Opens an inline-edit row (or modal) with: title
     (required), state (default `todo`), description
     (optional Markdown), order_index (default = last +
     1.0).
   - Save → POST creates the row; list updates.
   - Cancel → discard.

8. **Edit item** — click title to edit title inline (Enter
   commits, Escape cancels, blur commits). For richer edits
   (description Markdown, state, date), `⋯ → Edit item`
   opens a small modal with the full row's fields.

9. **Delete item** (per Q-STATUS-4 resolved — fully
   deletable):
   - `⋯ → Delete item` opens a shadcn `Dialog` confirm
     (simple Cancel / Delete; no name retyping).
   - Soft-delete (`deleted_at = now()`). Item disappears
     from the list immediately. **No undo UI in v1** —
     undelete is admin-only (mirrors US-1.4 project-delete
     policy).
   - Deleting the "current-step" highlighted item
     transparently shifts the highlight to the new first
     `todo` (since it's computed).

10. **Reorder (drag + keyboard):**
    - **Drag** a row by its grip handle to a new position;
      drop commits a new `order_index` for the dragged row
      computed as the midpoint between adjacent rows
      (fractional indexing). Single-row update — no
      cascade-renumber.
    - **Keyboard fallback:** focus a row, press
      `Alt+↑` / `Alt+↓` to move up/down one position.
      Accessibility-friendly equivalent to drag.
    - **Edge case** — if 30+ insert-between operations
      eventually exhaust the float-64 precision between
      two consecutive integers (very unlikely but
      theoretically possible), a periodic renumber job
      can re-spread the values. Out of scope for v1.

11. **Description rendering:**
    - **Display:** Markdown rendered via a sanitized
      renderer (e.g. `react-markdown` with allow-list).
      Permitted elements: paragraphs, line breaks, bold,
      italic, inline code, **external hyperlinks**
      (open in new tab).
    - **Internal anchor links** (`[Airtightness](##airtightness)`
      → navigate to the Envelope tab's Airtightness
      sub-tab) **deferred to v1.1+** (UI plumbing for
      cross-tab navigation is non-trivial).
    - **Edit:** plain textarea with Markdown shortcuts (no
      WYSIWYG); preview tab available in the edit modal.

12. **No attachments in v1** (per Q-STATUS-5 resolved).
    Users who want to link a photo or PDF write a Markdown
    link to an asset download URL exposed by the asset API
    (uploaded elsewhere — Site Photos / datasheets / HBJSON files).

13. **Permissions:**
    - **Editors:** full add / edit / delete / reorder /
      state-toggle access.
    - **Viewers:** read-only. Can see the
      timeline; cannot mutate.

14. **Locked-version handling: N/A.** `project_status_items`
    is relational, **not bound to project document
    versions**. Switching the active project version does
    NOT affect the status list — same status visible
    regardless of which version is open. (Sibling pattern:
    `project_hbjson_files` per US-VIEW-1 architectural
    decision 2.)

15. **MCP-callable backend endpoints** (per NEW-LLM-API-1):
    - `GET /projects/{id}/status-items` — list (ordered
      by `order_index`).
    - `POST /projects/{id}/status-items` — create.
    - `PATCH /projects/{id}/status-items/{item_id}` —
      update (title / state / completion_date /
      description / order_index).
    - `DELETE /projects/{id}/status-items/{item_id}` —
      soft-delete.
    - `POST /projects/{id}/status-items/apply-default-template` —
      bulk-insert the 4 default items.
    These let agentic workflows manage the status list
    ("mark CAD files received and add today's date").

### Resolved questions (2026-05-10)

- **Q-STATUS-1 (default template content):** 4 cert-agnostic
  items. Amendment 2026-05-10 — item 3 renamed from "Phius
  review complete" → "Cert review complete" per
  Q-STATUS-2's cert-agnostic directive.
- **Q-STATUS-2 (multiple templates):** single basic
  cert-program-agnostic template in v1. Projects still store a
  multi-value `cert_programs` metadata field (`phi`, `phius`, both, or
  empty) so future PHI/Phius-specific templates do not depend on
  inferring scope from `phius_number`. Multi-template support defers to
  v1.1+ if a real need surfaces.
- **Q-STATUS-3 (`in_progress` state):** dropped — states
  are `todo / done / na` only. Current-step is a computed
  visual (first non-done item).
- **Q-STATUS-4 (deletable items):** yes, fully deletable
  via `⋯ → Delete item`.
- **Q-STATUS-5 (per-item attachments):** out of v1.
  Description Markdown can link to stable PHN asset download routes for files
  uploaded elsewhere.
- **Q-STATUS-6 (empty-state UX):** see Q-LANDDEFAULT-1 in
  US-3. Three CTAs as captured in criterion 2.
- **Q-STATUS-7 (`completion_date` editing):** auto-populate
  to today on `done` flip, BUT user-editable thereafter
  (so they can backdate).

### Open questions
None outstanding.

### Cross-references

- **PRD §6.1** — `project_status_items` schema lands here.
- **Q-LANDDEFAULT-1 / US-3** — empty-state UX wiring.
- **PRD §4.1 (access-check seam)** — permissions plumbing.
- **NEW-LLM-API-1** — MCP-callable endpoints (criterion 15).
- **US-VIEW-1** — sibling relational-not-document-versioned
  table pattern (`project_hbjson_files`).
- **US-ENV-14** — sibling relational table
  (`project_airtightness`).

---
