---
DATE: 2026-05-10
TIME: -
STATUS: DRAFT — narrative UI/UX descriptions, populated incrementally
        alongside the user-stories doc. Companion to
        context/PRD.md (architecture PRD) and
        context/USER_STORIES.md (user stories).
        Designed to be handed off to Claude Design (or another visual
        designer) for actual screen design once content is stable.
AUTHOR: Ed May (with Claude)
SCOPE: Narrative descriptions of every UI page and flow in PH-Navigator
       V2. Describes layout, content, behavior, and interaction patterns
       in plain language — no pixel-level decisions. Reference, not
       prescription.
RELATED: context/PRD.md (architecture PRD),
         context/USER_STORIES.md (user stories),
         https://github.com/bldgtyp/bt-branding,
         https://bldgtyp.github.io/bt-branding/
---

# PH-Navigator V2 — UI / UX Narrative

## 0. Design intent

PH-Navigator V2 is an **internal tool** for a two-person consulting
firm. The audience is technical (architects, certified passive house
consultants, energy modelers) and data-dense screens are welcome.

Design hypothesis: PH-Navigator V2 should feel like a **technical
workbench for Passive House project data**: quiet, precise, data-rich,
and built for repeated use by expert users. It should preserve V1's
domain spine without inheriting V1's generic admin-app styling.

Design should optimize for:

- **Clarity over polish.** Information hierarchy and discoverability
  matter more than visual flourish.
- **Speed of action.** Frequent users; minimize click counts on the
  workflows they hit daily (open project → edit → save).
- **Stable mental model.** App-like Save / Save As, lock states,
  versions, catalogs — concepts the user keeps in their head; the UI
  must reinforce them, not contradict them.
- **Low ceremony.** No onboarding tours, no "we noticed you..." nags,
  no dark-pattern confirmations except where genuinely needed
  (project delete, lifecycle transitions).
- **Honest density.** Tables show the data; don't hide columns behind
  hover-reveal or progressive disclosure unless the screen really
  forces it.
- **Domain-native surfaces.** The best screens should support the
  building object directly: assembly section, aperture diagram,
  evidence checklist, model selection, or row-level equipment record.
  Avoid generic dashboard/card composition when a workbench layout is
  clearer.

### V1 precedent, not prescription

V1 screenshots are useful precedent for workflow shape, not final visual
direction. Treat V1 findings with this taxonomy:

- **Invariant:** product/workflow facts that carry forward unless a
  later PRD decision supersedes them.
- **Requirement:** behavior V2 must implement.
- **Design hypothesis:** direction to prototype and test.
- **Open question:** choice to keep unresolved until more V1 examples,
  user priority, or prototype feedback clarifies it.

Current V1-derived invariants:

- Project workspace tabs stay: Status, Windows, Envelope, Equipment,
  Model.
- Status remains the default project landing surface.
- Windows and assemblies need visual builders, not only tables.
- Dense table views remain central for equipment, materials, and
  catalog-like records.
- Evidence state for datasheets, specs, and site photos is a
  cross-cutting UX system, not a set of isolated icon cells.
- The Model tab is a real HBJSON viewer with color-by, legends,
  selection, inspection, model-file switching, and enough canvas area to
  feel primary.

### BLDGTYP design system

PH-Navigator V2 should crib directly from the BLDGTYP brand design
system where it helps the application feel like part of the same
technical tool family:

- Canonical reference: <https://bldgtyp.github.io/bt-branding/>
- Source repo: <https://github.com/bldgtyp/bt-branding>
- Required CSS tokens:
  <https://bldgtyp.github.io/bt-branding/tokens/tokens.css>
- Optional component reference:
  <https://bldgtyp.github.io/bt-branding/tokens/components.css>
- Machine-readable tokens:
  <https://bldgtyp.github.io/bt-branding/tokens/tokens.json>

Use the published tokens for fonts, color, radius, motion, and theme
surfaces when possible. Build PH-Navigator-specific components on
shadcn/ui/Tailwind, but map the visual layer to BLDGTYP tokens instead
of inventing a separate palette.

Initial application guidance:

- Use Outfit 400 for readable body text where practical; keep headings
  on Outfit weights from the published token scale.
- Use Geist Mono for labels, numeric annotations, nav triggers,
  compact metadata, units, and technical chips.
- Use the published `--font-table` token (Geist) for table headers and
  records.
- Use `--accent` / `--accent-text` as the primary action/accent channel.
- Use `--highlight` / `--highlight-text` sparingly for emphasis,
  warnings, missing evidence, or selected technical objects. Do not let
  magenta mean every action state.
- Use theme-aware surfaces (`--bg-page`, `--bg-card`, `--bg-elev`,
  `--border-subtle`, `--text-*`) for light/dark mode.
- Consider graph-paper treatments only where they reinforce technical
  drafting/data context: dashboard bands, data views, model/building
  workbench panels, or empty technical states. Keep them subtle.
- Treat `components.css` classes as reference or selectively reusable
  pieces, not a mandate to make this app look like the public branding
  site.

### Tech-stack constraints (from PRD §12)

The chosen frontend stack is **Vite + React + TypeScript + Tailwind +
shadcn/ui + TanStack Table + Zustand**. The 3D viewer adds **React
Three Fiber + drei**. These should not be visible to the user as
specific tools — the user sees clean, consistent UI — but they
constrain visual idioms in friendly ways:

- shadcn/ui's primitives (button, input, dialog, tabs, table, command)
  are the building blocks.
- Tailwind tokens (color, spacing, radius) define the look.
- Tailwind/shadcn theme tokens should be wired to the BLDGTYP CSS
  custom properties when possible, so app components consume the same
  source values as the design-system site.
- Real screen composition and component design are deferred to a Claude
  Design pass that follows this doc and the BLDGTYP design system.

### Out of scope for this doc

Pixel-perfect mockups, final component variants, illustration,
empty-state art, and animation specifics. Those land in the design pass.
The brand-token dependency itself is in scope here.

---

## 1. Common elements

### 1.1 Top header

Present on signed-in app pages and Viewer project reads. Viewers
use the same project workspace routes in read-only mode
(§2.11).

```
┌────────────────────────────────────────────────────────────────────┐
│ [PH-Nav]  Project Foo › Status                 Catalogs ▾   Ed ▾  │
└────────────────────────────────────────────────────────────────────┘
```

- **Far left:** PH-Nav logo (wordmark + minimal graphic mark).
  Clicking returns to `/dashboard`.
