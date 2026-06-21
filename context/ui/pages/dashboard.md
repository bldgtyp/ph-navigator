> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.2 Dashboard (`/dashboard`)

**Purpose:** A signed-in user's home — list of their projects, primary
entry point to all work.

**Layout:** Single column, full-width minus comfortable side margins.
Top header (§1.1) on top.

**Content (top to bottom):**
1. **Page heading bar.**
   - Left: "My Projects" heading.
   - Right: "+ New project" primary button.
2. **Pinned projects section** (deferred).
   - Do not render pin or drag controls until
     `user_project_preferences` persistence/API exists.
   - Once shipped, show pinned projects above All projects in
     per-user order, visually distinct from unpinned rows.
3. **All projects section.**
   - Section heading: "All projects" with the count ("12 projects").
   - Sorted by `bt_number` **descending** (largest number first;
     newest projects at the top).
   - Uses the row layout below.

**Row layout (each project):**

| Column | Content | Width |
|---|---|---|
| BT number | `2024-013` | narrow, monospace |
| Project name | `Project Foo` (clickable; opens project) | flex |
| Client | `Acme Architects` | flex |
| Last modified | "2 hours ago" (hover for exact timestamp) | narrow |
| Row menu | `⋯` action menu (deferred until real actions ship) | narrow |

Row click opens the project. When pin and row-menu controls ship, clicks
on those controls do not open the row.

**Row menu (`⋯`) actions:**
- Deferred until real actions ship; do not render inert menus.
- Later actions: Open, Pin / Unpin, Copy project URL, Delete
  (greyed-out / hidden until US-1.4 ships).

**Empty state:** if user owns no projects, show a centered card with
a one-line message and "+ New project" button. No pinned section
appears at all.

**"+ New project" modal:**
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

