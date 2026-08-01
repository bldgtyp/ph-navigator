> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.2 Dashboard (`/dashboard`)

**Purpose:** A signed-in user's home and primary entry point to project work.
Ordinary users see their projects; users with `projects.access.all` see the
admin all-project view described below.

**Layout:** Single column, full-width minus comfortable side margins.
Top header (§1.1) on top.

**Content (top to bottom):**
1. **Catalogs section.**
   - Heading "Catalogs" with a "3 libraries" count.
   - A card grid (`catalog-card-grid`) of three shortcut cards, each a
     `<Link>` to a global catalog manager (§2.3): **Materials**,
     **Window-Glazing** (`glazing-types`), and **Window-Frame Elements**
     (`frame-types`). Cards are icon + label; always shown (catalogs are
     global, not per-project). This mirrors the `Catalogs ▾` menu that
     appears in the topbar on the catalog pages themselves.
2. **New-project action.**
   - A single **"Add New Project +"** button (opens the new-project
     modal below). This is the exact button label rendered by
     `Dashboard.tsx`.
3. **Pinned projects section** (deferred).
   - Do not render pin or drag controls until
     `user_project_preferences` persistence/API exists.
   - Once shipped, show pinned projects above All projects in
     per-user order, visually distinct from unpinned rows.
4. **All projects section** (`ProjectList`).
   - Section heading: "All projects" with the count ("12 projects").
   - Ordinary responses are sorted by `bt_number` **descending** (largest
     number first; newest projects at the top).
   - Responses for users with `projects.access.all` carry `grouped: true` and
     contain every non-deleted project, grouped by `owner_id`. The signed-in
     user's group comes first; remaining owner groups sort by owner display
     name ascending, with `bt_number` descending inside each group.
     `ProjectList` renders that server order directly and adds one owner
     heading with a project count per contiguous group.
   - Uses the row layout below, plus per-row selection checkboxes, a
     select-all control, and a delete-selected action (see "Bulk delete"
     below).
5. **Deleted projects panel** (`DeletedProjectsPanel`).
   - Lists soft-deleted projects with a per-row **Restore** action
     (`useRestoreProjectMutation`). Hidden/empty when nothing is
     soft-deleted.

**Row layout (each project):**

| Column | Content | Width |
|---|---|---|
| BT number | `2024-013` | narrow, monospace |
| Project name | `Project Foo` (clickable; opens project) | flex |
| Client | `Acme Architects` | flex |
| Last modified | "2 hours ago" (hover for exact timestamp) | narrow |
| Select | selection checkbox (feeds bulk delete) | narrow |

The project-name link opens the project. Selection checkboxes do not navigate.

**Bulk delete (shipped, US-1.4).** Project deletion shipped as a
**multi-select bulk** flow, not a per-row `⋯` menu:

- Each row carries a selection checkbox; the list header carries a
  select-all toggle (`onToggleAllProjects`). Selection state
  (`selectedProjectIds`) lives on the Dashboard and auto-prunes ids that
  leave the visible list.
- Selection remains owner-only even in the admin all-project view. A
  non-owned row checkbox is disabled with the explanation "Only the owner can
  delete this project"; select-all selects only projects whose `owner_id`
  matches the signed-in user. If no visible projects are owned, select-all is
  disabled.
- With one or more projects selected, a **delete-selected** action
  appears (`onDeleteSelected`). It opens `DeleteProjectsModal`, a
  confirmation listing the chosen projects; confirming calls
  `useBulkDeleteProjectsMutation` (soft delete) and clears the
  selection.
- Deleted projects then appear in the **Deleted projects panel** below
  the list, each with a **Restore** action
  (`useRestoreProjectMutation` / `useDeletedProjectsQuery`).

Pin / Unpin and Copy-URL row actions remain deferred.

**Empty state:** if the list response contains no projects, `ProjectList`
shows a centered empty state whose call-to-action re-opens the new-project
modal. No pinned section appears at all.

**New-project modal** (opened by the "Add New Project +" button):
- Modal title: "New project"
- Fields:
  - **Project name** — required, free text.
  - **BT number** — required, must be globally unique. 4-digit
    expected (e.g. "2426"). The input shows live availability
    feedback: ⏳ "Checking…" while the debounced
    `/api/v1/projects/check-bt-number` request is in flight,
    ✅ "Available" green, or ❌ "Already in use by Project Foo
    (2024-013)" red. The Create button stays disabled until the
    response is ✅.
  - **Client** — optional.
  - **Phius number** — optional.
- Buttons: Cancel, Create project (primary, disabled when name is
  empty or BT number is empty / unchecked / not-available).
- On submit, redirects to `/projects/{new_id}/status`.
- On race-condition 409 (`error_code='bt_number_taken'`), inline
  error appears on the BT number field; user picks a different one
  and retries.