- **Adjacent right of logo:** breadcrumb context. Examples:
  - On `/dashboard` → just shows the logo (no breadcrumb).
  - On `/projects/{id}` → "Project Foo › Status" (or the active tab).
  - On `/catalog/materials` → "Catalogs › Materials".
  - Each breadcrumb segment is a link to the corresponding page.
- **Center-right:** "Catalogs ▾" dropdown. Opens a small menu listing
  the available catalogs. **v1 (live):** Materials, Window-Frame
  Elements, Window-Glazing. **Future (deferred — see PRD §7.0
  for the full roster):** ERV units, Pumps, Fans, Appliances,
  Hot-Water Heaters, Hot-Water Storage Tanks, Heat-Pumps,
  Direct-Elec Heaters, Boilers, and others TBD.
  - **v1 menu treatment:** show only the 3 live catalogs; do not
    list future catalogs as "coming soon" entries (premature
    promises). Future catalogs appear in the menu the moment they
    ship.
  - **Menu-redesign trigger:** when the catalog count exceeds ~5,
    the flat dropdown becomes unwieldy. At that point, regroup
    (Envelope / Mechanical / Appliances / ...) or move to a
    Command-K-style search palette. Defer the redesign until the
    fourth catalog actually lands.
- **Far right:** user identity. "Ed ▾" or avatar + name. Click opens
  a small menu: Sign out, (later: account settings).
- **Sticky on vertical scroll.** Stays visible.
- **Responsive note (low priority for v1):** at narrow widths,
  breadcrumb collapses; logo stays. Phone is non-goal.

### 1.2 Footer (signed-in app)

Minimal: small text bottom-right with build/version (e.g. "PHN-V2
build 2026-05-10.42") and a link to the changelog. No marketing.

### 1.3 Modals

Used for:
- Confirmation of high-stakes actions (Delete project, Discard
  changes).
- Forms that don't justify a full page (New project, Save As).
- Conflict-resolution dialogs (409 on Save).

shadcn `Dialog` primitives. Always dismissible by Esc and clicking
outside, **unless** the dialog is mid-confirmation of a destructive
action (e.g. project delete final-confirm) — then only an explicit
Cancel closes.

### 1.4 Toasts

Used for:
- "Saved." after successful Save.
- "Saved as Round 1 Submit." after Save As.
- Error notifications (network failure on draft sync, 409 on Save).

shadcn `Sonner` / `Toast`. Auto-dismiss after 4 seconds. Errors are
sticky until the user dismisses or clicks "View details."

### 1.5 Session-expiry modal

When a request returns 401 because the user's session expired (60-min
idle) or was invalidated by sign-in on another device, the frontend
opens a **session-expiry modal in place** rather than navigating
away — so the in-memory document and current tab context are not
lost.

Modal contents:
- Title: "Your session has expired"
- Subtitle (varies by reason):
  - Idle timeout: "You've been inactive for 60 minutes. Sign in to
    continue."
  - Superseded by new login: "Your account signed in on another
    device. Sign in here to take over editing."
- Email + password inputs (email pre-filled from the prior session if
  remembered).
- "Sign in" primary button.
- No Cancel / Dismiss; modal is non-dismissible. The user must sign
  in or close the tab. (Closing the tab is a final-fallback for
  signing out without re-authenticating.)

On successful re-auth:
- Modal closes.
- The most recent failed request (or queue of failed requests) is
  retried automatically.
- A subtle toast: "Welcome back, Ed."

If the user has unsaved in-memory changes that were never synced to
the server-side draft (the queue had items pending when the 401
occurred), those are queued and retried after re-auth as well.

### 1.6 Empty states

For empty tables, lists, and pages, show a quiet illustration or icon
+ short description + primary action. Never a blank screen.

Examples:
- Empty dashboard (new user): "No projects yet. [+ New project]"
- Empty assemblies list: "No assemblies yet. Add your first wall,
  floor, or roof. [+ New assembly]"
- Empty HBJSON list: "No HBJSON files uploaded yet. Upload a model
  exported from Rhino + honeybee_ph. [+ Upload]"

### 1.7 DataTable — shared grid interaction model

