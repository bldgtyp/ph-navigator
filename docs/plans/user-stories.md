[[title](https://)](https://)---
DATE: 2026-05-10
TIME: -
STATUS: DRAFT — populated incrementally as Ed and Claude walk through
        each feature. Companion to docs/plans/architecture-prd.md
        (architecture PRD) and docs/plans/ui-ux.md (UI/UX narrative).
AUTHOR: Ed May (with Claude)
SCOPE: Detailed user stories for PH-Navigator V2. Each story carries
       acceptance criteria, status, priority, and cross-references to
       the PRD and UI/UX docs.
RELATED: docs/plans/architecture-prd.md (architecture PRD),
         docs/plans/ui-ux.md (UI/UX narrative)
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
5. Failed sign-in shows a generic "email or password is incorrect"
   error without revealing which field was wrong.
6. No social login. **No self-serve forgot-password flow.** Password
   reset is admin-only: Ed runs a CLI / admin script to set a new
   password hash. Confirmed two-person internal-tool scope.
7. No public sign-up. Accounts created by admin via one-shot script.
8. **Session lifetime:** 60-minute sliding expiration. Every
   authenticated API request resets the expiry timer. Idle for 60
   minutes → session expires; next request returns 401.
9. **Single active session per user** (no multi-device support).
   Signing in on a new device invalidates the existing session for
   that user (most-recent-wins). The previous device sees 401 on its
   next request.
9a. **401-handling pattern (both idle and device-collision):**
   instead of navigating away, the frontend opens an in-place
   **session-expiry modal** (UI/UX §1.5) so the current tab context
   and any in-memory document are preserved. The modal subtitle
   distinguishes the cause ("inactive for 60 minutes" vs. "signed
   in on another device"). On successful re-auth, the modal closes
   and the failed request is retried.
10. **Mid-edit session-expiry UX.** If a session dies while the user
    has an open editor with unsaved in-memory changes:
    a. Frontend keeps the in-memory document; does not unmount.
    b. Modal: "Your session has expired. Sign in to continue editing."
       with email + password inputs (stays on the same URL).
    c. On successful re-auth, the modal closes and the most recent
       failed request is retried. The server-side draft (§8.3) already
       holds everything synced before idle, so worst-case data loss
       is one debounce window (~500ms of typing).
11. Successful sign-in is recorded in `user_action_log` with
   `action='login'`, IP, user-agent, timestamp (see C-1).
12. Failed sign-in attempts are recorded with `action='login_failed'`
   and the email attempted, for troubleshooting.
13. Session invalidations from device-collision sign-in are recorded
   with `action='session_invalidated_by_new_login'` on the
   superseded session.
14. Explicit sign-out (from header user menu) clears the session and
   logs `action='sign_out'`.

### UI/UX ref
See `docs/plans/ui-ux.md` §2.1 *Sign-in page*
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
  `project_versions` rows. Updated on Save / Save As. Confirmed.
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
- Phius number — optional, free text.

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
5. Redirect to `/projects/{new_id}/builder`.

### Resolved questions (2026-05-10)
- **Q6 (Q-CREATE-1):** Empty `ProjectDocumentV1` has empty arrays
  for every table:
  ```json
  {
    "schema_version": 1,
    "project": { "name": "<name>", "bt_number": "<num>",
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
  - Resolve the current user from session OR MCP token (no view-link token — project URLs are public-readable per PRD §4 updated 2026-05-10).
  - For `mode='edit'`: require an authenticated editor (signed-in user).
  - For `mode='view'`: **always passes.** Project URLs are public-readable; the dependency just resolves the visitor (authenticated editor OR anonymous-viewer sentinel) for downstream use.
  - Return the resolved user (or "anonymous-viewer" sentinel) for downstream use.
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

### New open questions
- **Q-UNITS-2:** TS units library choice — port `PH_units` to
  TypeScript, use a generic library (`convert-units`,
  `js-quantities`), or write thin per-quantity helpers? V1's
  approach to investigate when we hit the Builder stories.
  Defer.

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
- **Cert-type agnostic — single basic template** (per Q-STATUS-2
  resolved). No Phius vs PHI vs design-only variants in v1.
  Multi-template support is v1.1+ if a real need surfaces.
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
  Description Markdown can link to R2 URLs from assets uploaded
  elsewhere (Site Photos, datasheets, etc.).
- **Reorder:** drag-and-drop with up / down keyboard fallback
  for accessibility. Fractional `order_index` makes reorder a
  one-row update, not a renumber.
- **Shared (not per-user):** the status list belongs to the
  project, visible identically to Ed and John.
- **Permissions:** any editor can mutate. Read-only for
  anonymous (non-logged-in) viewers (per the access-check seam, PRD §4.1).

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
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX project_status_items_project_id_order_idx
  ON project_status_items (project_id, order_index)
  WHERE deleted_at IS NULL;
```

### Default template content (Q-STATUS-1 resolved, amended 2026-05-10 for cert-type agnosticism)

The "Apply BLDGTYP default template" CTA populates these
**4 items** in order, **cert-type agnostic** (works for Phius,
PHI, or design-only projects):

| # | Title | Initial state |
|---|---|---|
| 1 | CAD files received | todo |
| 2 | Design Model complete | todo |
| 3 | Cert review complete | todo |
| 4 | Certification Complete | todo |

> **Amendment 2026-05-10:** item 3 renamed from "Phius review
> complete" → **"Cert review complete"** per Q-STATUS-2's
> cert-agnostic directive. The template ships identical for
> every project type.

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
    - **Anonymous public viewers:** read-only. Can see the
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
  cert-type-agnostic template in v1. Multi-template support
  defers to v1.1+ if a real need surfaces.
- **Q-STATUS-3 (`in_progress` state):** dropped — states
  are `todo / done / na` only. Current-step is a computed
  visual (first non-done item).
- **Q-STATUS-4 (deletable items):** yes, fully deletable
  via `⋯ → Delete item`.
- **Q-STATUS-5 (per-item attachments):** out of v1.
  Description Markdown can link to R2 URLs from assets
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

## US-Builder-Windows — Windows tab (US-3.3)

**Status:** Draft (parent — sub-stories range Draft → Placeholder)
**Priority:** MVP
**PRD ref:** §6.2 (`tables.window_types` shape), §7 (catalog
bookshelf), §11.1 (project tabs), §11.5 (units architecture),
§8 (save / version model — Window-Builder edits flow into the
draft buffer, persisted by Save / Save As)
**UI/UX ref:** §2.6 *Windows tab* (placeholder — expanded by these
sub-stories)
**V1 reference:** `research/v1-window-builder-reference.md`
— deep enumeration of V1 behavior; consult for any "what does V1
do here" question. Cited as `V1 ref §N` below.

### Story (parent)
> As an editor, I want to compose the project's window / door types —
> the 2D grid of rows × columns, the elements that fill the cells,
> the frames and glazings each element uses, and the operation
> patterns (fixed / swing / slide / tilt-turn) — so that I can capture
> the design intent for every aperture in the project, see live
> ISO 10077-1 window U-values, and feed downstream tools (Rhino +
> honeybee_ph, certification submittals) without leaving the app.

### Why this is a story-cluster (US-WIN-1..12)
Window-Builder is the densest editing surface in PHN — V1 has 12+
named subsystems (sidebar, dimensions panel, canvas, elements table,
frame & glazing selectors, operation editor, manufacturer filter,
copy/paste, view direction, zoom, U-value). Splitting into an
`US-WIN-N` cluster lets us walk one subsystem at a time without
losing the cross-cutting picture. Sub-stories share the project's
versioned-document + bookshelf-catalog architecture (PRD §6.2, §7).

### Key V1 → V2 shifts (read first)
1. **All window-type data lives in the versioned project document.**
   `body.tables.window_types[]` per PRD §6.2. Edits flow into the
   draft buffer (PRD §8.3); explicit **Save** or **Save As** persists
   to a version. No V1-style per-edit autosave round-trip
   (V1 ref §14.1).
2. **Frame and Glazing are bookshelf-copied from the catalog, not
   live-referenced** (PRD §7.1). At pick time, the catalog row's
   values are *copied into the document* and stamped with a
   `catalog_origin` block. Catalog edits do not propagate into the
   project. Refresh-from-catalog (US-WIN-11) is the explicit
   re-sync gesture.
3. **No AirTable.** V2 catalog is hand-curated in the catalog manager
   (a separate top-level area; PRD §7.3, US-2). No "Refresh frame
   types from AirTable" gesture; no `purge_unused_frame_types`
   behavior.
4. **Backend is SI-only; frontend converts** (PRD §11.5). V1's
   selector option preview leaked hard-coded SI strings even in IP
   mode (V1 ref §17); V2 must respect the per-user IP/SI toggle
   everywhere — selectors, table cells, dimensions, U-value labels.
5. **Locked versions block all edits** (US-3.1). When the active
   version is locked, the entire Windows tab renders read-only with
   the "Save As to copy and edit" banner; no inline edit
   affordances anywhere in this cluster.
6. **Sort order normalized.** V1 has three different sort orders for
   aperture lists across three components (V1 ref §17). V2 uses
   `naturalSortCompare` everywhere (so `C2 < C10`).
7. **Selection cleared on version switch.** Canvas multi-select state
   does not survive a version switch via the header dropdown
   (US-3.1).
8. **Toast + Dialog replace `alert` + `window.confirm`.** V1 uses
   browser `alert()` and `window.confirm()` extensively
   (V1 ref §14.3, §17). V2 uses shadcn `Dialog` for confirmations
   and Sonner toasts for non-blocking feedback (UI/UX §1.3, §1.4).

### Open architectural questions — resolve early (data-model-shaping)

These four shape the document body and need to be settled before
Pydantic models are written. They are not blockers for this PRD's
acceptance, but are blockers for the first US-WIN-N implementation.

- **Q-WIN-1: Element span representation.** PRD §6.2 sketch shows
  `row_span: [start, end]` and `column_span: [start, end]` (range
  form). V1 stores `row_number + row_span` (offset + length;
  V1 ref §2.2). V2 picks the **range form** per the sketch — cleaner,
  generalizes naturally to merged cells, and JSON-Patch-friendly
  (a merge is a single value-replacement). **Lean: confirm range
  form. Convention: `[start, end]` is **inclusive** on both ends, so
  a 1×1 cell at row 0 col 0 is `row_span: [0, 0]`,
  `column_span: [0, 0]`.**
- **Q-WIN-2: Per-side frames.** V1 has four frame refs per element
  (`top / right / bottom / left`; V1 ref §2.2). PRD §6.2 sketch
  shows a single inlined `frame: {...}` per element — but the sketch
  is illustrative, not normative. **Lean: keep V1's four-side model
  (`frames: { top, right, bottom, left }`).** Reasons: Phius / WUFI
  need per-side U-values and Ψ-glazing to round-trip correctly;
  asymmetric jamb cases (e.g. structurally reinforced bottom) need
  per-side; V1's ISO 10077-1 calc assumes per-side
  (V1 ref §10.1).
- **Q-WIN-3: Default frame / glazing on element create.** V1 picks
  catalog row named "Default", falls back to first row, raises
  `NoFrameTypesException` / `NoGlazingTypesException` if catalog is
  empty (V1 ref §17). V2 has no AirTable seed.
  Options:
  (a) Seed the catalog with named "PHN-Default" frame and glazing
      rows on first deploy; new elements pick these by default.
  (b) New elements ship with `frames: { top: null, ... }`,
      `glazing: null`. Document validation tolerates nulls in the
      draft, but Save returns warnings ("3 elements have no frame
      assigned") and Save As to a `submitted` / `closed` kind
      requires non-null assignments.
  (c) Inline placeholder values not tied to the catalog — e.g.
      `name: "— pick a frame —"`, `width_mm: 50`, `u_value: 2.0` —
      with no `catalog_origin`.
  **Lean: (b) — null + Save-time validation.** Forces explicit
  picks, keeps `catalog_origin` clean (only present when a real
  catalog pick happened), avoids "everyone forgot to change the
  default" pattern. Confirm.
- **Q-WIN-4: Manufacturer-filter storage.** V1 stores
  `ProjectManufacturerFilter (project_id, manufacturer, filter_type,
  is_enabled)` — relational (V1 ref §9.3). V2 options:
  (a) Lives in the project document as
      `body.tables.manufacturer_filters` (PRD §6.2 sketch already
      includes this name). Filter state versions with the project,
      so locking a Submitted version captures filter at submit
      time.
  (b) Per-user app-level preference (`users.window_builder_manufacturer_filter`).
      Lighter; doesn't travel with the version; doesn't capture
      filter state in cert submits.
  **Lean: (a) — store in the project document.** A Submitted
  version's `manufacturer_filters` should reflect what the
  project actually consumed when submitted. Confirm.

### Other open questions (UX-shaping; can be resolved per-sub-story)

- **Q-WIN-5: Per-window-type deep-link URL.** V1 has no per-aperture
  URL (V1 ref §18). V2 lean: `/projects/{id}/windows` lists,
  `/projects/{id}/windows/{window_type_id}` opens a specific type.
  Confirm.
- **Q-WIN-6: Split behavior.** V1 splits a merged element into 1×1
  cells whose frame / glazing / operation revert to defaults — the
  source assignments are lost (V1 ref §17, §7.9). V2 lean: **preserve
  source assignments on every new cell.** The document model makes
  this cheap (one JSON-Patch instead of N inserts), and the V1
  behavior is a known papercut. Confirm.
- **Q-WIN-7: Frame-label flip semantics on interior view.** V1 flips
  both the SVG (visual right edge reads `frames.left`) AND the
  elements-table label (table row "Right Frame:" reads
  `element.frames.left` when interior view is active;
  V1 ref §7.10, §17). The behavior is technically correct but
  reliably surprises new readers. V2 lean: **keep the flip** —
  changing it would break the "what you see is what you label"
  invariant when looking from interior.
- **Q-WIN-8: HBJSON window-constructions export.** V1 ships
  `GET /aperture/get-window-constructions-as-hbjson/{bt_number}`
  building Honeybee-Energy `WindowConstruction` per element on
  demand (V1 ref §13.1, §17). V2 with PRD §11.4.6 builder ↔ HBJSON
  disconnect: keep, drop, or move?
  **Lean: keep, as a per-version export sibling to "download
  project JSON" in the project header `⋯` menu.** The construction
  JSON is the bridge into the Rhino + honeybee_ph workflow that
  PRD §11.4.6 acknowledges as the design-time exchange surface.
  Confirm.
- **Q-WIN-9: Display-unit format selector scope.** V1 keeps SI
  (`mm | cm | m`) and IP (`in | ft | ft-in`) last-choices separately
  in localStorage (V1 ref §4.7). V2 with per-user
  `users.units_preference` chooses **system** but not **format**;
  inside the Window-Builder, the user still picks `mm` vs `cm`
  vs `m` (in SI mode) or `in` vs `ft` vs `ft-in` (in IP mode).
  Storage: per-user (`users.window_builder_dim_format_si`,
  `users.window_builder_dim_format_ip`) or per-project
  document? **Lean: per-user.** Confirm.

### Sub-story sequence

| Sub-story | Topic | Status |
|---|---|---|
| US-WIN-1 | Window-type list (sidebar) — add / rename / duplicate / delete | Draft |
| US-WIN-2 | Compose the grid — rows × columns, dimensions, edge add | Draft |
| US-WIN-3 | Window-elements — naming, selection, merge, split | Draft |
| US-WIN-4 | Pick frame & glazing — bookshelf flow from the catalog | Draft (key V2 shift) |
| US-WIN-5 | Operation editor — fixed / swing / slide + directions | Draft |
| US-WIN-6 | U-value display — per-element + window-level (ISO 10077-1) | Draft |
| US-WIN-7 | Copy / paste assignments — eyedropper / paint-bucket | Draft |
| US-WIN-8 | Manufacturer filter — project-scoped, gates selectors | Draft |
| US-WIN-9 | Canvas — SVG render, view direction, zoom, label overlay | Draft |
| US-WIN-10 | Dimensions panel — input parsing, expressions, ft-in | Draft |
| US-WIN-11 | Refresh-from-catalog (per-entry) — bookshelf re-sync | Draft (new in V2) |
| US-WIN-12 | HBJSON window-constructions export | Placeholder (gated by Q-WIN-8) |

---

## US-WIN-1 — Window-type list (sidebar)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.window_types[]`), §11.1 (Windows tab),
§8 (draft + Save flow)
**V1 ref:** §5 (Sidebar), §3.3 (UnitBuilder shell), §4.1
(AperturesProvider)

### Story
> As an editor, I want a left-rail list of every window type in this
> project version, with quick-access actions to add, rename,
> duplicate, and delete a type, so I can navigate and reorganize my
> window set without leaving the canvas.

### Acceptance criteria

1. **Layout.** The Windows tab is split:
   - Left sidebar (≈260 px wide; collapsible to a 0-px rail with a
     chevron toggle), default state **closed** for first-time visits
     to a project (mirroring V1 ref §3.3).
   - Right main area = canvas + elements table for the active type
     (US-WIN-2..5).
2. **List source.** Renders `body.tables.window_types[]` from the
   currently-open version's draft body (or saved body if no draft).
3. **Sort order.** `naturalSortCompare` ascending by `name`. So
   `Type A`, `Type B`, ..., `Type 2`, `Type 10`. (V1 ref §5.1.)
4. **Each row shows name only** — no thumbnail, no U-value, no
   element count (matches V1; perf-friendly; can be expanded
   post-MVP). Active type is highlighted.
5. **Click a row → set active.** The clicked type becomes the
   editing target in the main area. Selection state is local to
   the tab (not persisted to URL in v1 unless Q-WIN-5 resolves
   yes; if so, URL becomes `/projects/{id}/windows/{wt_id}`).
6. **Hover-revealed row actions** (logged-in editor on an unlocked
   version only):
   - **Edit name** — opens the rename dialog (criterion 9).
   - **Duplicate** — clones the type (criterion 10).
   - **Delete** — confirms and removes (criterion 11).
   On a **locked** version, action icons are hidden entirely (the
   tab is read-only per US-3.1 cross-cutting). On a public view
   link, icons are also hidden.
7. **Add button.** Sticky at the top of the sidebar:
   `+ Add new window type`. Disabled on locked versions and public
   anonymous viewers. Clicking creates a new window type (criterion 8) and
   sets it as active.
8. **Add new window type.** Creates the following object in the
   draft body:
   ```jsonc
   {
     "id": "win_<ULID>",                    // server-generated
     "name": "<auto-named per criterion 8a>",
     "row_heights_mm": [1000.0],
     "column_widths_mm": [1000.0],
     "elements": [
       {
         "id": "winel_<ULID>",
         "row_span": [0, 0],
         "column_span": [0, 0],
         "name": "Unnamed",
         "frames": { "top": null, "right": null,
                     "bottom": null, "left": null },
         "glazing": null,
         "operation": null
       }
     ]
   }
   ```
   Newly added type becomes the active selection. Default values
   match V1 (V1 ref §2.1, §6.10) except for the null frames/glazing
   per Q-WIN-3 lean.

   **8a. Auto-named to satisfy uniqueness (per criterion 9a).**
   The default name is **"Unnamed Window Type"**. If a window type
   with that name already exists in the active version's
   `tables.window_types`, the suffix ` (2)`, ` (3)`, …, is appended
   to find the first available integer. So a project that already
   has `Unnamed Window Type` and `Unnamed Window Type (2)` gets a
   new add named `Unnamed Window Type (3)`. Suffix-search uses the
   same case-insensitive trimmed comparison as criterion 9a.
9. **Rename dialog.**
   - Modal title: **"Window Type Name"**.
   - Single text field labelled **"Window Type Name"**, autofocus,
     full-select on focus.
   - Submit on **Enter**.
   - **Save** button disabled while:
     - the field is empty / whitespace, OR
     - the trimmed value equals the current name (no-op), OR
     - the trimmed value collides with another window type's name
       per criterion 9a.
   - **Cancel** / **Save** buttons (Cancel is the default action
     on Esc).
   - On Save, applies a JSON-Patch `replace` op to
     `tables.window_types[<idx>].name` in the draft body.

   **9a. Uniqueness rule (Q-WIN-1.1, resolved).** Window-type
   names **must be unique within a project version**. Comparison
   is **trim + case-insensitive**: `"Type A"`, `"type a "`, and
   `"  TYPE A"` are all treated as the same name. Display preserves
   the user's original casing.
   - Uniqueness is per-version-body (each version's
     `tables.window_types[]` is independent — duplicates across
     versions are fine; locked versions are immutable so they
     can't conflict anyway).
   - Names are **not required to be unique across projects**.
   - When the rename input would collide, the dialog shows a red
     helper line under the field: **"A window type named '<value>'
     already exists in this version."** The Save button stays
     disabled.
   - The same rule blocks Add (criterion 8a auto-suffixes to
     avoid it) and Duplicate (criterion 10a auto-suffixes).
10. **Duplicate.**
    - Deep-copies the active type into a new entry. New `id`s are
      generated for the type itself and every element.
    - `catalog_origin` blocks are preserved (the duplicate inherits
      its source's bookshelf state; no re-pick required).
    - The duplicated type becomes active.
    - Surfaced as a Sonner toast: **"Duplicated as '<new name>'"**.

    **10a. Duplicate naming.** Default new name =
    `"<source name> (Copy)"`. If that name already exists in the
    version (per criterion 9a), suffix ` (2)`, ` (3)`, …, until a
    free name is found. So duplicating `Type A` twice in succession
    produces `Type A (Copy)`, then `Type A (Copy) (2)`.
11. **Delete.**
    - shadcn `Dialog` confirm (not `window.confirm`):
      title **"Delete window type?"**, body **"This will remove
      '<name>' and all its elements from this version. Save or
      Save As to persist. Cancel keeps it in your draft."**,
      buttons **Cancel** / **Delete** (delete is the destructive
      variant).
    - On confirm, removes the entry from the draft.
    - If the deleted type was the active selection, the next type
      in sort order becomes active; if the list is empty, the
      main area shows the empty state (criterion 13).
    - **No `window.confirm`. No type-name re-typing** (deletion is
      reversible by Discard-changes or by not-Saving — much lower
      stakes than project deletion in US-1.4).
12. **Empty list state.** When `tables.window_types` is empty, the
    sidebar shows only the **+ Add new window type** button; the
    main area shows: "No window types yet. **[+ Add window
    type]**" centered, with the same primary action as the sidebar
    button.
13. **Locked-version + anonymous-viewer rendering.** All edit affordances
    (add button, hover icons, rename modal trigger) are hidden.
    The list is still navigable read-only. The active row is still
    highlightable.
14. **All mutations go through the draft buffer** (PRD §8.3); no
    direct version-body writes. The save status indicator in the
    project header bar (UI/UX §2.4) reflects the dirty state.

### Resolved questions (2026-05-10)

- **Q-WIN-1.1: Name uniqueness within a project version?**
  **Resolved:** **enforced** within a project version (per criterion
  9a). Trim + case-insensitive. Not required across projects. Add
  and Duplicate auto-suffix to avoid collision; Rename rejects.
- **Q-WIN-1.2: Delete confirmation.**
  **Resolved:** simple shadcn `Dialog` with Cancel / Delete (no
  type-name re-typing). Per criterion 11.
- **Q-WIN-1.3: Reorder.**
  **Resolved:** alphabetical (`naturalSortCompare`) only for MVP.
  Drag-reorder deferred to v1.1+ if requested.

### Open questions
None — all US-WIN-1 questions resolved 2026-05-10.

---

## US-WIN-2 — Compose the grid

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.window_types[].row_heights_mm` /
`column_widths_mm`), §11.5 (units architecture)
**V1 ref:** §6 (Dimensions panel), §7.1 (canvas grid layout),
§7.6 (EdgeAddButtons)

### Story
> As an editor, after creating a window type, I want to define the
> internal grid — number and sizes of rows and columns — by typing
> dimensions in any familiar unit (mm, in, `2'-6"`, `100+50`) and by
> adding rows / columns at any edge, so the grid matches the
> design.

### Acceptance criteria

1. **Initial state.** A newly created window type has one row
   (1000 mm) × one column (1000 mm). User edits from there.
2. **Display formats.**
   - Per-user **system** preference (SI / IP) drives the default
     unit per PRD §11.5.
   - Inside the Windows tab, a small unit-format selector (in the
     dimensions strip's gutter) lets the user pick:
     - SI mode: `mm | cm | m` (default `mm`).
     - IP mode: `in | ft | ft-in` (default `in`).
   - Format choice persists per-user across projects per Q-WIN-9.
3. **Add row / column** — two paths (no keyboard shortcuts in MVP
   per Q-WIN-2.1):
   - **Edge-add hover buttons** on the canvas: a 40-px hot-zone
     above / below / left / right of the grid reveals a small
     blue **+** button when hovered. Tooltips: `Add row at top`,
     `Add row at bottom`, `Add column at left`, `Add column at
     right` (V1 ref §7.6).
   - **Header buttons** in the canvas toolbar: `+ Row`, `+ Column`
     (each adds at the END of the data array — same as V1 default).
4. **Default new row / column dimensions** = 1000 mm.
5. **Adding at the START** shifts every existing element's
   `row_span` / `column_span` by +1 (the document update is a
   single JSON-Patch `replace` of the entire window type, simpler
   than V1's bulk-update SQL; V1 ref §6.10).
6. **Adding a row / column auto-creates one element per
   opposing-axis cell**, each:
   - `row_span` / `column_span` set to the new cell's coordinates,
   - `frames` all `null`, `glazing: null`, `operation: null`,
   - `name: "Unnamed"`.
   Per Q-WIN-3 lean (b) — null frames force pick. (V1 ref §6.10
   creates with default catalog refs; V2 differs.)
7. **Delete row / column.**
   - Hover reveals a small `–` button on each dimension label.
   - Confirm dialog **only when** the row / column contains
     element assignments that would be lost (any frame / glazing
     non-null) — quiet delete otherwise.
   - **Last row / column cannot be deleted.** Button is disabled
     with a tooltip: **"A window type must have at least one row
     and one column."** (V1 ref §6.11 returns 403; V2 makes it a
     UI-level lock.)
   - Deleting shifts subsequent indices down; element spans clamp.
8. **Edit a dimension** — click a label:
   - Label swaps for an inline `Input` (autofocus, full-select).
   - `endAdornment` shows the current display unit (`mm`, `in`,
     `ft`) — except in `ft-in` mode where the value contains markers.
   - Tooltip on the input matches V1's per-unit cheat sheet
     (V1 ref §6.3): e.g. for `in`/`ft-in`:
     **"Tip: Use 2' 6\", 6-1/2\", or expressions like 24 + 12"**.
   - Tooltip enter delay: 1500 ms (matches V1 — non-intrusive).
9. **Submit edit on Enter or click-away.** Edit is committed only
   if (a) the new value is different from the original
   pre-edit display string AND (b) `parseToMM(input)` is a
   positive non-NaN number (matches V1 ref §6.3 invariant).
   Otherwise the input reverts and no patch is sent.
10. **Parser** behavior matches V1 (US-WIN-10 fully specs):
    - SI mode: arithmetic with `+ - * /` (no parens; no negative
      second operand). Feet-inch markers in SI mode → invalid.
    - IP mode: feet-inches forms (`2'`, `6"`, `2' 6"`, `6-1/2"`,
      `2' 6-1/2"`); arithmetic when no markers; smart-quote
      normalization.
    - Empty / NaN / ≤0 → revert.
11. **Visual elements** match V1 (V1 ref §6.2):
    - Horizontal dimension strip below the canvas.
    - Vertical dimension strip to the left.
    - Per-segment label at midpoint, delete button on hover.
    - Center-guide line with grid-tick dots.
    - Grid-line ticks (30 px length).
12. **Total dimensions caption** above the canvas: `"<width> ×
    <height>"` in the active display unit (e.g.
    `"1234.5 mm × 1000.0 mm"` or `"3' 4-3/8" × 3' 3-3/8""`).
    V1 ref §7.11.
13. **All mutations flow through the draft buffer** as JSON-Patch
    ops; debounced ~500 ms (PRD §8.3). No autosave to the version
    body.

### Resolved questions (2026-05-10)

- **Q-WIN-2.1: Keyboard shortcuts for add-row/col?**
  **Resolved:** **no — not in MVP.** Edge-hover **+** buttons and
  the canvas-toolbar `+ Row` / `+ Column` buttons are the only
  add paths. Defer keyboard shortcuts to v1.1+ if requested.
- **Q-WIN-2.2: Drag-to-resize dimension labels?**
  **Resolved:** **no — not in MVP.** Dimension editing is
  text-input only (matches V1 ref §18). Defer to v1.1+ if
  requested.
- **Q-WIN-2.3: Equal-divide tool ("split column into N equal")?**
  **Resolved:** **no — not in MVP.** Defer to v1.1+ if requested.

### Open questions
None — all US-WIN-2 questions resolved 2026-05-10.

---

## US-WIN-3 — Window-elements (naming, selection, merge, split)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`elements[]` shape)
**V1 ref:** §4.1 (multi-select), §7.5 (element click), §7.9
(merge/split), §8.2 (elements table)

### Story
> As an editor, I want to select one or more cells, name them,
> merge contiguous cells into a single element (a transom, a
> spandrel, a multi-cell pane), and split a merged element back
> into its constituent cells, so I can express the design's
> mullion pattern.

### Acceptance criteria

1. **Element identity.** Every element has a stable `id`
   (`winel_<ULID>`), a `row_span: [r0, r1]` and
   `column_span: [c0, c1]` (inclusive ranges per Q-WIN-1), an
   optional `name`, four `frames`, one `glazing`, an optional
   `operation`. Default `name` on create is `"Unnamed"`.
2. **Click an element on the canvas → single-select.**
   Clicking the same element again deselects.
3. **Shift-click extends selection** — V2 keeps V1's
   adjacency-only rule (V1 ref §4.1, §17): the shift-clicked element
   must be adjacent to at least one already-selected element.
   Non-adjacent shift-clicks are silently ignored.
   **Confirm: V2 keeps this rule, or relax to "any element
   shift-clicked extends selection, but merge enforces
   contiguous-rectangle at commit time"?** Lean: **relax** — the
   silent-ignore is confusing; let merge fail with a clear toast
   instead.
4. **Cmd/Ctrl-click** toggles a single element in/out of the
   selection without the adjacency rule (NEW; V1 has no equivalent).
5. **Element name editing** — click the element's label overlay
   (small white pill at center; V1 ref §7.8):
   - Pill swaps for inline `Input` (autofocus, full-select).
   - **Enter** or **click-away** → commit; **Escape** → cancel.
   - Empty / whitespace-only name → revert to previous (no empty
     names). V1 default `"Unnamed"` is allowed.
6. **Merge** — toolbar `Merge` button (V1 ref §7.2):
   - Enabled when ≥2 elements selected.
   - Tooltip shows count: **"Merge selected (3 elements)"**.
   - On click: validates the selection forms a complete rectangle
     with no gaps. If valid, replaces those N elements with one
     element whose `row_span` covers the union and `column_span`
     covers the union. The merged element inherits the assignments
     of the **top-left** source element (frames, glazing,
     operation, name); a Sonner toast notes this:
     **"Merged 4 elements; kept assignments from top-left
     ('Sash 1A')."** Confirm.
   - If invalid (gaps or non-rectangular), error toast:
     **"Selection isn't a rectangle. Pick contiguous cells to
     merge."** (V1 ref §17 — server-side ValueError raised; V2
     can validate client-side too.)
7. **Split** — toolbar `Split` button:
   - Enabled when exactly 1 element selected AND that element has
     `row_span[1] > row_span[0]` OR `column_span[1] > column_span[0]`.
   - On click: replaces the merged element with N 1×1 elements
     covering the same area. Per Q-WIN-6 lean, **each new cell
     inherits the source's frames / glazing / operation** (V1 ref §17
     papercut fixed in V2). Each new cell gets a fresh `id` and
     name `"Unnamed"`.
8. **Clear selection** — toolbar button + `Esc` keypress.
9. **No holes invariant — no direct Delete-element gesture.**
   Per Q-WIN-3.3 (resolved): every cell of the grid is always
   covered by exactly one element. There is no "empty cell" /
   dashed-hole render state.
   - **Delete / Backspace key with a selection** is **not a
     direct gesture** in v1. Pressing it with elements selected
     shows a one-time tooltip: **"To remove an element, merge it
     into a neighbor (Toolbar → Merge) or delete its row / column
     (hover the dimension label, click −)."**
   - **Removing an element** is therefore one of:
     - **Merge it into an adjacent element** (criterion 6) —
       the merged target keeps its own assignments per
       criterion 6's top-left rule.
     - **Delete the row or column** that contains it
       (US-WIN-2 criterion 7).
   - **Deleting a window type** (US-WIN-1 criterion 11) removes
     all its elements at once and is unaffected by this rule.
   - **Direct Delete-element-with-auto-merge** is a v1.1+
     candidate if the merge-or-delete-row workflow proves
     cumbersome.
10. **Multi-select copy/paste** — V1 supports single-source →
    single-target paste only (V1 ref §18). V2 NEW (only if Ed
    wants): **multi-select paste** — picked source pasted onto
    every selected target. Defer to US-WIN-7. Confirm.
11. **Adjacency check.** "Adjacent" = the two elements share an
    edge fully or partially (their bounding rectangles touch
    along a row or column boundary, accounting for spans). Same
    rule as V1 ref §4.1 lines 22–35; ported as a TS utility.

### Resolved questions (2026-05-10)

- **Q-WIN-3.1: Shift-click rule.**
  **Resolved:** **relax** the V1 adjacency-only rule. Any
  shift-click extends the selection; **merge** validates the
  contiguous-rectangle invariant at commit time and shows a
  clear toast on failure (per criterion 3 + 6). The silent-ignore
  V1 behavior is dropped.
- **Q-WIN-3.2: Merged inheritance source.**
  **Resolved:** **top-left** source element's assignments are
  inherited (frames, glazing, operation, name) — per criterion 6.
  Toast confirms which source provided the assignments. No
  user prompt, no alternative source.
- **Q-WIN-3.3: Holes in the grid.**
  **Resolved:** **no holes allowed.** Every cell of the grid
  must always be covered by exactly one element. Deletion of an
  element is only valid if the freed cells can be re-merged with
  an adjacent element (or if the element is the last one and the
  whole window-type would be deleted, which is blocked by the
  "at least one element" invariant). Practically, criterion 9 is
  revised: Delete-key on selection only succeeds if the freed
  cells form a rectangle adjacent to exactly one neighbor — that
  neighbor absorbs the cells. Otherwise the user must merge or
  re-shape first. (See revised criterion 9 below.)

### Open questions
None — all US-WIN-3 questions resolved 2026-05-10.

---

## US-WIN-4 — Pick frame & glazing (bookshelf flow)

**Status:** Draft · **Priority:** MVP — **the key V2 shift**
**PRD ref:** §7.1 (bookshelf semantics), §7.4 (refresh from
catalog), §6.2 (`catalog_origin` block)
**V1 ref:** §8.5 (FrameTypeSelector), §8.6 (GlazingTypeSelector),
§9 (manufacturer filter), §17 (V1's hard-coded SI in option
preview — V2 fixes)

### Story
> As an editor, when assigning a frame type to one of an element's
> four sides, or a glazing type to its center, I want to browse the
> shared catalog filtered by my project's manufacturer set, see
> live performance data (U-value, width, Ψ-glazing, g-value),
> pick one, and have its values copied into my project's document
> so my project no longer depends on the catalog continuing to
> exist or look the same.

### Acceptance criteria

1. **Where the picker lives.** In the per-element table card
   (US-WIN-3 / V1 ref §8.2), each side-frame row and the glazing
   row has a combobox-style selector (shadcn `Combobox` / `Command`
   primitive, replacing V1's MUI `Autocomplete`).
2. **Picker open behavior.**
   - Trigger: click the chip showing the current frame / glazing
     name. If unset (per Q-WIN-3 lean), trigger reads
     **"Pick a frame…"** / **"Pick a glazing…"**.
   - Opens a popover with:
     - Search input (autofocus). Search matches `name`, `manufacturer`,
       `brand` (case-insensitive substring; V1 was alpha-ordered list
       only).
     - Filtered catalog list, sorted `naturalSortCompare` by `name`.
     - Manufacturer filter active by default — frames whose
       `manufacturer` is `null` always pass; otherwise `manufacturer`
       must be in the project's enabled set (US-WIN-8).
   - Each row shows:
     - Bold `name`.
     - Secondary line: `Width: 100 mm · U-value: 0.85 W/(m²K) ·
       Ψ-g: 0.040 W/(m·K)` for frames; `U-value: 0.7 W/(m²K) ·
       g-value: 0.50` for glazing. **Values rendered in the user's
       active unit system** — V1 hard-coded SI (V1 ref §17); V2 fixes.
3. **On pick — bookshelf copy.** The catalog row's values are
   **copied into the document**. The element side's `frame` /
   `glazing` field becomes:
   ```jsonc
   {
     "name": "Skyline Ridge SR-3",
     "width_mm": 100.0,
     "u_value_w_m2k": 0.85,
     "psi_g_w_mk": 0.040,
     "manufacturer": "Skyline",
     "brand": "Ridge",
     "use": "...", "operation": "...", "location": "...",
     "mull_type": "...", "source": "...",
     "datasheet_url": "...", "link": "...", "comments": "...",
     "catalog_origin": {
       "catalog_table": "frame_types",
       "catalog_record_id": "rec123abc",
       "catalog_version_id": "rec123abc_v3",
       "synced_at": "2026-05-10T14:23:00Z"
     }
   }
   ```
   (Exact field set is the FrameType / GlazingType Pydantic model —
   matches V1 ref §2.5, §2.6 with `id` removed and `catalog_origin`
   added.)
4. **After the first pick, the project owns its copy.** Editing
   the catalog row (in the catalog manager) does NOT change the
   element's frame. To re-sync, the user runs Refresh-from-catalog
   (US-WIN-11).
5. **Inline override.** The element table also exposes inline
   editable cells for the bookshelf-copied values:
   - Frame: editable `name`, `width_mm`, `u_value_w_m2k`,
     `psi_g_w_mk` directly in the row (the rest read-only;
     reachable via a "More fields…" expander).
   - Glazing: editable `name`, `u_value_w_m2k`, `g_value`.
   Editing any of these fields:
   - Updates the document inline.
   - **Sets a `catalog_origin.diverged: true` flag** so
     refresh-from-catalog knows to flag this entry. (Catalog row
     itself is not affected.)
6. **"Sourced from catalog" badge.** Each frame / glazing chip
   shows a small `📚` (or shadcn `Library` icon — no emoji per
   project conventions) badge if `catalog_origin` is non-null.
   Hover tooltip: **"From catalog: 'Skyline Ridge SR-3' · Synced
   2026-05-10. Catalog has changed since pick — refresh to update."**
   (only shows the "changed" suffix when the catalog has a newer
   `current_version_id` than the synced one).
7. **Hand-entered values.** A "+ Hand-enter" entry at the bottom
   of the picker creates an entry with no `catalog_origin`. User
   types in `name`, `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`
   inline. The element gets a small `✎` (handwritten) badge —
   tooltip: **"Hand-entered. Not linked to the catalog."**
8. **Empty catalog.** If the catalog is empty (e.g. fresh DB), the
   picker shows: **"No frames in the catalog yet. [Open catalog
   manager]"** linking to the catalog page in a new tab.
9. **Set all four sides — deferred to v1.1+ (Q-WIN-4.3).**
   Not in MVP. Each of the four sides is picked individually.
   The convenience shortcut "Apply this frame to all four sides"
   may be added post-MVP if it surfaces as a real papercut.
10. **All edits flow through the draft buffer.** Pickers debounce
    patches per PRD §8.3. The save status indicator updates.
11. **U-value live-recompute.** After every pick / inline edit,
    the per-element and window-level U-value labels (US-WIN-6)
    recompute (300 ms debounce; immediate on window-type switch,
    matching V1 ref §10.2).
12. **Read-only on locked versions / for anonymous viewers.** Pickers are
    disabled; chips render as static labels with the badge.

### Resolved questions (2026-05-10)

- **Q-WIN-4.1: Inline override field set (criterion 5).**
  **Resolved:** the **full FrameType / GlazingType field set is
  editable inline** in the elements table. Power fields
  (`source`, `link`, `datasheet_url`, `comments`) and any other
  rarely-used metadata hide behind a `More fields…` expander on
  the row to keep the default density tight. Editing any field
  sets `catalog_origin.diverged: true` per criterion 5.
- **Q-WIN-4.2: Diverged-from-catalog visualization (criterion 6).**
  **Resolved:** **inline diff modal on click of the badge**,
  showing three columns: **Catalog (current) · Yours · Choose new
  value**. The "Choose new value" column lets the user pick
  per-row (Take catalog · Keep mine · Edit a third value). Full
  spec lives under **US-WIN-11** (refresh-from-catalog) — same
  modal, reachable from the per-element badge or from the
  project-wide drift summary.

### Resolved questions (continued — 2026-05-10)

- **Q-WIN-4.3: Apply to all four sides shortcut?**
  **Resolved:** **deferred to v1.1+; not in MVP.** Each side
  picked individually. (Criterion 9 updated.)
- **Q-WIN-4.4: Promote hand-entered frame into catalog?**
  **Resolved:** **deferred to v1.1+; not in MVP.** Hand-entered
  values stay in the project document with no `catalog_origin`;
  no UI to push them back into the shared catalog in v1.

### Open questions
None — all US-WIN-4 questions resolved 2026-05-10.

---

## US-WIN-5 — Operation editor

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`elements[].operation`)
**V1 ref:** §8.7 (OperationEditor), §7.4 (OperationSymbols)

### Story
> As an editor, I want to mark each element with its operation
> pattern (fixed, swing, slide, tilt-turn) and direction(s), so
> the canvas shows the standard architectural symbols and the
> exported HBJSON / certification documents reflect operability.

### Acceptance criteria

1. **Data shape.** `operation: { type: "swing" | "slide",
   directions: ("left"|"right"|"up"|"down")[] } | null`.
   `null` = fixed. (Matches V1 ref §2.2.)
2. **Editor UI** in the elements table (Operation row, V1 ref §8.4):
   - shadcn `Select` with options **Fixed**, **Swing**, **Slide**.
   - Picking **Fixed** sets `operation = null`.
   - Picking **Swing** or **Slide** sets `operation = { type, directions: [] }`.
   - When type is non-fixed, four `Toggle` buttons appear:
     **Left**, **Right**, **Up**, **Down**. Multiple selections
     allowed (V1 ref §8.7 allows tilt-turn = swing + [left, up]).
3. **Display label.**
   - `null` → **"Fixed"**.
   - `{ swing, [] }` → **"Swing"**.
   - `{ swing, [left, up] }` → **"Swing (Left, Up)"** — directions
     joined comma-space.
4. **Canvas symbols** match V1 (V1 ref §7.4):
   - Swing: dashed lines from the named-side hinge midpoint to the
     opposite two glazing-rect corners (`strokeDasharray="4,3"`).
   - Slide: a single arrow at vertical center, length = 80% of
     `min(w, h)`, head size = 10%.
   - Multi-direction: overlapping symbols.
   - Color: grey (`#666`), stroke-width 1.
5. **Inside-view flip.** Left ↔ Right swap when interior view is
   active (V1 ref §7.4); Up / Down unchanged. Mirror-image, as a
   real interior viewer would see.
6. **Pre-built operation presets** (NEW v.s. V1; V1 ref §18 lists
   absence). A small `Common patterns` menu at the top of the
   editor lists:
   - **Tilt-turn** (= swing + [left, up])
   - **Awning** (= swing + [up])
   - **Hopper** (= swing + [down])
   - **Casement, hinge left** (= swing + [left])
   - **Casement, hinge right** (= swing + [right])
   - **Slider, opens left** (= slide + [left])
   - **Slider, opens right** (= slide + [right])
   Picking applies the preset's directions; user can still
   customize after. **Confirm: MVP or v1.1?**
7. **Read-only on locked versions / for anonymous viewers.**

### Resolved questions (2026-05-10)

- **Q-WIN-5.1: Operation presets in MVP?**
  **Resolved:** **yes — in MVP.** The `Common patterns` menu
  (Tilt-turn, Awning, Hopper, Casement (hinge L/R), Slider (L/R))
  ships in v1 per criterion 6. Short list, recurring papercut
  removal.
- **Q-WIN-5.2: Operation feeds U-value?**
  **Resolved:** **no — operation does not affect U-value.** The
  thermal effect of operability (gasket / weatherseal / extra
  meeting-rail at sashes) is **already baked into the chosen
  frame product's `u_value_w_m2k`** — picking a casement frame
  vs. a fixed frame is what changes the U. So:
  - The backend U-value calc ignores `operation` entirely (it
    already does — V1's calc never read it; V1 ref §10.1).
  - The frontend U-value-fetch dependency key **excludes
    `operation`** (V1 ref §17 papercut fixed). Toggling a swing
    direction does NOT trigger a U-value refetch.

### Open questions
None — all US-WIN-5 questions resolved 2026-05-10.

---

## US-WIN-6 — U-value display

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.window_types`), §10.4 (glossary)
**V1 ref:** §10 (full ISO 10077-1 calc + display components)
**Convention reference:** `context/glossary.md` — Thermal
performance section. **U-Value (no films) only**, never
"U-Factor." Same policy as envelope (US-ENV-10) and the
Model-tab info panel (US-VIEW-6).

### Story

> As an editor composing a window type, I want a single live
> U-Value number in the Windows tab — both at the window-type
> level and per-element — so I know at a glance whether the
> assembly hits my design target, using the same convention
> the rest of PHN uses.

### Acceptance criteria

1. **Window-type-level chip.** Inside the Windows tab content
   header (NOT the project header bar — per Q-WIN-6.1
   resolved: window U-Value is window-scoped, not
   project-scoped). Renders alongside the window-type
   selector / name.

2. **Per-element chip.** Each elements-table card shows its
   own U-Value chip (per-element data, since per-side frame
   selection per Q-WIN-2 means each element has a distinct
   composite U-Value).

3. **Label text — per active unit system, no films
   convention** (matches `context/glossary.md` + US-ENV-10):
   - IP: `Window U-Value: 0.21` (2 decimals, BTU/(hr·ft²·°F))
   - SI: `Window U-Value: 1.20 W/m²K` (2 decimals)
   - Per-element renders same format with smaller font.
   - **NEVER labeled "U-Factor"** — the films-excluded
     convention applies here exactly as it does on the
     envelope side. Window U-Value is the **composite**
     conductance through frame + glazing + spacer at the
     window level, excluding surface films.

4. **Info icon** opens the tooltip:

   > **Window U-Value**
   >
   > Composite per-window-type U-Value computed per ISO
   > 10077-1, combining frame, glazing, and spacer
   > performance with area-weighted aggregation across all
   > sides of each element.
   >
   > Note: Surface film resistances (air films) are NOT
   > included in the value shown here — same convention as
   > the envelope's R-Value display (US-ENV-10).
   >
   > Operation (Tilt-Turn, Casement, etc.) does NOT affect
   > this U-Value — the operability's thermal effect is
   > already captured in the picked frame product's
   > `u_value_w_m2k`.
   >
   > *Reference: ISO 10077-1*

5. **Backend calculation** — port V1's
   `backend/features/aperture/services/window_u_value.py`
   (renaming the V1 `aperture` concept → V2 `window_type`).
   Algorithm unchanged: per ISO 10077-1, area-weighted
   composite over frame / glazing / spacer.

6. **Caching.** Backend keys the cached result by a
   **content-hash** of the window-type subtree
   (`row_heights_mm`, `column_widths_mm`, `elements[*]`
   with each element's `frame.{top,right,bottom,left}` +
   `glazing` — only the U-Value-affecting fields). Frontend
   refetches on hash change. V1 ref §10.1 pattern preserved.

7. **Refetch trigger — explicitly EXCLUDES `operation`**
   (per Q-WIN-5.2 resolution). V1 ref §17 flagged this as
   a papercut where the frontend dep key included
   `operation`, triggering unnecessary refetches when
   only the operation enum changed. V2 fixes: the
   content-hash on the backend and the dependency key on
   the frontend both omit `operation`.

8. **Refetch trigger fires on:**
   - Add / remove / merge / split element
     (`tables.window_types[<wt>].elements[]` shape change)
   - Element's frame or glazing reference change
   - Inline override of frame / glazing values (any
     U-Value-affecting field — `u_value_w_m2k`,
     `psi_install_w_mk`, etc.)
   - Row height / column width change (affects element
     areas, which affect the area-weighted composite)
   - Debounced ~500 ms after the last edit (matches
     US-ENV-10's behavior).

9. **`min-width: 200 px`** on each U-Value chip to prevent
   layout shift when the value changes from `--` to a
   number.

10. **Loading state.** While the request is in flight,
    the chip renders `…` with low-opacity tween.

11. **Invalid-state handling.** When any element is
    missing a frame or glazing (per Q-WIN-3 — `null` is
    allowed in draft), the window-type chip renders
    with the same **"unfinished"** qualifier as
    US-ENV-10 criterion 8:
    - Compact form: `Window U-Value: 1.20 W/m²K
      (unfinished)` — italic, muted.
    - Tooltip extends with: *"2 elements are missing a
      frame or glazing assignment. The value above is
      computed from the picked elements only."*
    - The number still renders; we don't suppress it.

12. **Locked-version + anonymous-viewer rendering.** Chip and
    tooltip work identically — value is data, not edit
    state.

### Resolved questions (2026-05-10)

- **Q-WIN-6.1: Where to render the window-type-level
  chip — project header vs Windows tab content header?**
  Resolved: **Windows tab content header.** Window
  U-Value is window-scoped, not project-scoped.

### Open questions
None outstanding.

### Cross-references

- **`context/glossary.md`** — Thermal performance section;
  drives the U-Value-only label + tooltip text.
- **Q-ENV-4 resolution** — sibling envelope decision; same
  policy applies here.
- **Q-WIN-5.2 resolution** — operation does not feed
  U-Value; ensures cache key correctness (criterion 7).
- **US-ENV-10** — envelope-side parallel; identical
  pattern for canvas-header thermal display.
- **US-VIEW-6** — Model-tab info panel; surfaces the same
  Honeybee-source U-Value on each aperture.

---

## US-WIN-7 — Copy / paste assignments

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.window_types`), §8.3 (JSON-Patch via
draft buffer)
**V1 ref:** §4.10 (CopyPaste context), §7.2 (toolbar buttons)
**Mirrors:** US-ENV-9 (envelope-side copy/paste) — same
eyedropper / paint-bucket pattern, same deferral decisions on
cross-tier paste + multi-select + keyboard shortcuts (V2-wide
consistency per Ed 2026-05-10)

### Story

> As an editor composing a complex window type, I want to copy
> the operation + glazing + per-side frame assignments from
> one window-element onto others with an eyedropper / paint-
> bucket gesture — without re-walking the bookshelf picker for
> each target — so building out grids of similar elements stays
> fast.

### Acceptance criteria

1. **Toolbar buttons** in the Windows tab header:
   - **Eyedropper** — enters "pick" mode.
   - **Paint-bucket** — enters "paste" mode (enabled only
     after a pick).
   - **Undo-last-paste** — explicit mouse-driven undo
     (parallel to US-ENV-9 criterion 1; ⌘Z also works).

2. **State machine** (V1 ref §4.10 parity, mirrors US-ENV-9
   criterion 2):
   - `idle` → click eyedropper → `picking`
   - `picking` → click source element → `picked` (source
     element shows subtle ring outline)
   - `picked` → click paint-bucket → `pasting`
   - `pasting` → click target element → paste applied +
     600 ms pulse animation → stays in `pasting` (so user
     can rapid-fire multiple targets without re-clicking
     the toolbar)
   - **ESC** at any non-idle state → return to `idle`
   - **Click outside any element** during pick / paste →
     return to `idle`

3. **Copy payload — 6 fields** (V1 parity per V1 ref §4.10):
   ```typescript
   {
     operation: string,
     glazing: { /* full glazing object including catalog_origin */ },
     frames: {
       top:    { /* full frame object including catalog_origin */ },
       right:  { /* ... */ },
       bottom: { /* ... */ },
       left:   { /* ... */ }
     }
   }
   ```
   - **`catalog_origin` blocks travel with the copy** —
     the target's drift-tracking starts fresh from the
     source's pinned `catalog_version_id`.
   - **NOT copied** (target keeps its own values): `id`,
     `row_span`, `column_span`, `display_name`, any
     per-element override metadata not part of the
     assignment.

4. **Single JSON-Patch per paste-target** (V2 cleanup
   matching US-ENV-9 criterion 4). V1 emitted multiple
   PATCH requests per paste-target; V2 paste = **one
   JSON-Patch** with multiple `replace` ops covering the
   6 payload fields, atomic at the draft-buffer level.

5. **No cross-window-type paste in V2 v1** (mirrors
   US-ENV-9's no-cross-assembly-paste decision per Ed
   2026-05-10). Switching the active window type clears
   all pick / paste state. **Rationale:** V2-wide
   consistency with US-ENV-9; the cross-tier mental
   model (does state survive a tier switch?) shouldn't
   differ between Windows and Envelope. The data model
   supports it trivially (just copy values +
   `catalog_origin` blocks), so v1.1+ can lift this
   without schema work.

6. **No multi-select paste in V2 v1** (mirrors US-ENV-9
   criterion 6). One click = one target. v1.1+ candidate.

7. **No keyboard shortcuts (⌘C / ⌘V) on the windows
   canvas** (mirrors US-ENV-9 criterion 7). Toolbar +
   ESC + ⌘Z are the full interaction surface.

8. **Bounded undo stack — 20 entries per active
   window type** (matches V1 + US-ENV-9 criterion 8).
   - ⌘Z undoes the last paste; subsequent presses pop
     the stack.
   - Undo-last-paste toolbar button is the mouse-driven
     equivalent.
   - In-memory only, per-window-type, cleared on type /
     version / document switch. Not persisted.

9. **Refetch window U-Value after every paste** —
   paste mutates `glazing` and the four `frames` (all
   U-Value-affecting). `operation` is excluded from the
   cache key per Q-WIN-5.2 / US-WIN-6 criterion 7, so
   the post-paste refetch fires only when there's a
   real frame / glazing change.

10. **Visual feedback during pick / paste mode:**
    - Source element ring outline (CSS var
      `--copy-source-ring`) — same as US-ENV-9
      criterion 10.
    - Target element 600 ms pulse animation on paste.
    - Element-select / merge / split affordances hidden
      during pick / paste mode (parallel to US-WIN-9 +
      US-ENV-4 criterion 5 patterns).

11. **Locked-version + anonymous-viewer rendering.** All
    toolbar buttons hidden; click on an element opens
    the read-only element panel as normal.

12. **All paste state is ephemeral frontend state** —
    lives in the windows-builder Zustand store
    (parallel to envelope-builder's `pickPasteState`),
    keyed per `window_type_id`. Not part of the project
    document.

### Resolved questions (2026-05-10)

- **Cross-window-type paste?** Resolved: **no — V2 v1
  mirrors US-ENV-9's "no cross-tier paste"** decision
  for consistency. V1 allowed it; V2 v1 doesn't. v1.1+
  can lift trivially.
- **Multi-select paste?** Resolved: **defer to v1.1+.**
- **Keyboard shortcuts on canvas?** Resolved: **defer to
  v1.1+.** Toolbar + ESC + ⌘Z only.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-9** — sibling story; identical state machine
  shape, payload-cleanup pattern, and three deferral
  decisions. Both stories should likely be implemented
  behind a shared `<PickPasteToolbar>` primitive if the
  abstraction is clean (call the implementer makes
  during build).
- **US-WIN-6 criterion 7** — refetch trigger fires
  after every paste; cache key excludes `operation`.
- **Q-WIN-5.2 resolution** — operation does not feed
  U-Value; captured in US-WIN-6.

---

## US-WIN-8 — Manufacturer filter

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.manufacturer_filters` —
project-document section), §7 (catalog model)
**V1 ref:** §9 (manufacturer filter modal + storage)

### Story

> As an editor working on a project with specific manufacturer
> commitments (e.g. all Schüco frames; only Saint-Gobain
> glazings), I want a per-project manufacturer filter that
> narrows down the catalog picker to only the manufacturers
> relevant to this project — so I don't have to scroll past 80
> products from manufacturers I'll never use.

### Acceptance criteria

1. **Storage** (per Q-WIN-4 resolved): `body.tables.manufacturer_filters`
   — a project-document section, versioned with the project
   like everything else under `body`. Shape:
   ```jsonc
   {
     "manufacturer_filters": {
       "frame_manufacturers_enabled": [
         "Schüco", "Zola", "Alpen", ...        // string identifiers; subset of the catalog roster
       ],
       "glazing_manufacturers_enabled": [
         "Saint-Gobain", "Cardinal", ...
       ]
     }
   }
   ```
   - **Inclusive list** (which manufacturers ARE enabled),
     not exclusive — `[]` means "no manufacturers visible
     in the picker," which is the explicit (and rare)
     state where the user has un-checked everything.
     `null` / absence is treated as "default state."
   - **Default state on a new project**: `null` (or both
     arrays equal to the full catalog roster at project
     create time) — meaning "all manufacturers enabled."
     V1 ref §9.3 parity.

2. **Modal trigger** — project header `⋯` overflow menu:
   **"Configure manufacturer filters"**. Opens a shadcn
   `Dialog` containing the filter modal.

3. **Modal contents** (V1 ref §9 layout):
   - Header: title + count summary ("12 of 18 frame
     manufacturers enabled · 6 of 9 glazing manufacturers
     enabled").
   - Two **checkbox lists** side by side (Frame
     Manufacturers · Glazing Manufacturers).
   - Each row: checkbox + manufacturer name + count badge
     showing how many catalog products are gated by this
     manufacturer ("Schüco · 23 products").
   - **"In-use" manufacturers** are **always-on**,
     checkbox disabled, with tooltip *"In use on N window
     elements — can't be disabled while referenced."*
     (V1 ref §9.2). Computed live from
     `tables.window_types[*].elements[*].frame.*` +
     `glazing` `manufacturer` field references.
   - Top of each list: **Select all** / **Clear all**
     bulk-action links (V2 NEW vs V1; small ergonomic win).
   - Footer: **Cancel** / **Save** buttons. Save is
     disabled if no changes have been made.

4. **Mutation flow:** Save commits a single JSON-Patch
   `replace` on `body.tables.manufacturer_filters` to the
   draft buffer (PRD §8.3). Closes the modal on success.

5. **Picker integration** — both US-WIN-4 (Pick frame &
   glazing) and US-WIN-11 (Refresh-from-catalog) filter
   their candidate lists through these filters:
   - Frame picker shows products from manufacturers in
     `frame_manufacturers_enabled` (or all when `null`).
   - Glazing picker shows products from manufacturers in
     `glazing_manufacturers_enabled` (or all when `null`).
   - Refresh-from-catalog drift diff still surfaces
     drift on filtered-out manufacturers, but the picker
     in the diff modal narrows by the same filter.

6. **"Filter narrowed your picker" UX hint** — when the
   active project has a non-default manufacturer filter
   AND the picker shows fewer than the full catalog roster,
   a small line at the bottom of the picker reads:
   *"Showing 12 of 18 manufacturers · [Adjust filter]"*
   with the link opening this modal. Avoids the V1
   confusion ("where did Manufacturer X go?").

7. **In-use enforcement on Save:** if a user attempts to
   uncheck an in-use manufacturer (e.g. via "Clear all"
   while in-use entries exist), the in-use entries
   remain checked (the toggle is suppressed) and a
   toast surfaces: *"3 manufacturers stayed enabled
   because they're in use."* No hard error.

8. **Catalog roster source.** The list of available
   manufacturers in each checkbox column is built from
   the distinct `manufacturer` values across the
   corresponding catalog table (Frame catalog for the
   frame list; Glazing catalog for the glazing list).
   Refreshes when the catalog changes (live source — not
   a snapshot in the project document).

9. **Locked-version + anonymous-viewer rendering:**
   - **Locked version:** modal opens read-only; Save
     button hidden; checkbox columns disabled.
   - **View-link:** modal trigger hidden in the `⋯`
     menu.

10. **Empty-catalog edge case.** If a catalog has zero
    manufacturers (e.g. fresh deployment with no seed
    data), the corresponding checkbox list shows the
    empty state *"No manufacturers in the catalog yet."*
    No save-on-empty issue since there's nothing to
    toggle.

### Resolved questions (2026-05-10)

- **Q-WIN-8.1: Per-project preset of "default-on"
  manufacturers** (e.g. BLDGTYP defaults to a curated
  subset rather than "all enabled")? Resolved: **defer
  to v1.1+**. Default stays "all enabled" (V1 parity).
  When a per-firm-preset feature lands, it'd likely
  sit at the user-preferences level
  (`userPreferencesStore.default_manufacturer_filters`)
  rather than per-project.

### Open questions
None outstanding.

### Cross-references

- **Q-WIN-4 resolution** — storage location
  (`body.tables.manufacturer_filters`).
- **PRD §6.2** — `tables.manufacturer_filters` shown in
  the canonical project-document sketch.
- **US-WIN-4** — picker filters its catalog rows through
  this.
- **US-WIN-11 (Refresh from catalog)** — diff dialog's
  pickers honor this filter.

---

## US-WIN-9 — Canvas (SVG render, view direction, zoom, label overlay)

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.window_types`)
**V1 ref:** §7 (full canvas — SVG composition + view direction
+ zoom + labels)
**Mirrors:** US-ENV-4 (envelope canvas) — shares the
locked-aspect-ratio + per-user-persisted-zoom pattern resolved
in Q-ENV-4.1

### Story

> As an editor composing a window type, I want a proportional
> SVG canvas showing the elements grid — each cell drawn with
> its four frames around its glazing — with toggleable view
> direction (interior ↔ exterior), zoom controls, and editable
> element-name labels overlaying each cell, so I can compose
> and review window types visually.

### Acceptance criteria

1. **Container layout** (V1 ref §7.1 parity):
   - Canvas wrapper fills the Windows tab content area below
     the per-type header.
   - **View-direction label** at the top reads
     `"Viewing from inside"` or `"Viewing from outside"`
     depending on the current direction (criterion 4).
   - Below the canvas: U-Value display chips (US-WIN-6) +
     dimensions panel (US-WIN-10).

2. **Per-element rendering** (V1 ref §7.3 parity — the
   four-rectangles-per-element pattern):
   - Each element is composed of **5 SVG `<rect>` regions**:
     - **Top frame** rectangle (height = top frame width)
     - **Right frame** rectangle (width = right frame width)
     - **Bottom frame** rectangle (height = bottom frame width)
     - **Left frame** rectangle (width = left frame width)
     - **Glazing** rectangle in the center (remaining area)
   - Each rectangle's fill comes from the picked frame /
     glazing's `argb_color` (parsing the `"(a, r, g, b)"`
     string to CSS `rgba(...)`; default `#ccc` on parse
     fail or null).
   - **Null-frame / null-glazing rendering** (mirrors
     US-ENV-4 criterion 3 dashed-outline treatment):
     - Null frame or glazing renders with **blank fill +
       dashed `#999` 1.5 px outline**.
     - Visually flags "no frame/glazing picked yet" — the
       same affordance as null-material segments on the
       envelope canvas. Pairs with the US-WIN-6 criterion
       11 "unfinished" U-Value qualifier.
   - **Merged elements** (per US-WIN-3) span their
     `row_span × column_span` cells; the 5-rect composition
     scales up with the merged area.

3. **Zoom + locked aspect ratio** (mirrors US-ENV-4
   criterion 9 + Q-ENV-4.1):
   - Single scale state: `windowCanvasZoom: number`,
     default `1.0`. **Per-user preference** stored at
     `userPreferencesStore.window_builder_canvas_zoom`
     (sibling to envelope's `envelope_canvas_zoom`).
   - Both axes always scale together by the same factor
     — **aspect ratio is never independent**, fixing
     V1's narrow-viewport squish problem identified
     for envelope (the same flex-grow bug affects this
     surface).
   - Discrete steps: `0.05, 0.10, 0.20, 0.30, 0.50,
     0.75, 1.0` (V1 ref §4.9 had `0.05`-step granularity
     0.05–1.0; V2 simplifies to ~7 discrete steps that
     match what users actually need).
   - Header zoom cluster: `[−] 25% [+] [Fit]` — same
     pattern as US-ENV-3 criterion 1 envelope zoom
     cluster. Visible on locked versions / anonymous viewers.

4. **View direction toggle** (V1 ref §7.10 parity):
   - **Toolbar button** at the canvas header — toggles
     between "interior" and "exterior" view.
   - **Visual semantics:**
     - Default = **exterior view** (looking at the
       window from outside the building).
     - On flip → **interior view**: column-reverse (left
       and right swap), AND symbol-flip on each element
       (the operation symbol — V1 ref §7.10 — mirrors
       left↔right since you're now looking from the
       other side).
   - **Frame-label flip on interior view: KEEP** (per
     Q-WIN-7 resolved). The elements-table label text
     also flips so what you see on the canvas matches
     what you read in the table — "what you see is what
     you label."
   - **View-direction storage: per-user preference**
     (per Q-WIN-9.1 — see Open Questions). Lives at
     `userPreferencesStore.window_builder_view_direction`
     (`'exterior' | 'interior'`).

5. **Label overlay — editable element name pills** (V1
   ref §7.8 parity):
   - Each element's `display_name` renders as an
     overlay pill centered on the glazing region (above
     the SVG, in a DOM layer that scales with zoom).
   - **Click-to-edit**: pill becomes an input field;
     Enter commits (single JSON-Patch `replace` on
     `tables.window_types[<wt>].elements[<el>].display_name`),
     Escape cancels, blur commits.
   - Empty names rejected (silently revert to prior
     value); whitespace trimmed.
   - Same name allowed across multiple elements in the
     same window-type (no uniqueness constraint — elements
     are identified by `id`, not name).

6. **Hover affordances:**
   - **Hover on element** → subtle ring outline + the
     element becomes the click target for selection
     (US-WIN-3 element selection).
   - **Hover on frame region (one of the four rects)** →
     stronger ring on just that rect; click opens the
     per-side frame picker (US-WIN-4) scoped to that side.
   - **Hover on glazing region** → ring on glazing rect;
     click opens the glazing picker.

7. **Click semantics:**
   - **Click on an element (background area)** → selects
     the element (US-WIN-3).
   - **Click on a frame rect** → opens the frame picker
     for that side (US-WIN-4).
   - **Click on the glazing rect** → opens the glazing
     picker for that element (US-WIN-4).
   - **In pick / paste mode (US-WIN-7)** → click drives
     the copy / paste state machine instead.

8. **Hover-`+` add row/col affordances** (mirrors V1 +
   US-ENV-4 hover-circle pattern — V1's edge-hot-zone
   pattern noted in Q-ENV-10 stays here on the windows
   side per its actual V1 implementation):
   - **+ Add row above / below** circular `+` buttons
     revealed on hover at the top / bottom edges of the
     row-rail.
   - **+ Add column left / right** at the left / right
     edges of the column-rail.
   - Gated: logged-in editor, unlocked version, not in
     pick / paste mode (hidden for anonymous viewers).

9. **Loading state.** Canvas renders nothing (or a quiet
   skeleton) when the active window-type is in flight or
   null.

10. **Locked-version + anonymous-viewer rendering.** Canvas
    visually identical; hover-`+` buttons + frame /
    glazing pickers hidden; pills are read-only (no
    click-to-edit); view-direction toggle and zoom
    cluster remain functional (viewing aids, not edits).

11. **Horizontal scroll on overflow.** When the scaled
    window-type exceeds canvas width, the canvas
    scrolls horizontally — never compresses (matches
    US-ENV-4 criterion 2 fix).

### Resolved questions (2026-05-10)

- **Q-WIN-9.1: View-direction storage scope?** Resolved:
  **per-user preference** in
  `userPreferencesStore.window_builder_view_direction`.
  V1 used `sessionStorage` (per-tab), which is awkward
  when a user opens the same project in a new tab. Per-
  user matches the pattern locked in for canvas zoom +
  unit-system + window-builder dim format.
- **Zoom persistence?** Resolved: **per-user preference**
  in `userPreferencesStore.window_builder_canvas_zoom`,
  parallel to envelope. V1 was per-tab session; V2
  upgrades to per-user.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-4** — envelope-side parallel canvas; same
  locked-aspect-ratio + per-user-zoom pattern.
- **Q-ENV-4.1 resolution** — drives the aspect-ratio
  + zoom-control design.
- **Q-WIN-7 resolution** — frame-label flip on interior
  view stays in.
- **US-WIN-3** — element selection / merge / split feeds
  click semantics.
- **US-WIN-4** — frame / glazing pickers triggered by
  per-region clicks.
- **US-WIN-6** — unfinished-U-Value qualifier pairs with
  the null-frame / null-glazing dashed outline.
- **US-WIN-7** — pick / paste mode preempts normal click
  behavior.
- **US-WIN-10** — dimensions panel sits below the canvas.

---

## US-WIN-10 — Dimensions panel (parser + display)

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`row_heights_mm`, `column_widths_mm` on
window types), §11.5 (units architecture — backend SI canonical,
frontend converts)
**V1 ref:** §6 (full Dimensions panel + parser tests)

### Story

> As an editor sizing a window type, I want a Dimensions panel
> below the canvas that lists each row height and column width
> with editable inline labels — and I want to type those values
> in whatever format is natural (decimal mm, fractions, feet-
> and-inches, or a simple expression like "100 + 50") with the
> parser figuring out what I meant — so I can size windows
> without context-switching to a calculator or a unit converter.

### Acceptance criteria

1. **Panel layout** (V1 ref §6.1 parity):
   - Sits directly below the canvas (US-WIN-9), within the
     Windows tab content area.
   - Two sections side by side: **Row Heights** (left) and
     **Column Widths** (right). Each section is a vertical
     list of editable rows.
   - Per row: index label (e.g. `Row 1`), input field with
     the dimension value, unit suffix per the active
     display format (criterion 4).

2. **Display unit selector** at the top of the panel —
   shadcn `Select` with options matching V1 ref §6.3:
   - **Millimeters** (`mm`) — `"304.8"`
   - **Centimeters** (`cm`) — `"30.48"`
   - **Meters** (`m`) — `"0.305"`
   - **Decimal inches** (`in`) — `"12.0"`
   - **Decimal feet** (`ft`) — `"1.0"`
   - **Feet-and-inches** (`ft-in`) — `"1' 0\""`
   - **Fractional inches** (`in-frac`) — `"12\""` (with
     ¹⁄₁₆" precision)

3. **Display unit persistence — per-user, per-system**
   (per Q-WIN-9 resolved). Two preferences in
   `userPreferencesStore`:
   - `window_builder_dim_format_si` — picked when active
     unit system is SI (`mm` / `cm` / `m`).
   - `window_builder_dim_format_ip` — picked when active
     unit system is IP (`in` / `ft` / `ft-in` / `in-frac`).
   - Switching the unit-system toggle (US-3 header)
     auto-switches which preference is read.

4. **Parser — port V1's utilities 1:1.** The four V1
   parser files port verbatim with their full test suite:
   - `parseFeetInches.ts` (V1 ref §6.4) — handles
     `1' 6"`, `1'-6"`, `1ft 6in`, `1' 6 1/2"`,
     `1' 6-1/2"`, etc.
   - `evaluateExpression.ts` (V1 ref §6.5) — simple
     arithmetic expressions (`100 + 50`, `1200 / 4`).
   - `parseInput.ts` (V1 ref §6.6) — top-level dispatcher
     that detects format and routes to the right
     sub-parser.
   - `displayUnitConverter.ts` (V1 ref §6.7) — mm ↔
     all-display-units conversion.
   - `formatFeetInches.ts` (V1 ref §6.8) — formatter for
     the `ft-in` and `in-frac` display modes.
   - **V1 ref §6.4–§6.8's 100+ test cases lift verbatim**
     into the V2 test suite. This is non-negotiable —
     the parser is well-tested in V1 and any regression
     is an immediate user papercut.

5. **`evaluateExpression` — add parens support in V2 v1**
   (per Q-WIN-10.1 resolved). V1 ref §18 noted parens
   were absent; users hit this regularly when typing
   `(1200 - 50) / 4` for evenly-spaced mullions. V2's
   parser handles standard precedence + parens.
   Implementation: simple recursive-descent parser or a
   small library (`mathjs` is overkill — write the ~50
   LOC parser inline).

6. **Inline edit flow** (V1 ref §6.2 parity):
   - Click a row's value → input becomes editable, full
     value selected.
   - **Precision preservation** (V1 ref §17, the
     `initialEditValue` ref): on edit-mode entry, the
     ref captures the value's mm-precise source. On
     blur / Enter, IF the user's typed value parses to
     the same mm-precise source (within rounding
     tolerance — `< 0.5 mm`), the original mm value is
     restored exactly. **Prevents round-trip rounding
     loss** — e.g. typing `"12 1/16\""` doesn't accidentally
     overwrite an underlying `305.5625 mm` with
     `305.5 mm`.
   - Escape → cancel; original value returns.
   - Enter / blur → commit. Single JSON-Patch `replace`
     on
     `tables.window_types[<wt>].row_heights_mm[<index>]`
     or `column_widths_mm[<index>]`.
   - **Backend stores mm-canonical** (PRD §11.5 — backend
     is SI). Display conversion happens at render time.

7. **Parser error handling.** If the input doesn't parse
   to a positive number:
   - Field gets a red border + error icon.
   - Tooltip on the icon: *"Couldn't parse this — try
     `1200`, `1' 6\"`, `1200 / 4`, or `1.2 m`."* (Format
     hints scale to the active display unit.)
   - Save is blocked until the user fixes or escapes.

8. **Validation:**
   - Value must parse to `> 0` (a zero-width column or
     zero-height row would render a degenerate canvas).
   - On `Save As` to a `submitted` / `closed` version
     kind, validation re-runs; any rows / cols that
     remain unparseable raise a structured error in the
     Save As flow (mirrors US-WIN-1's name-uniqueness +
     null-frame Save-As validation pattern).

9. **Refetch window U-Value after every dimension save**
   — dimensions affect element areas, which affect the
   area-weighted composite per US-WIN-6 criterion 8.

10. **Canvas + panel stay synced.** Editing a row /
    column value here re-renders the canvas (US-WIN-9)
    immediately — the panel and canvas read the same
    `row_heights_mm` / `column_widths_mm` arrays from
    the draft buffer.

11. **Locked-version + anonymous-viewer rendering.** Panel
    visible; input fields disabled; values rendered as
    plain text in the active display format. Display
    unit selector remains functional (it's a viewing
    aid, not an edit).

### Resolved questions (2026-05-10)

- **Q-WIN-10.1: Add parens to `evaluateExpression`?**
  Resolved: **yes — add parens in V2 v1.** V1 ref §18
  flagged the absence as a papercut. Expression parser
  is small enough that inline implementation is fine
  (no `mathjs` dependency needed).

### Open questions
None outstanding.

### Cross-references

- **PRD §11.5** — backend SI canonical (mm); frontend
  converts at display.
- **Q-WIN-9 resolution** — drives the per-user display-
  format preference (criterion 3).
- **V1 ref §6** — parser test cases lift verbatim to V2.
- **US-WIN-9** — canvas re-renders on dimension change.
- **US-WIN-6 criterion 8** — refetch trigger fires on
  row / column dimension change.

---

## US-WIN-11 — Refresh-from-catalog (per-entry bookshelf re-sync)

**Status:** Draft · **Priority:** MVP — **NEW in V2**
**PRD ref:** §7.4 (refresh-from-catalog UX)
**V1 ref:** none (V1's catalog is live-referenced; V2 is bookshelf)

### Story
> As an editor, when a frame or glazing in the catalog has been
> updated since I picked it (vendor reformulation, library
> typo-fix, new datasheet), I want a per-entry "refresh from
> catalog" gesture that shows me the diff and lets me decide
> which value to keep — without forcing me to re-pick from
> scratch.

### Acceptance criteria

1. **Drift detection.** A frame or glazing entry is "drifted from
   catalog" if `catalog_origin.catalog_version_id !=
   catalog_*_records.current_version_id`. Computed at read time.
2. **Surfaces.**
   - **Per-entry badge** — frame / glazing chip in the elements
     table shows a `🔄` (or shadcn `RefreshCw` icon) overlay when
     drifted. Hover tooltip: **"Catalog has changed since pick.
     Click to review."**
   - **Project-wide drift summary** — small banner at the top of
     the Windows tab when *any* drift exists in the active
     window-type's elements: **"3 entries drifted from catalog
     [Review all]"**.
   - **Across-the-project report** — accessible from the project
     header `⋯ → Catalog drift report`. Per PRD §7.4 final ¶,
     "lives in the catalog manager view of a project."
3. **Per-entry refresh dialog.**
   - Title: **"Refresh '<name>' from catalog?"**
   - Body: side-by-side diff:
     ```
     Field            Catalog (current)   Yours (saved)
     name             Skyline SR-3        Skyline SR-3
     width_mm         110                 100   ← differs
     u_value_w_m2k    0.78                0.85  ← differs
     psi_g_w_mk       0.040               0.040
     ...
     ```
   - Per-row radio: **Take catalog · Keep mine · Edit a third
     value** (third value opens an inline input).
   - Bulk actions: **Take all from catalog**, **Keep all mine**.
   - **Save** writes the chosen values into the document and
     updates `catalog_origin.synced_at = now()` and
     `catalog_version_id = current_version_id` (for fields where
     the user took catalog or matched it).
4. **Diverged user-edited fields.** If the user previously
   inline-edited a value (US-WIN-4 criterion 5,
   `catalog_origin.diverged: true`), the diff explicitly tags
   those rows with **"You edited this"** so the user doesn't
   forget why their value differs.
5. **No bulk "refresh everything" auto-apply** in v1 (PRD §7.4 +
   §17 question 9 lean). The dialog requires explicit per-row
   choice.
6. **Read-only on locked versions / for anonymous viewers.** Drift badges
   still show; refresh dialog is unavailable.
7. **All changes flow through the draft buffer.**

### Resolved questions (2026-05-10)

- **Q-WIN-11.1: Catalog version pinning — drift compared to what?**
  **Resolved:** drift is detected **only when**
  `catalog_origin.catalog_version_id !=
  catalog_*_records.current_version_id`. Intermediate non-current
  versions do not trigger the badge. So if the catalog row went
  v3 → v4 → v5 (current), an entry pinned at v3 shows drift; an
  entry pinned at v5 does not, regardless of the v3/v4 history.
- **Q-WIN-11.2: Renamed-field handling in the diff dialog —
  deferred to schema-migration design.**
  **Revised 2026-05-11:** catalog-schema migration tooling is
  deferred from MVP and kept as a post-MVP goal. MVP refresh
  compares current MVP field names only and stores
  `catalog_schema_version: 1` as a future hook. See sidebar below.

### Sidebar — catalog-schema migration is a post-MVP goal (revised 2026-05-11)

PRD §10.5 commits to **project-document** schema versioning
(forward-only shims, golden-file corpus, read-safe-mode
fallback, deprecation-without-removal). It is silent on
**catalog-schema** versioning — i.e. evolution of the
`catalog_materials` / `catalog_frame_types` /
`catalog_glazing_types` table columns themselves (which is
distinct from the row-level catalog_*_versions in PRD §7.2;
that's "Skyline 2024 spec vs 2026 spec" not "we renamed
`psi_g_w_mk` to `psi_glazing_w_mk`").

Revision (2026-05-11): catalog-schema migration tooling is
deferred from MVP and kept as a post-MVP architectural goal.

MVP does not ship catalog-row shim chains, catalog-schema
golden fixtures, production-corpus refresh drills, renamed-field
diff metadata, or added/removed/re-typed-field migration UI.

MVP does preserve a cheap future hook: catalog row APIs and
copied `catalog_origin` payloads include
`catalog_schema_version: 1`. Refresh-from-catalog compares only
current MVP field names. Any catalog schema change before the
post-MVP migration subsystem exists is a code/data migration
event that requires manual planning.

### Open questions
None for MVP — catalog-schema migration is tracked as a
post-MVP goal in PRD §7.5.

---

## US-WIN-12 — HBJSON window-constructions export

**Status:** Placeholder · **Priority:** v1.1 (gated by Q-WIN-8)
**V1 ref:** §13.1 (`get-window-constructions-as-hbjson` route),
§17 (hard-coded VT = 0.6)

### Notes for full draft
- Behavior matches V1: per-element Honeybee-Energy
  `WindowConstruction` JSON; identifier
  `"{window_type_name}_C{col}_R{row}"`; U-factor from per-element
  ISO 10077-1 result; SHGC from glazing's `g_value`; VT hard-coded
  to 0.6.
- Surfaced in the project header `⋯ → Download window
  constructions (HBJSON)`.
- Per-version: takes the active version's body as input.
- Open per Q-WIN-8: confirm we're keeping this in V2 at all,
  given the PRD §11.4.6 deliberate disconnect.

---

## US-Builder-Envelope — Envelope tab (US-3.4)

**Status:** Draft (parent — sub-stories range Draft → Placeholder)
**Priority:** MVP
**PRD ref:** §6.2 (`tables.assemblies` shape — sketch needs amendment;
see Q-ENV-1, Q-ENV-2), §7 (catalog bookshelf), §11.1 (project tabs),
§11.5 (units architecture), §8 (save / version model — Envelope
edits flow into the draft buffer, persisted by Save / Save As)
**UI/UX ref:** §2.7 *Envelope tab* (placeholder — expanded by these
sub-stories)
**V1 reference:** `research/v1-assembly-builder-reference.md`
— deep enumeration of V1 Envelope behavior; consult for any "what
does V1 do here" question. Cited as `V1 ref §N` below.

### Story (parent)
> As an editor, I want to compose the project's envelope assemblies
> — walls, floors, roofs, and any construction made of stacked
> material layers — by adding layers (each with thickness), filling
> each layer with one or more side-by-side material segments, picking
> materials from the catalog, marking design-spec status / continuous
> insulation / steel-stud cavities, attaching site photos and product
> datasheets per segment, and seeing the live PH-average effective
> R-value (with steel-stud handling per AISI S250-21), so the design
> intent is captured for every opaque construction in the project
> and the data round-trips cleanly with Rhino + honeybee_ph via
> HBJSON.

### Why this is a story-cluster (US-ENV-1..15)
The Envelope surface is the second-densest editing surface in PHN
after Windows. V1 splits it into **four sub-tabs** (Assemblies,
Materials, Airtightness, Site Photos; V1 ref §3.1) and the
Assemblies sub-tab alone has 10+ named subsystems (sidebar, header
labels, canvas, layer/segment renderers, three modals, copy/paste
state machine, HBJSON import/export). Splitting into an `US-ENV-N`
cluster lets us walk one subsystem at a time. Sub-stories share the
project's versioned-document + bookshelf-catalog architecture
(PRD §6.2, §7).

### Key V1 → V2 shifts (read first)

These mirror the Windows cluster's framing (US-Builder-Windows §
"Key V1 → V2 shifts") with envelope-specific emphasis:

1. **All assembly data lives in the versioned project document.**
   `body.tables.assemblies[]` per PRD §6.2 (with amendments — see
   Q-ENV-1 / Q-ENV-2). Edits flow into the draft buffer
   (PRD §8.3); explicit **Save** or **Save As** persists to a
   version. No V1-style per-property PATCH round-trip
   (V1 ref §13.14).
2. **Materials are bookshelf-copied from the catalog, not
   live-referenced** (PRD §7.1). At pick time, the catalog row's
   values are *copied into the document* and stamped with a
   `catalog_origin` block. Catalog edits do not propagate into the
   project. Refresh-from-catalog (US-ENV-11) is the explicit
   re-sync gesture. **This is the largest behavioral change from
   V1**, where the global Materials table was live-referenced and
   silently mutated by `purge_unused_materials` (V1 ref §13.9).
3. **No AirTable.** V2 catalog is hand-curated in the catalog
   manager (a separate top-level area; PRD §7.3, US-2). No
   "Refresh Materials from AirTable" gesture; no
   `purge_unused_materials` behavior; no
   `NoMaterialsException` hard-failure on first use
   (V1 ref §13.8). New segments in V2 ship with `material: null`
   per Q-WIN-3-style lean (lifted to assemblies as Q-ENV-3).
4. **Backend is SI-only; frontend converts** (PRD §11.5). V1's
   `DetailsModal` material-data block hard-coded SI even when the
   user was in IP mode (V1 ref §12.8); V2 must respect the
   per-user IP/SI toggle everywhere.
5. **Locked versions block all edits** (US-3.1). When the active
   version is locked, the entire Envelope tab renders read-only
   with the "Save As to copy and edit" banner; no inline edit
   affordances anywhere in this cluster. Replaces V1's logged-in
   vs. anonymous gating.
6. **Sort order normalized.** V1 already uses `naturalSortCompare`
   on the assembly sidebar (V1 ref §8.1) — V2 keeps this and uses
   it everywhere assemblies / materials are listed.
7. **Selection cleared on version switch.** Active assembly,
   copy/paste pick state, and undo stack do not survive a version
   switch via the header dropdown (US-3.1). Mirrors V1 behavior on
   assembly change (V1 ref §6.3 lifecycle).
8. **Toast + Dialog replace `alert` + `window.confirm`.** V1 uses
   `window.confirm` for assembly / layer / segment delete and
   `alert` for refresh / upload feedback (V1 ref §6.2, §8.3, §9.2,
   §9.3, §11.3). V2 uses shadcn `Dialog` for confirmations and
   Sonner toasts for non-blocking feedback (UI/UX §1.3, §1.4).
9. **Last-Layer / Last-Segment minimums become UI-level locks.**
   V1 enforces these server-side and surfaces backend exceptions
   via `alert()` (V1 ref §13.3). V2 disables the Delete button at
   the UI level with an explanatory tooltip, matching the
   US-WIN-2 criterion-7 pattern.
10. **Per-segment property updates collapse into one document
    patch.** V1 issues up to 4 PATCHes from the Segment-Properties
    modal Save and 5 PATCHes per copy/paste (V1 ref §13.14), with
    real partial-failure risk. V2's draft-buffer patches are
    atomic per Save flush (one round-trip writes the whole
    segment subtree); copy/paste applies as a single multi-op
    patch.

### Open architectural questions — resolve early (data-model-shaping)

These shape the document body and need to be settled before
Pydantic models are written.

- **Q-ENV-1 (Resolved 2026-05-10):** PRD §6.2 sketch is
  illustrative only — implementation details are picked during
  code-writing, but the missing fields (`assembly.orientation`,
  `layer.thickness_mm`, `segment.steel_stud_spacing_mm` per V1
  ref §2.1–§2.3) **must be added** to the document model.
  Confirmed.

- **Q-ENV-2 (Resolved 2026-05-10): Datasheets at project-material
  level; site photos at segment level.** Pulled out of original
  Q-ENV-2 lean during 2026-05-10 review. **The V2 model splits
  documentation by what unit it actually documents:**

  | Documentation kind | Lives where | Why |
  |---|---|---|
  | **Datasheets** (manufacturer PDFs) | Per-project per-material | One product = one datasheet for the whole project; required QA artifact regardless of how many assemblies use the product. Stored per-project (not in the catalog) so the design / construction team's submission is the captured record (the QA value is *they* tell *us* what they're using, even if our catalog already knows the product). |
  | **Specification status** | Per-project per-material | "Have we received a confirmed product commitment from the design team?" is a material-level question, not a segment-level one. If they've committed to XPS for the project, they've committed for every use. (V1 ref §2.3 had this per-segment as a side-effect of the data structure, not by design.) |
  | **Notes** | Per-project per-material | Same reasoning. (V1 ref §12.8 had this per-segment.) |
  | **Site photos** | Per-segment | "We need a photo of *each* installation slot" — a wall and a floor that both use XPS each need their own as-built photo. (V1 ref §13.7 already segment-scoped this with the right rationale: "site photos document a specific installation slot, not the abstract product.") |

  **Document model — restructured (replaces PRD §6.2 sketch for
  envelope tables):**

  ```jsonc
  {
    "tables": {
      "assemblies": [
        {
          "id": "asm_<ULID>",
          "name": "WALL-C3",
          "orientation": "first_layer_outside",
          "layers": [
            {
              "id": "lyr_<ULID>",
              "order": 0,
              "thickness_mm": 50.0,
              "segments": [
                {
                  "id": "seg_<ULID>",
                  "order": 0,
                  "width_mm": 812.8,
                  "steel_stud_spacing_mm": null,
                  "is_continuous_insulation": false,
                  "project_material_id": "pmat_<ULID>",   // <-- ref by id
                  "photo_asset_ids": []                    // <-- per-segment
                }
              ]
            }
          ]
        }
      ],
      "project_materials": [
        {
          "id": "pmat_<ULID>",
          "name": "XPS",
          "category": "Insulation",
          "conductivity_w_mk": 0.034,
          "density_kg_m3": 35,
          "specific_heat_j_kgk": 1500,
          "emissivity": 0.9,
          "argb_color": "(255,220,230,240)",
          "specification_status": "complete",       // 'complete'|'missing'|'question'|'na'
          "datasheet_asset_ids": ["asset_..."],      // <-- per-material
          "notes": null,
          "catalog_origin": {                        // null if hand-entered
            "catalog_table": "materials",
            "catalog_record_id": "rec123abc",
            "catalog_version_id": "rec123abc_v3",
            "synced_at": "2026-05-09T14:00:00Z"
          }
        }
      ]
    }
  }
  ```

  **Auto-management rules:**
  1. **Picking a catalog material in a segment** auto-de-dupes by
     `catalog_origin.catalog_record_id`:
     - If a `project_materials` row exists with the same
       `catalog_record_id` → segment's `project_material_id` is set
       to that row's id. Datasheet, spec-status, notes are shared
       across all segments using it.
     - Else → a new `project_materials` row is created (with the
       catalog row's values inlined) and the segment references
       it.
  2. **Hand-entering a material** always creates a new
     `project_materials` row with no `catalog_origin` (no
     auto-dedup by name; user explicitly types each unique
     hand-entered material).
  3. **Editing a `project_materials` row's values** (inline
     override) affects every segment that references it. This is
     the deliberate trade-off: shared identity = shared values.
  4. **Refresh-from-catalog** (US-ENV-11) operates on a
     `project_materials` row, not on individual segments.
  5. **Last-segment deletion → orphan row preserved.** When the
     last segment referencing a `project_material_id` is deleted,
     the `project_materials` row is **not** auto-cleaned. It
     surfaces in the Specifications view as **"Unused"** so the
     user can keep it (datasheet still useful for the QA record)
     or explicitly delete. This protects against accidental
     datasheet-loss when reorganizing assemblies.
  6. ~~**Catalog-origin recovery on HBJSON re-import.**~~
     Originally drafted as rule 6 here; **dropped 2026-05-10**
     when HBJSON construction import was removed from V2 v1
     scope (see US-ENV-12 / PRD §3 non-goals). HBJSON is
     viewer-only in V2 — the Model tab consumes uploaded
     HBJSON for visualization but does not write to
     `tables.assemblies` or `tables.project_materials`. PHN is
     the authoritative source for envelope data; Rhino /
     Honeybee consume PHN data downstream and produce HBJSON
     as output.

  Confirmed.

- **Q-ENV-2.1 — Should datasheets ever live at the catalog
  tier? Resolved 2026-05-10: NO.** The catalog carries product
  *specs* (conductivity, density, spec heat, emissivity, color)
  so the modeling work can proceed without manual entry, but
  **datasheets themselves never live in the catalog** — not even
  as optional defaults. The QA value is the design / construction
  team submitting *their* datasheet on *their* project; a
  catalog-tier default would invite users to skip the submittal
  step or assume our reference doc is "good enough." Catalog-side
  datasheets and per-project datasheets are different artifacts
  serving different workflows (catalog = "what is this product?"
  / per-project = "did the team commit to using it on this
  project?"); rather than carrying both, we carry only the one
  that the QA workflow demands. Persisted as an
  auto-memory principle so future feature proposals don't drift
  back toward "let's auto-populate from catalog."

- **Q-ENV-3: Default material on segment / assembly create.**
  Resolved 2026-05-10. V1's `Layer.default(material)` required
  non-null material and raised `NoMaterialsException` on first
  use of an empty DB (V1 ref §13.8). V2 has no AirTable seed.

  **Resolution — three parts:**

  1. **Initial state.** New assembly → first layer ships with
     one segment whose `project_material_id` is `null`. Document
     validation tolerates nulls in `draft`; `Save` shows a soft
     warning toast ("3 segments have no material assigned");
     `Save As` to a `submitted`/`closed` version kind hard-fails
     with the offending list. Mirrors Q-WIN-3 resolution for
     window-elements.
  2. **Visual cues for null-material segments** (so the user
     never wonders "why does my R-value say `--`?"):
     - **Canvas** (US-ENV-4): segment renders with **blank fill
       + dashed `#999` outline** — visually distinct from a
       picked segment (solid fill, solid border). See US-ENV-4
       criterion 3 update.
     - **R-/U-value label** (US-ENV-3 header / US-ENV-10):
       includes an **"unfinished"** marker (e.g. an "(unfinished —
       N segments missing material)" suffix or warning icon)
       whenever any segment in the active assembly is null. See
       US-ENV-10 placeholder note.
  3. **TWEAK — "last picked material" becomes session default.**
     Once a user picks any material for any segment in the
     active assembly, that material becomes the default for
     **subsequent new segments** (both add-segment and add-layer):
     - **add-segment hover-`+`** — primary source is the
       adjacent ("source") segment's `project_material_id` (V1
       parity, already in US-ENV-6 criterion 1). **Fallback** if
       the adjacent segment is `null`: the assembly's
       last-picked material from the session store. If both are
       null (brand-new empty assembly), the new segment is
       `null`.
     - **add-layer hover-`+`** — there is no source segment.
       The new layer's starting segment defaults to the
       assembly's last-picked material from the session store
       (or `null` if nothing has been picked yet in this
       assembly).
     - Rationale: walls and floors typically have multiple
       segments / layers of the same product (e.g. several XPS
       layers totaling a desired thickness). Defaulting to the
       last-used material removes a click per segment in the
       common case while preserving the dashed-outline / null
       state for the truly empty assembly.

     **Implementation note.** The "last-picked material" lives
     in **frontend Zustand state**, not in the project document
     — it's UI ergonomics, not data. Keyed per-assembly
     (`Record<assembly_id, project_material_id | null>`).
     Session-only; resets on document/version switch.
     Triggered to update on every successful material-pick
     through the bookshelf picker (US-ENV-7).

- **Q-ENV-4: Steel-stud surface-film divergence (V1 ref §13.5)
  + Honeybee U-Factor vs U-Value convention.** **Resolved
  2026-05-10** after a source-level audit of Honeybee
  (`honeybee_energy/construction/_base.py:115-141`) and
  PHN-V1 (`backend/features/assembly/services/
  thermal_resistance.py` + `to_hbe_material_steel_stud.py`).

  **Honeybee's convention is explicit and consistent at every
  level:**

  | Term | Films included? | Source |
  |---|---|---|
  | `EnergyMaterial.r_value` / `u_value` | **NO** ("excluding air films") | `material/opaque.py:201-225` |
  | `OpaqueConstruction.r_value` / `u_value` | **NO** ("excluding air films") | `construction/_base.py:115-123` |
  | `OpaqueConstruction.r_factor` / `u_factor` | **YES** (EN 673 / ISO 10292) | `construction/_base.py:125-141` |

  The films used by `r_factor` / `u_factor` are the **simple
  ISO 10292** coefficients (`out_h_simple()=23 W/m²K`,
  `in_h_simple()=3.6+(4.4·ε_inside/0.84)`). They are
  emissivity-dependent but **NOT direction-dependent** — the
  Honeybee `OpaqueConstruction` object doesn't carry
  orientation; direction-dependent films are applied at
  EnergyPlus simulation time using the geometric model.

  **V2 policy: PHN shows only U-Value / R-Value (no films).**
  Never displays U-Factor / R-Factor. Rationale:
  1. If PHN displayed a films-included "U-Factor" using
     Honeybee's simple ISO formulas, it would NOT match
     ASHRAE-convention U-Factor (direction-dependent), WUFI
     (direction-dependent), or EnergyPlus simulation runs
     (direction-dependent). One label, four meanings — actively
     misleading.
  2. The construction itself is direction-independent. Films
     are an envelope-boundary property whose direction the
     downstream simulation tool knows from its geometric model.
     PHN's job is to nail the construction-only thermal
     performance; downstream tools add films at simulation time.
  3. V1's display surface already uses this convention
     (Effective R-Value label + tooltip explicitly says "Surface
     film resistances NOT included" + ASHRAE Ch 27 reference).
     V2 carries V1's tooltip forward verbatim plus one extra
     sentence naming the Honeybee convention we're matching.

  **V1 HBJSON-export steel-stud bug.** V1's
  `to_hbe_material_steel_stud.py` baked `R_SE=0.17, R_SI=0.68
  hr·ft²·°F/BTU` into the AISI S250-21 cavity-equivalent
  conductivity (lines 27-28, 207-208). Downstream Honeybee
  re-adds its own ISO simple films when computing `u_factor`,
  so the cavity-portion films get counted twice. **V2 fix:**
  steel-stud equivalent-conductivity service uses `R_SE=0,
  R_SI=0` everywhere (both live calc and HBJSON export),
  matching what `thermal_resistance.py` already does for the
  live calc. Films enter exactly once at the construction
  boundary, downstream of PHN. Captured in US-ENV-12 (HBJSON
  export) acceptance criteria.

  **Documented in:** `context/glossary.md` (created
  2026-05-10 — Thermal performance section). PRD §14.1
  (migration script) carries the one-time HBJSON-delta note
  for re-imported V1 steel-stud assemblies.

  **Unblocks:** US-ENV-10 (Effective R-/U-value display) — now
  has full acceptance criteria (status: Draft, no longer
  Placeholder).

- **Q-ENV-5: Multi-row PhDivisionGrid — defer (V1 ref §13.11).**
  Resolved 2026-05-10: **defer to v1.1+; single-row only in V2
  v1.** V1's data model technically allows multi-row division
  grids (vertical splits within a layer producing 2D
  segmentation), but V1 never exposes the editing UI for it and
  hard-fails on the few imports that carry multi-row data. V2 v1
  keeps the same restriction — `layer.segments[]` stays a flat
  array of side-by-side segments along one horizontal axis.
  Confirmed by Ed: rare in practice on BLDGTYP projects (real
  hybrid assemblies model fine as multi-layer, single-row stacks
  via the AISI S250-21 steel-stud equivalent-conductivity
  treatment, V1 ref §5.5).

  ~~HBJSON import behavior: structured error on multi-row.~~
  **Moot 2026-05-10:** HBJSON construction import was dropped
  from V2 v1 entirely (see US-ENV-12 / PRD §3). No import =
  no multi-row error to surface. If a v1.1+ HBJSON import
  feature is added later, the structured-error pattern can be
  added then.

  Multi-row support itself promotes to v1.1+ candidate **gated
  by a concrete user request** (so we don't pay the 2D-grid UI
  cost for a hypothetical need).

- **Q-ENV-6: Manufacturer / category filter for materials —
  parity with Windows or skip?** Resolved 2026-05-10:
  **(a) no filter in V2 v1.** V1 has no per-project material
  filter (V1 ref §13.2) — every project sees every catalog
  material. V2 keeps that behavior.

  Rationale:
  - Material catalogs are dramatically smaller than
    frame/glazing catalogs (which combinatorially explode by
    manufacturer × product line × glazing makeup). Materials
    are mostly product types (XPS, mineral wool, OSB, gypsum,
    etc.), not vendor-keyed.
  - The picker (US-ENV-7) already groups by category and
    supports search across `name` + `category` — sufficient
    for the catalog sizes we expect.
  - Manufacturer is rarely the salient axis for *materials*
    (unlike windows, where projects commonly commit to a
    single manufacturer's product line for the whole job).

  Re-evaluation trigger: if BLDGTYP's catalog crosses
  ~150–200 materials, revisit in v1.1+. The replacement design
  would mirror US-WIN-8 — a project-document
  `body.tables.material_filters` table that versions with the
  project — so adding it later is a clean additive change with
  no migration of existing project documents.

### Other open questions (UX-shaping; can be resolved per-sub-story)

- **Q-ENV-7: Envelope tab structure — sub-tabs or flat?** V1 has
  4 sub-tabs (Assemblies / Materials / Airtightness / Site
  Photos; V1 ref §3.1). V2 PRD §11.1 says only "Envelope —
  assemblies." **Lean: keep V1's sub-tab structure for feature
  parity** — Assemblies (the canvas), Specifications (renamed
  from V1's misleadingly-named "Materials" — V1 ref §13.16;
  feature parity, clearer name), Airtightness, Site Photos.
  Walked under US-ENV-1. Confirm.

- **Q-ENV-8: V1 "Materials" sub-tab rename.** V1's tab labeled
  "Materials" is actually a per-segment design-spec / photo /
  datasheet view — V1 ref §13.16 calls out the misleading
  naming. **Lean: rename to "Specifications"** in V2 (matches
  the per-row "Design Spec. Complete / Missing / Question / N/A"
  status, and clearly distinguishes from the global Materials
  catalog reachable via the header "Catalogs ▾" dropdown). Page
  heading text inside the tab can stay "Project Materials" if
  Ed prefers visual continuity. Confirm.

- **Q-ENV-9: Per-assembly deep-link URL.** Resolved 2026-05-10:
  **`/projects/{project_id}/envelope/assemblies` lists** and
  **`/projects/{project_id}/envelope/assemblies/{assembly_id}`
  opens a specific assembly.** Mirrors Q-WIN-5 (per-window-type
  URL). V1's active assembly was React-state-only — refresh
  dropped you to "first assembly," and links couldn't be shared.
  V2 syncs `selectedAssemblyId` ↔ URL ↔ store. Edge case:
  deleting the active assembly redirects to the first remaining
  assembly (or the envelope tab's empty state if none remain).

- **Q-ENV-10: Layer add behavior — V1's hidden "+ Above" /
  "+ Below" hover buttons (V1 ref §9.2) or V2-style edge-add
  hover zones (US-WIN-2 criterion 3)?** Resolved 2026-05-10:
  **(a) match V1.** Small `+` circle buttons revealed on hover
  at each layer's top and bottom edges, magenta `#b2087c`. Same
  pattern for segments (`+ Add Segment Left / Right` on segment
  edges). Rationale: V1's pattern is well-trodden by Ed and
  John, and the envelope canvas has lower layer/segment counts
  than the windows grid (where hot-zone bands earn their
  complexity by supporting "add anywhere along this edge"). The
  small visual inconsistency between Windows (edge hot zones)
  and Envelope (hover circles) is acceptable — the surfaces are
  visually distinct enough not to confuse users.

- **Q-ENV-11: HBJSON construction action — where does it live,
  and is import in scope?** Resolved 2026-05-10 with a scope
  reduction:
  - **Import is dropped from V2 v1.** HBJSON construction
    import is removed from MVP. HBJSON is **viewer-only** in
    V2 — the Model tab (US-Viewer) consumes uploaded HBJSON
    for visualization but never writes back into the builder
    or tables. PHN is the authoritative source for envelope
    data; Rhino / Honeybee consume PHN data downstream and
    produce HBJSON as output. The same one-direction logic
    that applies to rooms (US-EQ-2) applies to assemblies.
    Captured in PRD §3 non-goals.
  - **Export only**, surfaced under the project header
    `⋯ → Download constructions (HBJSON)`. Mirrors Q-WIN-8
    placement (windows-side HBJSON download). Per-version —
    each download is a snapshot of the active version's body.
  - Detail in US-ENV-12.

### Sub-story sequence

| Sub-story | Topic | Status |
|---|---|---|
| US-ENV-1 | Envelope tab structure (sub-tabs) | Draft |
| US-ENV-2 | Assembly list (sidebar) — add / rename / duplicate / delete | Draft |
| US-ENV-3 | Assembly header (name, totals, header actions) | Draft |
| US-ENV-4 | Canvas — layers, segments, orientation labels, legend | Draft |
| US-ENV-5 | Layer ops — add / edit thickness / delete | Draft |
| US-ENV-6 | Segment ops — add / edit properties / delete | Draft |
| US-ENV-7 | Pick material — bookshelf flow from the catalog | Draft (key V2 shift) |
| US-ENV-8 | Orientation — flip orientation, flip layers | Draft |
| US-ENV-9 | Copy / paste material assignments | Draft |
| US-ENV-10 | Effective R-value / U-value display | Draft |
| US-ENV-11 | Refresh-from-catalog (per-segment material) | Draft (new in V2) |
| US-ENV-12 | HBJSON construction **export** (download only — import not in V2 v1) | Draft |
| US-ENV-13 | Specifications sub-tab (per-segment status, photos, datasheets) | Draft |
| US-ENV-14 | Airtightness sub-tab | Placeholder (out of cluster scope) |
| US-ENV-15 | Site Photos sub-tab — contractor-facing regrouped view of US-ENV-13 photo data | Draft |

---

## US-ENV-1 — Envelope tab structure

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.1 (Envelope tab)
**V1 ref:** §3.1 (envelope-data sub-tabs)

### Story
> As an editor, I want the Envelope tab grouped into sub-tabs that
> match the way I work — composing assemblies, tracking per-segment
> design specifications, recording blower-door results, and managing
> required site photos — so each task lives in a focused surface
> without crowding a single page.

### Acceptance criteria

1. **Envelope tab has four sub-tabs**, in this order:
   - **Assemblies** (default landing)
   - **Specifications**
   - **Airtightness**
   - **Site Photos**
2. **URLs.** Each sub-tab updates the URL:
   - `/projects/{id}/envelope/assemblies`
   - `/projects/{id}/envelope/specifications`
   - `/projects/{id}/envelope/airtightness`
   - `/projects/{id}/envelope/site-photos`
   The bare `/projects/{id}/envelope` redirects to
   `/envelope/assemblies` (V1 parity, V1 ref §3.1).
3. **Per-assembly deep link** (Q-ENV-9 lean): when an assembly is
   selected, the URL extends to
   `/projects/{id}/envelope/assemblies/{assembly_id}`. Direct
   visits restore the active assembly. Browser back / forward
   work.
4. **Sub-tab styling** mirrors the project tab bar (UI/UX §2.4):
   active-state underline + light fill, inactive grey. Sticky on
   vertical scroll along with the project header.
5. **Tab content is independently scrollable** — switching tabs
   does not reload the project document; it only swaps the inner
   view.
6. **Locked-version banner** (US-3.1 cross-cutting) renders above
   all four sub-tabs when the active version is locked. Banner
   does not duplicate per-sub-tab.
7. **No "Materials" sub-tab.** Per Q-ENV-8, V1's misleadingly-
   named "Materials" sub-tab is renamed to **Specifications** in
   V2 to disambiguate from the global Materials catalog (header
   "Catalogs ▾" dropdown, US-2). The page heading inside the tab
   stays **"Project Materials"** for visual continuity with V1.

### Open questions
None — resolved by Q-ENV-7 / Q-ENV-8 above.

---

## US-ENV-2 — Assembly list (sidebar)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.assemblies[]`), §11.1 (Envelope tab),
§8 (draft + Save flow)
**V1 ref:** §8 (Sidebar), §6.2 (AssemblyProvider)

### Story
> As an editor, I want a left-rail list of every assembly in this
> project version, with quick-access actions to add, rename,
> duplicate, and delete an assembly, so I can navigate and
> reorganize my envelope set without leaving the canvas.

### Acceptance criteria

1. **Layout.** The Assemblies sub-tab is split:
   - Left sidebar (≈260 px wide; collapsible to a 0-px rail with a
     chevron toggle), default state **closed** for first-time
     visits to a project (mirroring V1 ref §3.3, §8).
   - Right main area = Assembly header + canvas + legend for the
     active assembly (US-ENV-3..10).
2. **List source.** Renders `body.tables.assemblies[]` from the
   currently-open version's draft body (or saved body if no draft).
3. **Sort order.** `naturalSortCompare` ascending by `name`. So
   `WALL-C2`, `WALL-C10`, `WALL-SE-30a`, `WALL-SE-80`. Matches V1
   (V1 ref §8.1).
4. **Each row shows name only** — no thumbnail, no R-value, no
   layer count, no thickness (matches V1; perf-friendly). Active
   assembly is highlighted.
5. **Click a row → set active.** The clicked assembly becomes the
   editing target in the main area. Selection state is reflected
   in the URL per Q-ENV-9 (`/envelope/assemblies/{assembly_id}`).
   Switching active assembly **clears copy/paste state** (US-ENV-9
   cross-cutting; V1 ref §6.3).
6. **Hover-revealed row actions** (logged-in editor on an unlocked
   version only):
   - **Edit name** — opens the rename dialog (criterion 9).
   - **Duplicate** — clones the assembly (criterion 10).
   - **Delete** — confirms and removes (criterion 11).
   On a **locked** version, action icons are hidden entirely (the
   tab is read-only per US-3.1 cross-cutting). On a public view
   link, icons are also hidden.
7. **Add button.** Sticky at the top of the sidebar:
   `+ Add new assembly`. Disabled on locked versions and public
   anonymous viewers. Clicking creates a new assembly (criterion 8) and
   sets it as active.
8. **Add new assembly.** Creates the following object in the draft
   body:
   ```jsonc
   {
     "id": "asm_<ULID>",
     "name": "<auto-named per criterion 8a>",
     "orientation": "first_layer_outside",
     "layers": [
       {
         "id": "lyr_<ULID>",
         "order": 0,
         "thickness_mm": 50.0,
         "segments": [
           {
             "id": "seg_<ULID>",
             "order": 0,
             "width_mm": 812.8,
             "steel_stud_spacing_mm": null,
             "is_continuous_insulation": false,
             "photo_asset_ids": [],
             "project_material_id": null      // null per Q-ENV-3 — pick required before submit
           }
         ]
       }
     ]
   }
   ```
   Newly added assembly becomes active. Default values match V1
   (V1 ref §2.1, §2.2, §2.3) except for `project_material_id:
   null` per Q-ENV-3, and the `project_materials` indirection per
   Q-ENV-2. **Note:** `specification_status`, `notes`, and
   `datasheet_asset_ids` are **not** on segments in V2 — they live
   on the `project_materials` row referenced by
   `project_material_id` (Q-ENV-2 model).

   **8a. Auto-named to satisfy uniqueness (per criterion 9a).**
   Default name is **"Unnamed Assembly"** (matches V1 ref §2.1).
   If an assembly with that name already exists in the active
   version's `tables.assemblies`, suffix ` (2)`, ` (3)`, …, is
   appended. Same case-insensitive trimmed comparison as
   criterion 9a.

9. **Rename dialog.**
   - Modal title: **"Assembly Name"**.
   - Single text field labelled **"Assembly Name"**, autofocus,
     full-select on focus.
   - Submit on **Enter**.
   - **Save** button disabled while:
     - the field is empty / whitespace, OR
     - the trimmed value equals the current name (no-op), OR
     - the trimmed value collides with another assembly's name
       per criterion 9a, OR
     - the trimmed value exceeds 100 characters (V1 ref §2.1).
   - **Cancel** / **Save** buttons (Cancel is the default action
     on Esc).
   - On Save, applies a JSON-Patch `replace` op to
     `tables.assemblies[<idx>].name` in the draft body.

   **9a. Uniqueness rule.** Assembly names must be unique within
   a project version. Comparison is **trim + case-insensitive**.
   Display preserves the user's original casing. Mirrors
   US-WIN-1 criterion 9a.

10. **Duplicate.**
    - Deep-copies the active assembly into a new entry. New `id`s
      are generated for the assembly, every layer, and every
      segment.
    - **`project_material_id` references are preserved** — every
      duplicated segment points to the same `project_materials`
      rows as its source. This is the deliberate behavior given
      Q-ENV-2: the duplicate uses the same products, so it shares
      the same datasheets, spec-status, notes, and refresh-state.
      No new `project_materials` rows are created.
    - **Site photos are NOT duplicated** — they're segment-scoped
      and document a specific installation slot; copying them
      would misrepresent the new assembly's site. Each new
      segment's `photo_asset_ids` starts empty.
    - The duplicated assembly becomes active.
    - Default new name = `"<source name> (Copy)"`, with auto-
      suffix on collision. Matches V1 ref §5.1.
    - Surfaced as a Sonner toast: **"Duplicated as
      '<new name>'"**.

11. **Delete.**
    - shadcn `Dialog` confirm (not `window.confirm`):
      title **"Delete assembly?"**, body **"This will remove
      '<name>' and all its layers, segments, and per-segment site
      photos from this version. Project-level material datasheets
      and spec-status are preserved (visible as 'Unused' in the
      Specifications view if no other assembly uses the material).
      Save or Save As to persist. Cancel keeps it in your draft."**,
      buttons **Cancel** / **Delete** (delete is destructive
      variant).
    - On confirm, removes the entry from the draft.
    - **`project_materials` rows are NOT auto-deleted** per
      Q-ENV-2 rule 5 — they survive as orphans and surface in the
      Specifications view as "Unused" so the user can decide
      whether to keep the datasheet record or delete explicitly.
    - If the deleted assembly was active, the next assembly in
      sort order becomes active; if the list is empty, the main
      area shows the empty state (criterion 12).
    - **No `window.confirm`. No name retyping** (deletion is
      reversible by Discard-changes or by not-Saving).
12. **Empty list state.** When `tables.assemblies` is empty, the
    sidebar shows only the **+ Add new assembly** button; the main
    area shows: "No assemblies yet. **[+ Add assembly]**" centered.
13. **Locked-version + anonymous-viewer rendering.** All edit affordances
    hidden. List is still navigable read-only.
14. **All mutations go through the draft buffer** (PRD §8.3). Save
    status indicator in the project header bar (UI/UX §2.4)
    reflects dirty state.

### Resolved questions
None outstanding for V1 parity. Drag-reorder of the sidebar is
deferred (matches V1 — no reorder; alphabetical only).

### Open questions
None — defaults track US-WIN-1's resolved patterns.

---

## US-ENV-3 — Assembly header (name, totals, header actions)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §3.3 (header composition), §11.1
(TotalThicknessLabel), §11.2 (EffectiveRValueLabel),
§11.3 (useAssemblyHeaderButtons)

### Story
> As an editor, the active assembly's content area gives me at a
> glance: which assembly I'm editing, its total thickness, its
> effective R-/U-value, and one-click access to the per-version
> actions I need (flip, copy/paste, undo, HBJSON in/out).

### Acceptance criteria

1. **Header strip** sits above the canvas. Layout:
   - **Left:** "Assembly Details" heading + assembly name picker
     (V1 ref §3.3 `AssemblySelector` — shadcn `Combobox` /
     `Select`; replaces V1's MUI `Autocomplete`). Picker shows
     all assemblies in the active version's body, sorted by
     `naturalSortCompare`.
   - **Center / right:**
     - **Total Thickness** label — sum of layer
       `thickness_mm`. Live (reflects in-flight layer-thickness
       overrides per V1 ref §6.2 `layerThicknessOverridesMm`).
     - **Effective R-Value** (IP) or **U-Value** (SI) label —
       backend-computed; refetches on draft layer/segment
       changes (debounced ~500 ms).
   - **Right:**
     - **Canvas zoom cluster** (V2 NEW per Q-ENV-4.1):
       `[−] 100% [+] [Fit]`. Steps through `0.25 / 0.5 / 0.75 /
       1.0 / 1.5 / 2.0`. Persisted in
       `userPreferencesStore.envelope_canvas_zoom`. `Fit` snaps
       to the largest discrete step that fits both axes inside
       the canvas viewport. Always visible (even on locked
       versions and anonymous viewers — zoom is a viewing aid).
     - **Assembly Toolbar** (V1 ref §11.4): Flip-Orientation,
       Flip-Layers, Copy/Paste-Material entry, Undo-last-paste.
     - **`⋯` row-action overflow menu** for assembly-scoped
       actions: Rename, Duplicate, Delete (mirrors sidebar row
       actions; redundant for keyboard / accessibility).
2. **Total Thickness label** (V1 ref §11.1 parity):
   - SI: `"Total Thickness: 304.8 mm"` (3 decimals).
   - IP: `"Total Thickness: 12.0 in"` (1 decimal).
   - Tooltip: `"Sum of all layer thicknesses"`.
   - Renders `--` when no assembly selected.
   - `min-width: 160 px` to prevent layout shift.
3. **Effective R-Value / U-Value label** (V1 ref §11.2 parity;
   detail in US-ENV-10):
   - IP: `"Effective R-Value: 23.4"` (1 decimal,
     hr·ft²·F/BTU).
   - SI: `"Effective U-Value: 0.243 W/m²K"` (3 decimals).
   - Info icon (`InfoOutlined`) → tooltip with the ASHRAE
     CH27 PH-average explanation plus the **"surface films
     NOT included"** note (per Q-ENV-4 resolved 2026-05-10;
     full tooltip text in US-ENV-10 criterion 3).
   - Renders `--` while loading or if `is_valid=false`.
   - `min-width: 200 px` (per US-ENV-10 criterion 5).
4. **Assembly Toolbar** buttons disabled when no assembly
   selected, when in pick/paste mode for the unrelated buttons,
   when `undoStack.length === 0` for the Undo button (V1 ref
   §11.4 parity). Detail in US-ENV-8 / US-ENV-9.
5. **HBJSON in/out actions are NOT in this header.** Per Q-ENV-11
   lean, they live in the project header `⋯` menu (US-ENV-12).
   This is a deliberate divergence from V1 ref §11.3 (which has
   them in the assemblies-tab overflow menu).
6. **No "Refresh Materials from AirTable" button.** V2 has no
   AirTable surface; the catalog manager is reached via the
   global header "Catalogs ▾" dropdown (US-2). The "drift from
   catalog" feedback flows through the per-segment refresh
   workflow (US-ENV-11) and a per-tab summary banner (US-ENV-11
   surface 2).
7. **Locked-version + anonymous-viewer rendering.** Header reads as a
   read-only label strip (assembly picker still works to switch
   the viewed assembly; toolbar buttons hidden; `⋯` menu shows
   only Duplicate as an action that creates editable state in
   a NEW version).

### Resolved questions (2026-05-10)
- **Q-ENV-3.1: Should the assembly picker live in the header at
  all, given the sidebar already lists assemblies? Resolved: keep
  both.** V1 has both (V1 ref §3.3 `AssemblySelector` + sidebar);
  V2 retains both. Both bind to the same `selectedAssemblyId`
  state. Rationale:
  - **Sidebar** (US-ENV-2): full vertical scan; best for picking
    by glance when you don't remember the exact name; visual
    roster of "what assemblies exist."
  - **Header dropdown** (this story, US-ENV-3): fast keyboard /
    name-based jumps; doesn't require a glance shift to the left
    rail.
  - **Sidebar is collapsible** (US-ENV-2 criterion: 260 px → 0 px
    chevron toggle). When the sidebar is collapsed for screen
    real-estate, the header dropdown becomes the *only* assembly
    switch on screen — making the redundancy load-bearing, not
    decorative.
  Both surfaces must stay in sync on add / rename / duplicate /
  delete (same store; both subscribe).

### Open questions
None outstanding.

---

## US-ENV-4 — Canvas (layers, segments, orientation labels, legend)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §9.1 (canvas container), §9.2 (Layer rendering),
§9.3 (Segment rendering), §9.5 (AssemblyLegend), §13.4
(orientation enum)

### Story
> As an editor, I want the active assembly drawn as a
> proportional cross-section: layers stacked top-to-bottom with
> visual height = thickness in mm, each layer filled with one or
> more side-by-side colored rectangles whose colors come from the
> material catalog, with "interior" and "exterior" labels at the
> top and bottom matching the orientation enum, and a legend
> below summarizing the materials in use.

### Acceptance criteria

1. **Container layout** (V1 ref §9.1 parity):
   - Top label: `"interior"` or `"exterior"` per orientation
     (`first_layer_outside` → top = "exterior";
     `last_layer_outside` → top = "interior").
   - Vertical layer stack — `<Layer>` components in
     `assembly.layers` array order, index 0 at top.
   - Bottom label: companion orientation label.
   - **Below the canvas:** `<AssemblyLegend>` (criterion 6).
2. **Per-layer rendering** (V1 ref §9.2 parity, with V2
   aspect-ratio fix per Q-ENV-4.1):
   - **Left column** (35 px fixed, font-size 8 px, dashed right
     border): renders the layer's thickness in the user's active
     display unit (mm or in). Click → opens
     `LayerHeightModal` (US-ENV-5). Hover → bold text +
     highlight background. **+ Add Layer Above** and **+ Add
     Layer Below** circular `+` buttons revealed on hover at the
     top and bottom edges (per Q-ENV-10 lean (a) — match V1's
     magenta `#b2087c` style; logged-in unlocked-version only).
   - **Right column** (`flex-row`, no `flex-grow`): height in
     CSS px = `layer.thickness_mm * canvasZoom` (per criterion
     9). Children: `<Segment>` per `layer.segments`, side-by-side
     with `flex-shrink: 0` so they NEVER compress horizontally.
     This is a V2 bug-fix vs V1's flex-grow behavior, which
     squished segments on narrow viewports (Q-ENV-4.1).
   - When the sum of segment widths × `canvasZoom` exceeds the
     canvas viewport width, the **canvas scrolls horizontally**
     rather than compressing segments. Aspect ratio is locked.
   - Border treatment: dashed `#ccc` between layers; first-of-
     type also has a dashed top border. Match V1 ref §9.2.
3. **Per-segment rendering** (V1 ref §9.3 parity, with V2
   null-material affordance per Q-ENV-3):
   - Inline SVG with a `<rect>` whose `fill` is computed from
     the resolved `project_materials[*].argb_color` (parsing
     the `"(a, r, g, b)"` string to a CSS `rgba(...)`).
   - **Null-material segment** (`project_material_id` is null —
     Q-ENV-3 initial state): rendered with **blank fill** (no
     color; transparent or theme-default) and a **dashed
     `#999` 1.5 px outline** instead of a solid border. This
     visually flags "no material picked yet" so the user
     understands why the R-value label reads "unfinished" (per
     US-ENV-10). Hover styles still apply (highlighted fill +
     stroke); click still opens the picker.
   - Width: `width: ${segment.width_mm * canvasZoom}px` with
     `flex-shrink: 0`. Aspect ratio locked: both axes scale by
     the same `canvasZoom` factor (criterion 9). Replaces V1's
     `maxWidth + flex-grow` pattern, which squished on narrow
     viewports.
   - Hover styles (material picked): highlighted fill + 3 px
     solid stroke (CSS vars
     `--construction-layer-segment-hover-fill` and `-stroke`).
   - Click → opens the Segment-Properties modal (US-ENV-6). In
     pick / paste mode (US-ENV-9), click drives the copy/paste
     state machine instead.
   - **+ Add Segment Left** and **+ Add Segment Right** circular
     `+` buttons revealed on hover at left / right edges
     (logged-in unlocked-version only; hidden in pick/paste).
4. **Orientation label rendering** (V1 ref §13.4): top / bottom
   text labels reflect the assembly's `orientation` enum. The
   labels are read-only here; flipping is done from the toolbar
   (US-ENV-8).
5. **Hover-button visibility** is gated by:
   - Logged-in editor.
   - Unlocked active version.
   - Not in pick / paste mode.
   (For anonymous viewers, the gate fails on "logged-in editor"
   alone — hover-`+` buttons stay hidden.)
6. **Assembly Legend** (V1 ref §9.5 parity):
   - Below the canvas, listing each unique material used in the
     active assembly's segments.
   - Sorted alphabetically by material name.
   - Each row: color swatch + material name + resistivity (IP)
     OR conductivity (SI) per the active unit system.
   - **In V1 the legend is always SI conductivity** (V1 ref
     §9.5); this is a small bug — the rest of the app respects
     the IP/SI toggle. **V2 fixes:** legend renders in the
     active unit system (resistivity in IP, conductivity in
     SI). Mirrors V1→V2 fix #4 in the parent's Key Shifts list.
   - Read-only; clicking does nothing in MVP.
7. **Loading state.** Canvas renders nothing (or a quiet
   skeleton) when the active assembly is in flight or null.
8. **Locked-version rendering.** Canvas remains visually
   identical; hover buttons are hidden; modals are read-only
   (US-ENV-5 / US-ENV-6 cross-cutting).
9. **Canvas zoom + locked aspect ratio** (V2 NEW per Q-ENV-4.1):
   - Single scale state: `canvasZoom: number`. Default `1.0`
     (matches V1's 1:1 baseline). Persisted as a **per-user
     preference** in
     `userPreferencesStore.envelope_canvas_zoom`. NOT
     per-document, NOT per-project.
   - Both axes always scale together by the same factor:
     `segment_render_width_px = segment.width_mm * canvasZoom`
     and `layer_render_height_px = layer.thickness_mm *
     canvasZoom`. Aspect ratio is **never** independent — fixes
     V1's narrow-viewport squish.
   - Discrete zoom steps:
     `0.25 / 0.5 / 0.75 / 1.0 / 1.5 / 2.0`. Avoids fractional
     pixel jitter and gives `+/−` predictable behavior.
   - Zoom UI lives in the **assembly header** (US-ENV-3) as a
     compact cluster: `[−] 100% [+] [Fit]`.
     - `[−]` / `[+]` step through the discrete list, clamped at
       ends.
     - Numeric label is the current `canvasZoom` formatted as
       `Math.round(zoom * 100) + '%'` (read-only label in v1;
       direct-edit deferred).
     - `Fit` computes the largest discrete step that fits both
       `total_segment_width_mm` and `total_thickness_mm` inside
       the canvas viewport. Snaps to a known step so subsequent
       `+ / −` work predictably.
   - Cmd/Ctrl + scroll-wheel zoom: deferred to v1.1+ (testing
     overhead; discrete buttons cover the core need).
   - Horizontal overflow: when scaled assembly width >
     viewport, canvas scrolls horizontally. No compression.
   - Vertical overflow: page-level scroll (existing behavior).
  — **two changes vs V1, both shipping in V2 v1**:

  1. **Lock aspect ratio (bug fix vs V1).** V1's segment row
     uses `flex-grow flex-row` with `maxWidth: ${width_mm}px` per
     segment — when the available canvas width is less than the
     sum of segment widths, segments get **horizontally
     compressed** while layers keep their full 1:1 vertical
     scale. Result: studs and segments render visibly squished
     on narrow screens (Ed has hit this on real projects). V2
     fixes this by **rendering both axes at the same scale
     factor at all times** — no horizontal flex-compression.
     When the assembly is wider than the viewport, the canvas
     overflows into a **horizontal scroll container** instead of
     squishing.

  2. **Explicit zoom control (V2 NEW).** A user-driven zoom is
     part of V2 v1, not a v1.1+ deferred feature. Captured as
     US-ENV-4 criterion 9 (canvas zoom).

  **Implementation contract:**
  - Single scale state: `canvasZoom: number` (default `1.0` =
    V1's 1:1 baseline). Persisted as a **per-user preference**
    (same pattern as the unit-system toggle), not per-project,
    not per-document. Lives in
    `userPreferencesStore.envelope_canvas_zoom`.
  - Rendering math: `segment_render_width_px =
    segment.width_mm * canvasZoom`; `layer_render_height_px =
    layer.thickness_mm * canvasZoom`. Both axes always use the
    same factor — never independent.
  - Segment row CSS: `flex-shrink: 0` on each segment (no
    horizontal compression); the layer's row container scrolls
    horizontally when total width > viewport.
  - Zoom UI lives in the assembly header (US-ENV-3), as a
    discrete-step cluster: `[−] 100% [+] [Fit]`. Steps:
    `0.25 / 0.5 / 0.75 / 1.0 / 1.5 / 2.0` (zoom-in still
    valuable for inspecting thin layers like 6 mm air gaps).
    `Fit` computes
    `min(viewport_w / total_segment_width_mm,
         viewport_h / total_thickness_mm)`
    and snaps to the nearest discrete step (so `Fit` always
    leaves you at a known scale you can iterate from with `+ /
    −`).
  - Cmd/Ctrl + scroll wheel on the canvas optionally bumps zoom
    by one step (deferred to v1.1+ if it complicates testing).

  **Why per-user not per-document:** zoom is viewing
  ergonomics, not data. A user who likes 50% gets it across all
  projects; the document is unchanged.

---

## US-ENV-5 — Layer operations (add, edit thickness, delete)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §9.2 (add/delete flows), §10.2 (LayerHeightModal),
§13.3 (last-layer rule)

### Story
> As an editor, I want to add layers above or below any layer,
> edit a layer's thickness with full unit-parsing support, and
> delete a layer when needed, so I can compose any envelope
> stack-up.

### Acceptance criteria

1. **Add layer** — two paths (matches V1 ref §9.2):
   - Hover **+ Add Layer Above** or **+ Add Layer Below** on the
     thickness column of any existing layer.
   - On click: insert a new layer at the appropriate position.
     New layer:
     - `id: lyr_<ULID>`
     - `thickness_mm: 50.0` (V1 default; V1 ref §2.2)
     - one default segment per criterion 1a.
   - The order index of every existing layer at or after the
     insertion point shifts by +1. Implementation = single
     JSON-Patch `replace` on `tables.assemblies[<idx>].layers`.

   **1a. Default segment on new layer** (per Q-ENV-3 resolution
   — last-used material inheritance):
   ```jsonc
   {
     "id": "seg_<ULID>",
     "order": 0,
     "width_mm": 812.8,
     "steel_stud_spacing_mm": null,
     "is_continuous_insulation": false,
     "photo_asset_ids": [],
     "project_material_id": "<assembly's last-picked, or null>"
   }
   ```
   - `project_material_id` is read from the envelope-builder
     Zustand store: `lastPickedMaterialByAssembly[<assembly.id>]`.
   - If no material has been picked yet in the active assembly
     (brand-new assembly, or no segment has gone through the
     picker), the value is `null`. The new segment renders with
     the dashed-outline / blank-fill state per US-ENV-4
     criterion 3, and the R-value label flags "unfinished" per
     US-ENV-10.
   - The store entry updates whenever a user picks a material
     for any segment in this assembly via the US-ENV-7 picker.
   - Per Q-ENV-2 (project_materials indirection) + Q-ENV-3
     (last-used inheritance with null fallback).
2. **Edit thickness** (V1 ref §10.2 parity):
   - Click the thickness label → opens **LayerHeightModal**.
   - Single field labeled `"Layer Height [mm]"` or `"[in]"` per
     active unit system. `step="any"` so decimals allowed.
     Default value = current thickness in the active unit; on
     focus, full-select.
   - Tooltip on the input: a per-unit cheat sheet matching V1's
     `parse_input` (PH-units library) acceptance — e.g. for IP
     mode: **"Tip: Use 2.5 in, 2-1/2", or 50 mm"**.
   - Submit on **Enter** or **Save** button. Validates:
     - parses through the units utility (TS port; see Q-UNITS-2),
     - converts to mm,
     - must be `> 0` (V1 ref §2.2 / §5.2).
   - On Save, applies a JSON-Patch `replace` on
     `tables.assemblies[a].layers[l].thickness_mm` and triggers
     R-value refetch (US-ENV-10).
   - **Cancel** restores original value.
3. **Delete layer** (from inside the LayerHeightModal, V1 ref
   §10.2 parity):
   - Red full-width **"Delete Layer"** button at the bottom of
     the modal.
   - **Last-layer guard (Q-ENV-5.1):** if the assembly has only
     one layer, the Delete button is **disabled** with tooltip
     **"An assembly must have at least one layer."** UI-level
     lock matching the US-WIN-2 criterion-7 pattern (V2 fix for
     V1's server-side `LastLayerAssemblyException` + alert
     pattern, V1 ref §13.3).
   - On click of an enabled Delete: shadcn `Dialog` confirm —
     title **"Delete layer?"**, body **"This will remove the
     layer and all its segments, photos, and datasheets from
     this version. Save or Save As to persist."**, buttons
     **Cancel** / **Delete** (destructive variant).
   - On confirm: remove the layer; shift `order` of subsequent
     layers down by 1; trigger R-value refetch.
4. **Read-only on locked versions / for anonymous viewers.** Modal opens
   in read-only mode (input disabled; Delete hidden).
5. **All mutations flow through the draft buffer.**

### Resolved questions (2026-05-10)

- **Q-ENV-5.1: Last-layer guard — UI lock or backend exception?**
  **Resolved:** UI lock at the Delete button level (criterion
  3). Mirrors US-WIN-2 criterion 7's pattern.

### Open questions
None — V1 parity covered.

---

## US-ENV-6 — Segment operations (add, edit properties, delete)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §9.3 (add/delete flows), §10.3
(SegmentPropertiesModal), §13.3 (last-segment rule)

### Story
> As an editor, I want to add segments left or right of any
> segment, edit a segment's properties (material, width,
> continuous-insulation flag, steel-stud cavity flag and
> spacing), and delete a segment when needed, so I can compose
> heterogeneous layers (steel-stud cavities, hybrid wall
> sections) — and so I can mark each segment's design-spec
> readiness.

### Acceptance criteria

1. **Add segment** — two paths (matches V1 ref §9.3):
   - Hover **+ Add Segment Left** or **+ Add Segment Right** on
     a segment.
   - On click: insert a new segment at the appropriate position.
     **`project_material_id` resolution** (per Q-ENV-3
     resolution):
     1. **Primary** — the source (adjacent) segment's
        `project_material_id` if non-null. The new segment
        references the same `project_materials` row → shares
        datasheet, spec-status, notes. This matches V1's
        "inherit material only on add" parity.
     2. **Fallback** — if the source segment is itself null,
        use the assembly's last-picked material from the
        Zustand store
        (`lastPickedMaterialByAssembly[<assembly.id>]`).
     3. **Final fallback** — if both are null (e.g. brand-new
        assembly with nothing picked yet), the new segment is
        also `null`. Renders dashed-outline per US-ENV-4
        criterion 3.
     Other defaults:
     - `width_mm: 50.0` (V1 default; V1 ref §9.3)
     - `steel_stud_spacing_mm: null`
     - `is_continuous_insulation: false`
     - `photo_asset_ids: []`
   - Order index of every segment at or after the insertion
     point shifts by +1.
   - Rationale: source-segment-wins is the V1 parity behavior
     and matches the typical "split a layer into a hybrid"
     intent. The last-picked fallback handles the
     starting-from-empty case (a new assembly where the user
     has picked something for layer 1 segment 1 and is now
     building outward) so they don't get null segments
     spawning off null neighbors.

2. **Edit properties — SegmentPropertiesModal** (V1 ref §10.3
   parity, restructured per Q-ENV-2):
   - Trigger: click the segment (when not in pick/paste mode).
   - Modal title: `"Segment: {project_material.name}"` —
     resolved through the segment's `project_material_id`;
     updates live as the material picker changes.
   - Fields, top to bottom:
     1. **Material picker** — bookshelf flow (US-ENV-7).
        Resolves to a `project_material_id` (de-dupes by
        catalog_record_id per Q-ENV-2 rule 1). Shadcn
        `Combobox`/`Command` primitive. Grouped by category;
        search matches `name`, `category`. Empty-state
        replacement for V1's `NoMaterialsException`
        (V1 ref §13.8): "No materials in the catalog yet —
        [Open catalog manager]".
     2. **"Shared with" indicator** (NEW v.s. V1) — small
        meta line directly below the picker:
        - `"Shared with 3 other segments in this project"`
          (when project_material is referenced by ≥2 segments).
        - `"Used in this segment only"` (when only one
          reference).
        Hover: tooltip lists the other use-sites
        ("WALL-C3 · Layer 2 · seg 1; FLOOR-FC3R · Layer 3 ·
        seg 1"). This makes the project-materials sharing
        explicit so the user understands edits propagate.
     3. **Material Data** read-only block — Name, Category,
        Conductivity (SI: W/(m·K)) **OR Resistivity (IP:
        R-value/in)**, Density, Specific Heat, Emissivity.
        Values come from the resolved `project_materials` row.
        Each value renders `--` if null. **V2 respects active
        unit system** (V1 ref §10.3 already did this in the
        Assemblies-tab modal; V1 *Materials*-tab DetailsModal
        was hard-coded SI per V1 ref §12.8 — also fixed in V2
        US-ENV-13).
     4. **"Edit material values" expander** — when expanded,
        the read-only block becomes editable; saving the modal
        edits the `project_materials` row directly. **Banner
        inside the expander when shared:** *"Editing applies to
        all 4 segments using this material. To override values
        for this segment only, [Detach to a new material]."*
        — the Detach link creates a hand-entered
        `project_materials` row clone and re-points the segment
        to it. (Q-ENV-7.3 — see open questions.)
     5. **Segment Width** — number input with unit-aware
        parsing. `"Segment Width [mm]"` / `"[in]"` per active
        unit system. `step="any"`. Validates `> 0` (V1 ref §2.3).
     6. **Continuous Insulation** checkbox — `"Continuous
        Insulation (for steel-stud assemblies)"`. **Per-segment**
        flag (NOT moved to project_materials; this describes
        *how this segment functions in this layer*, not a
        product property).
     7. **Steel Stud Cavity** checkbox — `"Steel Stud Cavity"`.
        Per-segment. When checked, reveals **Steel Stud Spacing**
        field below.
     8. **Steel Stud Spacing** (conditional) — number input,
        unit-aware. Default if currently null: `406.4 mm`
        (≈ 16", V1 default).
   - **Specification Status, datasheets, notes are NOT in this
     modal in V2.** They live on the `project_materials` row
     and are edited from the Specifications sub-tab (US-ENV-13).
     A small **"Open material in Specifications →"** link at
     the bottom of the modal jumps to the row in the
     Specifications view scrolled-into-view + briefly
     highlighted. (Replaces the V1 pattern of editing spec /
     notes inline per-segment in V1 ref §10.3 / §12.8 — the V2
     restructure consolidates these to the material primary.)
   - Buttons: **Cancel** (restore original values) / **Save**
     (one atomic JSON-Patch — replaces V1's 4-PATCH-then-Save
     chatter and partial-failure risk; V1 ref §13.14).
3. **Delete segment** (from inside SegmentPropertiesModal):
   - Red full-width **"Delete Segment"** button at the bottom.
   - **Last-segment guard:** if the layer has only one segment,
     button is disabled with tooltip **"A layer must have at
     least one segment."** UI-level lock matching US-ENV-5
     criterion 3.
   - On click of an enabled Delete: shadcn `Dialog` confirm —
     title **"Delete segment?"**, body **"This will remove the
     segment and its site photos from this version. The
     project's material record (datasheet, spec-status, notes)
     is unaffected. Save or Save As to persist."**, buttons
     **Cancel** / **Delete**.
   - On confirm: remove the segment from the layer; shift
     `order` of subsequent siblings down by 1; clear copy/paste
     state if the deleted segment was the source; trigger
     R-value refetch.
   - **`project_materials` row is preserved** even if the
     deleted segment was the last reference (per Q-ENV-2
     rule 5) — the row surfaces in the Specifications view as
     "Unused" until the user explicitly removes it there.
4. **Read-only on locked versions / for anonymous viewers.** Modal opens
   in read-only mode (inputs disabled; Delete hidden).
5. **All mutations flow through the draft buffer** as a single
   JSON-Patch (vs V1's 4-PATCH chatter; V1 ref §13.14).

### Resolved questions (2026-05-10)

- **Q-ENV-6.1: Where does the user edit specification_status —
  in this modal, in the Specifications sub-tab, or both?**
  **Resolved (revised after Q-ENV-2 restructure):** **only in
  the Specifications sub-tab.** Specification status moved to
  the `project_materials` row level per Q-ENV-2 — it's
  per-material, not per-segment, so the segment-edit modal is
  not the right place. SegmentPropertiesModal carries an
  **"Open material in Specifications →"** link to jump there
  with the right row scrolled-into-view.

### Resolved questions (2026-05-10) — additional

- **Q-ENV-6.2: "Detach to a new material" workflow (criterion
  2.4 banner).** Resolved 2026-05-10. Confirmed all four
  sub-decisions:
  (a) **Inline confirmation in-modal:** "This will create a new
      project material '<source> (Custom)' that isn't shared
      with other uses. Continue?" — no full-screen confirm, no
      auto-detach-with-undo.
  (b) **Default name** on the cloned row: `"<source> (Custom)"`;
      user can rename in the same flow before committing.
  (c) **Clone is hand-entered** — `catalog_origin: null`. The
      detached row no longer participates in refresh-from-catalog
      (US-ENV-11) since it's diverged by intent. Detach is "fork
      from catalog," not "diverge but stay tracked."
  (d) **Clone inherits** `datasheet_asset_ids` and
      `specification_status` from source. Rationale: if the user
      is detaching to tweak conductivity but the datasheet still
      applies, they shouldn't lose the QA record. They can clear
      either field manually if no longer relevant.

  Implementation notes for US-ENV-6 build:
  - Detach is the only path to per-segment material overrides
    without touching other uses; no other "edit this segment's
    material in isolation" gesture exists.
  - The cloned row is **always created fresh** (new
    `pmat_<ULID>`); we never re-use a previously-detached
    "Custom" row even if its name and conductivity match.
  - Surface a toast post-detach: "Detached. New project material
    'XPS (Custom)' created — edit it in Specifications to apply
    different values."

---

## US-ENV-7 — Pick material (bookshelf flow with project_materials de-dup)

**Status:** Draft · **Priority:** MVP — **the key V2 shift**
**PRD ref:** §7.1 (bookshelf semantics), §7.4 (refresh from
catalog), §6.2 (`catalog_origin` block; restructured per Q-ENV-2)
**V1 ref:** §10.3 (V1 Material picker — live-referenced),
§13.2 (no per-project filter), §13.16 (no first-class catalog UI
in V1)

### Story
> As an editor, when assigning a material to a segment, I want
> to browse the shared Materials catalog (grouped by category,
> sortable, searchable), see live performance data (conductivity,
> density, specific heat, emissivity), pick one, and have its
> values copied into my project's document — automatically
> de-duplicated against any prior use of the same product so my
> project's material list mirrors the actual product set, not
> the per-segment use count.

### Acceptance criteria

1. **Where the picker lives.** Inside the SegmentPropertiesModal
   (US-ENV-6 criterion 2.1). Also reachable from the
   Specifications sub-tab when re-assigning a segment to a
   different material (US-ENV-13). Combobox-style trigger; opens
   a popover with search + grouped list.

2. **Picker open behavior.**
   - Trigger: click the chip showing the current material name.
     If unset (per Q-ENV-3 lean), trigger reads
     **"Pick a material…"**.
   - Opens a popover with **two sections**, in order:
     - **"In this project"** — every existing
       `project_materials` row in the active version's body,
       sorted alphabetically. Picking from here re-points the
       segment to an existing project-material (no new row
       created).
     - **"From catalog"** — every catalog row, grouped by
       category alphabetically, then by name within each group
       via `naturalSortCompare`. Picking from here either
       re-uses an existing project_materials row matching by
       `catalog_record_id` (de-dup; criterion 4) or creates a
       new one.
   - Search input (autofocus) — matches `name`, `category`
     (case-insensitive substring) across both sections.
   - **No manufacturer filter in V2 v1** per Q-ENV-6 lean.
   - Each row shows: bold `name`, secondary line with
     conductivity / density / spec-heat (SI) or resistivity
     (IP). **Active unit system** — V2 fix vs V1 ref §12.8
     hard-coded SI. Empty values render as `--`.
   - **In-this-project rows** carry an extra meta line:
     `"Used in 3 segments"` — so the user can tell at a glance
     which products are already heavily used.
   - **Catalog rows that match an existing project_materials
     row** (by `catalog_record_id`) display with a subtle
     **"Already in this project"** tag → picking still works
     (re-points to the existing row).

3. **Project-materials de-dup rules** (Q-ENV-2 mechanism in
   action):
   - Picking a **catalog** row whose `catalog_record_id` already
     matches an existing `project_materials.catalog_origin.catalog_record_id`
     in the active version → segment's `project_material_id` is
     set to that existing row's id. **No new row.** Datasheet,
     spec-status, notes are inherited.
   - Picking a **catalog** row whose `catalog_record_id` does
     **not** match any existing `project_materials` row → a new
     `project_materials` row is created with the catalog values
     inlined + a fresh `catalog_origin` block. Segment points
     to it.
   - Picking an **existing project_materials** row from the
     "In this project" section → segment re-points; no new row.
   - **Hand-enter** (criterion 5) → always creates a new row.

4. **What lives on the project_materials row** (Q-ENV-2 model):
   ```jsonc
   {
     "id": "pmat_<ULID>",
     "name": "Walltite ECO",
     "category": "Spray Foam",
     "conductivity_w_mk": 0.034,
     "density_kg_m3": 35,
     "specific_heat_j_kgk": 1500,
     "emissivity": 0.9,
     "argb_color": "(255,220,230,240)",
     "specification_status": "na",
     "datasheet_asset_ids": [],
     "notes": null,
     "catalog_origin": {
       "catalog_table": "materials",
       "catalog_record_id": "rec123abc",
       "catalog_version_id": "rec123abc_v3",
       "synced_at": "2026-05-10T14:23:00Z"
     }
   }
   ```
   (Exact field set is the ProjectMaterial Pydantic model —
   matches V1 ref §2.4's product-data fields + V2's project-
   level QA fields, with the AirTable string `id` replaced by a
   ULID and `catalog_origin` added.)

5. **Hand-entered values.** A "+ Hand-enter…" entry at the
   bottom of the picker opens an inline mini-form (name,
   category, conductivity, density, specific-heat, emissivity).
   On Save, creates a new `project_materials` row with no
   `catalog_origin`. Segment points to it. The row gets a small
   handwritten badge in the chip — tooltip: **"Hand-entered.
   Not linked to the catalog."**

6. **After the first pick, the project owns its copy.** Editing
   the catalog row (in the catalog manager) does NOT change the
   `project_materials` row. To re-sync, run Refresh-from-catalog
   (US-ENV-11) — operates on the project_materials row, not on
   individual segments.

7. **Inline override** — editing the project_materials row's
   values affects every segment that references it. Per
   Q-ENV-2 rule 3, this is the deliberate trade-off: shared
   identity = shared values. Two paths to override:
   - **Edit values for the shared material** (default path) —
     opens the project_materials row's editor (in-modal expander
     per US-ENV-6 criterion 2.4 OR via the Specifications-tab
     inline editor in US-ENV-13). Sets `catalog_origin.diverged:
     true` so refresh-from-catalog flags it.
   - **Detach to a new material** (per Q-ENV-6.2) — for
     "I want WALL-C3 segment 1's XPS to have a different value
     from FLOOR-FC3R segment 2's XPS." Clones the
     project_materials row, re-points the current segment, and
     leaves all other segments using the original.

8. **"Sourced from catalog" badge.** Each material chip shows a
   small `Library` icon when the resolved project_materials row
   has a non-null `catalog_origin`. Hover tooltip: **"From
   catalog: 'Walltite ECO' · Synced 2026-05-10. Catalog has
   changed since pick — refresh to update."** (suffix only
   when drift detected).

9. **Empty catalog.** If the Materials catalog is empty, the
   "From catalog" section shows: **"No materials in the catalog
   yet. [Open catalog manager]"** linking to the catalog page
   in a new tab. Replaces V1's `NoMaterialsException`
   hard-fail (V1 ref §13.8). The "In this project" section is
   still functional (lists prior project_materials, including
   hand-entered).

10. **All edits flow through the draft buffer.**

11. **R-value live-recompute.** After every pick / inline edit,
    the active assembly's effective R-/U-value (US-ENV-10)
    recomputes (300 ms debounce; immediate on assembly switch).
    **All assemblies referencing the same project_material**
    recompute too (since values may have changed).

12. **Read-only on locked versions / for anonymous viewers.** Picker
    disabled; chip renders as a static label with the badge.

### Resolved questions (2026-05-10)

- **Q-ENV-7.1 (Resolved):** Inline override field set =
  full ProjectMaterial Pydantic field set, with rarely-used
  fields (`emissivity`, `argb_color`) under a "More fields…"
  expander. Mirrors Q-WIN-4.1. (Editing applies to the
  project_materials row, with shared-segments banner per
  US-ENV-6 criterion 2.4.)
- **Q-ENV-7.2 (Resolved):** Promote hand-entered material into
  catalog — deferred to v1.1+; not in MVP. Mirrors Q-WIN-4.4.
- **Q-ENV-7.3 (NEW, Resolved):** Picker shows existing
  project-materials in their own section above the catalog
  list, so users can re-use the same product across assemblies
  without searching the global catalog every time. The "Already
  in this project" tag on duplicated catalog rows makes the
  shared-identity behavior explicit.

### Open questions
None — all US-ENV-7 questions resolved 2026-05-10. (Detach
behavior open under Q-ENV-6.2 in US-ENV-6.)

---

## US-ENV-8 — Orientation (flip orientation, flip layers)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §11.4 (AssemblyToolbar), §13.4 (two flip operations
are independent), §17 quick-reference checklist item 7

### Story
> As an editor, I want two distinct buttons — one to flip which
> end of the layers list is "outside" (flip orientation, layers
> untouched), and one to physically reverse the layer order
> (flip layers, orientation enum untouched) — so I can correct
> a misordered import or mirror an assembly without losing the
> distinction.

### Acceptance criteria

1. **Two buttons in the AssemblyToolbar** (V1 ref §11.4):
   - **Flip Orientation** (`SwapVert` icon) — toggles
     `assembly.orientation` between `first_layer_outside` and
     `last_layer_outside`. Layers untouched.
     Tooltip: **"Flip interior / exterior orientation"**.
   - **Flip Layers** (`Flip` icon) — physically reverses the
     order of `assembly.layers` (and re-numbers their `order`
     fields). Orientation enum untouched. Tooltip: **"Reverse
     layers from inside to outside"**.
2. **The "true mirror" requires both** — V1 documents this as a
   deliberate design choice (V1 ref §13.4). V2 keeps the
   distinction. **Optional v1.1+ shortcut:** a "Mirror assembly"
   menu item that calls both atomically. Defer.
3. **Both operations** apply as JSON-Patch to the draft body.
   Trigger R-value refetch (US-ENV-10).
4. **Disabled state.** Both buttons disabled when no assembly
   is selected, when in pick / paste mode, or when the active
   version is locked.
5. **Visual feedback.** After click, the canvas's
   "interior" / "exterior" labels and / or layer order update
   immediately (no toast — the visual change is the feedback).

### Open questions
None — V1 parity confirmed.

---

## US-ENV-9 — Copy / paste material assignments

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10 after all three structural questions resolved)
**V1 ref:** §6.3 (CopyPaste context), §9.4 (canvas state
machine), §11.4 (toolbar), §13.14 (per-target 5-PATCH chatty
behavior — fixed in V2)

### Story

> As an editor, when I've nailed the material assignment for
> one segment, I want to apply that same assignment to other
> segments in the active assembly with a two-click
> eyedropper-then-paint-bucket gesture — without re-walking the
> material picker each time — so building out hybrid stud-and-
> insulation layers stays fast.

### Acceptance criteria

1. **Toolbar buttons** in the assembly header (US-ENV-3
   criterion 1):
   - **Eyedropper** icon button — enters "pick" mode.
   - **Paint-bucket** icon button — enters "paste" mode (only
     enabled after a pick has been made).
   - **Undo-last-paste** icon button — same as V1 ref §11.4
     parity. Disabled when paste history is empty for the
     active assembly.
   - All three buttons hidden on locked versions and on view-
     links.

2. **State machine** (V1 ref §9.4 parity):
   - `idle` → click eyedropper → `picking` (cursor changes to
     eyedropper)
   - `picking` → click source segment → `picked` (eyedropper
     resets; paint-bucket lights up; source segment shows a
     subtle "this is the source" highlight)
   - `picked` → click paint-bucket → `pasting` (cursor changes
     to paint-bucket)
   - `pasting` → click target segment → paste applied + 600 ms
     paste-pulse animation on target → stays in `pasting`
     state (so user can keep clicking more targets without
     re-clicking the toolbar — V1 ref §6.3 parity)
   - **ESC** at any non-idle state → return to `idle`, drop
     source.
   - **Click outside any segment** during `picking` or
     `pasting` → return to `idle`, drop source.

3. **Copy payload — 3 fields** (Q-ENV-2 simplification of V1's
   5-field payload):
   ```typescript
   {
     project_material_id: string | null,
     steel_stud_spacing_mm: number | null,
     is_continuous_insulation: boolean
   }
   ```
   - `project_material_id` carries the **reference** to the
     `tables.project_materials[]` row — so the target's
     `specification_status`, `notes`, and `datasheet_asset_ids`
     automatically stay in sync with the source's material
     (they live on the project_material row, not on segments).
     This is a side-benefit of the Q-ENV-2 restructure: V1's
     `specification_status` and `notes` were per-segment fields
     that had to be explicitly copied; V2 makes them follow
     the material by reference, so copy/paste does less work
     but produces a more-correct result.
   - **NOT copied** (target keeps its own values): `width_mm`,
     `photo_asset_ids`. Same explicit contract as V1 ref §6.3.
   - **Width is preserved per target** — common case is
     "stamp this material onto an existing differently-sized
     segment," so we don't blow away the geometry the user
     already set.

4. **Single JSON-Patch per paste-target** (V2 cleanup of V1
   ref §13.14). V1 emitted 5 separate PATCH requests per
   paste-target (one per field), risking partial-failure
   inconsistency mid-paste. V2 paste = **one JSON-Patch**
   with multiple `replace` ops covering the 3 payload fields,
   atomic at the draft-buffer level.

5. **No cross-assembly paste** (V1 parity per Ed 2026-05-10).
   Switching the active assembly clears all pick/paste state
   (source, target history, mode) — paste cannot cross
   assemblies. Cross-assembly copy in v1.1+ can be revisited
   if a real workflow surfaces; the project_materials de-dup
   model makes it trivially easy to add later (target segment
   in a different assembly would just reference the same
   `project_material_id`), so the deferral is purely a UX
   call, not a data-model constraint.

6. **No multi-select paste in V2 v1** (Ed 2026-05-10). One
   click = one target. Mirror of US-WIN-7 deferred-NEW. v1.1+
   candidate.

7. **No keyboard shortcuts (⌘C / ⌘V) on the envelope canvas**
   (Ed 2026-05-10). The toolbar buttons + ESC + ⌘Z (undo) are
   the entire interaction surface. v1.1+ may revisit after
   real usage patterns surface.

8. **Bounded undo stack — 20 entries per active assembly**
   (V1 ref §6.3 `MAX_UNDO_STACK_SIZE` parity).
   - **⌘Z** undoes the last paste; subsequent ⌘Z presses pop
     the stack further. Beyond 20 entries the oldest entries
     fall off silently.
   - **Undo-last-paste toolbar button** is the explicit
     mouse-driven equivalent (V1 ref §11.4).
   - Undo stack is **per-assembly, in-memory only** — cleared
     on assembly switch (criterion 5) and on document /
     version switch. Not persisted in the project document.

9. **Refetch R-value after every successful paste** —
   paste mutates `project_material_id` and potentially the
   stud / CI fields, all of which are in the US-ENV-10
   refetch-trigger set (criterion 7 there). Backend
   content-hash changes; frontend invalidates and refetches.

10. **Visual feedback during pick/paste mode:**
    - Source segment (in `picked` / `pasting` state): subtle
      ring outline (CSS var `--copy-source-ring`) so the user
      remembers where the assignment came from.
    - Target segment on paste-click: 600 ms pulse animation
      (CSS var `--paste-pulse-duration`; V1 parity).
    - Canvas hover-`+` add-segment / add-layer buttons
      **hidden while in pick / paste mode** (already captured
      in US-ENV-4 criterion 5 — listed there as one of the
      hover-button-visibility gates).
    - SegmentPropertiesModal does NOT open on click while in
      pick / paste mode (US-ENV-4 criterion 3, US-ENV-6
      criterion 2.1 already capture this).

11. **Locked-version + anonymous-viewer rendering.** Toolbar buttons
    hidden entirely. Click on a segment opens the read-only
    SegmentPropertiesModal as normal. Undo button hidden.

12. **All paste state is ephemeral frontend state** — lives
    in the envelope-builder Zustand store (likely as
    `pickPasteState: { mode, sourcePayload, undoStack[20] }`)
    keyed per `assembly_id`. Not part of the project document.
    Clears on document / version / assembly switch.

### Resolved questions (2026-05-10)

- **Cross-assembly paste?** Resolved: **no — V1 parity.**
  State clears on assembly switch. Data model supports
  cross-assembly trivially (de-dup via shared
  `project_material_id`), so v1.1+ can lift this without
  schema work.
- **Multi-select paste?** Resolved: **defer to v1.1+.** One
  click = one target.
- **Keyboard shortcuts (⌘C / ⌘V) on canvas?** Resolved:
  **defer to v1.1+.** Toolbar + ESC + ⌘Z only.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-3 criterion 1** — assembly toolbar layout includes
  Eyedropper / Paint-bucket / Undo-last-paste.
- **US-ENV-4 criteria 3 + 5** — hover-`+` buttons hide,
  click-handler routes to copy/paste state machine instead of
  modal during pick/paste mode.
- **US-ENV-6 criterion 2.1** — SegmentPropertiesModal trigger
  defers to copy/paste state machine when in pick/paste mode.
- **US-ENV-10 criterion 7** — R-value refetch trigger
  includes `project_material_id` / `steel_stud_spacing_mm` /
  `is_continuous_insulation`, all in the copy payload.
- **Q-ENV-2 resolution** — drives the 3-field payload (was 5
  in V1; `specification_status` and `notes` now ride along by
  reference).

---

## US-ENV-10 — Effective R-value / U-value display

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
on 2026-05-10 after Q-ENV-4 resolution unblocked this story)
**PRD ref:** §6.2 (assembly shape), §10.4 (glossary location)
**V1 ref:** §5.5 (full thermal-resistance service), §11.2
(EffectiveRValueLabel), §13.5 (surface-film divergence —
resolved per Q-ENV-4)
**Convention reference:** `context/glossary.md` — Thermal
performance section. V2 shows only U-Value / R-Value (no
films); never U-Factor / R-Factor.

### Story

> As an editor, I want a single live thermal-resistance number
> in the assembly header that tells me how good my layer-stack
> is, computed the same way our certified projects' deliverables
> compute it, with surface-film handling that's unambiguous and
> consistent with the downstream simulation tools — so the
> number I see in PHN is the number I can stand behind in a
> design review.

### Acceptance criteria

1. **Where it renders.** Inside the assembly header (US-ENV-3
   criterion 3). Single label next to Total Thickness. Hidden on
   the empty Equipment / Status / Model tabs since this is an
   envelope-specific surface.

2. **Label text — per active unit system:**
   - **IP:** `Effective R-Value: 15.5` (1 decimal,
     hr·ft²·°F/BTU). Matches V1's exact rendering (see V1
     screenshot, 2026-05-10).
   - **SI:** `Effective U-Value: 0.36 W/m²K` (3 decimal places).
   - **No "Factor" variant is rendered in V2 v1** (per Q-ENV-4
     resolution). The construction-only value is the only
     honest one PHN can produce without orientation data.
   - Renders `--` while the calc is in flight or when the
     active assembly is `null`.

3. **Info icon** (`InfoOutlined` shadcn icon) sits to the right
   of the value. Hover / focus opens the tooltip:

   > **Effective Thermal Resistance**
   >
   > Calculated using the Passive House method: the average of
   > the Parallel-Path and Isothermal-Planes methods.
   >
   > Note: Surface film resistances (air films) are NOT
   > included in the value shown here.
   >
   > This matches Honeybee's `OpaqueConstruction.u_value` /
   > `r_value` convention. The films-included U-Factor depends
   > on assembly orientation (wall / floor / roof) and is
   > computed by the downstream simulation tool (WUFI, PHPP,
   > EnergyPlus) — not by PHN.
   >
   > *Reference: ASHRAE Handbook – Fundamentals, Chapter 27*

4. **Backend calculation** — service ports V1's
   `backend/features/assembly/services/thermal_resistance.py`
   to the V2 model shape (`tables.assemblies[*]` referencing
   `tables.project_materials[*]` per Q-ENV-2). Algorithm
   unchanged:
   - PH-average of **Parallel-Path** and **Isothermal-Planes**
     per ASHRAE Handbook Ch 27.
   - Steel-stud cavity layers run through the **AISI S250-21**
     equivalent-conductivity subroutine. **`R_SE = 0,
     R_SI = 0` passed to the subroutine** (matches V1's
     `thermal_resistance.py` policy and the Q-ENV-4
     resolution). Films never enter PHN's internal calc.
   - Returns `ThermalResistanceSchema` matching V1 ref §2.6
     (`r_effective_si`, `u_effective_si`, `is_valid: bool`,
     `warnings: list[str]`).

5. **`min-width: 200 px`** on the label container to prevent
   layout shift when the value changes from `--` to a number.

6. **Caching.** Backend keys the cached result by a
   **content-hash of the assembly subtree** (`layers[]`,
   `segments[]`, referenced `project_materials[]` entries —
   only the conductivity / thickness fields that affect the
   calc). Frontend refetches on hash change, not on every
   keystroke. Same hashing pattern V1 uses (V1 ref §10.1 of
   the Window-Builder reference for the parallel pattern).

7. **Refetch trigger.** Frontend invalidates the cache and
   refetches whenever any of these mutate in the draft buffer:
   - `tables.assemblies[<a>].layers[*].thickness_mm`
   - `tables.assemblies[<a>].layers[*].segments[*].width_mm`
   - `tables.assemblies[<a>].layers[*].segments[*].steel_stud_spacing_mm`
   - `tables.assemblies[<a>].layers[*].segments[*].is_continuous_insulation`
   - `tables.assemblies[<a>].layers[*].segments[*].project_material_id`
   - `tables.project_materials[<p>].conductivity_w_mk` (when
     referenced by any segment in the active assembly).
   - Debounced ~500 ms after the last edit.

8. **"Unfinished" qualifier** (per Q-ENV-3 resolution). When
   **any** segment in the active assembly has
   `project_material_id === null`, the label gains a clear
   "unfinished" qualifier so the user understands the
   displayed value is over the picked segments only:

   - **Compact form:** `Effective R-Value: 12.3 (unfinished)` —
     italic, muted-foreground color. Tooltip extends with:
     *"3 segments are missing a material. The value above is
     computed from the picked segments only. The canvas
     highlights the unfinished segments with a dashed
     outline."* (Mirrors the US-ENV-4 criterion 3
     dashed-outline affordance.)
   - The number itself **still renders** — we don't suppress
     it. Half-finished assemblies are useful design feedback.

9. **Invalid-assembly state.** When the backend returns
   `is_valid: false` (empty layers, zero conductivity, etc.),
   the label renders `--` with a small warning icon. Tooltip
   appends the backend's `warnings` array as a list. V1
   silently rendered nothing on invalid (V1 ref §11.2); V2
   surfaces the *why* explicitly.

10. **Loading state.** While the request is in flight (after
    a debounced cache invalidation), the label renders `…`
    with a low-opacity tween. No skeleton needed.

11. **Locked-version + anonymous-viewer rendering.** Label and
    tooltip work identically — the value is data, not edit
    state. Refetches if the active version changes (different
    body → different subtree hash → different cache key).

12. **No "U-Factor" or "R-Factor" toggle in V2 v1.** If a user
    asks for a films-included value, the answer is the tooltip
    text plus "the downstream simulation tool computes it from
    your HBJSON." A v1.1+ feature could optionally surface
    `u_factor` (computed using Honeybee's simple ISO 10292
    coefficients) with a clear label like
    `"U-Factor (Honeybee simple, non-direction-dependent)"` —
    but only with a UX design that prevents confusion with the
    ASHRAE direction-dependent value most users expect.

### Resolved questions (2026-05-10)

Parent question Q-ENV-4 (surface-film convention) resolved —
see Q-ENV-4 in the US-Builder-Envelope architectural-decisions
section. No US-ENV-10-specific open questions.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-3 criterion 3** — header layout, includes this label.
- **US-ENV-4 criterion 3** — canvas dashed-outline rendering for
  null-material segments (the visual companion to criterion 8
  here).
- **US-ENV-12 (HBJSON export)** — uses the same `R_SE=0,
  R_SI=0` policy for the steel-stud equivalent-conductivity
  written into HBJSON. See Q-ENV-4 resolution for the V1 bug
  fix this corrects.
- **`context/glossary.md` — Thermal performance section** —
  authoritative definitions of U-Value / U-Factor / R-Value /
  R-Factor and the rationale for PHN's policy.

---

## US-ENV-11 — Refresh-from-catalog (per-segment material re-sync)

**Status:** Draft · **Priority:** MVP — **NEW in V2**
**PRD ref:** §7.4 (refresh-from-catalog UX)
**V1 ref:** none — V1's Materials are live-referenced and silently
purged (V1 ref §13.9); V2 is bookshelf

### Story
> As an editor, when a material in the catalog has been updated
> since I picked it (vendor reformulation, catalog typo-fix,
> new datasheet), I want a per-segment "refresh from catalog"
> gesture that shows me the diff and lets me decide which
> values to keep — without forcing me to re-pick from scratch.

### Acceptance criteria

1. **Drift detection.** A segment's material is "drifted from
   catalog" if `material.catalog_origin.catalog_version_id !=
   catalog_materials.current_version_id`. Computed at read
   time. **Identical mechanism to US-WIN-11** for frame /
   glazing.
2. **Surfaces.**
   - **Per-segment badge** — material chip in the
     SegmentPropertiesModal AND in the Specifications-tab row
     (US-ENV-13) shows a `RefreshCw` overlay when drifted.
     Hover tooltip: **"Catalog has changed since pick. Click
     to review."**
   - **Per-tab drift summary** — small banner at the top of the
     Assemblies sub-tab when *any* drift exists in the active
     assembly's segments: **"3 segments drifted from catalog
     [Review all]"**.
   - **Across-the-project report** — accessible from the project
     header `⋯ → Catalog drift report`. Per PRD §7.4 final ¶,
     "lives in the catalog manager view of a project." Shared
     surface with US-WIN-11's drift report.
3. **Per-segment refresh dialog.** Mirrors US-WIN-11
   criterion 3 — three-column diff (Catalog · Yours · Choose),
   per-row radio + bulk actions, **Save** writes the chosen
   values into the document and updates `catalog_origin`.
4. **Diverged user-edited fields** (per Q-ENV-7.1 inline-
   override pattern): rows tagged with **"You edited this"** so
   the user doesn't forget why their value differs.
5. **No bulk "refresh everything" auto-apply** in v1 (PRD §7.4
   + §17 question 9 lean shared with US-WIN-11).
6. **Read-only on locked versions / for anonymous viewers.** Drift badges
   still show; refresh dialog unavailable.
7. **All changes flow through the draft buffer.**
8. **Catalog-schema migration deferred from MVP** (PRD §7.5).
   Materials store `catalog_schema_version: 1` in copied
   `catalog_origin` payloads as a future hook, but MVP
   refresh-from-catalog compares current MVP field names only.
   Catalog-row shim chains, renamed-field metadata, golden
   fixtures, and production-corpus drills are post-MVP.

### Resolved questions (2026-05-10)

- **Q-ENV-11.1: Drift compared to what?** **Resolved (mirrors
  Q-WIN-11.1):** drift only when `catalog_version_id !=
  current_version_id`. Intermediate non-current versions don't
  trigger.
- **Q-ENV-11.2: Renamed-field handling in diff.** **Resolved
  (revised 2026-05-11):** catalog-schema migration tooling is
  deferred from MVP and kept as a post-MVP goal. MVP stores
  `catalog_schema_version: 1` but does not ship renamed-field
  diff handling.

### Open questions
None for MVP — catalog-schema migration is tracked as a
post-MVP goal in PRD §7.5.

---

## US-ENV-12 — HBJSON construction export (download only)

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10; HBJSON construction **import** dropped from MVP per
Ed)
**PRD ref:** §3 (non-goals — HBJSON construction import is
explicitly out of scope), §10.4 (glossary)
**V1 ref:** §4.1 (HBJSON routes), §5.7 (export service),
§11.3 (header overflow menu — surface placement), §13.5
(surface-film divergence — resolved per Q-ENV-4)
**Convention reference:** `context/glossary.md` — Thermal
performance section (no surface films anywhere in PHN's data;
downstream tools add them at simulation time).

### Story

> As a CPHC delivering a project to a downstream simulation
> tool (WUFI Passive, PHPP via PHX, Honeybee energy
> simulation), I want a one-click "Download constructions as
> HBJSON" action on the active project version that produces
> a Honeybee-shape `.hbjson` file containing all of the
> project's assemblies — with per-material datasheets
> referenced once per product and per-segment photos
> referenced per installation — so my downstream workflow has
> a single auditable file matching the active version.

### Scope clarification — export only

V1 supported both **import** and **export** of HBJSON
constructions (V1 ref §4.1, §5.6, §5.7). **V2 v1 ships
export only.** HBJSON construction import is dropped from
MVP per Ed 2026-05-10:

- HBJSON is **viewer-only** in V2. The Model tab (US-Viewer)
  consumes uploaded HBJSON for 3D visualization but does NOT
  write into `tables.assemblies` / `tables.project_materials`
  / any other builder table. PHN is the authoritative source.
- Rhino / Honeybee consume PHN data downstream (via GH
  components that reference PHN tables) and produce HBJSON
  as their output. There's no reverse flow.
- Same one-direction logic applies as for rooms (US-EQ-2):
  user authors in PHN; HBJSON is what comes out, never what
  goes in.
- If a real workflow need surfaces for HBJSON construction
  import (e.g. seeding a new project from an existing Rhino
  model), it lands as a separate story in v1.1+.

### Acceptance criteria

1. **Surface.** Single action in the project header `⋯` menu:
   **"Download constructions (HBJSON)"**. Mirrors Q-WIN-8's
   windows-side HBJSON download placement. **No import
   action exists in V2 v1.**

2. **Per-version snapshot.** The download operates on the
   **active version's body** (`tables.assemblies[]` +
   `tables.project_materials[]` + `single_select_options[]`
   for any relevant columns). Each download is a snapshot of
   that specific version — re-downloading after a Save
   produces a different file; re-downloading after switching
   active version produces a different file.

3. **HBJSON shape.** The exported `.hbjson` is a Honeybee-
   compatible JSON object containing:
   - One `OpaqueConstruction` entry per assembly in
     `tables.assemblies[]`, named by `assembly.name`.
   - One Honeybee `EnergyMaterial` entry per unique
     `project_material` referenced by any segment in the
     exported assemblies. Materials are emitted ONCE per
     product (Q-ENV-2 de-dup carries through to the export).
   - Per-segment **photos** emit as `ImageReference` extension
     entries (Honeybee-PH custom extension) attached at the
     segment / division level within the construction. Matches
     V1 emission shape.
   - Per-`project_material` **datasheets** emit as
     `DocumentReference` extension entries attached at the
     **material level**, not duplicated per segment. (Q-ENV-12.3
     resolution: per-material emission. This differs from V1
     parity, which emitted datasheets per-segment with
     duplication. V2's per-material emission cleaner and
     matches the V2 data model.)

4. **No surface films emitted anywhere** (per Q-ENV-4
   resolution + `context/glossary.md`):
   - Per-material `r_value` values are computed with films
     excluded — matches Honeybee's `EnergyMaterial.r_value`
     "excluding air films" convention exactly.
   - Steel-stud cavity-equivalent conductivity uses
     `R_SE = 0, R_SI = 0` in the AISI S250-21 subroutine.
     **V2 fix vs V1's exporter:** V1 baked `R_SE = 0.17,
     R_SI = 0.68 hr·ft²·°F/BTU` into the cavity equivalent
     (`backend/features/assembly/services/
     to_hbe_material_steel_stud.py:27-28, 207-208`), which
     caused films to be double-counted when downstream
     consumers re-applied their own films. V2 drops these
     constants. See `context/glossary.md` (Thermal performance
     section, V1→V2 behavioral change subsection).
   - Downstream consumers (Honeybee → `u_factor`, WUFI,
     PHPP, EnergyPlus) add films **once** at the construction
     boundary at consumption time — they know which films to
     apply because they know each surface's orientation.

5. **`ph_nav` external IDs preserved on export.** Every
   emitted material carries a `ph_nav` extension block with
   `project_material_id` and (if present) `catalog_origin`.
   This is forward-compatible scaffolding — when / if v1.1+
   adds HBJSON construction import, the round-trip can
   re-link by `ph_nav` ID without depending on name matching.
   In V2 v1 this metadata is essentially unused (no import
   path), but it's cheap to emit and future-proofs the format.

6. **Multi-row PhDivisionGrid never produced.** V2 v1 only
   creates single-row segment layouts (per Q-ENV-5
   resolution). The exporter writes single-row
   `PhDivisionGrid` structures; nothing to error on.

7. **Filename convention** (per Q-ENV-12.4 resolution):
   `{bt_number}_{project_name}_{version_name}_constructions.hbjson`
   - All three components are slugified — lowercase, spaces
     converted to `-`, special characters stripped, repeated
     `-` collapsed.
   - Example: `2024-013_brooklyn-retrofit_round-2-submit_constructions.hbjson`
   - Generated client-side after the server returns the file
     content; no server-side filename storage needed.

8. **Download action permissions:**
   - **Editors:** always available (any version, locked or
     unlocked). Locked versions can be downloaded — they're
     read-only, not download-blocked.
   - **Non-logged-in viewers:** download available. HBJSON is a
     project deliverable; per PRD §4 (updated 2026-05-10) project
     URLs are public-readable, including downloadable artifacts.

9. **No mutation to the project document.** Export is a pure
   read-side operation; nothing flows through the draft
   buffer; no JSON-Patch ops; no version mutation.

10. **Error handling.** The only failure mode worth handling
    explicitly in v1 is a backend-side serialization error
    (malformed material data, conductivity = 0, etc.). Surface
    via a single toast: *"Couldn't generate the HBJSON file:
    {brief reason}. Please contact support if this persists."*
    The malformed-data conditions should already be caught by
    Pydantic validation upstream (PRD §6.2), so this is a
    safety net, not a primary user-facing path.

### Resolved questions (2026-05-10)

- **Q-ENV-12.1: Per-assembly export?** Resolved: **defer to
  v1.1+; whole-project only in V2 v1.** Matches V1 and the
  canonical certifier-submission workflow.
- **Q-ENV-12.3: Datasheet emission shape?** Resolved:
  **per-`project_material` (material-level), not per-segment.**
  V2 data model has datasheets at the product level (Q-ENV-2);
  emission shape matches that. Cleaner than V1's per-segment
  duplication.
- **Q-ENV-12.4: Filename convention?** Resolved:
  `{bt_number}_{project_name}_{version_name}_constructions.hbjson`,
  slugified.
- **Q-ENV-12.6: Upload UX (drag-drop vs file picker)?**
  Moot — no upload / import in V2 v1.
- **Q-ENV-12.2 / Q-ENV-12.5: Conflict policy + locked-version
  import handling?** Moot — no import in V2 v1.

### Open questions
None outstanding.

### Cross-references

- **`context/glossary.md` — Thermal performance section.**
  Authoritative source for the no-films policy and the
  steel-stud V1→V2 behavioral change.
- **Q-ENV-4 resolution.** Drives criterion 4 (no films
  anywhere; steel-stud R_SE=0/R_SI=0 fix).
- **Q-ENV-2 resolution.** Drives criterion 3 (per-product
  material emission; per-segment photo emission).
- **PRD §3 (non-goals).** Explicitly excludes HBJSON
  construction import from V2 v1.
- **PRD §14.1 (V1→V2 migration).** Captures the expected
  per-cavity `u_factor` delta for re-exported V1 steel-stud
  assemblies.
- **US-Viewer (Model tab).** The OTHER HBJSON surface in
  V2 — uploaded HBJSON used for 3D visualization only,
  no write-back to builder tables.

---

## US-ENV-13 — Specifications sub-tab (per-material primary view)

**Status:** Draft · **Priority:** MVP — **major V2 restructure**
**PRD ref:** §6.2 (per Q-ENV-2:
`tables.project_materials[]` with per-material datasheets +
spec-status + notes; `segment.photo_asset_ids` per-segment)
**V1 ref:** §12 (Material-List view, per-segment), §13.7
(segment-scoped media), §13.16 (V1 tab-name confusion)

### Story
> As a CPHC, I want a per-project view that lists every unique
> material used across all assemblies, auto-aggregated as I edit
> assemblies elsewhere, and shows — for each material — whether
> we have a manufacturer datasheet on file, what the
> specification-status is (have we received a confirmed product
> commitment from the design team?), and which segments use it
> with site-photo coverage per use. So I can sweep through a
> project at QA / certification-prep time and answer "is the
> documentation complete?" in one place.

### Why this restructures V1
V1 walked **per-segment** rows: every segment of every assembly
got its own row with its own datasheet uploader, its own
spec-status, its own notes. V1 ref §13.16 already calls this
out as confusing — the tab is about products (materials), not
about segments. V2 flips the primary axis to **per-project-
material** rows, with per-segment use as a secondary detail
(for site-photo upload). The data model change in Q-ENV-2
makes this natural: datasheets and spec-status now live at
the `project_materials` level; site photos at the segment
level.

### Acceptance criteria

1. **URL.** `/projects/{id}/envelope/specifications` (per
   Q-ENV-8 rename).
2. **Page heading.** **"Project Materials"** (matches V1's
   `<h4>` to preserve visual continuity with V1 ref §12.1
   despite the URL rename).
3. **Source.** Renders `body.tables.project_materials[]` from
   the active version's draft body (or saved body if no
   draft). Auto-aggregated by US-ENV-7's pick logic — the user
   does not manually maintain this list.
4. **Layout** — one scrollable column of **material cards**.
   Each card represents one `project_materials` row.
   Card sort order:
   - Cards with `specification_status != 'complete'` first
     (so pending QA work is at the top), within that group by
     `naturalSortCompare` on name.
   - Cards with `specification_status === 'complete'` next,
     same secondary sort.
   - **"Unused" cards** (no segment references; preserved orphans
     per Q-ENV-2 rule 5) at the bottom in a separate section
     **"Unused materials"** with a one-time onboarding line:
     *"These materials are no longer used in any assembly.
     Their datasheets and notes are preserved here in case you
     need them; clean up explicitly when ready."*
5. **Material card layout** — five regions:
   ```
   ┌───────────────────────────────────────────────────────────────────┐
   │  XPS                                            [📚][↻] · Spray Foam│   ← header
   │  Conductivity 0.034 W/(m·K) · Density 35 kg/m³                     │
   ├───────────────────────────────────────────────────────────────────┤
   │  [Spec Missing ▾]   [+ Notes]                          ⋯           │   ← QA bar
   │                                                                    │
   │  Datasheets                                                        │
   │  ┌─────────────┬─────────────┐                                     │   ← per-material
   │  │  IMG  PDF   │   + Add     │                                     │
   │  └─────────────┴─────────────┘                                     │
   │                                                                    │
   │  Used in 4 segments:                                               │   ← per-use
   │  ┌──────────────────────────────────────────────────────────────┐  │
   │  │ FLOOR-FC3R · Layer 2 · seg 1     [photo.jpg]            ⋯    │  │
   │  │ FLOOR-FC6R · Layer 3 · seg 2     [empty — Site Photo Needed] │  │
   │  │ ROOF-RC5R  · Layer 4 · seg 1     [photo1.jpg, photo2.jpg]    │  │
   │  │ WALL-C3    · Layer 2 · seg 1     [empty — Site Photo Needed] │  │
   │  └──────────────────────────────────────────────────────────────┘  │
   └───────────────────────────────────────────────────────────────────┘
   ```

   Region details:

   **5.1 Header (top strip):**
   - Bold material name (clickable → opens material-rename inline).
   - Right-side badges:
     - `Library` icon when `catalog_origin` is non-null.
     - `RefreshCw` icon when drifted from catalog (US-ENV-11
       detection); click → opens refresh-from-catalog dialog.
   - Sub-line: category + secondary product data
     (conductivity / density / spec-heat — IP or SI per active
     unit system).

   **5.2 QA bar (second strip):**
   - **Specification Status select** — four states (V1
     palette: `complete` / `missing` / `question` / `na`).
     Mutation flows through draft buffer.
   - **Notes** affordance — when notes are empty, shows
     `[+ Notes]`; when populated, shows a speech-bubble icon
     with the notes preview as tooltip; click → opens an
     inline notes editor below.
   - **`⋯` overflow** — "Edit material values…" (opens the
     project_materials row's full-field editor; affects all
     segments using it), "Refresh from catalog…" (when
     applicable), "Delete material" (only enabled when
     `Used in: 0 segments`; otherwise tooltip "In use; remove
     from segments first").

   **5.3 Datasheets region** (per-material — Q-ENV-2 model):
   - Drag-and-drop area for one or more datasheets (PDFs or
     images). Multiple datasheets supported per material
     (a manufacturer might have multiple sheets — product +
     installation guide + cert).
   - Empty state when `specification_status != 'na'`:
     "missing" appearance — magenta border + light-magenta
     background + text **"Product Datasheet Needed"** (V1
     palette parity, V1 ref §12.4).
   - Empty state when `specification_status === 'na'`:
     disabled appearance, no upload affordance.
   - Items render as thumbnails; click → opens
     `<ImageFullViewModal>` (criterion 8). PDF detection by
     extension → iframe-based viewer (V1 ref §12.7).
   - **NEW v.s. V1:** datasheets are **per-material**, not
     per-segment, so the user uploads once per product
     regardless of how many assemblies use it. (V1 was
     per-segment; users uploaded the same datasheet
     repeatedly across copies of the same product, V1 ref
     §12.9 / §13.7.)

   **5.4 "Used in N segments" region** (per-segment —
   Q-ENV-2 model):
   - Heading: `"Used in {N} segments"` (or
     `"Not used in any assembly"` for orphans).
   - One sub-row per segment referencing this
     `project_material_id`, sorted by:
     `naturalSortCompare(assembly.name)` →
     `layer.order` → `segment.order`.
   - Each sub-row shows:
     - Path: `{assembly.name} · Layer {layer.order + 1} ·
       seg {segment.order + 1}`. Clicking the path navigates
       to the Assemblies sub-tab with that assembly active and
       the segment highlighted.
     - Per-segment site-photo zone (drag-and-drop). Same
       empty / drag-over / items-present states as V1's
       site-photo container (V1 ref §12.4). When state is
       'na' at the material level, photo upload is disabled.
     - Per-row `⋯` menu: "Re-pick material…" (opens the
       picker to swap this segment to a different
       project_material), "Open segment in canvas →" (jumps
       to the assembly), "Detach to a new material…"
       (Q-ENV-6.2 detach flow).

6. **Auto-aggregation.** The list rebuilds from
   `body.tables.project_materials[]` after every draft
   mutation. New picks add cards (or surface usage on existing
   cards); deleting the last segment using a material moves
   the card to "Unused materials".

7. **Drag-and-drop upload behavior** — same shape as V1 ref
   §12.4 with V2 cleanups:
   - Multiple files supported; per-file failures surface as a
     Sonner error toast listing names (replaces V1's
     `console.error` + per-file `alert()`).
   - Backend uploads to R2; response stores asset record;
     either `project_materials.datasheet_asset_ids[]` (for the
     per-material datasheet zone) or `segment.photo_asset_ids[]`
     (for the per-use site-photo zone) gets the new id
     appended via JSON-Patch.
   - Loading overlay during upload.

8. **ImageFullViewModal** (V1 ref §12.6 parity):
   - One full-size image OR PDF iframe view.
   - PDF detection by file extension → renders inside an
     `<iframe src=".../#toolbar=0">` (browser-native viewer,
     toolbar hidden; V1 ref §12.7).
   - **Delete** button — confirms via shadcn `Dialog`
     (replaces V1 `window.confirm`) → soft-delete the asset →
     JSON-Patch removes the id from the appropriate array
     (project_material's datasheet array OR segment's
     photo array).
   - No keyboard nav between images, no zoom/pan in v1
     (matches V1's intentional minimalism).

9. **Inline material-values editor** (US-ENV-7 criterion 7;
   reachable via `⋯ → "Edit material values…"`):
   - Opens an inline editor below the QA bar.
   - Banner when shared: *"Editing applies to all 4 segments
     using this material. To override values for one segment
     only, use the canvas's segment modal → Detach to a new
     material."*
   - Sets `catalog_origin.diverged: true` on save.

10. **Drift surface.** When the material's `catalog_origin`
    is drifted (US-ENV-11 detection), the header `RefreshCw`
    icon appears. A per-tab summary banner above the cards:
    `"3 materials drifted from catalog [Review all]"`. Same
    behavior as the Assemblies-tab banner (US-ENV-11).

11. **View-link visibility rule.** V1 hides rows where
    `specification_status === 'na'` from anonymous viewers.
    **V2 keeps this rule** but applied at the **card** level
    (whole material card hidden when n/a), not the row level.
    Public-viewer sees only materials with a meaningful
    spec-status set. The "Unused materials" section is also
    hidden from public viewers.

12. **Locked-version + anonymous-viewer rendering.** Spec-status
    select disabled; drag-and-drop hidden; per-image delete
    hidden; inline editors disabled. Material cards still
    render so the public viewer can see the documented set.

13. **Project Materials count chip** in the sub-tab header:
    `"24 materials · 18 with datasheets · 21 with site photos
    on every use"`. Quick at-a-glance dashboard for QA prep.

14. **Empty state.** When `tables.project_materials[]` is
    empty (brand-new project, no segments have picked
    materials yet), show: **"No materials used yet. Pick
    materials in the Assemblies tab to see them here."**
    centered with a link to `/envelope/assemblies`.

### Resolved questions (2026-05-10)
- **Q-ENV-13.1: Per-row drift surface?** **Resolved (revised
  for restructured layout):** drift surfaces at the **material
  card** header (not per-segment-row), since drift is a
  property of the project_material's catalog_origin, not of
  individual uses.

### Resolved questions (2026-05-10) — additional
- **Q-ENV-13.2: Bulk operations across material cards.**
  Resolved: **defer to v1.1+; not in MVP.** V1 had no bulk
  ops (V1 ref §12.9); V2's per-material primary collapses N
  segments → 1 card, which already removes most of the
  manual repetition that bulk-set would have addressed in a
  per-use model. If a v1.1+ user surfaces a real workflow
  that needs it (e.g. "mark all 12 insulation products
  complete after submittal review"), revisit then.
- **Q-ENV-13.3: Site-photo per-use empty-state inheritance
  from material spec-status.** Resolved: **disabled when the
  material's `specification_status === 'na'`.** Matches V1
  semantics (per-segment disable when seg-level status was
  `na`); now applies at the material level since V2's
  spec-status moved to `project_materials`. Two reinforcing
  reasons: (a) early-design `na` placeholders shouldn't
  attract photo uploads against products that may get
  swapped; (b) users are already trained on this gate from
  V1. Workaround when an `na` segment legitimately needs
  documentation (e.g. existing-conditions photos before
  product selection): bump material spec-status to
  `pending` first — acceptable friction.

---

## US-ENV-14 — Airtightness sub-tab

**Status:** Draft · **Priority:** MVP (HBJSON-driven model
captured 2026-05-10; full UX specs to be walked separately)
**PRD ref:** §6.1 (proposed new `project_airtightness` table;
needs follow-up edit), §11.4.2 (`project_hbjson_files`)
**V1 ref:** §3.5 (out of V1 reference scope)

### Story
> As a CPHC, I want a project-level airtightness page that
> auto-extracts envelope volume and area from the most recent
> HBJSON upload, accepts the contractor's blower-door test
> results, computes ACH50 / n50 / cfm50/sf, and is shareable
> with the construction team — without my having to recompute
> every time I open the page.

### Architectural decisions (provisional, captured 2026-05-10)

- **Storage location: project-level relational, not in the
  project document.** Reason matches `project_status_items`
  (PRD §6.1 / US-Status): airtightness is a project-level
  artifact tied to physical reality (the actual building's
  test results), not a versioned property of the energy model.
  Opening Round 1 Submit a year later should show today's
  measured airtightness, not Round-1-time airtightness.

- **HBJSON-derived geometry summary** lives on the
  `project_hbjson_files` row (cached at upload time):
  ```sql
  -- New columns on project_hbjson_files
  extracted_volume_m3        FLOAT,    -- Σ room volumes
  extracted_envelope_area_m2 FLOAT,    -- Σ exterior face areas
  extracted_floor_area_m2    FLOAT,    -- iCFA proxy (TBD which
                                        -- floor-area definition;
                                        -- see Q-ENV-14.2)
  extraction_status          TEXT,     -- 'pending' | 'ok' | 'failed'
  extraction_error           TEXT,     -- failure detail
  extracted_at               TIMESTAMPTZ
  ```
  - **Computed once on HBJSON upload**, stored, never
    recomputed on page load.
  - If the user uploads a new HBJSON, the extraction runs
    again on the new row; the old row's cached values are
    preserved (matching the immutable HBJSON contract,
    PRD §11.4.2).
  - The Airtightness page reads the **active HBJSON's**
    cached values (default = most recent upload; the HBJSON
    file picker on the Model tab can also drive which file is
    "active" for airtightness — see Q-ENV-14.1).

- **User-entered blower-door results and design targets** live
  in a new **project-level** table:
  ```sql
  project_airtightness (
      project_id              UUID PRIMARY KEY REFERENCES projects(id),
      -- Test method and result inputs:
      test_method             TEXT,    -- 'ASTM_E779_50Pa' | 'ASTM_E1554' | 'ATTMA_TS1' | ...
      test_pressure_pa        FLOAT,   -- typically 50
      test_result_cfm         FLOAT,   -- measured airflow at test pressure
      test_date               DATE,
      tester_name             TEXT,
      tester_certification    TEXT,
      target_ach50            FLOAT,   -- design target (Phius / PHI / code)
      target_source           TEXT,    -- 'Phius_Core' | 'Phius_2024_CORE' | 'PHIPlus' | ...
      notes                   TEXT,
      -- Bookkeeping:
      hbjson_file_id          UUID REFERENCES project_hbjson_files(id),
                              -- which HBJSON's geometry the test result is paired against
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by              INTEGER REFERENCES users(id)
  )
  ```
  - **One row per project** (project_id is the PK; not
    versioned, not list-keyed).
  - **Pinned to a specific `hbjson_file_id`** so the displayed
    ACH50 is reproducible: ACH50 = (cfm × 60) / volume, where
    volume comes from the pinned HBJSON. If a newer HBJSON is
    uploaded, the user must explicitly re-pin (or the system
    auto-rolls forward — see Q-ENV-14.3).

- **Computed values** (`ach50`, `n50`, `cfm50_per_sf_envelope`,
  pass/fail vs target) are computed at read-time **from the
  cached inputs** (HBJSON's volume + area, project's test
  result + target). No recompute loop — both inputs are stored.

- **Permissions:** any editor can mutate. Read-only for
  anonymous (non-logged-in) viewers (per the access-check seam, §4.1) — and
  this is intentional, since Ed wants to share this page with
  contractors via anonymous viewers.

### Acceptance criteria (skeletal — full specs follow)

1. **URL.** `/projects/{id}/envelope/airtightness`.
2. **HBJSON-source banner** at the top — shows the current
   pinned HBJSON file name, upload date, and extracted volume
   / area / floor-area. If no HBJSON has been uploaded:
   empty state directing the user to the Model tab.
3. **Inputs section** (editable by editors):
   - Test method dropdown.
   - Test pressure (typically 50 Pa).
   - Measured result (cfm at test pressure).
   - Test date + tester name + tester certification.
   - Target ACH50 + target source (Phius / PHI / code).
   - Notes.
4. **Computed results section** (read-only):
   - ACH50 (computed live).
   - n50 (synonym for ACH50 — Phius vs PHI naming).
   - cfm50/sf-envelope (the Phius CORE metric).
   - Pass/fail badge vs target.
5. **Versioning behavior:** the inputs are project-level (not
   version-versioned); the page surfaces the same values
   regardless of which version of the project document is
   open. Switching versions does NOT change what's displayed
   here. **Banner clarification at the top:** *"Airtightness
   data is project-level — not tied to a specific version of
   the energy model."*
6. **Locked-version + anonymous-viewer rendering.** Editors see
   editable inputs always (since the data is project-level,
   not version-locked). View-link viewers see the page
   read-only.
7. **Sonner toast on save:** "Airtightness updated. ACH50:
   0.42 (target 0.6 — passes)."

### Resolved questions (2026-05-10)
- **Q-ENV-14.1: Which HBJSON file drives the Airtightness
  calc when multiple are uploaded?** Resolved: **(c)
  explicitly pinned via the Airtightness page's own UI.** The
  `project_airtightness.hbjson_file_id` column is the pin,
  with the Airtightness page offering its own picker to
  change it. Calc is reproducible and decoupled from "what
  the Model tab is showing." Rejected (a) always-most-recent
  (silent ACH50 changes break audit trail) and (b) Model-tab
  dropdown coupling (confusing).
- **Q-ENV-14.2: Floor-area definition for Phius CORE
  cfm50/sf.** Resolved: **iCFA per honeybee_ph's
  `interior_conditioned_floor_area`** convention. This matches
  Phius's expected variable and is already exposed in the
  HBJSON model. Document in `context/glossary.md` with a
  short note on what's excluded (unconditioned, exterior).
  Other definitions (gross, ground-only, code-specific
  variants) deferred to v1.1+ gated by concrete user request.
- **Q-ENV-14.3: Auto-roll-forward on new HBJSON upload?**
  Resolved: **no — keep pinned.** Auto-rolling silently
  changes the displayed ACH50 (because volume / envelope area
  changed) without the user knowing the source changed.
  Replacement UX: surface a banner *"A newer HBJSON has been
  uploaded; pinned source is still 'Round 1 model.hbjson'
  (uploaded 2026-04-12). [Re-pin to current]"* with an
  explicit re-pin button. Audit-trail discipline preserved;
  user is always informed.
- **Q-ENV-14.4: Multiple airtightness tests per project.**
  Resolved: **defer multi-test to v1.1+; one row per project
  in V2 v1.** Real projects do sometimes have multiple tests
  (rough-in + final, or per-zone in multifamily), but the
  single-row baseline covers single-family + small multifamily
  (BLDGTYP's typical caseload). Schema can extend additively
  later — `project_airtightness` becomes list-keyed by
  `test_id` rather than `project_id` PK; existing rows
  migrate cleanly to a single "final" entry.

---

## US-ENV-15 — Site Photos sub-tab

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10 after all Q-ENV-15.x resolved)
**PRD ref:** §6.2 (assembly shape — `assembly.type` field
added per Q-ENV-15.1), §4 (anonymous-viewer access model —
updated 2026-05-10)
**V1 ref:** §3.5 (V1's Site Photos tab — out of V1 reference
scope; V2 reorganizes the per-segment photo data captured by
US-ENV-13 into a contractor-facing view)
**Inherits:** US-ENV-13 (Specifications sub-tab) for photo
storage shape and upload primitive

### Story
> As an editor, I want a Site Photos sub-tab that's primarily
> useful for **sharing with the construction team** — a
> contractor-facing view of all the per-segment installation
> photos already attached in the Specifications sub-tab,
> reorganized by assembly type (Walls / Floors / Roofs) so the
> trades crew can see "all the wall photos in one place"
> without drilling per-material. Sharing happens by sending
> the project URL to the contractor (per PRD §4 updated
> 2026-05-10 — project URLs are public-readable); this
> surface is the page they'll land on.

### Architectural decisions (2026-05-10)

- **No new backend / no new tables in v1.** The data shown
  here is the **same per-segment site-photos** that the
  Specifications sub-tab already manages
  (`segment.photo_asset_ids` per Q-ENV-2). This sub-tab is
  purely a **presentation-layer reorganization** of existing
  data — no new asset storage, no new endpoints beyond
  what US-ENV-13 already exposes.

- **Grouping by assembly type** — sections render in this
  order (Other appears only when at least one assembly is
  typed `other`):
  **Walls · Floors · Roofs · Other**.
  Within each section, group by assembly, then by layer /
  segment.

- **Assembly type source** — explicit `assembly.type` enum
  field on each assembly (resolved per Q-ENV-15.1). Values:
  `'wall' | 'floor' | 'roof' | 'other'`. Name-based
  auto-detection on assembly create; user-editable thereafter
  via the assembly's `⋯` menu (US-ENV-2). This is a single
  field on the assembly schema, not a separate lookup table.

- **Editable here too — not a read-only redirect to
  Specifications.** Users can drop new photos directly onto
  per-segment zones in this view. Same R2 upload +
  `segment.photo_asset_ids[]` JSON-Patch path as US-ENV-13;
  this surface is a **different view of the same data**, with
  the same write affordances.

- **View-link rendering is the primary motivation.**
  Contractor-facing share — the trades crew gets a clean
  by-type browse view without needing editor access. Editor
  affordances (upload zones, `⋯` menus) hide gracefully.

### Acceptance criteria

1. **Sub-tab placement.** Lives under the Envelope tab
   (US-ENV-1) as the 4th sub-tab in display order:
   **Assemblies · Specifications · Airtightness · Site Photos**.
   URL deep-link: `/projects/{id}/envelope/site-photos`
   (mirrors Q-ENV-9 / US-ENV-1 routing pattern).

2. **Empty-state UX** (no photos uploaded anywhere on the
   project):
   - Centered card with copy: *"No site photos yet. Site
     photos are attached per-segment under the
     **Specifications** sub-tab — they'll appear here
     organized by assembly type once uploaded."*
   - Primary CTA: **[Go to Specifications]** (linkable
     button — same data, different view).
   - Anonymous public viewers see the empty-state card without
     CTA (just the explanatory text). Avoids dead links to
     editor-only surfaces.

3. **Section structure** (when at least one photo exists):
   - **Walls** section — assemblies where `assembly.type === 'wall'`
   - **Floors** section — `assembly.type === 'floor'`
   - **Roofs** section — `assembly.type === 'roof'`
   - **Other** section — `assembly.type === 'other'`, rendered
     only if at least one assembly falls into it.
   - Sections render in fixed order (Walls / Floors / Roofs /
     Other), each with a sticky-on-scroll header.

4. **Per-section header:**
   - Title with summary count: `Walls (3 assemblies · 24 photos)`.
   - Anchor link for sharing: hover reveals a small `🔗` icon
     that copies a fragment URL (e.g.
     `/projects/{id}/envelope/site-photos#walls`) to
     clipboard — useful when sharing a specific section with
     a contractor.

5. **Per-assembly card** within a section:
   - Sorted by `naturalSortCompare(assembly.name)`.
   - Card header: assembly name + a small **canvas thumbnail
     color-strip** showing the cross-section (mini version
     of the US-ENV-4 canvas — re-uses the same SVG render
     scaled down, no zoom controls).
   - Per-segment photo grid below: re-uses the same
     drag-drop primitive as US-ENV-13's per-use site-photo
     zone (criterion 7 below).

6. **Per-segment photo zone** (re-uses US-ENV-13's primitive):
   - One zone per `segment` in the assembly's layers.
   - Zone label: `"{Layer N} · {Segment N} · {project_material.name}"`
     (e.g. `"Layer 2 · Segment 1 · XPS"`).
   - Thumbnails of each photo currently attached to that
     segment's `photo_asset_ids[]`.
   - Drag-drop accepts new uploads (criterion 7).
   - Per-thumbnail actions: click to view full-size in a
     lightbox modal; `⋯` → Delete (with confirm dialog).
   - **Disabled when material's `specification_status === 'na'`**
     per Q-ENV-13.3 resolved (matches US-ENV-13 semantics —
     "we don't know what this is yet, don't waste photos").
     Greyed-out drop zone with tooltip *"Set material spec
     status to 'pending' to enable uploads."*

7. **Upload flow** (drag-drop + file picker, mirrors US-ENV-13):
   - File-type validation: image MIME types only
     (`image/jpeg`, `image/png`, `image/webp`, `image/heic`).
   - File-size cap: **10 MB per photo** (matches typical
     contractor-camera output).
   - Upload progress shown as a thin progress bar at the
     drop-zone top edge.
   - Success → thumbnail appears in the zone; underlying
     JSON-Patch appends to `segment.photo_asset_ids[]`.
   - Failure → toast with error reason; partial uploads
     cleaned up.

8. **No cross-segment drag-and-drop** (per Q-ENV-15.3
   resolved). Within this view's UI, dragging a thumbnail
   from segment A's zone to segment B's zone is **not
   supported** — photos stay tied to the segment they were
   uploaded against. Workaround: re-upload to the correct
   segment, delete the wrong one (two clicks; not painful).
   v1.1+ could add an explicit "re-assign photo" action with
   audit-log entry if a real workflow surfaces.

9. **No required-photo-set checklist in v1** (per Q-ENV-15.2
   resolved). V2 v1 ships the regrouped browse view only.
   The cert-package "required N photos per category" concept
   defers to v1.1+ — needs design work V1 skipped (who
   maintains the per-type required-photo list? where does
   it live? per-project override?).

10. **Per-photo metadata viewer.** Click thumbnail → lightbox
    modal:
    - Full-size image render.
    - Caption strip: filename, uploaded date, uploaded by
      (editor display name).
    - Navigation arrows to step through all photos in the
      current assembly card (not just the segment — useful
      for contractors scanning a wall section).
    - Close on ESC / backdrop click.
    - Download button (always present, even for anonymous
      viewers — contractors need this).

11. **Editor permissions** — full drag-drop / upload /
    delete / rename / cross-section nav. Per-thumbnail
    `⋯` menus visible.

12. **Anonymous-viewer permissions** (the contractor-share
    use case — primary motivation for this surface):
    - **Read + download only.** Sections / cards /
      thumbnails / lightbox all render normally.
    - Upload zones render as **passive thumbnail grids**
      (no drag-drop, no `+ Add photo` CTA, no per-thumbnail
      `⋯` menu).
    - Anchor-link `🔗` icons still work for sharing
      specific sections with the trades.
    - Empty per-segment zones render as a quiet *"No photos
      yet"* placeholder, not a CTA-bearing drop zone.

13. **Locked-version rendering.** Same as anonymous
    viewers above — drop zones become passive, deletes
    hidden. Locked versions are an editor-side concept
    (a saved, frozen version of the project document),
    but the underlying photo data (in `segment.photo_asset_ids`)
    is part of that frozen document — so the locked view
    represents what photos existed at the time of locking,
    read-only.

14. **Re-uses US-ENV-13's backend endpoints.** No new
    routes; this is purely a frontend reorganization of the
    same data US-ENV-13 reads / writes. MCP-callable photo
    endpoints (per NEW-LLM-API-1) are inherited from
    US-ENV-13 / US-VIEW-1's asset-API pattern.

### Resolved questions (2026-05-10)

- **Q-ENV-15.1: Assembly type field — name-parse or explicit
  field?** Resolved: **explicit `assembly.type: 'wall' |
  'floor' | 'roof' | 'other'`** with name-based auto-detection
  on assembly create. Field added to the assembly schema in
  PRD §6.2 amendment (already landed).
- **Q-ENV-15.2: V1's "required photos" checklist concept —
  keep, drop, or defer?** Resolved: **defer to v1.1+.** V2 v1
  ships only the per-segment-installation regrouped view.
- **Q-ENV-15.3: Per-section drag-and-drop reorganization?**
  Resolved: **no — photos stay tied to segments.** Cross-
  segment moves have unclear semantics. Workaround: re-upload
  + delete wrong (2 clicks). v1.1+ can add explicit
  "re-assign photo" with audit-log if a real workflow
  surfaces.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-13 (Specifications sub-tab)** — the OTHER view of
  the same per-segment photo data; this sub-tab is a
  presentation-layer reorganization. All photo storage /
  upload / delete plumbing is shared. Bug fixes on one
  surface fix both.
- **Q-ENV-2 resolved** — `segment.photo_asset_ids[]` data
  shape (photos at segment level, not material level).
- **Q-ENV-15.1 resolved → PRD §6.2 amendment** —
  `assembly.type` enum field source.
- **Q-ENV-13.3 resolved** — per-segment photo zone disabled
  when material's spec-status is `na`.
- **PRD §4** — anonymous-viewer access model (updated
  2026-05-10) / contractor-share use case.
- **NEW-LLM-API-1** — asset-API endpoints (inherited).
- **NEW-DATASHEET-1** (post-parity) — bulk-download of all
  project datasheets shares the asset-API pattern; bulk-
  download of all site photos as a contractor-share zip is
  a natural v1.1+ NEW-SITEPHOTOS-1 follow-up (worth flagging
  but not creating as a stub until a real use surfaces).

### Resolved questions (2026-05-10)

- **Q-ENV-15.1: Assembly type field — name-parse or explicit
  field?** Resolved: **explicit `assembly.type: 'wall' |
  'floor' | 'roof' | 'other'`** with name-based auto-detection
  on assembly create (heuristic: name starts with `WALL` →
  wall, `FLOOR` / `FC` → floor, `ROOF` → roof, else `other`),
  user-editable thereafter via the assembly's `⋯` menu.
  Robust against renames; auto-detect avoids manual entry on
  create. Adds one enum field to the `assembly` shape (PRD
  §6.2 amendment item).
- **Q-ENV-15.2: V1's "required photos" concept (the cert
  package needs N photos in each category) — keep, drop, or
  defer?** Resolved: **defer to v1.1+; V2 v1 ships only the
  per-segment-installation re-grouped view.** The required-set
  design needs work that V1 didn't do (who maintains the
  per-assembly-type required-photo list? where does it live?
  per-project override?), and the regrouped view alone is
  already a meaningful step up from V1 for contractors. v1.1+
  can layer the checklist on top additively.
- **Q-ENV-15.3: Per-section drag-and-drop reorganization?**
  Resolved: **no — photos stay tied to segments.** Cross-
  segment moves have unclear semantics (does the source
  segment lose the photo, or is it copied? does the per-segment
  metadata travel?) and risk misleading the QA record.
  Workaround: re-upload to the correct segment, delete the
  wrong one (two clicks; not painful). v1.1+ can add an
  explicit "re-assign photo" action with audit-log entry if a
  real workflow surfaces.

---

## US-Builder-Tables — Common table-view pattern (cross-cutting)

**Status:** Draft · **Priority:** MVP (foundational — all
table-view tabs depend on this)
**PRD ref:** §6.2 (project document tables), §6.3 (project-
scoped non-catalog tables), §8.3 (JSON-Patch via draft buffer),
§11.3 (per-table display)
**Spike ref:** `poc/catalog-spike` branch — `/catalog-poc/sandbox-
tanstack` — Phase 1 (active cell, keyboard nav, frozen column,
⌘C copy), Multi-Cell Select, Phase 5 (stacked sort/filter/group
toolbar). The spike establishes the implementation primitive
this story formalizes.

### Story
> As an editor, I want every per-project data table (Rooms,
> Thermal Bridges, ERVs, Pumps, Fans, future heat-pumps, etc.)
> to share the same TanStack Table primitive and the same
> sort/filter/group/copy/keyboard ergonomics, so I learn the
> pattern once and apply it everywhere — and so the team adding
> a new table type writes column definitions, not a new editor.

### Why this is its own story

The Equipment tab (US-Builder-Equipment) ships with **five**
sub-tabs whose UX is 80% identical (table primitive, toolbar,
keyboard nav, mutations, locked-version handling); only the
column set, validation rules, and per-row modal contents differ.
Per-tab stories should not re-spell the shared half. This parent
defines the shared half. Per-table stories specialize.

### Acceptance criteria (the shared pattern)

1. **Table primitive — TanStack Table v8** (already prototyped
   in `/catalog-poc/sandbox-tanstack`). One reusable
   `<ProjectDataTable>` component lives in
   `frontend/src/components/data-table/`. Each per-table sub-tab
   passes a `columnDef` array, a `tableKey` (e.g.
   `"rooms"`, `"thermal_bridges"`), and a JSON-Patch path
   (`tables.rooms`, `tables.thermal_bridges`).
2. **Stacked sort / filter / group toolbar** (Phase 5 spike;
   commit `b5fa8f8`). The toolbar above the table lets the user
   stack any number of sorts, filters, and groupings — same UX
   on every table tab.
3. **Session-only single view state** (per Q-TBL-1 resolved
   2026-05-10). Sort/filter/group state lives in **in-memory
   Zustand** keyed by `table_key` for the duration of the
   session — switching sub-tabs and returning preserves your
   last-edited toolbar config; reloading the page or signing
   out resets to defaults. **Not persisted** to localStorage,
   to `userPreferencesStore`, or to the backend in V2 v1.
   Single view per table per session — multi-view / named /
   shareable views are a post-parity feature (see
   NEW-TBL-1 below). Reset-to-default action in the toolbar
   overflow.
4. **Active cell + keyboard nav** (Phase 1 spike; commit
   `b2a3c7c`). Active cell highlighted; arrow-key nav across
   cells; first column frozen. Tab/Shift-Tab moves cell-to-cell;
   Enter opens row-detail modal (criterion 8); Escape closes.
5. **Multi-cell select + ⌘C copy** (commit `834881e`). Click +
   shift-click rectangular selections; ⌘C copies as TSV
   (Excel-compatible); ⌘A selects whole table.
6. **`naturalSortCompare` for default sort** — same comparator
   used in US-WIN-1 / US-ENV-2 sidebar lists. "Room 2" sorts
   before "Room 10."
7. **Add row** — two-path UX matching US-ENV-7 (segment) and
   US-WIN-4 (window-element):
   - **Hand-enter row** — opens an inline-edit row with
     `catalog_origin: null` and the table's empty-defaults.
     Always available.
   - **Pick from catalog** — only available when the table
     has a corresponding catalog. **In V2 v1, only Materials,
     Window-Frames, and Window-Glazing have catalogs** (PRD
     §3 non-goals); the equipment catalogs (ERVs, Pumps, Fans,
     Heat-Pumps, etc.) are deferred to v1.1+. Story copy:
     when the catalog ships, "Pick from catalog" appears next
     to "Hand-enter" without a story rewrite — the
     `catalog_origin` shape is already in the per-row schema.
8. **Edit row — row-detail modal.** Click any row → modal
   opens with all editable fields, validation per-field. Save
   commits one JSON-Patch `replace` on
   `tables.<table_key>[<idx>]`; Cancel discards. Modal reopens
   on the same row across re-renders (URL deep-link to the row
   is post-MVP).
9. **Inline edit on cell double-click** (Phase 1 spike). For
   simple-typed columns (number, short text), double-click
   enters cell-edit mode — Enter commits, Escape cancels.
   Complex fields (enums, references) always go through the
   row-detail modal.
10. **Delete row** — destructive shadcn `Dialog`, simple
    Cancel/Delete confirm. No name retyping (matches
    US-WIN-1.2 / US-ENV-2 patterns). Single JSON-Patch
    `remove`. **No** physical purge of orphans this row may
    have referenced (consistent with envelope's "Unused
    materials" treatment, Q-ENV-2).
11. **Drift badges for catalog-linked rows** — when a row's
    `catalog_origin.catalog_version_id !=
    current_catalog_version_id`, render the same drift badge
    + diff dialog as US-WIN-4.2 / US-ENV-11. Hidden in V2 v1
    for tables whose catalogs haven't shipped.
12. **Empty-state.** Table-specific copy + primary CTA wired
    to the table's add-row flow. E.g. "No rooms yet. **[+ Add
    room]**". Secondary line if the table is catalog-eligible:
    "Or pick from the catalog when it's available."
13. **Locked-version + anonymous-viewer rendering.** Read-only —
    cell editing disabled, add/delete hidden, sort/filter/
    group still functional, ⌘C copy still works (read-only is
    a UX state, not a data state).
14. **Per-table JSON download** — under the table's overflow
    `⋯` menu. Exports a slice of the document body
    (`{ "table_key": [...] }`) for the active version. Same
    semantics as the project-level JSON download, just scoped.
15. **All mutations through the draft buffer** (PRD §8.3) —
    one JSON-Patch per row operation; no chatty multi-PATCH.

16. **User-defined single-select column type** (per
    `research/poc-plans/poc-evaluation.md` §4.3 — Phase 4 of
    the catalog-spike). Tables can declare columns of type
    `single_select` whose options are **defined per-project by
    the user** (not hard-coded enums) and stored alongside
    project data in the document. This is a shared primitive
    used by multiple tables (Rooms `floor_level` /
    `building_zone`, future TBs / ERVs / etc.).

    **Storage shape** in the project document body:
    ```jsonc
    {
      "schema_version": 1,
      "project": { ... },
      "tables": { "rooms": [...], ... },
      "single_select_options": {
        "<table_key>.<column_key>": [
          { "id": "opt_<ULID>", "label": "Basement",
            "color": "#6b7280", "order": 0 },
          { "id": "opt_<ULID>", "label": "Ground",
            "color": "#3b82f6", "order": 1 },
          { "id": "opt_<ULID>", "label": "1st",
            "color": "#10b981", "order": 2 }
        ],
        "rooms.building_zone": [ /* ... */ ]
      }
    }
    ```
    Row cells reference options by stable `option_id`
    (`"floor_level": "opt_01HXYZ..."`), not by label —
    renames are non-destructive.

    **Behavior:**
    - **Pills with palette colors.** Each option renders as a
      pill in its `color`. Phase 4 spike has the palette wired.
    - **Cell popover with search + create.** Click cell → popover
      lists existing options; type to filter; "Create '<x>'"
      shortcut creates a new option using the next palette color
      and appends to the column's option list. Inline-create is
      shipping in the spike (POC §4.3 qualified-yes).
    - **Match-or-create on paste.** Pasting a column of strings
      runs through the spike's `single-select match-or-create`
      pipeline — case-aware match against existing labels;
      unmatched strings auto-create new options (consolidated
      toast lists everything created); single ⌘Z reverts the
      cell writes AND the option creations as one op (spike
      L6.5).
    - **Sort follows option order, not alphabetical.** When the
      user sorts by a single-select column, rows order by
      `option.order`, not by `label`. Reordering options
      reorders the table (AirTable parity — POC §4.3 L2.4).
    - **Nullable** — cells may be empty (`null`); sort treats
      null as last (configurable per-column if needed v1.1+).

17. **Single-select header modal** — option management
    (drag-reorder + recolor + rename + delete). This was
    deferred from the catalog-spike Phase 4 (POC §4.3
    qualifications), but is **required for V2 v1** because Rooms
    needs explicit user control over option order (drives sort).

    **Trigger:** click the column header's `⋯` menu →
    **"Edit options…"**.

    **Modal contents:**
    - Vertical list of options, each row: drag handle, color
      swatch (clickable → palette picker), label text-input,
      delete `×` button. shadcn `Dialog` + `react-aria-components
      DropZone` (or equivalent) for drag-reorder.
    - Drag-reorder updates `order` integers; sort follows.
    - Recolor swatch click opens a palette popover; selection
      writes `color`.
    - Rename in-place; commits on blur or Enter; affects
      every row referencing this option (no row mutation —
      cell-render pulls the latest label).
    - **Delete with row-impact warning.** When the option is
      referenced by ≥1 row, the delete `×` opens a sub-dialog:
      *"3 rows reference 'Basement'. Choose what to do:"*
      → **(a)** Clear those cells (set `null`), then delete.
      → **(b)** Replace with a different option (dropdown of
      remaining options).
      → **(c)** Cancel.
    - **Add option** at the bottom — same UX as inline-create
      from the cell popover; gets the next palette color.
    - **Save / Cancel** at the bottom of the modal.

    All mutations route through the draft buffer as
    JSON-Patches against
    `body.single_select_options["<table>.<column>"]`.

### Cross-cutting hooks for LLM-friendliness

The MCP server (PRD §10.3) exposes per-table read/write tool
calls keyed by `table_key`: `read_table`, `add_row`,
`update_row`, `delete_row`. The `<ProjectDataTable>` component
should not know about MCP; the *backend* exposes uniform
endpoints that the MCP server wraps. From day 1, every table
type added gets MCP support for free.

### Resolved questions (2026-05-10)
- **Q-TBL-1: Per-user persisted view state?** Resolved: **no
  persistence in V2 v1.** Single view state per table per
  session, kept in-memory only — last edits survive sub-tab
  navigation, reset on reload. The richer "saved / named /
  shareable views" model (analogous to AirTable Interfaces)
  is a deliberate post-parity feature, captured as
  **NEW-TBL-1** below. Rationale: avoid building two view-state
  systems (a session one and a persistence one) when the
  end-state is shareable views, which is a much bigger UX
  surface than just localStorage caching.
- **Q-TBL-2: Per-row deep-link URLs.** Resolved: defer to
  v1.1+. URL format when added would be
  `/projects/{id}/equipment/rooms/{row_id}` mirroring Q-ENV-9
  / Q-WIN-5.
- **Q-TBL-3: Bulk row operations** (delete N rows, set field
  on N rows). Resolved: defer to v1.1+. Multi-select + ⌘C
  copy ships in V2 v1; multi-edit / bulk-delete doesn't.

### Open questions
None outstanding.

### Related new feature (post-parity)

**NEW-TBL-1 — Shareable stable views (AirTable-Interface
analog).** Status: stub · post-parity · Source: Ed feedback
2026-05-10 (Q-TBL-1 resolution thread).

> As a CPHC, I want to save a named view of any project data
> table (a particular sort + filter + group + column-visibility
> config) and share that view via a stable URL with my project
> team — contractors, clients, certifiers — so they always land
> on the same curated slice without me having to re-explain the
> filter every time.

**Why this matters.** AirTable's "Interface" feature (and to a
lesser extent its saved Views) is a workflow Ed and BLDGTYP
teams already rely on — the value isn't just personal-
preference persistence, it's *team-coordination*: "open this
URL to see only the rooms with iCFA ≥ 0.5, sorted by floor
level, grouped by building zone — that's what we're reviewing
in tomorrow's design call."

**Open design questions (queued, not blocking V2 v1):**

- View ownership — per-project (visible to all editors) or
  per-user (private until shared)?
- View identity — short-id slug in URL
  (`/projects/{id}/equipment/rooms?view=q4-design-review`) or
  opaque ULID?
- View fields — sort + filter + group + column-visibility +
  active-cell? Or also "frozen rows / cells" for presentation?
- Editable on a shared URL, or strictly read-only?
- Apply across multiple tables, or per-table only?
- Versioned with the project document, or independent of
  versions (so a view URL keeps working as the project
  evolves)?

**Cross-references.** Couples with NEW-LLM-API-1 (asset / API
endpoints) — agentic workflows ("create a view that shows…")
ride on this. The view persistence layer should expose CRUD
endpoints from day 1 so the MCP server can manage views.

---

## US-Builder-Equipment — Equipment tab (US-3.5)

**Status:** Draft · **Priority:** MVP (promotes the placeholder
in US-3.5 to a walked story; sub-stories US-EQ-1..6 detail the
sub-tabs)
**PRD ref:** §6.2 (`tables.rooms`, `tables.equipment`), §6.3
(non-catalog tables), §11.1 (project tabs)
**V1 ref:** V1 has equipment surfaces under the AirTable
backend; V2 brings them into the project document and into the
unified table-view UX (US-Builder-Tables)

### Story
> As an editor, I want a single "Equipment" tab that gathers
> all per-project occupancy and MEP data — Rooms, Thermal
> Bridges, ERVs, Pumps, Fans — under one roof, so I have one
> destination for "everything that's not envelope and not
> windows." Sub-tabs let me focus on one table at a time
> without losing the parent context.

### Why one tab, not five

Per Q-LAND-1's resolved tab bar (Status / Windows / Envelope /
**Equipment** / Model), Equipment is one of five top-level tabs.
Splitting Rooms, Thermal Bridges, and the equipment tables into
five top-level tabs would push the bar to 9 tabs and bury
related data behind extra clicks. The sub-tab convention used
by Envelope (Assemblies / Specifications / Airtightness / Site
Photos) carries over here cleanly. **Decision (a) per Ed,
2026-05-10.**

### Sub-tabs (in display order)

| Order | Sub-tab | Story | V2 v1 status | Catalog-linked? |
|---|---|---|---|---|
| 1 | Rooms | US-EQ-2 | **Full draft** — source-of-truth for downstream HBJSON | No (rooms unlikely to ever have a catalog) |
| 2 | Thermal Bridges | US-EQ-3 | **Placeholder** — scaffolding + empty-state copy only; full schema deferred to v1.1+ | No |
| 3 | ERVs | US-EQ-4 | **Full draft** — ventilation-critical for PH | Catalog deferred to v1.1+ |
| 4 | Pumps | US-EQ-5 | **Placeholder** — scaffolding + empty-state copy only; full schema deferred to v1.1+ | Catalog deferred to v1.1+ |
| 5 | Fans | US-EQ-6 | **Full draft** — ventilation-critical for PH | Catalog deferred to v1.1+ |

Default sub-tab on first visit: **Rooms** (it's the
source-of-truth that downstream tools — Rhino, the energy model
— consume; users are most likely to land here first when
populating a new project).

### Architectural decisions

- **All five sub-tabs share the US-Builder-Tables primitive.**
  Per-sub-tab stories cover only the column set, per-field
  validation, row-detail-modal contents, and any unique
  affordances. The shared half (toolbar, keyboard nav,
  mutations, locked-version, drift badges, JSON download) is
  inherited.
- **All five tables are hand-entered in V2 v1.** PRD §3
  non-goals: equipment catalogs (ERVs, Pumps, Fans, Heat-Pumps,
  etc.) ship in v1.1+. Each row's schema includes
  `catalog_origin: null | <object>` from day 1 so adding the
  catalog-pick path later is additive — no schema migration.
- **Rooms is special: PHN-first source-of-truth.** Per Ed's
  framing (2026-05-10), Rooms data is **defined in PHN first**,
  then **consumed by Rhino** to generate HBJSON. HBJSON is
  downstream of the rooms table, not upstream. There is **no
  "sync from HBJSON"** action — that would invert the data
  flow. A future "Compare HBJSON vs Rooms" QA/QC feature is
  captured as a post-parity new feature (NEW-ROOMS-1 below).

### Sub-stories

#### US-EQ-1 — Equipment tab structure (sub-tab nav)

**Status:** Draft · **Priority:** MVP
**Mirrors:** US-ENV-1 (envelope sub-tab structure)

**Acceptance criteria:**

1. **Sub-tab bar** below the Equipment tab heading. Five
   sub-tabs in the order above. shadcn `Tabs` primitive.
2. **URL deep-link** per Q-LAND-1 / Q-ENV-9 pattern:
   - `/projects/{id}/equipment` → redirect to
     `/projects/{id}/equipment/rooms` (default sub-tab)
   - `/projects/{id}/equipment/rooms`
   - `/projects/{id}/equipment/thermal-bridges`
   - `/projects/{id}/equipment/ervs`
   - `/projects/{id}/equipment/pumps`
   - `/projects/{id}/equipment/fans`
   - Browser back / forward navigates sub-tab history.
3. **Sub-tab content area** renders the matching
   `<ProjectDataTable>` (US-Builder-Tables) with that table's
   column definition and validation rules.
4. **Persistent toolbar above the data table** — sort / filter
   / group / reset (per US-Builder-Tables criterion 2). Distinct
   from the page-level / project-level header above.
5. **Locked-version + anonymous-viewer rendering.** Sub-tab nav still
   functional; tables rendered read-only (US-Builder-Tables
   criterion 13).

### Resolved questions (2026-05-10)
- **Q-EQ-1: Sub-tab order.** Resolved: **Rooms / Thermal
  Bridges / ERVs / Pumps / Fans** (as listed). Rooms first
  matches "user populates this first."
- **Q-EQ-2: Default sub-tab on first visit to the Equipment
  tab.** Resolved: **Rooms** (source-of-truth, most-edited).
  `/projects/{id}/equipment` redirects to
  `/projects/{id}/equipment/rooms`.

### Open questions
None outstanding.

### Related new feature (post-parity)

**NEW-ROOMS-1 — "Compare HBJSON vs Rooms" QA/QC feature.**
Status: stub · post-parity. As a CPHC, after uploading a Rhino-
generated HBJSON to the Model tab (US-Viewer), I want a QA
action that compares the HBJSON's room metadata against the
Rooms table and flags drift (room renamed in Rhino without
updating PHN; iCFA factor changed in only one place; new room
appears in HBJSON but not in PHN; etc.). Surfaces in the Model
tab and on the Rooms sub-tab. Important quality gate for late-
stage QA but not blocking V2 v1.

---

## US-EQ-2 — Rooms sub-tab

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.rooms[]` — needs amendment per
Q-EQ-2.x resolutions below)
**V1 ref:** V1 captured rooms in AirTable; V2 brings them into
the project document.
**Inherits:** US-Builder-Tables (toolbar, keyboard nav,
mutations, locked-version, JSON download).

### Story
> As an editor, I want a Rooms table that captures the per-room
> metadata our Rhino → HBJSON pipeline depends on — name,
> number, floor level, building zone, occupant count, bedroom
> count, iCFA factor, ERV-unit assignment — so the energy model
> and certification submittals derive consistently from a single
> source-of-truth in PHN.

### Data shape (per Ed's spec, 2026-05-10; Q-EQ-2.x resolved)

```jsonc
{
  "id": "rm_<ULID>",
  "name": "LIVING ROOM",
  "number": "101",
  "floor_level": "opt_01HXYZ...",     // single-select option_id; ref to body.single_select_options["rooms.floor_level"][*].id
  "building_zone": "opt_01HABC...",   // single-select option_id; ref to body.single_select_options["rooms.building_zone"][*].id; nullable
  "num_people": 2,
  "num_bedrooms": 0,
  "icfa_factor": 1.0,                 // clamped [0.0, 1.0]
  "erv_unit_ids": ["erv_<ULID>"],     // array of refs to tables.equipment.ervs[*].id; empty array = no ERV; multiple ERVs allowed
  "catalog_origin": null,             // forward-compatible (rooms have no catalog and likely never will)
  "notes": null
}
```

**Companion `single_select_options` entries** (project document):
```jsonc
{
  "single_select_options": {
    "rooms.floor_level": [
      { "id": "opt_...", "label": "Basement", "color": "#6b7280", "order": 0 },
      { "id": "opt_...", "label": "Ground",   "color": "#3b82f6", "order": 1 },
      { "id": "opt_...", "label": "1st",      "color": "#10b981", "order": 2 }
      /* user-defined per-project; reordering options reorders the table */
    ],
    "rooms.building_zone": [
      /* user-defined per-project; nullable on the row;
         no predictable structure imposed */
    ]
  }
}
```

### Acceptance criteria

1. **Inherits US-Builder-Tables criteria 1–15** (table
   primitive, toolbar, keyboard nav, multi-cell copy, default
   sort, add/edit/delete, draft-buffer mutations, locked-
   version handling, JSON download).
2. **Column set** (default visible, default sort by `number`
   ascending via `naturalSortCompare`):
   | Column | Type | Validation | Notes |
   |---|---|---|---|
   | `number` | string | required, unique-within-project (case-insensitive trim) | sort key |
   | `name` | string | required | |
   | `floor_level` | **single_select** (US-Builder-Tables criteria 16–17) | option_id ref into `single_select_options["rooms.floor_level"]`; required | sort follows option order, not label |
   | `building_zone` | **single_select** (US-Builder-Tables criteria 16–17) | option_id ref into `single_select_options["rooms.building_zone"]`; **nullable** | user-defined options; no enum imposed |
   | `num_people` | int | `>= 0` | |
   | `num_bedrooms` | int | `>= 0` | |
   | `icfa_factor` | float | `0.0 <= x <= 1.0`, default `1.0` | |
   | `erv_unit_ids` | **array of refs** | each id must reference an existing `tables.equipment.ervs[*].id`; empty array allowed | multi-select dropdown listing this project's ERV units by `name`; **a room may be served by 0, 1, or multiple ERVs** (per Q-EQ-2.4 resolution); updates live as ERVs are added |
3. **Add row.** Hand-enter only (no catalog). Empty-defaults:
   `number`, `name` blank (required); `floor_level` set to the
   first option in `single_select_options["rooms.floor_level"]`
   if any exist (else null with a "Pick a floor level" prompt
   in the row-detail modal); `building_zone: null`; counts `0`;
   `icfa_factor: 1.0`; `erv_unit_ids: []`.
4. **Row-detail modal** opens on row click. Title:
   `"Room: {number} — {name}"` (or `"New room"` for unsaved
   row). All 8 columns editable; `notes` (multi-line)
   available under a "Notes" expander.
5. **`number` uniqueness** enforced like
   US-WIN-1's name-uniqueness — trim + case-insensitive
   comparison; add/duplicate auto-suffix `(2)`, `(3)`; rename
   rejects collisions with toast.
6. **`erv_unit_id` referential integrity.** When the
   referenced ERV is deleted (US-EQ-4), affected rooms have
   their `erv_unit_id` set to `null` and a soft-warning toast
   surfaces: *"3 rooms had their ERV assignment cleared because
   'ERV-A' was deleted."* No cross-table cascade-delete.
7. **HBJSON downstream — no auto-sync.** Rooms data is
   PHN-first; the Rhino model consumes it to generate HBJSON.
   The Rooms sub-tab has **no "Sync from HBJSON"** action —
   that would invert the data flow. The `HBJSON` upload action
   (US-ENV-12 / US-Viewer) does **not** mutate `tables.rooms`.
8. **Empty state.** "No rooms yet. **[+ Add room]**." Single
   primary CTA. (No catalog-pick alternative — this table has
   no catalog and is unlikely to ever have one.)
9. **Per-table JSON download** under `⋯` menu yields
   `{ "rooms": [...] }` for the active version.
10. **Locked-version + anonymous-viewer rendering** per
    US-Builder-Tables criterion 13.

### Resolved questions (2026-05-10)

- **Q-EQ-2.1: `floor_level` data type.** Resolved:
  **user-defined single-select column, per-project**, leveraging
  the catalog-spike single-select primitive (US-Builder-Tables
  criteria 16–17; POC §4.3). Each project's CPHC defines an
  ordered option list (e.g. `[Basement, Ground, 1st, 2nd, Roof]`);
  rooms reference options by stable `option_id`. **Sort follows
  the option order, not alphabetical** — reordering options in
  the header modal reorders the table data (AirTable parity).
  This handles both numeric ("1st", "2nd") and non-numeric
  ("Basement", "Roof", "Mezzanine", "B-2") values without an
  imposed schema.

- **Q-EQ-2.2: `building_zone` data type.** Resolved: same as
  Q-EQ-2.1 — **user-defined single-select per-project,
  nullable.** No enum is imposed; the user types whatever zone
  labels their project needs ("residential", "common-space",
  "rooftop garden", whatever). Empty cells (`null`) are
  permitted — not all rooms need a zone.

- **Q-EQ-2.3: `icfa_factor` constraints.** Resolved:
  **clamp `[0.0, 1.0]`, default `1.0`.** Mechanical rooms
  typically 0; primary living spaces 1.0; circulation sometimes
  fractional. Validation enforces clamp on save.

- **Q-EQ-2.4: ERV-unit assignment cardinality.** Resolved:
  **N:M (a room may be served by 0, 1, or multiple ERVs).**
  Stored as `erv_unit_ids: string[]`, each id referencing a
  `tables.equipment.ervs[*].id`. In real projects, a single
  room can legitimately be served by more than one ERV unit
  (e.g. a large multi-zone apartment with separate supply
  trains, or a room straddling two ventilation zones in a
  retrofit). The empty array is the default and represents "no
  ERV" (passive ventilation, or ventilation handled by a Fan
  row instead).

- **Q-EQ-2.5: HBJSON-vs-Rooms compare feature scope.**
  Resolved: **defer until after V2 v1 MVP ships.** Captured as
  **NEW-ROOMS-1 (post-parity)** in US-Builder-Equipment. The
  QA-rule set (which fields matter most for drift, drift
  severity thresholds, presentation) needs at least one real
  project's worth of usage data before we can spec it well —
  building it speculatively is wasted work.

### Open questions
None outstanding.

### Cross-references

- ERV-unit dropdown source: `tables.equipment.ervs[]` →
  US-EQ-4.
- iCFA-factor consumed by:
  - **US-ENV-14 (Airtightness)** — the iCFA used for Phius
    CORE cfm50/sf is the HBJSON's
    `interior_conditioned_floor_area`, which is computed from
    Rhino geometry × per-room iCFA factors. Rooms-table data
    feeds *into* the HBJSON, not the other way around.
- Future: energy-model service will read this whole table.

---

## US-EQ-3 — Thermal Bridges sub-tab

**Status:** Placeholder · **Priority:** MVP scaffolding only —
**full data shape, row-detail modal, and Ψ-value computation
deferred to v1.1+** (per Q-EQ-3.1 / Q-EQ-3.2 resolutions
2026-05-10)
**PRD ref:** §6.2 (`tables.thermal_bridges` — empty-list
placeholder in V2 v1)

### Scope in V2 v1 (placeholder)

The Thermal Bridges sub-tab exists in V2 v1 **as scaffolding
only** so the Equipment tab structure (US-EQ-1) is complete and
the URL deep-link `/projects/{id}/equipment/thermal-bridges`
resolves. **No editable schema ships in v1.**

Concretely:

1. Sub-tab nav routes correctly (US-EQ-1 criterion 2).
2. The `<ProjectDataTable>` primitive renders, but the
   underlying `tables.thermal_bridges` array is empty and there
   are **no editable columns** in v1.
3. The empty state copy reads:
   *"Thermal Bridges — coming in v1.1+. Continue to track these
   in your existing simulation deliverables (Flixo, Dartwin)
   and add them directly to the energy model for now."*
   No `[+ Add]` CTA.
4. Add / edit / delete are all hidden in v1.
5. Locked-version + anonymous-viewer rendering as inherited (the
   placeholder card renders identically).

### Why placeholder, not full draft

Per Ed (2026-05-10): the simulation deliverables (Flixo 2D,
Dartwin 3D files + PDFs) and the energy-model TB list
currently live outside PHN, and integrating them is non-trivial
work that doesn't gate the V2 v1 use cases. Demoting to
placeholder lets the Equipment tab structure ship without
blocking on the TB-specific UX questions.

### Deferred to v1.1+ (full draft preserved below)

The schema and acceptance criteria below are **deferred** —
captured here as the v1.1+ starting point so the design is not
lost. Ed's MVP guidance is to keep the placeholder above and
walk this section when v1.1+ planning begins.

> **v1.1+ data shape (deferred):**
> ```jsonc
> {
>   "id": "tb_<ULID>",
>   "name": "Wall-to-Slab Junction",
>   "category": "opt_<ULID>",                // user-defined single-select; no seeded defaults (Q-EQ-3.2 resolved)
>   "length_m": 4.85,
>   "psi_value_w_mk": 0.04,
>   "assembly_id": "asm_<ULID>",
>   "simulation_method": "opt_<ULID>",       // user-defined single-select; no seeded defaults
>   "simulation_file_asset_ids": [],
>   "datasheet_asset_ids": [],
>   "notes": null,
>   "catalog_origin": null
> }
> ```
>
> **v1.1+ acceptance criteria (deferred):**
> - Inherits US-Builder-Tables criteria 1–17.
> - Column set: name / category / length_m / psi_value_w_mk /
>   assembly_id / simulation_method / simulation_file_asset_ids.
> - Linear-only — point thermal bridges (count × χ-value)
>   deferred again to a later v1.x (Q-EQ-3.1 resolved). Schema
>   additive — `kind: 'linear' | 'point'` enum + conditional
>   `count` / `chi_value_w_k` fields can land then.
> - `assembly_id` referential integrity: assembly delete
>   nulls the ref + soft-warning toast.
> - Datasheet / simulation-file uploads follow the
>   per-project QA principle (auto-memory
>   `qa_principle_per_project_datasheets`).
> - Cross-refs: `assembly_id` → `tables.assemblies[]`
>   (US-ENV-2); energy-model service will sum
>   `length_m × psi_value_w_mk` for total Ψ-loss contribution.

### Resolved questions (2026-05-10)
- **Q-EQ-3.1: Point thermal bridges in v1.1+.** Resolved:
  **defer for MVP — placeholder tab / table is enough for now.**
  The whole sub-tab is placeholder in V2 v1; point-vs-linear is
  a question for the v1.1+ full draft.
- **Q-EQ-3.2: Default suggested options for `category` and
  `simulation_method`.** Resolved: **none. Defer for MVP** along
  with the rest of the schema. When the v1.1+ draft lands, the
  user defines option lists from scratch (no seeded defaults).

### Open questions
None outstanding for V2 v1 (nothing to spec — placeholder
only). v1.1+ planning will re-open the deferred design.

---

## US-EQ-4 — ERVs sub-tab

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.equipment.ervs[]`), §6.3 (non-catalog
in v1; catalog deferred to v1.1+ per PRD §3 / §7.0)
**V1 ref:** V1 captured ERV units in AirTable per project; V2
moves them into the project document.
**Inherits:** US-Builder-Tables (criteria 1–17 including
single-select column type).

### Story
> As an editor, I want an ERVs table that captures each
> physical ERV / HRV unit installed on the project — name,
> manufacturer, model, type (ERV vs HRV), nominal performance
> (airflow, sensible recovery efficiency, electrical power),
> and a project-level datasheet — so Rooms (US-EQ-2) can
> reference these units and the energy model has the per-unit
> performance data it needs.

### Data shape

```jsonc
{
  "id": "erv_<ULID>",
  "name": "ERV-A",
  "manufacturer": "opt_<ULID>",               // single-select option_id; user-defined; no seeded defaults
  "model_number": "ComfoAir Q450",
  "unit_type": "opt_<ULID>",                  // single-select option_id; user-defined; no seeded defaults (ERV+HRV combined per Q-EQ-4.2; user types their own labels)
  "nominal_airflow_cfm": 250.0,
  "sensible_recovery_efficiency": 0.85,       // 0.0–1.0
  "electrical_power_w": 110.0,                // fan power at nominal CFM
  "datasheet_asset_ids": ["asset_..."],
  "notes": null,
  "catalog_origin": null                      // forward-compat; ERV catalog ships in v1.1+
}
```

### Acceptance criteria

1. **Inherits US-Builder-Tables criteria 1–17.**
2. **Column set** (default visible, default sort by `name`
   ascending):
   | Column | Type | Validation | Notes |
   |---|---|---|---|
   | `name` | string | required, unique-within-project | sort key |
   | `manufacturer` | single_select | nullable | user-defined per-project; **no seeded defaults** |
   | `model_number` | string | optional | |
   | `unit_type` | single_select | nullable | user-defined per-project; **no seeded defaults** — user types their own labels (e.g. "ERV", "HRV", "DOAS"); ERV + HRV share this single table per Q-EQ-4.2 resolved |
   | `nominal_airflow_cfm` | float | `> 0` | display in active unit (CFM / L/s) |
   | `sensible_recovery_efficiency` | float | `0.0 ≤ x ≤ 1.0` | percentage display in UI |
   | `electrical_power_w` | float | `≥ 0` | |
3. **Add row** — **two paths in V2 v1**:
   - **Hand-enter** — `catalog_origin: null`. Always available.
   - **Pick from catalog** — wired into the picker primitive
     **but the catalog itself is deferred** (PRD §3 non-goal).
     The "Pick from catalog" button is **hidden in V2 v1** and
     becomes visible automatically when the ERV catalog ships
     (v1.1+). The `catalog_origin` shape on each row supports
     this from day 1 — no migration needed.
4. **Row-detail modal.** Title: `"ERV: {name}"`. Datasheet
   uploader section per QA principle (project-only datasheets,
   never catalog-side; auto-memory
   `qa_principle_per_project_datasheets`).
5. **`name` uniqueness.** Trim + case-insensitive comparison;
   add/duplicate auto-suffix `(2)`, `(3)`; rename rejects
   collisions. Mirrors US-EQ-2 `number` uniqueness.
6. **Empty state.** "No ERV / HRV units yet. **[+ Add unit]**."
   When the catalog ships, secondary line "Or pick from the
   ERV catalog" appears.
7. **Per-table JSON download** under `⋯` menu.
8. **Locked-version + anonymous-viewer rendering** per
    US-Builder-Tables criterion 13.

### Deferred to v1.1+ (deliberately out of v1 scope)
- `latent_recovery_efficiency` (LRE) — relevant for full ERVs
  in cooling-dominated climates.
- `serves_zone` — single-select for which zone/floor; reverse-
  derivable from rooms.erv_unit_ids.
- `installation_location` (string) and `ducting_distance_m`
  (float) — needed for distribution-loss calc.
- `commissioning_test_date`, `commissioning_certified_cfm` —
  for QA after install. Likely lands as part of a
  Commissioning sub-tab in v2 along with airtightness
  (US-ENV-14) and other test data.

### Resolved questions (2026-05-10)
- **Q-EQ-4.1: Default seeded options for `unit_type` and
  `manufacturer`?** Resolved: **no seeded defaults for either.**
  User defines all option labels per-project. Aligns with the
  broader 2026-05-10 directive that V2 v1 ships zero seeded
  single-select defaults — the user controls vocabulary.
- **Q-EQ-4.2: Treat ERV and HRV as one table or split?**
  Resolved: **one combined table for all ERV and HRV units.**
  Data shape is identical; the `unit_type` single-select holds
  whatever labels the user defines (typically "ERV" and "HRV",
  but they can use any labels). PRD §7.0 also groups them as
  "ERV units."

### Open questions
None outstanding.

### Cross-references
- `tables.rooms[*].erv_unit_ids` references `id` of rows in
  this table (US-EQ-2 criterion 6 referential integrity).
- Catalog integration: deferred to v1.1+; story copy on the
  catalog manager side will surface "ERV catalog (v1.1+)" as
  a roadmap item per PRD §7.0.

---

## US-EQ-5 — Pumps sub-tab

**Status:** Placeholder · **Priority:** MVP scaffolding only —
**full data shape and row-detail modal deferred to v1.1+** (per
Q-EQ-5.1 resolution 2026-05-10)
**PRD ref:** §6.2 (`tables.equipment.pumps` — empty-list
placeholder in V2 v1)

### Scope in V2 v1 (placeholder)

The Pumps sub-tab exists in V2 v1 **as scaffolding only** so the
Equipment tab structure (US-EQ-1) is complete and the URL deep-
link `/projects/{id}/equipment/pumps` resolves. **No editable
schema ships in v1.**

Concretely:

1. Sub-tab nav routes correctly (US-EQ-1 criterion 2).
2. The `<ProjectDataTable>` primitive renders, but the
   underlying `tables.equipment.pumps` array is empty and
   there are **no editable columns** in v1.
3. Empty-state copy:
   *"Pumps — coming in v1.1+. Continue tracking pump
   electrical loads in your existing energy-model spreadsheet
   for now."* No `[+ Add]` CTA.
4. Add / edit / delete are all hidden in v1.
5. Locked-version + anonymous-viewer rendering as inherited.

### Why placeholder, not full draft

Per Ed (2026-05-10): pumps are a less-universal data set than
ERVs / Fans (some PH projects don't even have circulation
pumps), and the energy-model integration is non-trivial enough
that demoting to placeholder is the right v1 cut. Full draft
preserved below for v1.1+ planning.

### Deferred to v1.1+ (full draft preserved below)

> **v1.1+ data shape (deferred):**
> ```jsonc
> {
>   "id": "pmp_<ULID>",
>   "name": "DHW Recirc",
>   "manufacturer": "opt_<ULID>",            // user-defined single-select; no seeded defaults
>   "model_number": "Grundfos UP15-10",
>   "pump_type": "opt_<ULID>",               // user-defined single-select; no seeded defaults (Q-EQ-5.1 resolution dropped the seeded-defaults pattern)
>   "electrical_power_w": 25.0,
>   "runtime_hours_per_year": 8760,
>   "datasheet_asset_ids": [],
>   "notes": null,
>   "catalog_origin": null
> }
> ```
>
> **v1.1+ acceptance criteria (deferred):**
> - Inherits US-Builder-Tables criteria 1–17.
> - Column set: name / manufacturer / model_number /
>   pump_type / electrical_power_w / runtime_hours_per_year.
> - Two-path add (hand-enter; catalog-pick when Pump catalog
>   ships per PRD §7.0).
> - Datasheet QA principle (auto-memory).
> - `name` uniqueness within project.
> - Flow-rate / head-pressure deferred again to a later v1.x
>   when hydraulic-design verification surfaces a real need.

### Resolved questions (2026-05-10)
- **Q-EQ-5.1: Flow-rate / head-pressure fields for v1?**
  Resolved: **defer for MVP — placeholder tab and table are
  enough.** The whole sub-tab is placeholder in V2 v1. Even
  in the v1.1+ full draft, flow / head stay deferred (energy
  model only uses `power × runtime`).

---

## US-EQ-6 — Fans sub-tab

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.equipment.fans[]`), §6.3, §7.0
(future Fan catalog with `sub_category` column for
extract-trash / kitchen / laundry / other)
**Inherits:** US-Builder-Tables (criteria 1–17).

### Story
> As an editor, I want a Fans table that captures each
> non-ventilation-system fan on the project — kitchen extract,
> bathroom extract, dryer, range hood, etc. — so the energy
> model has per-fan power consumption and runtime, and the
> ventilation calculation knows about exhaust paths that
> don't go through an ERV.

### Data shape

```jsonc
{
  "id": "fan_<ULID>",
  "name": "Kitchen Extract",
  "manufacturer": "opt_<ULID>",
  "model_number": "Panasonic FV-08VKM3",
  "fan_purpose": "opt_<ULID>",                // single-select; defaults seeded per PRD §7.0 sub_categories: Kitchen Extract / Bath Extract / Dryer / Laundry / Range Hood / Other
  "airflow_cfm": 80.0,
  "electrical_power_w": 18.0,
  "runtime_hours_per_day": 0.5,               // average — user estimates per their occupancy profile
  "datasheet_asset_ids": [],
  "notes": null,
  "catalog_origin": null                      // Fan catalog v1.1+
}
```

### Acceptance criteria

1. **Inherits US-Builder-Tables criteria 1–17.**
2. **Column set** (default sort by `name`):
   | Column | Type | Validation | Notes |
   |---|---|---|---|
   | `name` | string | required, unique-within-project | |
   | `manufacturer` | single_select | nullable | user-defined; **no seeded defaults** |
   | `model_number` | string | optional | |
   | `fan_purpose` | single_select | nullable | user-defined; **no seeded defaults** — user types their own labels (Kitchen Extract, Bath Extract, etc.). v1.1+ Fan catalog (PRD §7.0) will introduce a `sub_category` whose options ARE catalog-managed; user-defined options here are independent of that |
   | `airflow_cfm` | float | `> 0` | display in active unit (CFM / L/s) |
   | `electrical_power_w` | float | `≥ 0` | |
   | `runtime_hours_per_day` | float | `0 ≤ x ≤ 24` | average daily runtime estimate |
3. **Add row** — two-path; catalog button hidden in v1.
4. **Row-detail modal.** Title: `"Fan: {name}"`. Datasheet
   uploader.
5. **`name` uniqueness** as US-EQ-4 / 5.
6. **Empty state.** "No fans yet. **[+ Add fan]**."
7. **Per-table JSON download** + locked-version rendering as
   inherited.

### Resolved questions (2026-05-10)
- **Q-EQ-6.1: Default seeded `fan_purpose` options?** Resolved:
  **no seeded defaults for MVP.** User defines all option
  labels per-project. Aligns with the broader 2026-05-10
  directive that V2 v1 ships zero seeded single-select
  defaults. When the v1.1+ Fan catalog (PRD §7.0) ships, its
  catalog `sub_category` column is independent of the
  user-defined `fan_purpose` here.
- **Q-EQ-6.2: Vent-path attribution to a Room (`serves_room_id`).**
  Resolved: **defer to v1.1+.** Most projects have 1–2 extract
  fans; explicit room linkage is overhead in v1. Add when a
  multifamily project surfaces a real need.

### Open questions
None outstanding.

### Cross-references
- Same datasheet QA principle as US-EQ-4.
- Catalog integration deferred to v1.1+; story will land
  alongside the Fan catalog roster (PRD §7.0).
- Coordinates with ERVs (US-EQ-4) — between them, Rooms'
  ventilation paths are fully covered.

---

## US-Viewer — Model tab (3D HBJSON viewer)

**Status:** Draft (parent + architectural decisions); sub-stories
US-VIEW-1..7 detail the implementation surfaces.
**Priority:** MVP — last of the 5 project workspace tabs
(US-3.6 in the tab roster: Status / Windows / Envelope /
Equipment / **Model**)
**PRD ref:** §11.4 (3D viewer — R3F + drei + postprocessing),
§11.4.2 (`project_hbjson_files` table), §11.4.6 (HBJSON ↔
builder data manually cross-referenced), §3 (non-goals — no
HBJSON write-back to builder tables)
**V1 ref:** `research/v1-3d-model-viewer-reference.md`
(authoritative V1 enumeration — 17 sections covering routes,
schemas, services, scene setup, viz states, tool states,
color-by modes, loaders, UI components, cross-cutting concerns)
**Convention reference:** `context/glossary.md` — Thermal
performance section (U-values exclude films; the viewer
surfaces them in the info panel verbatim from HBJSON, so
labels match)

### Story

> As a CPHC working on a project, I want to upload completed
> HBJSON exports from the Rhino / Honeybee toolchain at
> multiple points during a project's lifecycle (5–20 MB each),
> view each upload as 3D geometry in a dedicated Model tab,
> switch between visualization modes (geometry / interior
> spaces / floor segments / sun path / ventilation ducts /
> hot-water piping / color-by), pick objects to read their
> metadata in a side panel, and measure distances between
> vertices — so I can review the model's correctness against
> the design intent and use it as a reference surface for QA,
> client walkthroughs, and certifier submittals.

### Why this is its own (large) story

The 3D viewer is the **single largest surface** in PHN by code
and by behavior count — V1's reference doc runs 763 lines
covering 7 viz states × 3 tool states × 6 color-by modes × per-
object info-panel configs × 7 specialized loaders, all on top
of a Three.js scene-graph and DOM-event-driven state machine.
Walking it as one monolithic story would mean ~100 acceptance
criteria. Splitting into seven sub-stories keeps each one
reviewable and lets us walk them in dependency order
(file-management → scene → states → coloring → info → backend).

The viewer is **deliberately disconnected** from the builder
tables (PRD §11.4.6 + the post-2026-05-10 PRD §3 non-goals
update). HBJSON renders for visualization only; nothing flows
back into `tables.assemblies`, `tables.project_materials`,
`tables.rooms`, or any other table. This is the same
PHN-first-source-of-truth principle that drives US-EQ-2
(rooms) and US-ENV-12 (HBJSON export). The viewer is a
read-only window into "what came out of the Rhino model
downstream."

### Key V1 → V2 shifts

| V1 | V2 |
|---|---|
| Vanilla Three.js + `useRef`-driven imperative scene mutations | **React Three Fiber + drei + @react-three/postprocessing** (PRD §11.4). Declarative `<Canvas>`-based scene, viz/tool state in Zustand, geometry as `<primitive>` / drei components |
| HBJSON in AirTable (per-project, dated revisions) | **HBJSON in Cloudflare R2 + `project_hbjson_files` table** (PRD §11.4.2). Per-project file lifecycle, independent of project document versions (Ed 2026-05-10) |
| AirTable-managed uploads (out-of-band) | **In-tab drag-drop upload** in the Model tab itself (Ed 2026-05-10, US-VIEW-1) |
| Backend converts m³/s → m³/h pre-Pydantic before sending | **Backend SI canonical** (PRD §11.5). Wire transports m³/s; frontend converts m³/s → CFM at display time |
| Process-local 1-hour TTL cache (`LimitedCache`) | **R2 ETag-based fetch** — no in-memory cache; HBJSON is immutable post-upload so ETag works as the cache key (PRD §11.4.2) |
| Module-global handler registries mutated from render bodies | **Zustand slices** for viz-state, tool-state, color-by-state, selected-object, hover-object. Standard R3F pattern: `useFrame` + `useThree` for scene access |
| `alert()` for load failures | **Sonner toasts** + retry button per the global error UX |
| Comments tool placeholder (button exists, no behavior) | **Dropped entirely** from V2 v1 (Ed 2026-05-10) |
| `dimensionLinesRef` added to scene in render body | **Declarative `<group>` containing dimension lines** as a child of `<Canvas>`. State (point pairs) lives in Zustand |
| AirBoundary faces silently skipped by extractor | **Skip preserved** (Q-VIEW-1 resolved 2026-05-10). Backend logs each skipped face; load-summary toast surfaces count |
| Supply / exhaust ducts rendered with same color | **Split colors in V2 v1** (Q-VIEW-2 resolved 2026-05-10). Supply blue, exhaust red |
| Shades not selectable | **Preserved — shades NOT selectable** (Q-VIEW-3 resolved 2026-05-10, redirect from lean). V1 parity |
| Pipe info panel only shows ID + Name | **Surface all loaded fields** (Q-VIEW-4 resolved 2026-05-10) — diameter, insulation thickness/conductivity/reflective/quality, water temp, daily period, length, material |
| Z-up camera (`up = (0, 0, 1)`) | **Preserved** — Rhino/Honeybee convention; non-negotiable |

### Architectural decisions (resolved 2026-05-10)

1. **HBJSON pinning model — independent picker.** The Model tab
   has its own HBJSON-file picker. The Airtightness sub-tab
   (US-ENV-14) pins its own HBJSON via
   `project_airtightness.hbjson_file_id` for derived-calc
   reproducibility. **The two are independent** — switching the
   Model tab's view does not affect the Airtightness pin. (Per
   Ed 2026-05-10.)

2. **HBJSON file lifecycle — per-project, NOT per-document-
   version.** HBJSON files are uploaded over the lifetime of a
   project (multiple revisions: round 1 model, round 2 after
   design changes, final cert model). They are NOT bound to
   `project_versions`. Switching the active project document
   version does not change which HBJSONs are available. (Per
   Ed 2026-05-10. Matches V1.)

3. **Upload UX — inside the Model tab itself.** Drag-drop zone
   in the Model tab's file picker dropdown; co-located with
   where the file will be consumed. NOT a project-header
   `⋯` action. (Per Ed 2026-05-10. Detail in US-VIEW-1.)

4. **Comments tool dropped from V2 v1.** V1's placeholder button
   is not carried forward. (Per Ed 2026-05-10.) If 3D-space
   annotation surfaces as a real need, it lands as a separate
   v1.1+ story.

5. **Viewer-only stance — no write-back to builder tables.**
   Already locked in PRD §3 non-goals (after the US-ENV-12
   scope reduction 2026-05-10). HBJSON renders for
   visualization only.

### Sub-stories (in implementation dependency order)

| ID | Scope | Priority |
|---|---|---|
| US-VIEW-1 | HBJSON file management — upload, list, pick, delete; `project_hbjson_files` schema; R2 storage integration | MVP |
| US-VIEW-2 | 3D scene setup — R3F `<Canvas>`, Z-up camera, lighting, ground plane, orbit controls, postprocessing | MVP |
| US-VIEW-3 | Viz state machine + menubar — 7 modes (Geometry / Interior Floors / Interior Spaces / Site+SunPath / Ventilation / Hot-Water Piping / ColorBy) | MVP |
| US-VIEW-4 | Tool state machine + menubar — Select, Measure (Comments dropped per architectural decision 4) | MVP |
| US-VIEW-5 | Color-by modes — 6 attributes (FaceType / Boundary / OpaqueConstruction / ApertureConstruction / VentilationAirflow / FloorWeightingFactor) + static/dynamic legend | MVP |
| US-VIEW-6 | Element info panel — per-type field configs + IP/SI unit conversion at display | MVP |
| US-VIEW-7 | Backend — `project_hbjson_files` routes + bulk `/model_data` extraction (port `services/model_elements.py` from V1, with SI canonical conversion fix) | MVP |

US-Viewer sub-stories will reference `research/v1-3d-model-viewer-reference.md` extensively — that file is the V1 source-of-truth for behavior to preserve. The reference's "§16 no-regression checklist" is the V2 acceptance gate.

### Resolved questions (2026-05-10)

All 9 Q-VIEW questions resolved 2026-05-10. Summary:

- **Q-VIEW-1: AirBoundary face handling.** Resolved:
  **omit AirBoundary surfaces in MVP** (V1-parity skip).
  Backend extractor logs each skipped face; the load-summary
  toast surfaces the count to the user ("3 air boundaries
  skipped — not rendered in V2 v1"). Rendering AirBoundaries
  as a distinct (dashed / translucent) surface type defers
  to v1.1+.

- **Q-VIEW-2: Supply vs exhaust duct color split.**
  Resolved: **split colors in V2 v1** — supply blue,
  exhaust red (final hex values picked during US-VIEW-3
  walk). V1 used the same `ductLine` material for both;
  this is a trivial UX win for V2.

- **Q-VIEW-3: Shade selectability.** Resolved (redirect
  from lean): **shades NOT selectable in V2 v1** (V1
  parity). Shades render in the SunPath viz state but are
  not added to `selectableObjects` and have no info-panel
  config. Making them selectable defers to v1.1+ if a real
  use case surfaces.

- **Q-VIEW-4: Pipe info panel — richer fields.** Resolved:
  **surface all loaded pipe userData fields in V2 v1** —
  diameter, insulation thickness, insulation conductivity,
  insulation reflective, insulation quality, water temp,
  daily period, length, material. V1 only displayed ID +
  Name despite loading the rest. Cheap, meaningful for
  cert-review walkthroughs.

- **Q-VIEW-5: Loading UX.** Resolved: **non-blocking Sonner
  toast with progress** ("Loading model: 12 MB · 40%
  downloaded / parsing geometry / building scene"). Replaces
  V1's blocking modal `Dialog` with `CircularProgress`. Lets
  the user click around the rest of the app while a large
  model loads.

- **Q-VIEW-6: Sun-path time-of-year scrubber.** Resolved:
  **defer to v1.1+.** Annual envelope (V1 behavior — all
  hourly analemmas + monthly arcs rendered simultaneously)
  is enough for design reviews; scrubber adds UI complexity
  without clear v1 payoff.

- **Q-VIEW-7: Legend-as-filter.** Resolved: **defer to
  v1.1+** — but flagged as **near-priority post-MVP** per
  Ed 2026-05-10 ("definitely will want later"). Captured
  as **NEW-VIEW-2** below; should be one of the first
  post-MVP additions.

- **Q-VIEW-8: Section / clipping planes.** Resolved:
  **defer to v1.1+.** Useful for "show me the wall section
  through this room" but needs UI for plane placement +
  non-trivial R3F integration. Not gating MVP.

- **Q-VIEW-9: HBJSON-vs-document cross-check.** Resolved:
  **defer to v1.1+ as NEW-VIEW-1 post-parity** (below).
  Family with NEW-ROOMS-1 (Compare HBJSON vs Rooms QA/QC).
  PRD §11.4.6 explicitly leaves this out of scope for V2 v1.

### Open questions
None outstanding.

### Related new features (post-parity)

**NEW-VIEW-1 — HBJSON ↔ project document cross-check (Q-VIEW-9).**
Status: stub · post-parity. Family with NEW-ROOMS-1
(US-Builder-Equipment). As a CPHC after uploading an HBJSON,
I want PHN to flag any divergence between what the HBJSON
describes (window types, room metadata, assembly names) and
what the builder tables say. Surfaces in the Model tab as
inline warnings on suspect objects + a top-bar "5 divergences
found" summary.

**NEW-VIEW-2 — Legend-as-filter (Q-VIEW-7).** Status: stub ·
**near-priority post-MVP** per Ed 2026-05-10 ("definitely
will want later"). As a CPHC reviewing a complex model, I
want to click a swatch in the ColorByLegend to **hide all
non-matching elements** — e.g. click the "RoofCeiling"
swatch in the FaceType legend to see only roof faces; click
an "Insulation" entry in the OpaqueConstruction legend to
isolate every wall layer using that product. Shift-click
toggles multi-select (show roofs AND floors). Reset by
clicking the active swatch again, or via a "Clear filter"
button at the top of the legend.

This couples cleanly with V2's ColorBy system — the legend
already knows the mapping; this just inverts it for
visibility control. **Should be one of the first post-MVP
additions** based on Ed's signaled priority.

### Cross-references

- **`research/v1-3d-model-viewer-reference.md`**
  — authoritative V1 reference; consulted for every sub-story.
  The "§16 no-regression checklist" is the V2 acceptance
  gate.
- **PRD §11.4 (3D viewer)** — locks in R3F + drei + postprocessing.
- **PRD §11.4.2 (`project_hbjson_files`)** — table schema for
  HBJSON file metadata. Detailed in US-VIEW-1.
- **PRD §11.4.6 (HBJSON ↔ builder data)** — manually
  cross-referenced; no auto-sync either direction.
- **PRD §11.5 (units architecture)** — SI canonical on the
  wire; fixes V1's m³/s → m³/h backend conversion.
- **PRD §3 (non-goals)** — locks in no HBJSON write-back to
  builder tables.
- **US-ENV-14 (Airtightness)** — uses a separately-pinned
  HBJSON (`project_airtightness.hbjson_file_id`); does NOT
  follow the Model tab's picker.
- **US-ENV-12 (HBJSON construction export)** — the OTHER
  HBJSON surface in V2; produces HBJSON, doesn't consume it.
- **NEW-LLM-API-1** — per-feature endpoints (faces, spaces,
  ventilation, etc.) are MCP-callable for LLM-assisted
  workflows ("show me all rooms with v_sup < 30 m³/h"). The
  bulk `/model_data` endpoint is the viewer-side default;
  per-feature endpoints stay live for MCP.

---

## US-VIEW-1 — HBJSON file management

**Status:** Draft · **Priority:** MVP — gates all other
US-VIEW-* (nothing can render without a file)
**PRD ref:** §6.5 (`project_assets` backbone), §11.4.2
(`project_hbjson_files` subtype table), §3 (non-goals —
viewer-only)
**V1 ref:** `2026-05-10-v1-3D-model-viewer-reference.md` §2.1
(`/hb_model/{bt_number}/models` route), §13.3
(`ModelSelector.tsx`), §14.4 (process-local cache — replaced
in V2)
**Inherits:** US-Builder-Tables only loosely — this isn't a
table-view surface; it's a custom uploader + picker

### Story

> As an editor on a project, I want to upload HBJSON exports
> from my Rhino / Honeybee workflow into the Model tab via a
> simple drag-drop, see all of this project's uploaded
> HBJSONs in a dated list, pick which one to view, and
> delete obsolete uploads — without that file management
> touching the project document or its versions.

### Data model

HBJSON uses the generic asset backbone from PRD §6.5 plus a
viewer-specific subtype table. File bytes and R2 metadata live in
`project_assets`; viewer labels, notes, optional version provenance,
and cached geometry summaries live in `project_hbjson_files`.

```sql
CREATE TABLE project_hbjson_files (
  id                      UUID PRIMARY KEY,
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id                TEXT NOT NULL UNIQUE REFERENCES project_assets(id),
                                                    -- project_assets.asset_kind = 'hbjson'
  display_name            TEXT NOT NULL,            -- user-supplied or default to original filename
  notes                   TEXT,                     -- optional user-supplied note ("Round 2 model after slab change")
  uploaded_by_user_id     INTEGER NOT NULL REFERENCES users(id),
  uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Geometry summary cached at upload time (also used by US-ENV-14 Airtightness)
  extracted_volume_m3            FLOAT,
  extracted_envelope_area_m2     FLOAT,
  extracted_floor_area_m2        FLOAT,
  extraction_status              TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
  extraction_error               TEXT,
  extracted_at                   TIMESTAMPTZ,

  deleted_at              TIMESTAMPTZ                -- soft delete; preserves history
);

CREATE INDEX project_hbjson_files_project_id_idx ON project_hbjson_files (project_id) WHERE deleted_at IS NULL;
```

`project_assets` supplies `object_key`, `r2_etag`, `size_bytes`,
`content_hash_sha256`, `content_type`, signed URL generation, soft
delete, and GC behavior for HBJSON exactly as it does for datasheets and
site photos.

**Why per-project, not per-version:** confirmed 2026-05-10
(US-Viewer architectural decision 2). HBJSONs are uploaded
over a project's lifecycle (round 1 / round 2 / final cert
model) and outlive any individual document version. Tying them
to versions would force users to "save a new version" just to
upload a file, which doesn't match the workflow.

### Acceptance criteria

1. **Surface inside the Model tab.** A file picker
   (compact dropdown trigger) sits at the top of the Model
   tab content area. Shows the current selection: e.g.
   `"📁 Round 2 model · 2026-04-12 · 14.2 MB ▾"`. Clicking
   opens a dropdown panel with the full file list.

2. **Dropdown panel contents** — top-to-bottom:
   - **Drag-drop upload zone** at the top of the panel:
     dashed-border rectangle with text *"Drop a `.hbjson`
     file here, or [browse]"*. Also accepts files via the
     `[browse]` link → native file picker.
   - **Vertical list of files**, sorted by `uploaded_at`
     descending (newest first). Each row:
     - File icon + `display_name` (editable inline on
       row-click of a pencil icon)
     - Sub-row: `{size_mb} MB · uploaded {relative_time} by
       {uploader_display_name}`
     - Optional `notes` field rendered as a third sub-row
       (italic, muted)
     - **Active** indicator (checkmark + bg-highlight) on
       the currently-viewed file
     - `⋯` row-action menu: Rename, Edit notes, Delete
   - **Refresh button** at the bottom (`RefreshCw` icon
     with text "Refresh list") — re-fetches the file list
     from the backend in case another editor uploaded since
     the dropdown was opened.

3. **Upload behavior:**
   - Single-file at a time in V2 v1 (multi-file drag-drop
     deferred — adds UX complexity for queueing).
   - File-type validation: must end in `.hbjson` or `.json`
     (case-insensitive). On rejection, toast: *"Only
     `.hbjson` files are supported. Please drop a Honeybee
     Model JSON."*
   - File-size cap: **50 MB**. Files larger than 50 MB
     rejected with toast: *"File is too large (max 50 MB).
     Please contact support if you need to upload a larger
     model."* — 5–20 MB is the typical range (per Ed); 50
     MB cap gives 2× headroom.
   - Default `display_name` = the original filename minus
     extension. User can rename before/after upload.
   - **Content-hash dedup:** server computes
     `content_hash_sha256` on receipt. If an existing
     non-deleted file in this project has the same hash,
     the upload is rejected with toast: *"This file matches
     an existing upload ({existing.display_name}). Switch
     to it instead?"* with a `[Switch]` button. Avoids
     duplicate 20 MB files in R2.
   - Upload progress shows as a thin progress bar across
     the upload zone (no modal). On completion, the new
     file becomes the active selection and the viewer
     reloads.

4. **R2 storage path:**
   - Created through the generic asset upload-intent endpoint
     with `asset_kind = 'hbjson'`.
   - Object key follows the asset backbone convention:
     `projects/{project_id}/assets/{asset_id}/{safe_filename}`.
   - Content-type: `application/json`.
   - `r2_etag`, `size_bytes`, and `content_hash_sha256` are captured
     on the `project_assets` row during upload completion.

5. **Geometry summary extraction** (runs server-side after
   upload finishes):
   - Backend job parses the HBJSON and extracts
     `extracted_volume_m3` (sum of `room.volume`),
     `extracted_envelope_area_m2` (sum of exterior face
     areas), `extracted_floor_area_m2` (sum of iCFA per
     honeybee_ph spaces per Q-ENV-14.2 resolution).
   - `extraction_status` transitions `pending` → `success`
     or `failed`. On failure, store the error message in
     `extraction_error`; the file is still uploadable and
     viewable — the failure only affects derived calcs
     (US-ENV-14 Airtightness).
   - These cached summaries are why
     `project_hbjson_files` is the right schema location:
     **the table serves both the viewer AND US-ENV-14.**
     One upload, one extraction, used twice.

6. **Picking a file** (clicking a row in the dropdown):
   - Sets the active HBJSON file id in the Model tab's
     Zustand store
     (`modelViewerStore.activeHbjsonFileId`).
   - **Persists in-session only** (NOT persisted per-user
     across sessions). Switching projects / re-opening the
     app resets to "newest available file" (the natural
     default behavior).
   - Triggers a viewer reload: `<Canvas>` remounts (or
     scene clears) and `/model_data` fetches the new
     file's contents.
   - URL updates with the file id:
     `/projects/{id}/model?file={hbjson_file_id}` — so
     deep-links and browser-back work.

7. **Default file on first visit:** newest non-deleted file
   for this project. If no files exist yet, the Model tab
   shows an empty state: *"No HBJSON files uploaded yet.
   **[Drop a file here]** or [browse] to upload your first
   model."* Drop-zone is the empty state CTA.

8. **Rename** (inline pencil icon on the row, or via `⋯ →
   Rename`):
   - Edits `display_name`. Saves on blur or Enter.
   - Empty names rejected; trimmed of whitespace.
   - Same name allowed across multiple files in the same
     project (no uniqueness constraint — files are
     identified by id, not name).

9. **Delete** (via `⋯ → Delete`):
   - shadcn `Dialog` confirm — title **"Delete this HBJSON
     file?"**, body **"'{display_name}' will be removed
     from the file list. If this file is pinned by the
     Airtightness sub-tab, that pin will be cleared. R2
     storage retention follows the project's standard 90-
     day retention policy (PRD §10.5 mirror)."**, buttons
     **Cancel** / **Delete**.
   - On confirm: soft-delete (set `deleted_at`); cascade-
     clear `project_airtightness.hbjson_file_id` to null
     if it pointed here (with the soft-warning toast on
     US-ENV-14 the next time someone opens that tab).
   - If the deleted file was the active selection, the
     viewer switches to the next-newest file (or empty
     state if none remain).
   - R2 garbage collection runs as a background job;
     90-day retention before purge (matches PRD §10.5
     deleted-project policy for consistency).

10. **Edit notes** (via `⋯ → Edit notes` or pencil on the
    notes sub-row):
    - Multi-line text area (max 1000 chars).
    - Saves on blur.
    - Useful for marking "Round 2 model after slab change"
      / "Final cert submittal model" / etc.

11. **Permissions:**
    - **Editors:** full read + upload + rename + edit
      notes + delete.
    - **Anonymous public viewers:** read only. Can pick which
      file to view; cannot upload / rename / delete. The
      dropdown's upload zone is hidden; `⋯` menus on
      rows are hidden.
    - Signed URLs are short-lived and are resolved through the
      standard public read route; raw R2 object keys are never exposed.

12. **Locked-version handling:** **N/A** — HBJSON files
    are NOT bound to project document versions
    (architectural decision 2). The project's active
    version being locked does not affect HBJSON upload /
    rename / delete. This is a deliberate decoupling.

13. **Loading UX (cross-references US-VIEW-2 / US-VIEW-7):**
    - During the `/model_data` fetch + parse, the viewer
      shows a non-blocking Sonner toast with progress
      (lean per Q-VIEW-5).
    - The file-picker dropdown remains usable so a user
      can switch files without waiting for the current
      one to fully render.

14. **MCP-friendliness** (per NEW-LLM-API-1):
    - `GET /projects/{id}/hbjson-files` — list endpoint;
      same shape the dropdown consumes.
    - `POST /projects/{id}/assets/upload-intent` with
      `asset_kind='hbjson'` — returns signed PUT URL.
    - `POST /projects/{id}/assets/{asset_id}/complete-upload` —
      marks the uploaded asset complete.
    - `POST /projects/{id}/hbjson-files` — links the uploaded asset
      into the HBJSON viewer metadata table; content-hash dedup applies
      at the asset layer.
    - `GET /projects/{id}/hbjson-files/{file_id}/download` —
      returns signed R2 URL.
    - `DELETE /projects/{id}/hbjson-files/{file_id}` —
      soft-delete.
    - These endpoints are MCP-tool-callable from day 1, so
      an agentic workflow can manage HBJSON uploads
      ("upload this file from my email attachment and
      switch the viewer to it").

### Resolved questions (2026-05-10)

- All four architectural questions (pinning model, file
  lifecycle, upload UX, drop Comments) resolved at the
  US-Viewer parent level. No US-VIEW-1-specific open
  questions at this point.

### Open questions
None outstanding.

### Cross-references

- **PRD §11.4.2** — formal `project_hbjson_files` schema
  lands here.
- **US-ENV-14 (Airtightness)** — also reads
  `project_hbjson_files` rows + the cached geometry
  summary. Pin (`project_airtightness.hbjson_file_id`)
  is independent of the Model tab's active selection
  (architectural decision 1).
- **US-VIEW-2..7** — all depend on the active HBJSON file
  selected here.
- **NEW-LLM-API-1** — MCP endpoints for HBJSON file CRUD.

---

## US-VIEW-2 — 3D scene setup (R3F canvas, camera, lighting, ground)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4 (R3F + drei + postprocessing stack)
**V1 ref:** §6 (`scene_setup/SceneSetup.tsx` — class-based world),
§7 (`Materials.tsx`), §14.1 (Z-up convention as non-negotiable)
**Inherits:** none — this is the foundation US-VIEW-3..6 build on

### Story
> As an editor opening the Model tab, I want a 3D canvas that
> renders with the correct Rhino-conventional axis orientation
> (Z up), a sensible default view, smooth orbit / pan / zoom
> controls, and good-enough lighting to actually see the
> geometry — so I can drop a model in and start reviewing.

### Acceptance criteria

1. **R3F `<Canvas>`** mounts inside the Model tab's content
   area below the file picker (US-VIEW-1). Fills the
   remaining height; resizes with the window. Black or
   theme-default background.

2. **Camera — Z-up convention** (V1 ref §14.1, non-negotiable
   for Rhino / honeybee_ph compatibility):
   - `<PerspectiveCamera>` with `up={[0, 0, 1]}` set
     explicitly on first mount.
   - Initial position: `[-25, 40, 30]` (V1 parity).
   - Looks at `[0, 0, 0]`.
   - FOV: 45°. Near 0.1, far 1000.

3. **Orbit controls** (`@react-three/drei` `<OrbitControls>`):
   - `rotateSpeed = 0.9`, `zoomSpeed = 3.0` (V1 parity).
   - Target locked to origin by default; auto-recenters on
     model load (lean — V1 didn't recenter, which is a
     papercut when models drift far from origin).
   - Damping enabled for smoother rotate / pan.

4. **Lighting** (mirrors V1 §6 Lighting):
   - `<ambientLight>` — `SURFACE_WHITE`, intensity per
     `defaultLightConfiguration.indirectLightIntensity`.
   - `<directionalLight>` at `[-10, -10, 25]` with
     `castShadow`, shadow-camera frustum `{top:25,
     bottom:-25, left:-25, right:25}`.
   - All color constants come from `styles/AppColors.ts`
     (project-global, NOT a model-viewer-local file).

5. **Shadow map** enabled: `PCFSoftShadowMap`.

6. **Ground plane + grid** (V1 §6):
   - 50×50 `<Plane>` at z=0 with a shadow-only material
     (drei `<shadowMaterial>` with opacity 0.3). Receives
     shadows from the directional light; does NOT cast.
   - Two grid helpers via drei `<Grid>` — 50 units, 50 + 5
     subdivisions, rotated to lie flat on the XY plane.
     Always visible (no toggle in V2 v1; v1.1+ candidate).

7. **Postprocessing** via `@react-three/postprocessing`:
   - SMAA antialiasing on by default (drei's `<Effects>`
     wrapping `<SMAA>` or the postprocessing equivalent).
   - **No SAO / SSAO in v1** — V1 ref §6 explicitly tried
     `SAOPass` and disabled it ("too slow, and too shitty"
     per the V1 inline comment). V2 sticks with the same
     "antialias only" baseline; richer effects defer to
     v1.1+ if needed.

8. **CSS2D label layer** (for Measure-mode distance labels,
   US-VIEW-4) — drei `<Html>` or a CSS2DRenderer instance
   scoped to the canvas wrapper (NOT to `document.body` as
   V1 did per V1 ref §14.8 — that pattern leaks labels
   across tab switches). Pointer-events: none on the
   overlay layer so labels don't intercept clicks.

9. **Scene reset on file switch.** When the user picks a
   different HBJSON in the US-VIEW-1 dropdown, the scene
   clears (all loader-produced groups unmount via React's
   normal unmount path; geometry GC's). New file's
   geometry mounts after `/model_data` fetch completes.
   This is automatic with R3F's declarative model — no
   manual `world.reset()` needed (V1 ref §14 cleanup
   notes are obsolete).

10. **Loading UX** (Q-VIEW-5 resolved): non-blocking Sonner
    toast with progress states — "Downloading model…" /
    "Parsing geometry…" / "Building scene…". Toast updates
    in place via Sonner's `toast.loading()` / `toast.success()`
    API. Replaces V1's blocking MUI `Dialog` with
    `CircularProgress` (V1 ref §5).

11. **Locked-version + anonymous-viewer rendering.** Scene renders
    identically. Tool / Viz menubars (US-VIEW-3, US-VIEW-4)
    still functional — viewing is always available.

### Resolved questions (2026-05-10)
- **Q-VIEW-5 (loading UX):** non-blocking toast — see
  criterion 10.
- **Q-VIEW-8 (section / clipping planes):** deferred to
  v1.1+. Not in v1 scope.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §6, §7, §14.1, §14.8** — scene setup,
  materials, Z-up convention, label-scoping bug.
- **US-VIEW-1** — provides the active HBJSON file id;
  scene reloads on file switch.
- **US-VIEW-3 / US-VIEW-4** — viz / tool state machines
  hook into the scene built here.

---

## US-VIEW-3 — Viz state machine + menubar (7 modes)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4
**V1 ref:** §8.1 (`appVizStateTypeEnum`), §9.1–9.7 (loaders
per mode), §13.1 (`VizStateMenubar.tsx`), §14.6 (module-global
handlers — V2 refactor target)

### Story
> As an editor exploring an HBJSON model, I want to switch
> between visualization modes — exterior building geometry,
> interior spaces, interior floor segments, site (sun path +
> shades), ventilation ducts, hot-water piping, and color-by
> — via a single menubar at the bottom of the canvas, with
> exactly one mode active at a time and smooth transitions
> between them.

### Acceptance criteria

1. **`VizStateMenubar`** — horizontal icon-button row,
   centered at the bottom of the canvas (floating overlay).
   Order matches V1 ref §13.1:
   - **Geometry** — Exterior Surfaces
   - **FloorSegments** — Interior Floors
   - **Spaces** — Interior Spaces
   - **SunPath** — Site (sun path + shades)
   - **Ducts** — Ventilation Ducting
   - **Pipes** — Hot Water Piping
   - **ColorBy ▾** — opens a sub-menu (criterion 6)

2. **Active-button visual feedback** — currently-active
   button gets a highlighted background. Clicking the
   already-active button **reverts to Geometry** (the
   implicit "off" state), matching V1.

3. **Exactly one viz state active at a time.** Switching
   modes unmounts the previous mode's geometry visibility
   + selectable-objects scope, then mounts the new mode's
   visibility + scope.

4. **Per-mode visibility rules** (mirror V1 §8.1):
   | Mode | Visible groups | Selectable scope |
   |---|---|---|
   | Geometry | Building meshes + outlines + vertices | Building meshes |
   | FloorSegments | Floor meshes + outlines + vertices + building outlines (context) | Floor meshes |
   | Spaces | Space meshes + outlines + building outlines (context) | Space meshes |
   | SunPath | Building meshes + outlines + vertices + sun-path diagram + shade meshes + shade wireframe | Building meshes (shades NOT selectable per Q-VIEW-3) |
   | Ducts | Ventilation geometry + building outlines (no meshes) | Duct segments |
   | Pipes | Pipe geometry + building outlines (no meshes) | Pipe segments |
   | ColorBy | Delegated to color-by attribute (see US-VIEW-5) | Per attribute |

5. **State implementation — Zustand, not module-globals.**
   `modelViewerStore.vizState: VizMode` (replaces V1's
   `appVizStateTypeEnum` reducer). Mount / dismount
   behaviors implemented as R3F `useEffect` cleanup in the
   group components themselves (e.g. `<BuildingGeometryGroup
   visible={vizState === 'Geometry' || vizState ===
   'SunPath' || ...}>`), NOT as imperative scene
   mutations. V1 ref §14.6 module-global handler registries
   are explicitly replaced.

6. **ColorBy sub-menu** — clicking the ColorBy menubar
   button opens a dropdown (shadcn `DropdownMenu` or
   similar) listing the 6 attributes per V1 ref §13.1:
   - **FaceType**
   - **Boundary**
   - --- divider ---
   - **Opaque Construction**
   - **Aperture Construction**
   - --- divider ---
   - **Ventilation Airflow**
   - **Floor Weighting Factor**
   Picking an attribute dispatches `vizState = 'ColorBy'`
   (if not already) AND `colorByAttribute = <picked>` (full
   color-by logic detailed in US-VIEW-5).

7. **Mount / dismount visual continuity.** Switching modes
   is essentially instant — no fade / transition animation
   in V2 v1 (V1 parity). v1.1+ could add a fade if it
   helps orientation.

8. **Sun-path scrubber NOT included** (Q-VIEW-6 deferred to
   v1.1+). SunPath mode renders V1's annual envelope (all
   hourly analemmas + monthly arcs simultaneously).

9. **Locked-version + anonymous-viewer rendering.** Menubar fully
   functional — viz-state changes are viewing operations,
   not edits.

### Resolved questions (2026-05-10)
- **Q-VIEW-3 (shade selectability):** shades NOT selectable
  even in SunPath mode (V1 parity, redirect from earlier
  lean). See criterion 4 row "SunPath."
- **Q-VIEW-6 (sun-path scrubber):** deferred to v1.1+. See
  criterion 8.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §8.1, §9, §13.1** — viz state semantics + per-mode
  loaders + menubar layout.
- **US-VIEW-5** — ColorBy attribute switching detail.
- **US-VIEW-7 (backend)** — provides the data for each
  mode's loaders.

---

## US-VIEW-4 — Tool state machine + menubar (Select, Measure)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4
**V1 ref:** §8.2 (`appToolStateTypeEnum`), §12 (Select +
Measure handlers), §13.2 (`ToolStateMenubar.tsx`)

### Story
> As an editor reviewing a model, I want two interaction
> tools: a Select tool that lets me click any object to see
> its metadata in the side panel, and a Measure tool that
> lets me click two vertices to get a distance label between
> them — accessible via a small persistent toolbar.

### Acceptance criteria

1. **`ToolStateMenubar`** — small toolbar at the bottom-
   left of the canvas (overlay). Two buttons in this
   order:
   - **Select** (V1 ref §13.2 "Surface" icon)
   - **Measure** (V1 ref §13.2 "Ruler" icon)
   - **Comments DROPPED per architectural decision 4** (no
     placeholder button rendered in V2 v1, per Ed
     2026-05-10).

2. **Active-button visual feedback** — same pattern as
   `VizStateMenubar`. Clicking the active button reverts
   to **None** (no tool).

3. **Tool semantics:**
   | Tool | OnClick | OnPointerMove | OnExit cleanup |
   |---|---|---|---|
   | None | — | — | — |
   | Select | Raycast → set `selectedObjectId`; apply highlight material via `userData['materialStore']` contract (V1 ref §12.2) | Raycast → set `hoverObjectId`; apply hover material | Restore both highlight + hover materials; clear selection state |
   | Measure | If a hovering vertex is held, drop a dimension line from last vertex to current; CSS2D distance label at midpoint | Snap pointer to nearest face vertex (V1 ref §12.3); render marker sphere at snap target | Clear dimension lines group; null `hoveringVertex` |

4. **State implementation — Zustand** (mirrors US-VIEW-3).
   `modelViewerStore.toolState: ToolMode`. Event
   subscription happens in a component-scoped
   `useEffect`, NOT a module-global handler registry
   (V1 ref §14.6 replaced).

5. **Select tool — drag-vs-click detection.** Click must
   be within 5px of the original `mousedown` position to
   register; otherwise it's an orbit-camera drag and
   doesn't trigger selection (V1 ref §12.1).

6. **`materialStore` userData contract** (V1 ref §12.2,
   §14.5 — load-bearing for ColorBy + Select interaction).
   Every selectable mesh carries `userData['materialStore']`
   = "the material to restore me to when I'm no longer
   highlighted." Select / hover write the highlight
   material to `mesh.material` but leave `materialStore`
   intact. ColorBy (US-VIEW-5) updates BOTH `mesh.material`
   AND `materialStore` simultaneously, so a deselect
   during ColorBy mode restores to the color-by material,
   not the original.

7. **Measure tool vertex snap** — picks the nearest vertex
   from `buildingGeometryVertices` (the per-face corner
   vertex points loaded in US-VIEW-7). Threshold: vertex
   within ~20px of pointer (camera-space). Marker is a
   small drei `<Sphere>` at the snap target.

8. **Measure tool dimension line** — built from two
   consecutive snap-target clicks:
   - drei `<Line>` from previous vertex to current vertex,
     using the `dimensionLine` material.
   - CSS2D label at the line midpoint showing the Euclidean
     distance, formatted in the active unit (m / ft).
     V1's distance string formatting (1 decimal, "1.23 m"
     or "4.0 ft") preserved.
   - Pill-shaped white background with shadow (DOM-styled
     via the project's design system, NOT V1's loose
     CSS file).

9. **Measure tool dimension-line lifecycle:**
   - Dimension lines accumulate across multiple click pairs
     while Measure tool is active. Each pair = one
     dimension line.
   - Switching to a different tool (or no tool) clears all
     dimension lines.
   - Switching the viz state ALSO clears dimension lines
     (the source vertices may no longer be visible).

10. **Locked-version + anonymous-viewer rendering.** Both tools
    fully functional — selecting / measuring are viewing
    operations.

### Resolved questions (2026-05-10)
- **Comments tool dropped from V2 v1** per architectural
  decision 4 (Ed 2026-05-10). Not even a placeholder
  button.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §8.2, §12, §13.2** — tool state semantics +
  handlers + menubar.
- **US-VIEW-2 criterion 8** — CSS2D label scoping (drei
  `<Html>` or canvas-scoped `CSS2DRenderer`).
- **US-VIEW-5** — `materialStore` contract is shared with
  ColorBy.
- **US-VIEW-6** — Select tool's `selectedObjectId` feeds
  the info panel.
- **US-VIEW-7** — `buildingGeometryVertices` provides snap
  targets for Measure.

---

## US-VIEW-5 — Color-by modes (6 attributes + legend)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4
**V1 ref:** §11 (`modeColorBy.tsx` + `colorByColors.ts`),
§13.5 (`ColorByLegend/`), §14.5 (`materialStore` contract)

### Story
> As an editor reviewing a model, I want six color-by
> attributes that re-color the visible geometry by a
> meaningful grouping (face type, boundary condition,
> construction id, ventilation airflow, floor weighting
> factor) with a matching legend, so I can visually scan
> for outliers, anomalies, and grouping mistakes in the
> model.

### Acceptance criteria

1. **Six color-by modes** (mirror V1 ref §11.1):
   | Mode | Acts on | Color source | Legend |
   |---|---|---|---|
   | FaceType | Building meshes | `faceTypeColors` static map (Wall, RoofCeiling, Floor, Aperture, default) | static |
   | Boundary | Building meshes | `boundaryColors` static map (Outdoors, Ground, Adiabatic, Surface, default) | static |
   | OpaqueConstruction | meshes with `userData.type === 'faceMesh'` | Per-construction-identifier deterministic hash (cyrb53 + golden-ratio HSL — V1 §11.2 algorithm preserved) | **dynamic** |
   | ApertureConstruction | meshes with `userData.type === 'apertureMeshFace'` | Same hash, keyed by aperture construction id | **dynamic** |
   | VentilationAirflow | `spaceGroup` groups | `ventilationAirflowColors` static map (SupplyOnly, ExtractOnly, SupplyAndExtract, NoVentilation, default), categorized by `(v_sup > 0, v_eta > 0)` | static |
   | FloorWeightingFactor | `spaceFloorSegmentMeshFace` meshes | `floorWeightingFactorColors` static map (5 buckets) | static |

2. **Floor weighting bucket boundaries — clean up V1 §11.1
   inconsistency.** V1's `getWeightingFactorCategory`
   has a gap at exactly `0.3` (strict-`>` conditions on
   both sides). V2 buckets — closed at the upper end,
   open at the lower (except for the `0.0` bucket which
   is exact):
   - `FullyTreated`: `factor >= 0.6` (incl 1.0)
   - `Semi`: `0.5 <= factor < 0.6`
   - `Partial`: `0.3 <= factor < 0.5`
   - `Minimal`: `0.0 < factor < 0.3`
   - `NonTreated`: `factor == 0.0`
   Real PH factors are typically 0.0, 0.5, 0.6, or 1.0 so
   the practical hit rate of the edge cases is near zero,
   but the cleanup makes the math defensible.

3. **Duct color split — supply blue, exhaust red**
   (Q-VIEW-2 resolved). This is **not technically a
   "color-by mode"** — it's the default rendering when
   the Ducts viz state is active (US-VIEW-3). Supply
   ducts always use the supply-blue `LineMaterial`;
   exhaust ducts always use the exhaust-red `LineMaterial`.
   No legend in V2 v1 (just the implicit color convention);
   v1.1+ could add a one-time visual legend.

4. **`materialStore` contract** (V1 ref §14.5, shared
   with US-VIEW-4 Select):
   - On entering ColorBy mode, for each affected mesh:
     - Stash `mesh.material` into
       `userData['colorByOriginalMaterial']` **only if
       not already present** (idempotent across attribute
       switches).
     - Write the new color-by `MeshBasicMaterial` to BOTH
       `mesh.material` and `userData['materialStore']`.
   - On exiting ColorBy mode: restore `mesh.material` and
     `userData['materialStore']` from
     `userData['colorByOriginalMaterial']`.
   - **Switching attributes within ColorBy mode** —
     `applyColorByMode` always calls the restore functions
     first to get a clean slate, then re-applies. This is
     the V1 pattern; preserved in V2.

5. **Legend component** — right-sidebar panel, visible
   only when `vizState === 'ColorBy'`:
   - **Static modes:** legend items come from the matching
     static color map (e.g. `faceTypeColors`); the
     `default` entry is dropped from display.
   - **Dynamic modes (OpaqueConstruction / ApertureConstruction):**
     legend items come from a `Map<string, ColorDefinition>`
     built at color-application time and pushed into
     `modelViewerStore.dynamicLegendItems`.
   - Each item: colored swatch + label (the construction
     id, or the static-mode value name).
   - **Click-to-filter is NOT in V2 v1** (Q-VIEW-7
     deferred). See NEW-VIEW-2 for the planned post-MVP
     legend-as-filter behavior.

6. **Deterministic color hash for construction names**
   (V1 §11.2 algorithm — preserve verbatim):
   - `cyrb53(constructionId, seed)` → 53-bit hash.
   - HSL: hue = `(baseHue + goldenRatio * hash) % 1`,
     saturation 55–85%, lightness 40–65%.
   - Golden-ratio rotation gives consecutive / similar
     construction names well-distributed colors. V1's
     example: "N.3.1", "N.3.2", … all get visually
     distinct hues even though they sort adjacently.

7. **`MeshBasicMaterial`, not `MeshStandardMaterial`** —
   color-by re-coloring uses unlit basic materials so the
   color matches the legend swatch exactly (no lighting
   tint). V1 ref §11.2.

8. **Switching attribute within ColorBy mode re-applies
   immediately** — no need to exit + re-enter. Dynamic
   legend updates with the new attribute's color map.

9. **Locked-version + anonymous-viewer rendering.** Fully
   functional — color-by is a viewing operation.

### Resolved questions (2026-05-10)
- **Q-VIEW-2 (duct color split):** supply blue, exhaust
  red — criterion 3.
- **Q-VIEW-7 (legend-as-filter):** deferred to v1.1+;
  captured as NEW-VIEW-2 in US-Viewer parent.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §11, §13.5, §14.5** — color-by algorithms,
  legend, materialStore contract.
- **US-VIEW-3** — ColorBy sub-menu launches color-by mode.
- **US-VIEW-4** — `materialStore` contract is shared
  with Select tool.
- **US-VIEW-7** — backend serializes the attribute values
  (face_type, boundary_condition, construction.identifier,
  weighting_factor, v_sup/v_eta) into userData via
  loaders.
- **NEW-VIEW-2** (post-MVP) — legend-as-filter.

---

## US-VIEW-6 — Element info panel (per-type field configs)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4, §11.5 (units architecture — IP/SI
conversion at display)
**V1 ref:** §13.4 (`ElementInfoPanel/` + `fieldConfigs.ts`)

### Story
> As an editor who's clicked an object in the viewer, I want
> a right-sidebar info panel that shows me everything we
> know about that object — name, IDs, geometry properties,
> construction (with U-/R-values), ventilation airflow,
> insulation specs — formatted in my preferred unit system
> (IP or SI) — so I can use the viewer as a model-inspection
> surface.

### Acceptance criteria

1. **Right-sidebar panel** — visible when
   `modelViewerStore.selectedObjectId !== null` (the
   user has clicked something in Select tool mode). Hidden
   otherwise. shadcn `Sheet` or similar primitive,
   width ~320px.

2. **Per-element-type field configs** — a
   `Record<string, ElementTypeConfig>` keyed by the
   selected mesh's `userData.type`. The config declares
   the title, fields, and optional sections.

3. **Field shape** — each field declares:
   ```typescript
   {
     key: string,           // dot-path into userData ("properties.energy.construction.u_factor")
     label: string,         // human label
     tooltip?: string,      // optional help text
     decimals?: number,     // default 2
     units?: {              // optional unit conversion descriptor
       si: string,          // backend canonical unit
       ip: string,          // displayed in IP mode
       siLabel: string,     // unit suffix in SI mode ("W/m²K")
       ipLabel: string,     // unit suffix in IP mode ("BTU/hr·ft²·°F")
     }
   }
   ```

4. **IP / SI conversion at display** (PRD §11.5 — backend
   is canonical SI, frontend converts at render). Field
   renderer reads `userPreferencesStore.units_preference`
   and applies the configured `units` conversion.

5. **Configured element types — V2 v1 roster:**

   | Type | Title | Fields | Section |
   |---|---|---|---|
   | `faceMesh` | "Opaque Surface" | Name, ID, Face Type, Boundary, Area | "Construction": Name, Type, U-Value (with the `context/glossary.md` convention applied — see criterion 7), R-Value |
   | `apertureMeshFace` | "Window" | Name, ID, Face Type, Boundary, Area | "Construction": Name, Type, U-Value (no R-Value per V1) |
   | `spaceGroup` | "Interior Space" | Name, ID, Number, Quantity, WUFI Type, Floor Area, Weighted Area, Net Volume, Avg Height, Avg Weighting Factor | "Ventilation": Supply Air, Extract Air, Transfer Air (m³/s SI → CFM IP per PRD §11.5) |
   | `spaceFloorSegmentMeshFace` | "Interior Floor" | Space, Number, Weight, Floor Area, Weighted Area | "Ventilation": Supply, Extract, Transfer Air |
   | `pipeSegmentLine` | "Pipe" | ID, Name, **Diameter** (mm/in), **Insulation Thickness** (mm/in), **Insulation Conductivity** (W/m·K), **Insulation Reflective** (yes/no), **Insulation Quality** (text), **Water Temp** (°C/°F), **Daily Period** (hours), **Length** (m/ft), **Material** (text) | **Per Q-VIEW-4 resolved — V1 only showed ID + Name; V2 surfaces all loaded fields.** |
   | `ductSegmentLine` | "Duct" | ID, Name, **Duct Type** (Supply / Exhaust — per Q-VIEW-2), Diameter (mm/in), Insulation Thickness (mm/in) | — |

6. **No info-panel config for shades** (Q-VIEW-3 resolved
   — shades not selectable in V2 v1). Even if a shade
   somehow got selected through future refactoring,
   the absence of a config means the panel renders
   empty / hidden, which is the safe default.

7. **U-Value / R-Value labels respect `context/glossary.md`
   convention.** Per the Thermal performance section
   (created 2026-05-10 as part of Q-ENV-4 resolution):
   - Labels read "U-Value" and "R-Value" (NOT "U-Factor" /
     "R-Factor").
   - Tooltip on the field rephrases: *"Excludes surface air
     films. Matches Honeybee's `OpaqueConstruction.u_value`
     convention."*
   - Same convention as US-ENV-10 — the viewer's labels
     match the envelope-builder's labels exactly.

8. **Airflow units** — Q-VIEW that's implicit, addressed
   by PRD §11.5: the wire transports m³/s (SI canonical);
   the frontend converts to m³/h or CFM at display time.
   **V1's pre-Pydantic m³/s → m³/h backend conversion is
   dropped** (V1 ref §14.2 — the backend's "multiply by
   3600 before Pydantic" hack is a workaround for V1's
   backend convention, replaced in V2).

9. **Empty userData paths render `--`** (V1 parity).
   Missing fields don't throw or render `null`; they
   render an em-dash placeholder.

10. **Info-field tooltips** — each `InfoField` row can
    declare a `tooltip`; hovering the label shows a small
    popover with the tooltip text. V1 parity.

11. **Panel scroll** — if the field list overflows panel
    height, panel scrolls (not the page).

12. **Locked-version + anonymous-viewer rendering.** Panel fully
    functional — info-panel is a viewing operation.

### Resolved questions (2026-05-10)
- **Q-VIEW-3 (shade selectability):** shades not selectable
  → no info-panel config for shades. Criterion 6.
- **Q-VIEW-4 (pipe richer fields):** all loaded pipe
  fields displayed. Criterion 5 `pipeSegmentLine` row.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §13.4** — `ElementInfoPanel/` + `fieldConfigs.ts`
  layout.
- **`context/glossary.md`** — Thermal performance section;
  drives the U-Value / R-Value label + tooltip text.
- **PRD §11.5** — IP/SI conversion at display; m³/s SI on
  wire.
- **US-VIEW-4** — Select tool's `selectedObjectId` feeds
  this panel.
- **US-VIEW-7** — backend's loaders stash field values in
  userData (the source the panel reads).

---

## US-VIEW-7 — Backend: HBJSON parsing + bulk `/model_data` endpoint

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4.2 (`project_hbjson_files`), §11.5 (SI
canonical on wire), §10.3 (MCP surface)
**V1 ref:** §2 (full backend tour — routes, cache, services,
schemas), §14.2 (pre-Pydantic airflow conversion — V2 fix),
§14.3 (AirBoundary skip — Q-VIEW-1)

### Story
> As the frontend Model tab, I want a single
> `/model_data` endpoint that returns everything needed to
> render and inspect the model — faces, spaces, sun path,
> hot-water systems, ventilation systems, shading — in one
> bulk response, with all units in SI canonical so the
> frontend handles display conversion.

### Acceptance criteria

1. **Port V1's `backend/features/hb_model/services/model_elements.py`
   to V2** with the following changes:
   - **SI canonical on wire** (PRD §11.5). V1's pre-Pydantic
     `_v_sup * 3600` (m³/s → m³/h) conversion is **removed**.
     Wire transports m³/s. Frontend (US-VIEW-6 criterion 8)
     converts to m³/h or CFM at display.
   - **AirBoundary handling — preserve V1 skip + add explicit
     logging** (Q-VIEW-1 resolved). Faces whose
     `properties.energy.construction.to_dict()` fails opaque
     validation are skipped (V1 parity), but each skip
     emits a backend log line AND the count is returned in
     a new `load_summary.air_boundaries_skipped` field on
     `CombinedModelDataSchema`. The frontend surfaces this
     count in the load-summary Sonner toast (US-VIEW-2
     criterion 10).
   - **Drop V1's `LimitedCache` + 1-hour TTL** (V1 ref §14.4).
     V2 fetches directly from R2 using ETag-based
     validation — HBJSON is immutable post-upload (V1's
     re-upload-without-cache-invalidation issue can't
     happen because each upload creates a new
     `project_hbjson_files` row with a new R2 object).

2. **New endpoint structure** — routes under
   `/projects/{project_id}/hbjson-files/{file_id}/`:
   - `GET .../model_data` → `CombinedModelDataSchema`
     (bulk; the only one the frontend uses).
   - `GET .../faces`, `.../spaces`, `.../sun_path`,
     `.../hot_water_systems`, `.../ventilation_systems`,
     `.../shading_elements` → per-feature endpoints kept
     live for MCP-tool callability (NEW-LLM-API-1). The
     viewer uses only `/model_data`.

3. **`CombinedModelDataSchema`** — top-level response:
   ```jsonc
   {
     "faces": [FaceSchema, ...],
     "spaces": [SpaceSchema, ...],
     "sun_path": SunPathAndCompassDTOSchema | null,
     "hot_water_systems": [PhHotWaterSystemSchema, ...],
     "ventilation_systems": [PhVentilationSystemSchema, ...],
     "shading_elements": [ShadeGroupSchema, ...],
     "load_summary": {
       "air_boundaries_skipped": 0,         // per Q-VIEW-1
       "faces_extracted": 0,
       "spaces_extracted": 0,
       "shade_groups_extracted": 0,
       "extraction_warnings": ["..."]      // any non-fatal warnings
     }
   }
   ```
   `sun_path` stays optional — EPW load failure is
   non-fatal (V1 parity).

4. **Pydantic schemas** — port V1's
   `schemas/{honeybee, honeybee_energy, honeybee_ph,
   honeybee_phhvac, ladybug, ladybug_geometry}/`
   subtrees largely as-is. Pydantic v2 (`ConfigDict`,
   `field_validator`, `model_validator`,
   `.model_validate()`, `.model_dump()` — per project
   CLAUDE.md).

5. **Shade merging** — preserve V1's tolerance-aware vertex
   merging (`Point3D.is_equivalent`, tol=1e-7) at the
   backend so each shade group ships as a single merged
   `Mesh3D` (V1 ref §2.3.3 / §9.7). One draw call per
   group on the frontend.

6. **EPW for sun path** — V1's `services/epw.py` ports
   as-is. EPW file lookup moves from AirTable to whatever
   storage V2 uses for project EPW (likely R2; defer the
   exact mechanism to a separate v1.1+ if not already
   covered by the project-creation flow).

7. **Honeybee-PH supply/exhaust duct distinction surfaced**
   (Q-VIEW-2 prerequisite). The `PhHvacDuctElementSchema`
   already carries `duct_type` (Supply vs Exhaust) from
   the V1 schema. Backend ensures this field is populated
   correctly per the source honeybee-phhvac data so the
   frontend can color-split (US-VIEW-5 criterion 3).

8. **Loaders stash userData** — see V1 ref §9. Each
   per-feature loader on the frontend (US-VIEW-2..6
   helpers) reads the schema, builds Three.js geometry,
   and stamps full DTO fields onto `userData` so the
   info panel (US-VIEW-6) can read without re-fetching.
   This is presentation-side, not backend, but the
   backend's job is to ship the DTOs in the schemas the
   loaders expect — no field renames vs V1.

9. **Process-local cache removed** (V1 ref §14.4). V2
   relies on R2 + HTTP-level caching (signed-URL with
   `Cache-Control: immutable` since HBJSON is immutable
   post-upload). Backend does NOT memoize the
   deserialized `honeybee.model.Model` — re-parsing on
   every request is acceptable for 5-20 MB files and
   avoids the cross-worker cache-coherence problems V1
   had (V1 ref §14.4).

10. **MCP-callable endpoints** (NEW-LLM-API-1) — every
    endpoint listed in criterion 2 is also exposed as an
    MCP tool. Agent workflows like *"list all spaces with
    `v_sup < 30 m³/s`"* read the per-feature endpoint;
    the viewer reads the bulk endpoint. Same data,
    different surface.

11. **Error handling** — port V1's
    `MaterialNotFoundException` collection pattern (V1
    ref §2.3.3) for any future import paths that need it,
    but in V2 v1 it's not exercised (no HBJSON construction
    import per US-ENV-12). The pattern stays in the
    codebase for MCP-tool error reporting consistency.

12. **Permissions** — same as US-VIEW-1: editors and
    anonymous viewers can fetch model data; anonymous
    cannot.

### Resolved questions (2026-05-10)
- **Q-VIEW-1 (AirBoundary handling):** skip + log + count
  in `load_summary`. Criterion 1.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §2** (full backend tour) — authoritative source
  for the V2 port.
- **PRD §11.4.2** — `project_hbjson_files` table is the
  upstream of these endpoints.
- **PRD §11.5** — SI canonical drives criterion 1.
- **PRD §10.3** — MCP tool surface; per-feature endpoints
  remain live for MCP.
- **`context/glossary.md`** — U-Value / R-Value labels
  shipped by Pydantic schemas match the convention
  (criterion 4).
- **NEW-LLM-API-1** — drives the per-feature endpoint
  preservation in criterion 2.

---

## US-Settings — Project settings modal (US-3.7)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.1 (`projects` table), §11.1 (project tabs +
header `⋯` menu placement), §4 (access model — updated
2026-05-10)
**V1 ref:** V1 has no equivalent; project metadata was edited
in AirTable
**Inherits:** US-3 / US-3.1 for the project header `⋯` menu
placement

### Story

> As an editor, I want a single Project Settings modal where
> I can edit the project's identifying metadata (name,
> BT number, Phius certification number, Dropbox link) and
> see at a glance who owns this project and when it was
> created / last saved — so I don't have to dig through
> AirTable or admin tools to keep a project's record clean.

### Architectural decisions (2026-05-10)

- **Modal, not a tab.** Settings opens as a shadcn `Dialog`
  triggered from the project header `⋯ → Project settings`
  menu item (per PRD §11.1 — no top-level Settings tab).
- **Scope = project-level metadata only.** Editing fields on
  the `projects` relational row. **Not** included in this
  modal:
  - **Version-level concerns** (Save / Save As / Lock /
    Unlock / Discard) — live in the version dropdown
    (US-3.1) and elsewhere in the `⋯` menu.
  - **Project delete** — **dashboard only** (US-1.4) per
    Q-SET-3 resolved 2026-05-10. Not in this modal.
    Rationale: deletion is rare, high-stakes, and naturally
    pairs with the dashboard's project-list context where
    you can see your remaining projects.
  - **View-link management** — does not exist as a concept
    after the 2026-05-10 PRD §4 update. Project URLs are
    public-readable; to "revoke access" the project is
    soft-deleted (US-1.4). No share-link surface in V2 v1.
  - **MCP token management** — included in V2 v1 per
    Q-SET-5 revised 2026-05-11. Tokens are project-scoped,
    read/write capable, and issued/revoked from this modal.
- **Edits bypass the draft buffer.** Project-level metadata
  is relational (not document-versioned), so saves are
  direct PATCH calls to `/api/v1/projects/{id}`. No
  JSON-Patch through the version draft.

### Acceptance criteria

1. **Trigger.** Project header `⋯` overflow menu →
   **"Project settings"**. Opens a shadcn `Dialog`. Modal
   width ~480px; vertical scroll within if content
   overflows.

2. **Modal title:** `"Project settings"` (small subtitle
   below: the project's display name, e.g.
   *"Brooklyn Retrofit · BT-2024-013"* — for orientation).

3. **Editable fields** (per Q-SET-1 resolved):
   | Field | Type | Validation | Notes |
   |---|---|---|---|
   | `name` | text | required; trim whitespace; max 200 chars | Pure cosmetic — see Q-SET-6 (display-only) |
   | `bt_number` | text | required; **UNIQUE across all projects** (Q-CREATE-2) | Editable post-create (Q-SET-2 resolved); rare but real (typo correction, internal renumbering) |
   | `phius_number` | text | optional; max 100 chars | E.g. `PHIUS-2024-0445`. Empty = not yet registered |
   | `phius_dropbox_url` | URL | optional; must be a valid URL starting with `http(s)://` if non-empty | Link to the project's Dropbox certification folder |

4. **Read-only fields** displayed below the editable block:
   | Field | Source |
   |---|---|
   | Owner | `projects.owner_id` → user name. Read-only in v1 (transfer UI is post-MVP per Q-OWN-2 resolved) |
   | Created | `projects.created_at` (formatted date + creator's name) |
   | Last saved | `projects.last_saved_at` (denormalized per Q-DASH-2 resolved) |
   | Project ID | `projects.id` UUID — small monospace; click-to-copy icon for sharing in tickets / debugging |

5. **`bt_number` uniqueness check** (Q-SET-2 + Q-CREATE-2
   resolved):
   - On Save, backend validates the new value doesn't
     collide with another project's `bt_number` (excluding
     soft-deleted projects — per US-1.4 notes, soft-deleted
     bt_numbers are retained permanently and **never
     reused**).
   - Collision → 409 response → modal shows inline error
     on the field: *"BT number is already in use by
     another project."* Save button stays disabled until
     the user corrects.
   - **Self-collision is fine** (saving the modal without
     changing `bt_number` doesn't trigger a collision
     check against the same project's own row).

6. **Field-level validation runs on blur AND on Save.**
   Errors render inline (red border + error icon +
   tooltip). Save button disabled while any field is in
   error state.

7. **Save / Cancel** at modal footer (per Q-SET-7
   resolved):
   - **Save button** — disabled when no fields have
     changed from the loaded state, or when any field is
     in error.
   - On Save: single `PATCH /api/v1/projects/{id}` with
     only the changed fields. Closes modal on success;
     toast: *"Project settings saved."*
   - On Save failure (other than 409 uniqueness): toast
     with the backend error; modal stays open with edits
     preserved.
   - **Cancel** discards in-modal edits; closes modal.
     If the modal has dirty edits, a small inline-warning
     prompt before close: *"You have unsaved changes.
     Discard?"* with Cancel / Discard buttons.

8. **Renaming has no other effects** (per Q-SET-6
   resolved):
   - URLs use `{project_id}` UUID, not name — renaming
     doesn't change any URL.
   - HBJSON downloads use the **new** `bt_number` +
     `name` in the filename pattern per Q-ENV-12.4 (the
     slugified filename pattern reads from the current
     project record at download time).
   - Dashboard refreshes show the new name on next load.
   - **No cascade rename of derived artifacts** — old
     downloaded HBJSON / JSON files on the user's disk
     keep their original filenames.

9. **MCP token management — V2 v1**
   (Q-SET-5 revised 2026-05-11). Render a compact
   **MCP tokens** section below project metadata:
   - Existing active tokens list: label, token prefix,
     scopes, created date, last used date, optional expiry,
     and **Revoke** button.
   - **Create token** action opens an inline form:
     token label, scopes (`project:read`, `project:write`,
     `asset:read`, `asset:write`), optional expiry.
     Default scopes: all four v1 scopes.
   - Created token plaintext is shown exactly once in a
     copy field; after the dialog closes, only prefix/hash
     remain server-side.
   - Tokens are project-scoped. They can read/write only this
     project, never all projects.
   - Revocation is immediate. Existing MCP calls fail on the
     next request with a structured auth error.
   - Issue/revoke actions write `mcp_token_issue` /
     `mcp_token_revoke` events to `user_action_log`.

10. **Project delete — NOT in this modal** (per Q-SET-3
    resolved). The dashboard's per-row `⋯` menu is the
    sole entry point (US-1.4). The Settings modal has
    **no "Danger zone"** section in V2 v1.

11. **Anonymous-viewer permissions:**
    - **Modal trigger hidden in the project header `⋯` menu**
      for anonymous viewers. They can't open Settings.
    - If someone manually constructs a settings-modal-open
      URL fragment (edge case), the modal renders **read-only**:
      all editable fields display as plain text; Save button
      hidden; Cancel becomes Close.

12. **Locked-version handling: N/A.** Project settings are
    relational (on the `projects` row), not bound to any
    project document version. Switching the active version
    or locking it has no effect on this modal — same
    settings visible regardless. (Sibling pattern with
    `project_status_items` per US-Status criterion 14 and
    `project_hbjson_files` per US-VIEW-1 architectural
    decision 2.)

13. **MCP-callable** (per NEW-LLM-API-1):
    - `GET /api/v1/projects/{id}` — returns the project
      record (editors + anonymous viewers).
    - `PATCH /api/v1/projects/{id}` — partial update
      (editors only). Same endpoint that powers the
      modal's Save action.
    - Agentic workflow can update project metadata
      ("rename this project to 'Final Approved Round 4'")
      without opening the UI.

### Resolved questions (2026-05-10)

- **Q-SET-1: What's editable in the modal?** Resolved:
  `name`, `bt_number`, `phius_number`, `phius_dropbox_url`.
  Owner stays read-only in v1 (transfer UI is post-MVP per
  Q-OWN-2).
- **Q-SET-2: Is `bt_number` editable post-create?**
  Resolved: yes, editable subject to uniqueness check.
  Q-CREATE-2's "never reused" applies to soft-deleted
  projects' freed bt_numbers, not the owning project's
  own renames.
- **Q-SET-3: Where does project delete live?** Resolved
  (redirect from lean): **dashboard only** (US-1.4). Not
  in the Settings modal. Rationale: rare, high-stakes
  action; pairs naturally with the dashboard's
  project-list context.
- **Q-SET-4: View-link management?** Resolved
  (moot 2026-05-10): no view-link management surface
  exists because view-links don't exist as a concept
  after the PRD §4 access-model update. To revoke
  access, soft-delete the project (US-1.4).
- **Q-SET-5: MCP token management?** Revised 2026-05-11:
  include in V2 v1. MCP is read/write capable from day 1,
  so Project Settings issues/lists/revokes project-scoped
  bearer tokens.
- **Q-SET-6: Rename side-effects?** Resolved: none.
  Rename is display-only. URLs use UUID; old downloaded
  files keep their original names.
- **Q-SET-7: Save flow — explicit Save or auto-save?**
  Resolved: explicit Save / Cancel. Edits bypass the
  draft buffer (relational, not document-versioned);
  single `PATCH` on Save.

### Open questions
None outstanding.

### Cross-references

- **PRD §6.1** — `projects` table schema; the fields this
  modal edits live there.
- **PRD §11.1** — `⋯` menu placement; "no top-level
  Settings tab" framing.
- **PRD §4 (updated 2026-05-10)** — access model; gates
  who can open the modal vs view it read-only.
- **US-3.1 (version dropdown)** — handles version-level
  concerns the Settings modal doesn't touch (Save / Save
  As / Lock).
- **US-1.4 (project delete)** — sole entry point for
  deletion; intentionally not duplicated here.
- **US-1.3 / Q-CREATE-2** — `bt_number` uniqueness rules
  (UNIQUE, never reused after soft-delete).
- **Q-OWN-2** — ownership transfer UI is post-MVP;
  modal renders Owner as read-only.
- **NEW-LLM-API-1** — MCP-callable PATCH endpoint
  (criterion 13).

---

### C-1 — Per-user action logging

**Status:** Draft  
**Priority:** MVP  
**PRD ref:** new — needs to be added to §6.1 and §15

> As BLDGTYP support / admin, I want a per-user action log so that I
> can troubleshoot issues, answer "who changed what when" questions,
> and audit access.

#### What we log (v1 scope)
| Event | When | Metadata |
|---|---|---|
| `login` | successful sign-in | IP, user-agent |
| `login_failed` | failed sign-in | email attempted, IP, user-agent |
| `sign_out` | explicit logout | — |
| `project_create` | new project | project_id, name |
| `project_update_metadata` | rename, change client, etc. | project_id, fields changed |
| `project_delete` | soft-delete | project_id, name |
| `version_create` | Save As | project_id, version_id, name, kind |
| `version_save` | Save (overwrite) | project_id, version_id |
| `version_lock_toggle` | lock / unlock | project_id, version_id, new state |
| `version_delete` | soft-delete | project_id, version_id |
| `hbjson_upload` | new HBJSON file | project_id, file_id, size |
| `hbjson_delete` | soft-delete HBJSON | project_id, file_id |
| `catalog_record_create` / `_update` / `_version_create` / `_delete` | catalog edits | catalog_table, record_id, version_id |
| `mcp_token_issue` / `_revoke` | MCP auth admin | token_id |

Out of scope for v1: every read, every JSON-Patch op on a draft. Too
noisy. If we need draft-level forensics later, draft patches already
write to `project_version_drafts.last_patched_at`.

#### Storage
New table `user_action_log`:
```sql
user_action_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id),
                 -- nullable: failed login attempts before user lookup
    action       TEXT NOT NULL,
    project_id   UUID REFERENCES projects(id),
    target_type  TEXT,
    target_id    TEXT,
    metadata     JSONB,
    ip_address   INET,
    user_agent   TEXT,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON user_action_log (user_id, at DESC);
CREATE INDEX ON user_action_log (project_id, at DESC);
CREATE INDEX ON user_action_log (action, at DESC);
```

#### Surfacing
- v1 ships with **no UI surface** for the log; it's queried via SQL by
  Ed for support purposes.
- v1.1 may add a per-project "activity" tab.
- **Open question:** retention policy — keep forever? Roll off after
  N months? **Lean:** keep forever; volume is trivial at two-user
  scale.

---

### C-2 — Header consistency

**Status:** Draft  
**Priority:** MVP  
**PRD ref:** §11.1 (top-level surfaces)

Every page in the signed-in app shares a top header:

| Region | Content | Behavior |
|---|---|---|
| Far left | PH-Nav logo (text + minimal mark) | Click → `/dashboard` |
| Center / left | Breadcrumb / context (e.g. "Project Foo › Builder") | Each crumb is a link |
| Center / right | "Catalogs ▾" dropdown | Reveals catalog list (US-2) |
| Far right | User name + avatar, click → menu (Sign out, Settings) | Menu opens on click |

The header is **not present** on `/sign-in`. For non-logged-in
visitors on a project URL, the header is **present but reduced** —
no "Catalogs ▾" dropdown, no user-avatar menu (replaced with a
"Sign in" link). All edit affordances under the header hide; reads
remain available. Per the access model in PRD §4 updated
2026-05-10.

---

## New features (post feature-parity)

This section captures **net-new** features Ed has flagged during
V2 user-story review. They are **NOT in the V1→V2 parity scope**
and are tracked here so they don't get mixed into US-WIN / US-ENV
parity stories. Each gets a full story write-up once we close the
parity backlog and decide priority.

### NEW-DATASHEET-1 — Bulk + individual datasheet download

**Status:** Stub (post-parity) · **Priority:** Tied to PH
certification submission workflow
**Source:** Ed feedback 2026-05-10 (Q-ENV-2.1 resolution thread)

**Story.** As a CPHC packaging up a Phius/PHI certification
submission, I want to download **all** of a project's product
datasheets in one click (zipped, conventionally named so the
certifier can pair them with the materials list), and I also
want to download individual datasheets when only one or two need
re-submission.

**Why this matters.** Certification submissions today involve
manually pulling each datasheet from Dropbox / AirTable / email
and renaming it for the certifier's tree. This is a top
time-sink and a common source of mismatches between the model's
material list and the submitted documents. Centralizing it on
the project's `project_materials[]` table (the source of truth
per Q-ENV-2) lets us guarantee 1:1 coverage.

**Open design questions (queued, not blocking V2 v1 parity):**
- File-naming convention in the bulk zip: by `project_material.name`
  (`XPS Foam.pdf`) or by name + spec-status (`XPS Foam [submitted].pdf`)?
- Include unused materials? Probably yes — submitted-but-not-used
  is still a QA record.
- Per-version download or only HEAD? Lean: per-version (mirrors
  HBJSON / window-construction export under header `⋯` menu).
- One PDF binder vs zip of individual PDFs? Lean: zip; PDF binder
  as v1.1+.
- Surface in: Specifications sub-tab toolbar (bulk button) AND
  project header `⋯` menu (per Q-ENV-11 pattern). Per-row "↓"
  button on each material card for individual download.

**Cross-references.** Implies stable asset IDs and signed download URLs
through `project_assets`. Couples with NEW-LLM-API-1 (LLM-friendly
asset endpoints).

### NEW-LLM-API-1 — LLM-friendly read/write MCP + asset API

**Status:** V2 v1 scope (cross-cutting — not envelope-only)
· **Priority:** MVP infrastructure
**Source:** Ed feedback 2026-05-10; day-1 read/write decision
confirmed 2026-05-11.

**Story.** As an LLM agent assisting a CPHC, I need authenticated,
project-scoped **read/write** access to PH-Navigator from day 1: fetch
documents, apply JSON-Patch edits to drafts, save/save-as, upload
datasheet PDFs or batches, attach assets to the right project-document
paths, and download existing assets for review / re-upload.

**Why this matters.** Datasheet ingest is the highest-volume
manual workflow on a project. An LLM that can:
1. Read an uploaded email attachment,
2. Match it to the right `project_material` (by product name),
3. Upload it via API,
4. Update spec-status to `submitted`,

…would compress what is currently a 5-minute manual click-fest
per product into a single agent call. This is the kind of leverage
PHN-V2 is meant to enable, so the API design has to support it
from day one — not retrofit it later.

**Design constraints (capture early so V2 v1 endpoints don't
paint us into a corner):**
- **One asset backbone.** All uploaded files are `project_assets`
  rows (PRD §6.5). Datasheets, photos, HBJSON, future simulation
  files, and export bundles share signed upload/download, dedup,
  soft-delete, and GC behavior.
- **Stable asset IDs plus explicit kind.** Tool calls reference stable
  `asset_id` values; agents determine meaning from `asset_kind`, not
  from an overloaded id prefix.
- **Consistent endpoint shape across asset types.**
  `POST /projects/{id}/assets/upload-intent` returns `asset_id` +
  signed PUT URL; `POST /projects/{id}/assets/{asset_id}/complete-upload`
  marks upload complete; `GET /projects/{id}/assets/{asset_id}/url`
  returns a signed download URL. The same shape covers datasheet,
  site photo, and HBJSON bytes.
- **Clear MIME / type discrimination.** `asset_kind` enum
  (`datasheet | site_photo | hbjson | …`) so an agent inspecting
  a project's assets can filter without guessing.
- **Idempotent uploads** — agents retry; we should not get duplicate
  active rows on retry. Match by
  `(project_id, asset_kind, content_hash_sha256)` and return
  `duplicate_of` metadata when appropriate.
- **Bulk endpoints.** `POST /projects/{id}/assets/bulk` for batch
  uploads; `GET /projects/{id}/assets?kind=datasheet` for batch
  reads. Avoids N round-trips for an agent doing 30 datasheets.
- **Attach/detach through drafts.** `attach_asset` and `detach_asset`
  are convenience wrappers over draft JSON-Patch. Removing an asset
  from a material/photo UI detaches the reference from the active draft;
  hard purge waits for GC after saved-version and active-draft reference
  checks.
- **OpenAPI spec served at `/openapi.json`** (FastAPI gives us
  this for free) — let any LLM tool (Claude / Anthropic API tool
  use, OpenAI function-calling, etc.) auto-discover the endpoints
  without bespoke docs.
- **Project-scoped bearer tokens** issued from Project Settings.
  Tokens are shown once, stored hashed, revocable, audit-logged,
  and scoped to one project. v1 scopes:
  `project:read`, `project:write`, `asset:read`, `asset:write`.
- **MCP is never anonymous.** Public browser read access to
  `/projects/{id}/...` does not grant unauthenticated tool access.
- **Tool surface wraps the same REST/service layer.** No separate
  LLM-only business rules. MCP tools call the same validation,
  access checks, JSON-Patch, idempotency, and audit paths as the
  web UI.
- **Write path goes through drafts.** LLM JSON-Patch edits target
  the token owner's draft; `save_draft` explicitly flushes to the
  version body. Save against locked/stale versions returns the
  same structured 409s as the web UI.

**Resolved design decisions (2026-05-11):**
- Bearer tokens live in `mcp_tokens` (PRD §6.1).
- v1 tokens are per-user and per-project. The issuing editor owns
  the token; every write is attributed to that user.
- Project Settings is the v1 token UI: issue, list, revoke.
- MCP tools are read/write capable in v1, but catalog writes are
  excluded. Catalog browse is read-only through MCP until a concrete
  global-library edit workflow and review policy exist.
- LLM-callable write endpoints are wrappers around human-driven
  endpoints/services, not a separate business surface.

**Cross-references.** NEW-DATASHEET-1 (bulk download) and
NEW-DATASHEET-1's per-row download both ride on this API. Future
agentic features (auto-extract spec values from datasheet PDFs,
auto-match products from email attachments) are blocked on this.

---

## Index of open questions (by area)

Tracked here so we can sweep them for closure. References point back
to the per-story sections above.

| ID | Story | Question | Lean |
|---|---|---|---|
| ~~Q-OWN-1~~ | ~~US-1 Q1~~ | ~~Ownership = dashboard filter only, or strict ACL?~~ | **Resolved 2026-05-10:** dashboard-filter only; ACL deferred. Forward-compatible access-check seam (US-1.5). |
| ~~Q-OWN-2~~ | ~~US-1 Q2~~ | ~~Ownership transferable?~~ | **Resolved 2026-05-10:** yes (data model supports; transfer UI post-MVP) |
| ~~Q-AUTH-1~~ | ~~US-0 Q1~~ | ~~Forgot-password flow?~~ | **Resolved 2026-05-10:** admin-reset only |
| ~~Q-AUTH-2~~ | ~~US-0 Q2~~ | ~~Session duration?~~ | **Resolved 2026-05-10:** 60-min sliding |
| ~~Q-AUTH-3~~ | ~~US-0 Q3~~ | ~~Concurrent sessions?~~ | **Resolved 2026-05-10:** single active session, most-recent-wins |
| ~~Q-DASH-1~~ | ~~US-1 Q3~~ | ~~Default unpinned sort?~~ | **Resolved 2026-05-10:** by `bt_number` descending |
| ~~Q-DASH-2~~ | ~~US-1 Q4~~ | ~~"Last modified" definition?~~ | **Resolved 2026-05-10:** denormalized `projects.last_saved_at` |
| ~~Q-DASH-3~~ | ~~US-1 Q5~~ | ~~"New project" location?~~ | **Resolved 2026-05-10:** dashboard top-right primary button |
| ~~Q-CREATE-1~~ | ~~US-1.3 Q6~~ | ~~Empty `ProjectDocumentV1` shape?~~ | **Resolved 2026-05-10:** empty arrays for every table |
| ~~Q-CREATE-2~~ | ~~US-1.3 Q7~~ | ~~bt_number unique?~~ | **Resolved 2026-05-10:** hard UNIQUE, never reused |
| ~~Q-DEL-1~~ | ~~US-1.4 Q8~~ | ~~Retention before R2 GC?~~ | **Resolved 2026-05-10:** 90 days |
| ~~Q-DEL-2~~ | ~~US-1.4 Q9~~ | ~~Undelete UI?~~ | **Resolved 2026-05-10:** admin-only |
| ~~Q-CAT-1~~ | ~~US-2 Q1~~ | ~~Future catalogs scope?~~ | **Resolved 2026-05-10:** all global + bookshelf; full roster captured in US-2 |
| ~~Q-CAT-2~~ | ~~US-2 Q2~~ | ~~Catalog activity on dashboard?~~ | **Resolved 2026-05-10:** no, not in MVP |
| ~~Q-LAND-1~~ | ~~US-3 Q1~~ | ~~Project landing layout?~~ | **Resolved 2026-05-10:** tab bar (Status / Windows / Envelope / Equipment / Model) |
| ~~Q-LAND-2~~ | ~~US-3 Q2~~ | ~~Default tab?~~ | **Resolved 2026-05-10:** Status |
| ~~Q-LAND-3~~ | ~~US-3 Q3~~ | ~~Versions placement?~~ | **Resolved 2026-05-10:** header dropdown with explicit Open + dirty-draft + locked-version protections (US-3.1) |
| ~~Q-UNITS-1~~ | ~~US-3~~ | ~~Units (IP/SI) preference scope?~~ | **Resolved 2026-05-10:** per-user; **backend 100% SI, frontend-only conversion** (PRD §11.5) |
| Q-UNITS-2 | US-3 (new) | TS units library choice? | TBD when walking Builder stories |
| ~~Q-LANDDEFAULT-1~~ | ~~US-3~~ | ~~Brand-new project default-tab UX?~~ | **Resolved 2026-05-10:** empty state with "Apply BLDGTYP default template" CTA, no auto-populate |
| ~~Q-STATUS-1~~ | ~~US-Status~~ | ~~Default template content?~~ | **Resolved 2026-05-10 (amended same day):** 4 cert-agnostic items — CAD files received → Design Model complete → **Cert review complete** (renamed from "Phius review complete" per cert-agnostic directive) → Certification Complete |
| ~~Q-STATUS-2~~ | ~~US-Status~~ | ~~Multiple templates (Phius vs PHI vs design-only)?~~ | **Resolved 2026-05-10:** single basic cert-type-agnostic template in V2 v1. Multi-template support defers to v1.1+ if a real need surfaces |
| ~~Q-STATUS-3~~ | ~~US-Status~~ | ~~Does `in_progress` state belong in the enum?~~ | **Resolved 2026-05-10:** drop `in_progress`. States are `todo / done / na`. Current-step is a computed visual (first non-done item in `order_index` order) |
| ~~Q-STATUS-4~~ | ~~US-Status~~ | ~~Items deletable or only state-toggleable?~~ | **Resolved 2026-05-10:** fully deletable via `⋯ → Delete item`. Soft-delete; undelete is admin-only (mirrors US-1.4 project-delete) |
| ~~Q-STATUS-5~~ | ~~US-Status~~ | ~~Per-item attachments (photos, PDFs)?~~ | **Resolved 2026-05-10:** out of v1. Description Markdown can link to R2 URLs from assets uploaded elsewhere. Per-item attachment UI defers to v1.1+ |
| ~~Q-STATUS-6~~ | ~~US-Status~~ | ~~Empty-state UX for brand-new project?~~ | **Resolved 2026-05-10 (via Q-LANDDEFAULT-1):** centered card with 3 CTAs — "Apply BLDGTYP default template" (primary) / "+ Add custom item" (secondary) / "Skip to Envelope" (link) |
| ~~Q-STATUS-7~~ | ~~US-Status~~ | ~~`completion_date` editing — auto-populate or always-editable?~~ | **Resolved 2026-05-10:** auto-populate to today on `done` flip; user-editable thereafter (so they can backdate). Clearing to null supported via the edit form |
| Q-LOG-1 | C-1 | Log retention? | keep forever |
| Q-URL-1 | (meta) | V2 URL? | `ph-navigator-v2.onrender.com` for staging, custom domain later |
| Q-WIN-1 | US-Builder-Windows | Element span representation? | **Lean:** range form `[start, end]` inclusive, per PRD §6.2 sketch |
| Q-WIN-2 | US-Builder-Windows | Per-side frames or single-frame per element? | **Lean:** four sides (`top/right/bottom/left`) — match V1; per-side U / Ψ-g needed for Phius / WUFI |
| Q-WIN-3 | US-Builder-Windows | Default frame / glazing on element create? | **Lean:** null + Save-time validation; explicit pick required |
| Q-WIN-4 | US-Builder-Windows | Manufacturer-filter storage? | **Lean:** in project document (`tables.manufacturer_filters`); versions with the project |
| Q-WIN-5 | US-Builder-Windows | Per-window-type deep-link URL? | **Lean:** `/projects/{id}/windows/{wt_id}` |
| Q-WIN-6 | US-Builder-Windows | Split behavior — preserve assignments? | **Lean:** preserve (fix the V1 papercut) |
| Q-WIN-7 | US-Builder-Windows | Frame-label flip on interior view? | **Lean:** keep (matches V1; "what you see is what you label") |
| Q-WIN-8 | US-Builder-Windows | HBJSON window-constructions export? | **Lean:** keep, as per-version export under header `⋯` menu |
| Q-WIN-9 | US-Builder-Windows | Display-unit format selector scope? | **Lean:** per-user (`window_builder_dim_format_si` / `_ip`) |
| ~~Q-WIN-1.1~~ | ~~US-WIN-1~~ | ~~Name uniqueness within a project version?~~ | **Resolved 2026-05-10:** enforced (trim + case-insensitive); add/duplicate auto-suffix `(2)`, `(3)`, …; rename rejects collisions |
| ~~Q-WIN-1.2~~ | ~~US-WIN-1~~ | ~~Delete confirmation strength?~~ | **Resolved 2026-05-10:** simple shadcn `Dialog` (Cancel / Delete); no type-name retyping |
| ~~Q-WIN-1.3~~ | ~~US-WIN-1~~ | ~~Sidebar reorder?~~ | **Resolved 2026-05-10:** alphabetical-only (`naturalSortCompare`) for MVP; drag-reorder deferred |
| ~~Q-WIN-2.1~~ | ~~US-WIN-2~~ | ~~Keyboard shortcuts for add-row/col?~~ | **Resolved 2026-05-10:** no for MVP |
| ~~Q-WIN-2.2~~ | ~~US-WIN-2~~ | ~~Drag-to-resize dimensions?~~ | **Resolved 2026-05-10:** no for MVP |
| ~~Q-WIN-2.3~~ | ~~US-WIN-2~~ | ~~Equal-divide tool?~~ | **Resolved 2026-05-10:** no for MVP |
| ~~Q-WIN-3.1~~ | ~~US-WIN-3~~ | ~~Shift-click rule (V1 adjacency-only or relax)?~~ | **Resolved 2026-05-10:** relax — any shift-click extends; merge validates contiguous-rectangle at commit |
| ~~Q-WIN-3.2~~ | ~~US-WIN-3~~ | ~~Merged inheritance source?~~ | **Resolved 2026-05-10:** top-left source; toast confirms |
| ~~Q-WIN-3.3~~ | ~~US-WIN-3~~ | ~~Holes in grid allowed?~~ | **Resolved 2026-05-10:** no holes; no direct Delete-element gesture in MVP — remove via merge or row/col delete |
| ~~Q-WIN-4.1~~ | ~~US-WIN-4~~ | ~~Inline override field set?~~ | **Resolved 2026-05-10:** full field set editable inline; power fields (`source`/`link`/`datasheet_url`/`comments`) under `More fields…` expander |
| ~~Q-WIN-4.2~~ | ~~US-WIN-4~~ | ~~Diverged-from-catalog visualization?~~ | **Resolved 2026-05-10:** inline diff modal on badge click — three columns (Catalog · Yours · Choose new value); shared with US-WIN-11 |
| ~~Q-WIN-4.3~~ | ~~US-WIN-4~~ | ~~Apply-to-all-four-sides shortcut?~~ | **Resolved 2026-05-10:** deferred to v1.1+; not in MVP |
| ~~Q-WIN-4.4~~ | ~~US-WIN-4~~ | ~~Promote hand-entered frame into catalog?~~ | **Resolved 2026-05-10:** deferred to v1.1+; not in MVP |
| ~~Q-WIN-5.1~~ | ~~US-WIN-5~~ | ~~Operation presets in MVP?~~ | **Resolved 2026-05-10:** yes; Tilt-turn, Awning, Hopper, Casement (L/R), Slider (L/R) ship in v1 |
| ~~Q-WIN-5.2~~ | ~~US-WIN-5~~ | ~~Operation feeds U-value?~~ | **Resolved 2026-05-10:** no — already captured in the picked frame's `u_value_w_m2k`; backend ignores; frontend dep key excludes |
| ~~Q-WIN-6.1~~ | ~~US-WIN-6~~ | ~~Where to render the window-type-level U-Value chip — project header vs Windows tab content header?~~ | **Resolved 2026-05-10:** Windows tab content header. Window U-Value is window-scoped, not project-scoped |
| ~~Q-WIN-7 (cross-tier paste)~~ | ~~US-WIN-7~~ | ~~Can paste cross window-types?~~ | **Resolved 2026-05-10:** **no — V2 v1 mirrors US-ENV-9's no-cross-tier-paste decision** (V1 allowed cross-type paste; V2 doesn't for consistency). Data model supports it trivially; v1.1+ can lift |
| ~~Q-WIN-7 (multi-select)~~ | ~~US-WIN-7~~ | ~~Multi-select paste?~~ | **Resolved 2026-05-10:** defer to v1.1+. Mirrors US-ENV-9 |
| ~~Q-WIN-7 (keyboard)~~ | ~~US-WIN-7~~ | ~~Keyboard shortcuts (⌘C/⌘V) on windows canvas?~~ | **Resolved 2026-05-10:** defer to v1.1+. Toolbar + ESC + ⌘Z only |
| ~~Q-WIN-8.1~~ | ~~US-WIN-8~~ | ~~Per-project preset of "default-on" manufacturers (e.g. BLDGTYP curated subset)?~~ | **Resolved 2026-05-10:** defer to v1.1+. Default stays "all enabled" (V1 parity). Future home likely at user-preferences level, not per-project |
| ~~Q-WIN-9.1~~ | ~~US-WIN-9~~ | ~~View-direction storage scope (sessionStorage / per-user)?~~ | **Resolved 2026-05-10:** per-user preference (`userPreferencesStore.window_builder_view_direction`). V1's sessionStorage was awkward across tabs |
| ~~Q-WIN-9.2~~ | ~~US-WIN-9~~ | ~~Canvas zoom persistence?~~ | **Resolved 2026-05-10:** per-user preference (`userPreferencesStore.window_builder_canvas_zoom`). Discrete steps; mirrors envelope canvas (Q-ENV-4.1) |
| ~~Q-WIN-10.1~~ | ~~US-WIN-10~~ | ~~Add parens to `evaluateExpression`?~~ | **Resolved 2026-05-10:** yes — V1 ref §18 flagged the absence as a papercut; V2 v1 adds standard-precedence + parens. ~50 LOC recursive-descent parser inline (no library) |
| ~~Q-WIN-11.1~~ | ~~US-WIN-11~~ | ~~Drift compared to what (current_version vs any newer)?~~ | **Resolved 2026-05-10:** only `current_version_id` triggers drift |
| ~~Q-WIN-11.2~~ | ~~US-WIN-11~~ | ~~Renamed-field handling in diff dialog?~~ | **Revised 2026-05-11:** catalog-schema migration tooling deferred from MVP and kept as post-MVP goal in PRD §7.5. MVP stores `catalog_schema_version: 1`; no shim chain or renamed-field diff handling in v1 |
| ~~Q-ENV-1~~ | ~~US-Builder-Envelope~~ | ~~PRD §6.2 sketch missing layer thickness, steel-stud spacing, orientation enum?~~ | **Resolved 2026-05-10:** PRD §6.2 is illustrative only; missing fields (`assembly.orientation`, `layer.thickness_mm`, `segment.steel_stud_spacing_mm`) confirmed must be added; specifics decided during code-writing |
| ~~Q-ENV-2~~ | ~~US-Builder-Envelope~~ | ~~Photos/datasheets segment-scoped or material-scoped?~~ | **Resolved 2026-05-10:** **split by what they document** — datasheets at project-material level (per-product, one per project), site photos at segment level (per-installation-slot). Introduces `tables.project_materials[]` table; segments reference by `project_material_id`. See US-Builder-Envelope architectural Q-ENV-2 for full model + auto-management rules |
| ~~Q-ENV-2.1~~ | ~~US-Builder-Envelope~~ | ~~Should datasheets eventually move to catalog tier (defaultable + per-project override)?~~ | **Resolved 2026-05-10: NO.** Datasheets never live in the catalog, not even as defaults. Catalog carries specs only (modeling-relevant fields); the QA submittal must come from the project team on the project. See auto-memory `qa_principle_per_project_datasheets.md` |
| ~~Q-ENV-3~~ | ~~US-Builder-Envelope~~ | ~~Default material on segment / assembly create?~~ | **Resolved 2026-05-10:** initial state `project_material_id: null` (with Save-time validation, mirrors Q-WIN-3) **+** dashed-outline / blank-fill canvas rendering **+** R-/U-value label "unfinished" marker **+** TWEAK: once any material is picked in the active assembly, that becomes the session-default for new add-segment / add-layer (Zustand store `lastPickedMaterialByAssembly`, per-assembly key, session-only) |
| ~~Q-ENV-4~~ | ~~US-Builder-Envelope~~ | ~~Steel-stud surface-film divergence (V1 ref §13.5) + Honeybee U-Factor vs U-Value convention~~ | **Resolved 2026-05-10** after source audit of Honeybee + PHN-V1. Honeybee convention is explicit: `r_value`/`u_value` exclude films, `r_factor`/`u_factor` include them (simple EN 673 / ISO 10292, NOT direction-dependent). **V2 policy: PHN shows only U-Value / R-Value (no films); never U-Factor/R-Factor.** ASHRAE-convention U-Factor is direction-dependent, but PHN constructions are direction-free — downstream tools add films at sim time. V1 HBJSON steel-stud bug (R_SE=0.17/R_SI=0.68 baked into cavity equivalent) fixed in US-ENV-12: cavity equivalent uses R_SE=0/R_SI=0 everywhere. Documented in `context/glossary.md` (created 2026-05-10). Unblocks US-ENV-10 |
| ~~Q-ENV-5~~ | ~~US-Builder-Envelope~~ | ~~Multi-row PhDivisionGrid (V1 ref §13.11)?~~ | **Resolved 2026-05-10:** defer to v1.1+; single-row only in V2 v1. Rare in BLDGTYP practice (hybrid assemblies model via multi-layer single-row stacks). Original lean had a structured-error on HBJSON import for multi-row data — now moot since HBJSON construction import was dropped from V2 v1 (US-ENV-12). v1.1+ candidate gated by concrete user request |
| ~~Q-ENV-6~~ | ~~US-Builder-Envelope~~ | ~~Per-project material filter (V1 ref §13.2 has none)?~~ | **Resolved 2026-05-10:** (a) no filter in V2 v1. Material catalogs are smaller and not vendor-keyed; picker's category grouping + search are sufficient. Re-eval at ~150–200 catalog materials; v1.1+ replacement would mirror US-WIN-8 `material_filters` table |
| ~~Q-ENV-7~~ | ~~US-Builder-Envelope~~ | ~~Envelope sub-tabs or flat?~~ | **Resolved 2026-05-10:** keep V1 sub-tab structure (Assemblies / Specifications / Airtightness / Site Photos). Confirmed via Ed's review — see Q-ENV-2 for the restructured Specifications model |
| ~~Q-ENV-8~~ | ~~US-Builder-Envelope~~ | ~~Rename V1 "Materials" sub-tab?~~ | **Resolved 2026-05-10:** rename to "Specifications"; page heading "Project Materials" stays for visual continuity. Confirmed |
| ~~Q-ENV-9~~ | ~~US-Builder-Envelope~~ | ~~Per-assembly deep-link URL?~~ | **Resolved 2026-05-10:** `/projects/{project_id}/envelope/assemblies/{assembly_id}`. Refresh-stable, shareable, browser-back works. Delete-active redirects to first remaining (or empty state) |
| ~~Q-ENV-10~~ | ~~US-Builder-Envelope~~ | ~~Layer add UI — V1 hover-`+` buttons or V2-Windows-style edge-add hot zones?~~ | **Resolved 2026-05-10:** (a) match V1 hover-`+` circles (magenta `#b2087c`) on layer top/bottom edges and segment left/right edges. Muscle-memory continuity wins; small inconsistency vs Windows-edge-zones acceptable since surfaces are visually distinct |
| ~~Q-ENV-11~~ | ~~US-Builder-Envelope~~ | ~~HBJSON construction in/out — assembly-tab toolbar (V1) or project header `⋯`?~~ | **Resolved 2026-05-10:** project header `⋯` (mirrors Q-WIN-8); per-version surface. **Plus scope reduction (2026-05-10):** import dropped from V2 v1 entirely — HBJSON is viewer-only. Only **download** action lives in the `⋯` menu |
| ~~Q-ENV-12.1~~ | ~~US-ENV-12~~ | ~~Per-assembly download (vs whole-project)?~~ | **Resolved 2026-05-10:** defer per-assembly to v1.1+. Whole-project download only in V2 v1 (matches V1 + canonical certifier-submission workflow) |
| ~~Q-ENV-12.2~~ | ~~US-ENV-12~~ | ~~Import-conflict policy?~~ | **Moot 2026-05-10:** import dropped from V2 v1 |
| ~~Q-ENV-12.3~~ | ~~US-ENV-12~~ | ~~Datasheet emission per-segment or per-`project_material`?~~ | **Resolved 2026-05-10:** per-`project_material` (material-level emission, matches V2 data model from Q-ENV-2). Differs from V1's per-segment duplication. Cleaner downstream |
| ~~Q-ENV-12.4~~ | ~~US-ENV-12~~ | ~~Download filename convention?~~ | **Resolved 2026-05-10:** `{bt_number}_{project_name}_{version_name}_constructions.hbjson`, all components slugified (lowercase, spaces→`-`, special chars stripped) |
| ~~Q-ENV-12.5~~ | ~~US-ENV-12~~ | ~~Import on locked active version — Save-As prompt?~~ | **Moot 2026-05-10:** import dropped from V2 v1 |
| ~~Q-ENV-12.6~~ | ~~US-ENV-12~~ | ~~Upload UX (drag-drop vs file picker)?~~ | **Moot 2026-05-10:** no upload path in V2 v1 (import removed) |
| ~~Q-ENV-3.1~~ | ~~US-ENV-3~~ | ~~Keep both header assembly picker AND sidebar list?~~ | **Resolved 2026-05-10:** keep both. Sidebar = scan/browse; header = fast jump by name. Sidebar is collapsible (260 px → 0 px), so the header dropdown is the only on-screen switch when sidebar is collapsed — redundancy is load-bearing. Both bind to `selectedAssemblyId` |
| ~~Q-ENV-4.1~~ | ~~US-ENV-4~~ | ~~Keep V1's 1:1 mm-to-px canvas scale (no zoom)?~~ | **Resolved 2026-05-10:** lean redirected. **(1) Lock aspect ratio** — both axes always scale together (V2 bug-fix vs V1's narrow-viewport horizontal squish). Segments use `flex-shrink: 0`; canvas scrolls horizontally on overflow. **(2) Explicit zoom control in V2 v1** (not v1.1+) — `[−] 100% [+] [Fit]` cluster in assembly header, discrete steps `0.25 / 0.5 / 0.75 / 1.0 / 1.5 / 2.0`, persisted as per-user preference (`userPreferencesStore.envelope_canvas_zoom`) |
| ~~Q-ENV-5.1~~ | ~~US-ENV-5~~ | ~~Last-layer guard — UI lock or backend exception?~~ | **Resolved 2026-05-10:** UI lock at the Delete button (matches US-WIN-2 criterion 7 pattern); replaces V1's server-exception + alert |
| ~~Q-ENV-6.1~~ | ~~US-ENV-6~~ | ~~Where does the user edit specification_status?~~ | **Resolved 2026-05-10 (revised after Q-ENV-2 restructure):** Specifications sub-tab only — spec-status lives on `project_materials` row, not on segments. SegmentPropertiesModal links to the right row in Specifications. |
| ~~Q-ENV-6.2~~ | ~~US-ENV-6~~ | ~~"Detach to a new material" workflow (per-segment override)?~~ | **Resolved 2026-05-10:** in-modal confirm + default name `"<source> (Custom)"` + clone is hand-entered (`catalog_origin: null`, no longer tracked by refresh-from-catalog) + clone inherits `datasheet_asset_ids` and `specification_status` from source |
| ~~Q-ENV-7.1~~ | ~~US-ENV-7~~ | ~~Inline-override field-set scope on materials?~~ | **Resolved 2026-05-10:** full ProjectMaterial field set with `emissivity` / `argb_color` under "More fields…" expander; editing applies to the project_materials row (shared across all uses) |
| ~~Q-ENV-7.2~~ | ~~US-ENV-7~~ | ~~Promote hand-entered material into catalog?~~ | **Resolved 2026-05-10:** deferred to v1.1+ (mirrors Q-WIN-4.4) |
| ~~Q-ENV-7.3~~ | ~~US-ENV-7~~ | ~~Picker shows existing project-materials separately from catalog rows?~~ | **Resolved 2026-05-10:** yes — "In this project" section above "From catalog"; duplicates in catalog tagged "Already in this project" so de-dup is explicit |
| ~~Q-ENV-11.1~~ | ~~US-ENV-11~~ | ~~Drift compared to what?~~ | **Resolved 2026-05-10:** only `current_version_id` (mirrors Q-WIN-11.1) |
| ~~Q-ENV-11.2~~ | ~~US-ENV-11~~ | ~~Renamed-field handling in diff?~~ | **Revised 2026-05-11:** catalog-schema migration tooling deferred from MVP and kept as post-MVP goal in PRD §7.5. MVP stores `catalog_schema_version: 1`; no shim chain or renamed-field diff handling in v1 |
| ~~Q-ENV-13.1~~ | ~~US-ENV-13~~ | ~~Per-row drift surface in Specifications tab?~~ | **Resolved 2026-05-10 (revised after Q-ENV-2):** drift surfaces at the **material card** header (not per-segment-row); drift is a property of the project_material's catalog_origin |
| ~~Q-ENV-13.2~~ | ~~US-ENV-13~~ | ~~Bulk operations across material cards?~~ | **Resolved 2026-05-10:** defer to v1.1+; not in MVP. Per-material primary already collapses N→1 (one card per product), so bulk-set's value drops vs V1's per-use rows |
| ~~Q-ENV-13.3~~ | ~~US-ENV-13~~ | ~~Per-segment site-photo zone disabled when material's spec-status is N/A?~~ | **Resolved 2026-05-10:** disabled when material's `specification_status === 'na'`. Matches V1 semantics, avoids photo waste on placeholders. Workaround: bump material to `pending` if `na` segment legitimately needs documentation |
| ~~Q-ENV-14.1~~ | ~~US-ENV-14~~ | ~~Which HBJSON drives the Airtightness calc?~~ | **Resolved 2026-05-10:** (c) explicitly pinned via the Airtightness page UI (`project_airtightness.hbjson_file_id`); reproducible, decoupled from Model-tab state |
| ~~Q-ENV-14.2~~ | ~~US-ENV-14~~ | ~~Floor-area definition (iCFA / gross / etc.) for Phius CORE cfm50/sf?~~ | **Resolved 2026-05-10:** iCFA per honeybee_ph's `interior_conditioned_floor_area`; document convention in `context/glossary.md`; other definitions v1.1+ gated by concrete user request |
| ~~Q-ENV-14.3~~ | ~~US-ENV-14~~ | ~~Auto-roll-forward `project_airtightness.hbjson_file_id` on new upload?~~ | **Resolved 2026-05-10:** no — keep pinned. Surface a "newer HBJSON available" banner with explicit `[Re-pin]` action. Audit-trail discipline preserved |
| ~~Q-ENV-14.4~~ | ~~US-ENV-14~~ | ~~Multiple airtightness tests per project (mid-construction + final, per-zone)?~~ | **Resolved 2026-05-10:** defer multi-test to v1.1+; one row per project in V2 v1. Schema extends additively (`test_id` keying) when needed |
| ~~Q-ENV-15.1~~ | ~~US-ENV-15~~ | ~~Assembly type — name-parse or explicit `assembly.type` field?~~ | **Resolved 2026-05-10:** explicit `assembly.type` enum (`'wall' \| 'floor' \| 'roof' \| 'other'`); name-based auto-detect on create, user-editable via `⋯` menu thereafter. Adds field to `assembly` shape (PRD §6.2 amendment) |
| ~~Q-ENV-15.2~~ | ~~US-ENV-15~~ | ~~V1's required-photo-set checklist semantics — keep, drop, or defer?~~ | **Resolved 2026-05-10:** defer to v1.1+. V2 v1 ships only the per-segment-installation re-grouped view (already meaningful for contractors). Checklist needs design work V1 skipped |
| ~~Q-ENV-15.3~~ | ~~US-ENV-15~~ | ~~Drag-photo-across-segments reorganization?~~ | **Resolved 2026-05-10:** no — photos stay tied to segments. Cross-segment semantics unclear, QA-record risk. Workaround: re-upload + delete wrong (2 clicks). v1.1+ can add explicit "re-assign photo" with audit log |
| ~~Q-TBL-1~~ | ~~US-Builder-Tables~~ | ~~Per-user persisted view state?~~ | **Resolved 2026-05-10:** no persistence in V2 v1. Single in-memory view state per table_key, last edits survive sub-tab navigation, reset on reload. Saved/named/shareable views = NEW-TBL-1 (post-parity), AirTable-Interface analog |
| ~~Q-TBL-2~~ | ~~US-Builder-Tables~~ | ~~Per-row deep-link URLs?~~ | **Resolved 2026-05-10:** defer to v1.1+. URL format when added: `/projects/{id}/equipment/rooms/{row_id}` mirroring Q-ENV-9 / Q-WIN-5 |
| ~~Q-TBL-3~~ | ~~US-Builder-Tables~~ | ~~Bulk row operations (delete N rows, set field on N rows)?~~ | **Resolved 2026-05-10:** defer to v1.1+. Multi-select + ⌘C copy ships in V2 v1; multi-edit / bulk-delete doesn't |
| ~~Q-EQ-1~~ | ~~US-Builder-Equipment~~ | ~~Sub-tab order?~~ | **Resolved 2026-05-10:** Rooms / Thermal Bridges / ERVs / Pumps / Fans |
| ~~Q-EQ-2~~ | ~~US-Builder-Equipment~~ | ~~Default sub-tab on first visit?~~ | **Resolved 2026-05-10:** Rooms (source-of-truth, most-edited). `/projects/{id}/equipment` → `/equipment/rooms` |
| ~~Q-EQ-2.1~~ | ~~US-EQ-2~~ | ~~`floor_level` data type — string / int / struct?~~ | **Resolved 2026-05-10:** user-defined single-select per-project (US-Builder-Tables criteria 16–17; POC §4.3). Sort follows option order, not alphabetical (AirTable parity) |
| ~~Q-EQ-2.2~~ | ~~US-EQ-2~~ | ~~`building_zone` enum values?~~ | **Resolved 2026-05-10:** user-defined single-select per-project, nullable. No imposed enum |
| ~~Q-EQ-2.3~~ | ~~US-EQ-2~~ | ~~`icfa_factor` constraints?~~ | **Resolved 2026-05-10:** clamp `[0.0, 1.0]`, default `1.0` |
| ~~Q-EQ-2.4~~ | ~~US-EQ-2~~ | ~~ERV-room cardinality?~~ | **Resolved 2026-05-10:** N:M — `erv_unit_ids: string[]`. A room may be served by 0, 1, or multiple ERVs (real-project requirement) |
| ~~Q-EQ-2.5~~ | ~~US-EQ-2~~ | ~~HBJSON-vs-Rooms compare priority?~~ | **Resolved 2026-05-10:** defer until after MVP ships. NEW-ROOMS-1 (post-parity); needs real-project usage data to define the QA-rule set |
| ~~Q-EQ-3.1~~ | ~~US-EQ-3~~ | ~~Point thermal bridges in v1.1+?~~ | **Resolved 2026-05-10:** defer for MVP — **US-EQ-3 demoted to Placeholder status.** Whole Thermal Bridges sub-tab is scaffolding-only in V2 v1; point-vs-linear question moves to v1.1+ full draft |
| ~~Q-EQ-3.2~~ | ~~US-EQ-3~~ | ~~Seed default options for `category` and `simulation_method`?~~ | **Resolved 2026-05-10:** none. Defer for MVP along with the rest of the schema |
| ~~Q-EQ-4.1~~ | ~~US-EQ-4~~ | ~~Default seeded options for `unit_type` and `manufacturer`?~~ | **Resolved 2026-05-10:** no seeded defaults for either. User defines all option labels per-project. Aligns with the V2 v1 directive: zero seeded single-select defaults across the app |
| ~~Q-EQ-4.2~~ | ~~US-EQ-4~~ | ~~One ERV+HRV table or split?~~ | **Resolved 2026-05-10:** one combined table for all ERV and HRV units. `unit_type` single-select holds user-defined labels |
| ~~Q-EQ-5.1~~ | ~~US-EQ-5~~ | ~~Flow-rate / head-pressure fields for v1?~~ | **Resolved 2026-05-10:** defer for MVP — **US-EQ-5 demoted to Placeholder status.** Whole Pumps sub-tab is scaffolding-only in V2 v1; flow / head deferred again to a later v1.x even in the full draft |
| ~~Q-EQ-6.1~~ | ~~US-EQ-6~~ | ~~Seed default `fan_purpose` options?~~ | **Resolved 2026-05-10:** no seeded defaults. User defines all option labels per-project. The v1.1+ Fan catalog (PRD §7.0) `sub_category` column is independent of `fan_purpose` |
| ~~Q-EQ-6.2~~ | ~~US-EQ-6~~ | ~~Optional `serves_room_id` reference for fans?~~ | **Resolved 2026-05-10:** defer to v1.1+. Most projects have 1–2 extract fans; add when a multifamily project surfaces need |
| ~~Q-VIEW-1~~ | ~~US-Viewer / US-VIEW-7~~ | ~~AirBoundary face handling — silently skip (V1) or render distinctly?~~ | **Resolved 2026-05-10:** omit AirBoundary surfaces in MVP (V1-parity skip). Backend logs each skip; load-summary toast surfaces count. Distinct-surface rendering defers to v1.1+ |
| ~~Q-VIEW-2~~ | ~~US-Viewer / US-VIEW-5~~ | ~~Supply vs exhaust duct color split?~~ | **Resolved 2026-05-10:** split colors in V2 v1 — supply blue, exhaust red |
| ~~Q-VIEW-3~~ | ~~US-Viewer / US-VIEW-3~~ | ~~Shade selectability?~~ | **Resolved 2026-05-10 (redirect):** shades NOT selectable in V2 v1 (V1 parity). Making them selectable defers to v1.1+ |
| ~~Q-VIEW-4~~ | ~~US-Viewer / US-VIEW-6~~ | ~~Pipe info-panel richer fields?~~ | **Resolved 2026-05-10:** surface all loaded pipe fields (diameter, insulation thickness/conductivity/reflective/quality, water temp, daily period, length, material). V1 only displayed ID + Name |
| ~~Q-VIEW-5~~ | ~~US-Viewer / US-VIEW-2~~ | ~~Loading UX — modal dialog (V1) or non-blocking toast?~~ | **Resolved 2026-05-10:** non-blocking Sonner toast with progress. Replaces V1's blocking modal |
| ~~Q-VIEW-6~~ | ~~US-Viewer / US-VIEW-3~~ | ~~Sun-path time-of-year scrubber?~~ | **Resolved 2026-05-10:** defer to v1.1+. Annual envelope (V1 behavior) is sufficient for design reviews |
| ~~Q-VIEW-7~~ | ~~US-Viewer / US-VIEW-5~~ | ~~Legend-as-filter (click a legend swatch to hide all others)?~~ | **Resolved 2026-05-10:** defer to v1.1+ **but flagged near-priority post-MVP** per Ed ("definitely will want later"). Captured as NEW-VIEW-2; should be one of the first post-MVP additions |
| ~~Q-VIEW-8~~ | ~~US-Viewer / US-VIEW-2~~ | ~~Section / clipping planes?~~ | **Resolved 2026-05-10:** defer to v1.1+. Useful but needs UI + R3F work that's non-trivial |
| ~~Q-VIEW-9~~ | ~~US-Viewer~~ | ~~HBJSON-vs-document cross-check (NEW-VIEW-1)?~~ | **Resolved 2026-05-10:** defer to v1.1+. Family with NEW-ROOMS-1. PRD §11.4.6 explicitly leaves out of V2 v1 |
| ~~Q-SET-1~~ | ~~US-Settings~~ | ~~What's editable in the Settings modal?~~ | **Resolved 2026-05-10:** `name`, `bt_number`, `phius_number`, `phius_dropbox_url`. Owner read-only (transfer UI post-MVP per Q-OWN-2) |
| ~~Q-SET-2~~ | ~~US-Settings~~ | ~~Is `bt_number` editable post-create?~~ | **Resolved 2026-05-10:** yes, editable subject to uniqueness check (excluding soft-deleted projects' freed numbers per Q-CREATE-2) |
| ~~Q-SET-3~~ | ~~US-Settings~~ | ~~Where does project delete live — dashboard only or also Settings modal?~~ | **Resolved 2026-05-10 (redirect):** dashboard only (US-1.4). Not in Settings modal. Rare, high-stakes action; pairs with dashboard's project-list context |
| ~~Q-SET-4~~ | ~~US-Settings~~ | ~~View-link management?~~ | **Moot 2026-05-10:** no view-link management surface exists. PRD §4 (updated 2026-05-10) made project URLs public-readable; no per-share tokens; to revoke access, soft-delete the project (US-1.4) |
| ~~Q-SET-5~~ | ~~US-Settings~~ | ~~MCP token management?~~ | **Revised 2026-05-11:** include in V2 v1. Project Settings issues/lists/revokes project-scoped read/write MCP bearer tokens because MCP ships read/write capable from day 1 |
| ~~Q-SET-6~~ | ~~US-Settings~~ | ~~Rename side-effects?~~ | **Resolved 2026-05-10:** none. Rename is display-only. URLs use UUID; old downloaded files keep their original names |
| ~~Q-SET-7~~ | ~~US-Settings~~ | ~~Save flow — explicit Save / Cancel or auto-save on blur?~~ | **Resolved 2026-05-10:** explicit Save / Cancel. Edits bypass the draft buffer (relational, not document-versioned); single `PATCH` on Save |