The same React component (`<DataTable>`) renders every grid-style
surface: the catalog manager pages (`/catalog/{slug}`), the
project-scoped Specifications sub-tab, the bookshelf material
picker, and any future tabular surface. Per-table column
declarations live in TS at the call site (PRD §11.1: "schema
flexibility lives in code, not runtime").

The interaction model below is the user-facing contract — what the
table feels like to use. The full component contract, library
choices, write pipeline, and lessons-learned live in
`context/technical-requirements/data-table.md`. This subsection is
the UI/UX-level summary that other pages reference.

**Density and chrome.** 32 px row height, 1 px dividers, hover
highlight on rows. Sticky-left first column for any table whose
first column is the row identifier. Sticky 32 px left gutter outside
the column model carries row numbers and the row-select target.
Every column has a user-resizable, persisted width (drag the right
edge of any header; double-click fits to content; defaults per field
type).

**Active cell + keyboard nav.** A single click focuses a cell (no
double-click required). Arrow keys, Tab/Shift+Tab (with row
wrapping), Home/End move the active cell. Enter or double-click
opens the cell editor; Esc cancels; Enter/blur commits. Auto-scroll
keeps the focused cell in view.

**Range selection.** Click-drag or Shift+arrow extends a rectangle.
Shift+click sets the head, anchor unchanged. Auto-scroll near
viewport edges while dragging. Click in the left gutter selects the
full row; Shift+click extends a contiguous block of rows. Click the
header strip selects the full column; Shift+click extends a
contiguous block of columns. ⌘A selects the visible (filtered) data
set. Non-contiguous ⌘+click selection is **not** supported in v1
(deferred per parity gate).

**Copy / paste.** ⌘C writes the active cell or selected rectangle to
the clipboard as **both** TSV and HTML, so external paste into
Excel, Numbers, Google Sheets, and AirTable preserves the row ×
column shape. ⌘V parses an incoming TSV and lays it onto the
selection:

- Single clipboard cell into a multi-cell selection → fills the
  selection.
- Multi-cell clipboard with a single anchor → places a block.
- Same-shape selection and clipboard → cell-by-cell.
- More clipboard rows than fit → modal: *"Clipboard has N more
  rows. Add N empty records and paste?"* Confirm appends; Cancel
  drops overflow.
- More clipboard columns than fit → silent drop with a toast note.

Paste is **disabled while the table is grouped** — banner reads
*"Ungroup to paste"*. Per-column type coercion runs on every
incoming string (numeric strings parsed; single-select strings
matched-or-created; etc.).

**Fill handle.** When a range is active and not editing, a 6×6 px
square at the bottom-right corner extends the selection by drag
(axis-locked to the dominant direction); a dashed target rectangle
previews the result. Source values map cyclically when shapes
mismatch. ⌘D fills down, ⌘R fills right. Pattern detection (1, 2, 3
→ 4, 5…) is **not** supported in v1.

**Undo / redo.** ⌘Z and ⌘⇧Z revert / replay user actions. Undo
operates per **gesture** — one ⌘Z reverts an entire paste, fill, or
row-insert, not one cell at a time. POC bound: 8 entries, in-memory.
Production undo is local-only; version switches, refetches, ETag
mismatches, Save / Save As / Discard, and MCP/other-tab draft changes
clear the undo stack (see `context/technical-requirements/data-table.md`).

**Sort, filter, group, hide — toolbar-owned.** A toolbar above the
table holds five buttons:

```
┌──────────────────────────────────────────────────────────────────┐
│  Hide fields    Filter (2)    Group by    Sort by    Color    ⋯  │
│                  green tint    purple       peach                │
└──────────────────────────────────────────────────────────────────┘
```

Each button opens a popover:

- **Hide fields.** Show/hide columns.
- **Filter.** Stacked rows: column + operator + value, drag-reorder,
  AND-only in v1 (OR is a deferred follow-up). Operators per type:
  text (contains/is/is empty/…); number (=, !=, >, <, between, is
  empty); single_select (is any of, is none of, is empty). Empty/
  dormant rows pass everything (don't match the empty string).
- **Group by.** Up to 3 levels; stacked rows with asc/desc.
- **Sort by.** Stacked rows; first row primary, rest are tiebreakers.
  Shift+click on a column header adds to the sort stack.
- **Color.** Configurable row-coloring rules — placeholder in v1.

When a button is active, it tints pale (filter-green, group-purple,
sort-peach) and reads as a sentence fragment: *"Filtered by
MANUFACTURER"*, *"Grouped by 1 field"*, *"Sorted by 1 field"*.

**Per-column tinting.** When a column participates in a filter,
sort, or group, its body cells tint the corresponding color. When it
participates in two or three roles, the tints layer through a
pre-mixed palette (no live HSL math). Tint sits underneath
selection; focus uses a separate `outline` channel so the focus ring
stays visible inside a tinted, selected cell.

**Group accordion.** Grouped rows render as a nested accordion with
a chevron, the group key (rendered as the column's own pill / value
type), a row count `(N)`, and per-column aggregated values
(count/sum/mean/min/max/none — pickable per column from a small
caret in the column header). Toolbar quick actions: Collapse all /
Expand all.

**Single-select cells.** A typed field type, used in v1 for
`materials.category`. Cells render as a colored pill; the inline
editor is a popover with search, click-to-pick, and an inline
`+ Add new option` form. Pasting a TSV column of category strings
runs match-or-create case-insensitively, auto-assigns palette colors
to new options, and reports the new options in a single toast:
*"5 cells written. 3 new options created in 'category'."* Undo of
the paste rolls back the cell writes **and** the new options
together.

**Per-column field config.** Right-click on a column header (or
double-click the header label — separate from the resize handle's
fit-to-content double-click) opens the field-config modal. The modal
is the unified entry point for renaming a column, editing its
description, editing options on single-select columns, and editing
formula source on formula columns. Built-in (feature-author-declared)
fields and user-created custom fields both open the same modal;
per-attribute locks (declared in feature code) disable individual
sections with a uniform `"Field Locked"` tooltip rather than hiding
the modal. Locked-attribute presence shows as a small lock glyph in
the header.

**Locked / read-only mode.** When the open version is locked, the
visitor is a Viewer, or another permission boundary applies, the table
renders in read-only mode: no toolbar mutations except sort/filter/group
on the user's local view, no inline edits, no paste/fill/undo, no
row-add. Edit affordances are hidden, not disabled-with-tooltip.

**A11y baseline.** `tabIndex={0}` container with bubbled key
handling so internal inputs still receive their own keys. `role=
"grid"` with `aria-rowindex`/`aria-colindex` reflecting the visual
(post-sort/filter) position. Tab from the last visible cell
**leaves** the table rather than wrapping. Polite live-region
announces filter/sort/group changes. Roving-tabindex hardening is a
post-extraction lane.

**Out of scope for v1.** Linked-record / relation cells; per-user
non-contiguous selection; OR mode in filter; fill-handle pattern
detection; comments / @mentions / presence cursors; mobile / phone
optimization; dark-mode tint palette. See
`context/technical-requirements/data-table.md`.

---

### 1.8 Evidence / documentation status grammar

Evidence state appears across project materials, equipment rows,
aperture/window records, site-photo pages, and certification/status
workflows. It should read as one coherent documentation layer.

Core states:

| State | Meaning | Typical use |
|---|---|---|
| Missing | Required evidence is absent. | Datasheet/site photo/spec missing. |
| Required | Evidence is expected but not yet evaluated. | New row or imported V1 data. |
| Attached | One or more files are linked. | Datasheets, photos, HBJSON files. |
| Complete | QA status accepted for this record. | Spec status, milestone done. |
| N/A accepted | Requirement intentionally does not apply. | Spec/photo requirement waived. |
| Linked source | Row came from a catalog or imported source. | Catalog badge, V1 import. |
| Drifted | Copied value differs from current catalog/source. | Refresh-from-catalog flows. |

Design rules:

- Missing evidence must be filterable at the page/table level.
- A missing state should link directly to the surface that resolves it:
  upload drop zone, row detail, assembly segment, equipment record, or
  status item.
- Evidence badges/icons need text labels or hover/detail affordances;
  tiny icon-only cells are not sufficient for certification QA.
- Separate missing/required from warning/error colors. Missing evidence
  is a work item, not necessarily an application error.
- For Viewer/read-only mode, retain evidence visibility but hide upload,
  delete, and status-edit affordances.

## 2. Pages — narrative

### 2.1 Sign-in page (`/sign-in`)

**Purpose:** Authenticate Ed or John into the app.

**Layout:** Single centered card on a neutral background. Card width
~400 px max.

**Content (top to bottom):**
- PH-Nav logo, larger than in the header. Visual anchor.
- Title: "Sign in to PH-Navigator".
- Email input (autocomplete `email`).
- Password input (autocomplete `current-password`, with show/hide eye
  toggle).
- "Sign in" primary button (full-width).
- Below the button, small text: "Trouble signing in? Contact Ed." (no
  self-serve forgot-password in v1; admin reset only).
- No social login buttons. No "create account" link.

**Behavior:**
- On load, focus the email input.
- Form is submitted on Enter from either field.
- During submission, button shows loading state; inputs disabled.
- On failure: red error banner above the form: "Email or password is
  incorrect."
- On success: redirect to `/dashboard` (or to `?next=` if present).

**Accessibility:**
- Proper `<label>`s, `<form>` semantics, focus management.
- Error banner uses `role="alert"`.

### 2.2 Dashboard (`/dashboard`)

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

### 2.3 Catalog landing pages (`/catalog/{table_slug}`)

**Purpose:** Curate the global catalogs that projects pick from.

**(Detailed in a later story — US-Catalog. Placeholder.)**

The dashboard's "Catalogs ▾" dropdown navigates to one of these pages.
The page renders a single `<DataTable>` (see §1.7 and
`context/technical-requirements/data-table.md`) over the catalog rows,
framed by chrome that's specific to catalogs:

- Page header with the catalog's display name, the active version
  (read-only banner if viewing a historical version), a version
  picker, and a "Save" / "Save as new version" affordance (PRD §7.2).
- Above the table, a small audit-log link surfaces who-changed-what
  inside this catalog (recent N events).
- The `<DataTable>` itself is the same component used in the
  project-scoped Specifications sub-tab; the only differences are
  the column declarations and which row-chrome slots are enabled.

Full UX description (page header layout, version picker mechanics,
attachment uploads on Frames, audit log surfacing) deferred to the
Catalog user stories.

### 2.4 Project workspace (`/projects/{project_id}/{tab}`)

**Purpose:** One project's home. Workspace structure matches the V1
mental model the user already has: Status / Windows / Envelope /
Equipment / Model.

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

#### Project header bar (below the global header)

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

#### Tab bar (below the project header)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Status · Windows · Envelope · Equipment · Model                         │
└──────────────────────────────────────────────────────────────────────────┘
```

- Tabs match the V1 mental model. **No "Versions" tab** (header
  dropdown instead). **No "Settings" tab** (overflow menu).
- Selected tab shows an active-state underline / fill.
- Tab selection updates the URL:
  `/projects/{id}/status`, `/projects/{id}/windows`,
  `/projects/{id}/envelope`, `/projects/{id}/equipment`,
  `/projects/{id}/model`. Browser back/forward work.
- Each tab loads independently (no full-page reload between tabs;
  data fetches are scoped).

#### 2.4.1 Version dropdown picker (US-3.1)

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

### 2.5 Status tab (`/projects/{id}/status`) — placeholder

**(Full spec in US-Status.)**

Default landing for the project workspace. Vertical timeline of
project lifecycle / certification milestones. Each item: state icon +
title + completion date or free-text description (Markdown).
User-managed list — add, reorder (drag), edit, mark done, delete.

**Empty state (brand-new project, zero items):**

The Status tab is the default landing tab, so a brand-new project
opens directly into an empty Status surface. No auto-populate; user
gets explicit control.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              No status items yet for this project.               │
│                                                                  │
│       Track lifecycle milestones — CAD received, design          │
│       complete, Phius reviews, certification — to know           │
│       where this project stands at a glance.                     │
│                                                                  │
│        [ Apply BLDGTYP default template ]   ← primary            │
│        [ Add custom item ]                  ← secondary          │
│                                                                  │
│                  Skip to Envelope → (link)                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**"Apply BLDGTYP default template"** populates 4 starter items in
order:
1. CAD files received
2. Design Model complete
3. Phius review complete
4. Certification Complete

All four start in `state='todo'`. User edits / reorders / dates / adds
freely from there. The template is hardcoded in code; no
template-management UI in v1.

**Populated state:** vertical timeline component (similar to V1's
Status page). Each row:
- State icon (○ todo / ✓ done / – n/a)
- Item number (auto from order)
- Title (clickable to edit)
- Completion date (if state = done) OR free-text description
  (Markdown, may include in-app links — internal anchors v1.1+)
- Optional next action / owner / linked work surface when a status item
  is acting as a workflow gate.
- Drag handle for reorder
- `⋯` row menu: Edit, Mark done, Mark todo, Mark n/a, Delete

Each milestone should read as a compact status record: state, title,
date/description, and a direct link to the surface that resolves it
where applicable. Avoid treating Airtightness/Site Photos links as
small annotations; if they are gates, they need action affordance.

Reference: V1 Status page screenshot supplied 2026-05-10.

### 2.6 Windows tab (`/projects/{id}/windows`) — placeholder

**(Detailed in US-Builder-Windows.)** Window types: shadcn-table
of window-type rows; clicking a row opens the per-window-type
editor (rows, columns, frames, glazings).

Use the shared builder shell: object browser/list on the left, visual
aperture editor in the center, computed U-w / dimension summary near
the top, and inspector/details or editable breakdown table adjacent to
the selected visual object. Catalog origins and custom overrides should
be visible without forcing the user into a separate audit page.

### 2.7 Envelope tab (`/projects/{id}/envelope`)

**(Detailed in US-Builder-Envelope and US-ENV-1..15.)**

The Envelope tab carries the project's opaque-construction data —
walls, floors, roofs, and any layered envelope assembly — plus the
per-segment design-spec / documentation surface, blower-door /
airtightness data, and required project site photos.

#### 2.7.1 Sub-tab structure (US-ENV-1)

The Envelope tab has its own **second-level tab bar** below the
project header / project tab bar. Four sub-tabs in this order:

```
Assemblies · Specifications · Airtightness · Site Photos
```

- **Assemblies** (default landing) — visual layer/segment composer
  for each assembly. URL `/envelope/assemblies` (with optional
  `/{assembly_id}` for direct deep-link).
- **Specifications** — per-segment design-spec status, attached
  product datasheets, attached site photos, and notes. URL
  `/envelope/specifications`. Replaces V1's misleadingly-named
  "Materials" sub-tab; the page heading inside ("Project
  Materials") stays for visual continuity with V1.
- **Airtightness** — placeholder; specced separately. URL
  `/envelope/airtightness`.
- **Site Photos** — placeholder; specced separately. URL
  `/envelope/site-photos`.

The bare `/envelope` URL redirects to `/envelope/assemblies`.

The locked-version banner (UI/UX §2.4.1) sits above the sub-tab
bar — one banner across all four sub-tabs, not duplicated per
sub-tab.

#### 2.7.2 Assemblies sub-tab (`/envelope/assemblies`)

**Layout:** assembly-list sidebar (left, ≈260 px, default closed) and
active-assembly canvas/workbench (right). Same shell pattern as the
Windows tab. The assembly visual is the primary object, not a decorative
preview.

**Sidebar (US-ENV-2):**

```
┌─────────────────────────────┐
│ + Add new assembly          │
├─────────────────────────────┤
│ FLOOR-FC3R                  │
│ FLOOR-FC6R                  │
│ ROOF-RC5R           ✏  📑  ✕│  ← hover-revealed actions
│ WALL-C3                     │
│ WALL-SE-30a                 │
│ WALL-SE-80                  │
│ ...                         │
└─────────────────────────────┘
```

- Sticky add-button at top.
- Naturally-sorted list (`WALL-C2 < WALL-C10 < WALL-SE-30a`).
- Active row highlighted.
- Hover reveals `Edit name (✏) · Duplicate (📑) · Delete (✕)`
  icons (logged-in editor on unlocked version only).
- All edit affordances hidden when version is locked or when the
  visitor is a Viewer.

**Right side — active assembly content (US-ENV-3, 4):**

```
┌───────────────────────────────────────────────────────────────────────┐
│  Assembly Details   [WALL-C3 ▾]    Total Thickness: 304.8 mm  ⓘ      │
│                                    Effective U-Value: 0.243 W/m²K  ⓘ  │
│                                    [⇅ Flip Orient] [↔ Flip Layers]    │
│                                    [⨀ Pick] [⬇ Paste] [↶ Undo]   ⋯   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                              exterior                                 │
│  ┌──────────┬─────────────────────────────────────────────────────┐  │
│  │  10.000  │ ░░░░░░░░░░░░░░░░ Concrete (Heavily Reinforced) ░░░░│  │  ← layer 1
│  │   in     │                                                     │  │
│  ├──────────┼─────────────────────────────────────────────────────┤  │
│  │  3.000   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ XPS ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │  ← layer 2
│  │   in     │                                                     │  │
│  └──────────┴─────────────────────────────────────────────────────┘  │
│                              interior                                 │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  Color │ Material                       │ Resistivity [R/in]          │
│  ░░░░  │ Concrete (Heavily Reinforced)  │ 0.048                       │
│  ▓▓▓▓  │ XPS                            │ 4.999                       │
└───────────────────────────────────────────────────────────────────────┘
```

(Preserves V1's assembly object model and rough builder structure — see
V1 reference screenshot supplied 2026-05-10. Adjusted in V2 to:
1. **Move HBJSON in/out** to the project header `⋯` overflow
   menu (per Q-ENV-11), out of this assembly-tab toolbar.
2. **Drop the AirTable button** entirely (V2 has no AirTable
   surface).
3. **Drop the "Refresh Materials" overflow item** — the catalog
   manager is reached via the global header "Catalogs ▾"
   dropdown, and drift is surfaced inline per US-ENV-11.)

**Layer rendering (US-ENV-4 / US-ENV-5):**

- Each layer is a horizontal strip whose height in CSS px equals
  its thickness in mm (1:1 scale; matches V1).
- Left column (35 px): thickness label in active unit (mm or in).
  Hover the label → bold + dashed-border highlight + reveal
  compact `+` buttons at top edge ("Add Layer Above") and bottom edge
  ("Add Layer Below").
- Click the thickness label → opens **Layer Height modal** with
  unit-aware input parsing (`50 mm`, `2 in`, `2-1/2"`,
  `100 + 50`); modal has an inline **Delete Layer** action that
  is disabled when only one layer remains (UI-level guard, V2
  fix vs V1's server-exception + alert).
- Right column: side-by-side segment SVG rectangles, colored
  from each segment's material `color` (`#rrggbb`).
- Segment hover reveals compact `+` buttons at left and right edges
  ("Add Segment Left / Right").
- Click a segment → opens **Segment Properties modal** (US-ENV-6).

**Segment Properties modal (US-ENV-6):**

```
┌──────────────────────────────────────────────────────────┐
│  Segment: Concrete (Heavily Reinforced)              ✕   │
├──────────────────────────────────────────────────────────┤
│  Material                                                │
│  [Concrete (Heavily Reinforced) ▾]  📚 [More fields…]    │
│                                                          │
│  Material Data (read-only)                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Name: Concrete (Heavily Reinforced)               │  │
│  │  Category: Concrete                                │  │
│  │  Resistivity: 0.048 R/in                           │  │
│  │  Density: 2400 kg/m³                               │  │
│  │  Specific Heat: 880 J/(kg·K)                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Segment Width                                           │
│  [  9' 11"           in  ]                               │
│                                                          │
│  ☐ Continuous Insulation (for steel-stud assemblies)    │
│  ☐ Steel Stud Cavity                                    │
│                                                          │
│  Specification Status                                    │
│  [N/A ▾]                                                 │
│                                                          │
│  Notes                                                   │
│  [                                                    ]  │
│                                                          │
│  ────────────────────────────────────────────────────    │
│             [ Delete Segment ]   [ Cancel ] [ Save ]     │
└──────────────────────────────────────────────────────────┘
```

- Material picker: bookshelf flow (US-ENV-7) — pick from
  shared catalog, values copied into the document. The 📚
  badge indicates the segment's material is sourced from the
  catalog; on drift, an additional `↻` overlay appears (US-
  ENV-11).
- Save flushes a single JSON-Patch into the draft buffer (V2
  cleanup vs V1's 4-PATCH chatter, V1 ref §13.14).
- **Delete Segment** at bottom-left, red. Disabled with tooltip
  "A layer must have at least one segment" when only one
  segment in the layer remains.
- All inputs read-only on locked versions / Viewer reads.

**Assembly Toolbar (US-ENV-8 / US-ENV-9):**

- **⇅ Flip Orientation** — swaps the "exterior" / "interior"
  labels; layers untouched.
- **↔ Flip Layers** — reverses the physical layer order;
  orientation enum untouched.
- **⨀ Pick** — enter eyedropper mode; click any segment to
  capture its assignments.
- **⬇ Paste** — auto-revealed after Pick; click target segments
  to apply.
- **↶ Undo** — undo the last paste (capped at 20-step stack;
  cleared on assembly switch).
- **⋯** — assembly-scoped overflow (Rename, Duplicate, Delete).

ESC at any time exits pick / paste mode. Mousedown anywhere
outside a segment also exits.

Design note: keep selected state precise but visually lighter than V1.
Layer orientation and inside/outside labels are core building-science
state; they should be stable, visible, and tied to the flip actions.

**Drift summary banner (US-ENV-11):**

When any segment in the active assembly has drifted from the
catalog (its `material.catalog_origin.catalog_version_id !=
catalog_materials.current_version_id`), a small banner appears
above the canvas:

```
┌───────────────────────────────────────────────────────────────┐
│  ↻ 3 segments drifted from catalog       [ Review all → ]    │
└───────────────────────────────────────────────────────────────┘
```

Click "Review all" → opens the project-wide drift report
(reachable also from project header `⋯ → Catalog drift report`).

#### 2.7.3 Specifications sub-tab (`/envelope/specifications`)

**Purpose:** A QA-prep dashboard for the CPHC. List every unique
material used across all assemblies in the project (auto-
aggregated as the user edits assemblies), with per-material
status: do we have the manufacturer datasheet on file? Has the
design / construction team committed to using this product (spec
status)? And per use of the material in each assembly: do we
have a site-installation photo?

**V2 restructure vs V1:** V1 walked **per-segment** rows, so the
same product appeared in the list multiple times (once per use)
with redundant per-use datasheet upload zones. V2 flips to
**per-material primary** — one card per unique product —
because datasheets and spec-status are material-level questions,
not segment-level (Q-ENV-2 model). Site photos stay segment-
scoped because each installation slot needs its own photo.

**Top-of-page summary chip:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Project Materials   24 materials · 18 with datasheets · 21 with    │
│                      site photos on every use                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout** — one scrollable column of **material cards**.
Cards with `specification_status != 'complete'` first (pending
QA), then `complete`, then an "Unused materials" section at the
bottom.

**Material card** (the building block):

```
┌──────────────────────────────────────────────────────────────────────┐
│  XPS                                                  📚  ↻          │
│  Spray Foam · Conductivity 0.034 W/(m·K) · Density 35 kg/m³          │
├──────────────────────────────────────────────────────────────────────┤
│  [Missing ▾]        [+ Notes]                                  ⋯     │
│                                                                      │
│  Datasheets                                                          │
│  ┌─────────────────────────────────────┐                             │
│  │  ▒▒  PDF  ▒▒                + Add    │   ← Missing state when     │
│  └─────────────────────────────────────┘     empty: missing state    │
│                                                                      │
│  Used in 4 segments:                                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  FLOOR-FC3R · Layer 2 · seg 1   ┌──┬──┬──┐         ⋯           │  │
│  │                                  │📷│📷│ +│                     │  │
│  │                                  └──┴──┴──┘                     │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  FLOOR-FC6R · Layer 3 · seg 2   ┌──────────────┐    ⋯           │  │
│  │                                  │ Site Photo  │                 │  │
│  │                                  │   Needed    │                 │  │
│  │                                  └──────────────┘                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  ROOF-RC5R · Layer 4 · seg 1    ┌──┬──┐             ⋯           │  │
│  │                                  │📷│📷│                          │  │
│  │                                  └──┴──┘                          │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  WALL-C3 · Layer 2 · seg 1      ┌──────────────┐    ⋯           │  │
│  │                                  │ Site Photo  │                 │  │
│  │                                  │   Needed    │                 │  │
│  │                                  └──────────────┘                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Card regions (top to bottom):**

| Region | Content |
|---|---|
| **Header** | Bold material name (clickable → inline rename). Right side: 📚 Library badge when from catalog; ↻ refresh badge when drifted (click → refresh-from-catalog dialog). Sub-line: category + product data (resistivity in IP, conductivity in SI; respects active unit system). |
| **QA bar** | Specification-status `<Select>` (states follow §1.8). `[+ Notes]` opens an inline notes editor. `⋯` overflow: "Edit material values…" (affects all uses), "Refresh from catalog…", "Delete material" (only enabled when no segments reference it). |
| **Datasheets** | Drag-and-drop zone for one or more datasheets (PDFs / images). Missing state follows the evidence/status grammar in §1.8; disabled when status = N/A. **One zone per material**, not per use (V2 cleanup vs V1's per-segment redundancy). |
| **"Used in N segments"** | Per-segment sub-rows. Each row shows the path (`Assembly · Layer N · seg N`, click jumps to the canvas) + a per-segment site-photo drag-and-drop zone (same component as V1's site-photo container, V1 ref §12.4). `⋯` per-row: Re-pick material…, Open in canvas →, Detach to a new material…. |

**Card sort order:**

1. **Pending QA cards first** — `specification_status` of
   `missing`, `question`, or `na` — within that group sorted by
   `naturalSortCompare(name)`.
2. **Complete cards** — `specification_status == 'complete'`.
3. **"Unused materials" section** at the bottom — orphan
   `project_materials` rows (no segment references) with a
   one-time inline note: *"These materials are no longer used
   in any assembly. Their datasheets and notes are preserved
   here in case you need them; clean up explicitly when ready."*

**Drag-and-drop upload behavior** (for both datasheet zones and
per-segment site-photo zones):

- Drop zone activates on dragover (blue dashed border).
- Multiple files supported; each uploads individually. On
  per-file failure, a Sonner error toast lists the failed
  filenames (V2 cleanup vs V1's `console.error` + per-file
  `alert()`). Successful uploads append to the relevant array
  via the generic asset upload flow plus a draft JSON-Patch attach.
- Loading overlay during upload.

**Click a thumbnail → ImageFullViewModal:**

- Single full-size image OR PDF iframe view (`#toolbar=0`
  hides the browser toolbar).
- "Delete Image" / "Delete Datasheet" button confirms via
  shadcn `Dialog` (replaces V1 `window.confirm`) and detaches
  the asset from the appropriate array in the active draft
  (project_material's datasheet array OR segment's photo array).
  The uploaded asset remains available to older saved versions
  and is only purged by the backend GC path when unreferenced.

**Click the material name → inline rename** (and the QA bar's
`⋯ → "Edit material values…"` opens the full-field editor in an
expander below the QA bar). The full editor shows a banner when
shared: *"Editing applies to all 4 segments using this
material. To override values for one segment only, use the
canvas's segment modal → Detach to a new material."*

**Visibility rule** (V1-aligned, applied at card level):

- Viewers see only material cards whose
  `specification_status != 'na'`. The "Unused materials"
  section is also hidden from Viewers. The Specifications
  tab is most useful as a "what's pending / what's documented"
  view; n/a cards are noise for external readers.

**Locked-version rendering:**

- Spec-status `<Select>` disabled.
- Drag-and-drop hidden; thumbnails still viewable.
- Per-image / per-datasheet delete hidden.
- Inline editors disabled.
- Material cards still render (so a Viewer / locked-
  submit reader can see the documented set).

**Empty state** — when a brand-new project has no materials
picked yet:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              No materials used yet for this project.            │
│                                                                 │
│       Pick materials in the Assemblies tab to see them here.    │
│                                                                 │
│                  [Open Assemblies tab →]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.7.4 Airtightness sub-tab (`/envelope/airtightness`)

**(Detailed in US-ENV-14.)**

Project-level airtightness page. Shareable with the construction
team via normal project URLs. Auto-extracts envelope volume + envelope
area + iCFA from the most recent HBJSON upload (cached on the
`project_hbjson_files` row at upload time, never recomputed on
page load); accepts the contractor's blower-door test inputs;
computes and displays ACH50, n50, and cfm50/sf-envelope.

**Layout sketch:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Airtightness                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  Geometry source: Round 1 model.hbjson (uploaded 2026-04-12)        │
│  ⚠ A newer HBJSON has been uploaded — pinned source still in use.   │
│  [ Re-pin to current ]   [ Change source ▾ ]                        │
│                                                                     │
│  Volume: 1,234 m³  ·  Envelope area: 567 m²  ·  iCFA: 234 m²        │
├─────────────────────────────────────────────────────────────────────┤
│  Test inputs                                                        │
│  Test method         [ASTM E779 @ 50 Pa ▾]                          │
│  Result (cfm50)      [____600____]                                  │
│  Test date           [2026-04-30]                                   │
│  Tester              [_______________________]   Cert [_______]     │
│  Target ACH50        [____0.6____]   Source [Phius CORE 2024 ▾]    │
│  Notes               [________________________________________]     │
├─────────────────────────────────────────────────────────────────────┤
│  Computed                                                           │
│  ACH50: 0.49   ✓ Passes (target 0.6)                                │
│  n50:   0.49                                                        │
│  cfm50/sf-envelope: 0.022                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Banner above the page (always present):** *"Airtightness data
is project-level — not tied to a specific version of the energy
model. Switching versions will not change what's shown here."*

**Editor / public-read behavior:** editors see editable inputs
regardless of version-lock state (the data is project-level,
not version-locked). Viewers see the page read-only —
but they DO see the page, since contractor-share is the primary
use case per Ed's framing.

#### 2.7.5 Site Photos sub-tab (`/envelope/site-photos`)

**(Detailed in US-ENV-15.)**

Contractor-facing reorganization of the same per-segment site
photos that the Specifications sub-tab manages — grouped by
**assembly type** (Walls / Floors / Roofs / Other) instead of by
material. Same data, different presentation. Useful for sharing
with the trades team via the normal project URL: "all the wall photos in
one place," etc.

**Layout sketch:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Site Photos                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Walls (3 assemblies, 24 photos)                                    │
├─────────────────────────────────────────────────────────────────────┤
│  WALL-C3                                                            │
│    Layer 1 · seg 1  [📷 📷 +]                                       │
│    Layer 2 · seg 1  [Site Photo Needed]                             │
│    Layer 3 · seg 1  [📷 +]                                          │
│  WALL-SE-30a                                                        │
│    ...                                                              │
├─────────────────────────────────────────────────────────────────────┤
│  Floors (2 assemblies, 8 photos)                                    │
│  ...                                                                │
├─────────────────────────────────────────────────────────────────────┤
│  Roofs (1 assembly, 5 photos)                                       │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

- **No new backend** in v1 — same data as Specifications, just
  re-grouped.
- **Assembly type** comes from a new `assembly.type` field
  (auto-detected from name on create per Q-ENV-15.1 lean;
  user-editable thereafter).
- **Editable here too** — drag-and-drop upload writes to the
  same `segment.photo_asset_ids[]` arrays as Specifications.
- **Viewers** see this page populated and organized
  for trades-crew use — the primary motivation for the tab's
  existence.

### 2.8 Equipment tab (`/projects/{id}/equipment`) — placeholder

**(Detailed in US-Builder-Equipment.)** Sub-rail or sub-tabs per
equipment kind: Rooms (MVP), then ERVs / Pumps / Fans / etc. as
the corresponding catalogs ship.

Equipment surfaces should use dense, filterable tables with status /
evidence badges that follow §1.8. When row detail becomes too wide for
the grid, use a selected-row details/evidence panel rather than forcing
long manufacturer/model/spec strings into cramped cells. Preserve fast
scan/edit/copy behavior; avoid pagination as the primary way to manage
project-scale tables unless performance requires it.

### 2.9 Model tab (`/projects/{id}/model`) — placeholder

**(Detailed in US-Viewer.)**

Top-of-tab strip: HBJSON file picker (dropdown listing uploaded
files with labels and dates) + "Upload new HBJSON" button.

Main area: R3F canvas filling the available space. The viewer should be
full-bleed or near full-bleed below the project header, with minimal
generic page chrome. Preserve V1 viewer behavior but redesign the
composition:

- compact floating HBJSON file selector / upload affordance;
- left legend/filter rail when color-by is active;
- right inspector panel for selected object metadata;
- bottom or side tool rail with grouped tools, labels on hover, and
  keyboard-accessible controls;
- restrained, high-contrast selection color that is distinct from table
  focus and evidence status colors.

The Model tab may carry more BLDGTYP character than ordinary tables,
but it still needs to feel like inspecting a building model, not viewing
a dashboard chart.

### 2.10 Project settings (overflow menu, not a tab)

**(Detailed in US-Settings.)**

Reached via the project header `⋯` → "Project settings". Opens a
modal (or dedicated route — TBD when walked) with:
- Edit metadata (name, bt_number, client, phius_number,
  phius_dropbox_url).
- MCP tokens for this project (issue / list / revoke).
- Transfer ownership (post-MVP UI; data model supports).
- Delete project (gated to v1.1, US-1.4).

### 2.11 Viewer public read (`/projects/{id}/{tab}`)

**Purpose:** Anyone with the normal project URL views the project
read-only. There is no separate public URL, no `/v/{token}` route, and
no public link management surface.

**Header:** same project-workspace shell, rendered in Viewer
read-only mode. The header shows a "Read-only" pill next to the
project/version label. A sign-in affordance may appear in the account
area; edit controls do not render unless the visitor is logged in as an
editor.

**Layout:** Same project landing page as the editor view, but:
- No `Save` / Save As buttons.
- No row-action menus that lead to write actions.
- Version dropdown remains available for opening other versions;
  lock/rename/delete/default-version actions are hidden.
- Model tab viewing is allowed; Upload HBJSON is hidden.
- Project settings menu is hidden.
- Catalog manager routes require editor auth and are not part of the
  Viewer project workspace.

---

## 3. Flows (multi-page)

### 3.1 Sign-in → dashboard (US-0 → US-1)

1. User visits any signed-in URL while unauthenticated.
2. Server redirects to `/sign-in?next=<original-url>`.
3. User enters credentials, submits.
4. Server validates, sets session cookie, returns 200 with redirect
   target (the `next` URL or `/dashboard`).
5. Frontend navigates to the redirect target.

### 3.2 Create new project (US-1.3)

1. From dashboard, user clicks "+ New project".
2. Modal opens; user fills name, bt_number, optional client.
3. User clicks "Create project".
4. Backend INSERTs project row + initial "Working" version + sets
   active_version_id.
5. Frontend redirects to `/projects/{new_id}` (Status tab default).

### 3.3 Pin / reorder projects (US-1.1)

- Click the pin icon on any row → row immediately moves to the
  Pinned section, persists via `user_project_preferences`.
- Drag a pinned row by its handle → other pinned rows reflow;
  on drop, new order persists.
- Unpinning sends the row back to the All-projects section in its
  natural sort position.

### 3.4 Delete project (US-1.4 — deferred from MVP)

1. User clicks `⋯` on a row → Delete.
2. Modal #1: warning + summary of consequences. Cancel / Continue.
3. Modal #2: "Type the project name `Project Foo` to confirm."
   Confirm button disabled until exact match.
4. On confirm: project soft-deleted, row removed from dashboard,
   toast: "Project Foo deleted. Recovery is admin-only."

### 3.5 Open project → switch tab (US-3)

- Click a project row → land on `/projects/{id}/status`.
- Click "Model" in the tab bar → URL becomes
  `/projects/{id}/model`; back/forward buttons work.

---

## 4. State indicators (cheatsheet)

Consistent visual language for state across the app:

| State | Visual | Used where |
|---|---|---|
| Clean (saved) | Subtle green dot | Project header save indicator |
| Dirty (unsaved draft) | Amber dot + "Unsaved changes" tooltip | Project header |
| Sync error | Red dot + tooltip | Project header |
| Locked version | Padlock icon next to version name | Project header, Versions list |
| Submitted | Document-with-checkmark icon | Versions list |
| Closed | Folded-document icon | Versions list |
| Read-only (Viewer public read) | "Read-only" pill in header | Project workspace header |
| Evidence missing | Badge/icon + filterable status | Tables, Specifications, Site Photos |
| Evidence attached | Badge/icon + file count/preview | Datasheets, photos, HBJSON files |
| N/A accepted | Muted badge/state | Spec/photo requirements |
| Catalog/source drift | Refresh/drift badge | Materials, frames, glazings, catalog-linked rows |

---

## 5. Open UX questions (collected)

These are the cross-cutting UX questions surfaced so far. Each maps
back to a user-story open question.

| ID | Topic | Lean |
|---|---|---|
| UX-Q1 | Pinned vs. all visual treatment — distinct section or just sort-to-top? | distinct section |
| UX-Q2 | Last-modified column format — relative ("2 hours ago") or absolute? | relative + tooltip absolute |
| ~~UX-Q3~~ | ~~Project landing default tab?~~ | **Resolved 2026-05-10:** Status |
| UX-Q4 | Save status indicator — dot, text, or both? | dot + tooltip text |
| UX-Q5 | Catalogs nav — header dropdown (lean) or top-level page route? | header dropdown |
| UX-Q6 | Empty-state primary action — single button or guided onboarding? | single button |
| ~~UX-Q7~~ | ~~Viewer header — "Read-only" pill or banner?~~ | **Resolved 2026-05-11:** pill in normal project header |
| UX-Q8 | Builder details placement — below canvas, right inspector, or adaptive? | adaptive by surface |
| UX-Q9 | Model toolbar placement — bottom V1 rail or left/right modeling-app rail? | open through prototype |
| UX-Q10 | Evidence interaction model — checklist, table filters, or both? | both, via §1.8 |

---

## 6. Out-of-scope for this doc

- Final component variants.
- Final iconography choices.
- Animation specifics.
- Mobile / phone optimization.
- Onboarding tours.
- Marketing / public-facing pages.

These are deferred to the Claude Design pass that follows this
content review.

---

## 7. Index of pages by status

| Page | Status | Priority |
|---|---|---|
| Sign-in (`/sign-in`) | Drafted | MVP |
| Dashboard (`/dashboard`) | Drafted | MVP |
| Catalog landing (`/catalog/{slug}`) | Placeholder | MVP |
| Project workspace shell (header + tab bar) | Drafted | MVP |
| Version dropdown picker (header) | Drafted | MVP |
| Locked-version edit lockout banner | Drafted | MVP |
| Status tab (`/projects/{id}/status`) | Placeholder | MVP |
| Windows tab (`/projects/{id}/windows`) | Placeholder | MVP |
| Envelope tab (`/projects/{id}/envelope`) — sub-tab structure + Assemblies + Specifications | Drafted | MVP |
| Envelope · Airtightness sub-tab | Placeholder | MVP |
| Envelope · Site Photos sub-tab | Placeholder | MVP |
| Equipment tab (`/projects/{id}/equipment`) | Placeholder | MVP |
| Model tab (`/projects/{id}/model`) | Placeholder | MVP |
| Project settings (overflow menu) | Placeholder | MVP (minus delete) |
| Viewer public read (`/projects/{id}/{tab}`) | Drafted (high-level) | MVP |
