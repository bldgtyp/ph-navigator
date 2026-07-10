> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements including the DataTable model (§1 / §1.7),
> flows (§3), and the state-indicator cheatsheet (§4) remain in
> `../../UI_UX.md` and apply here.

# 2.5 Status tab (`/projects/{id}/status`)

The Status tab is the default project landing page. It answers two distinct,
related questions without adding another top-level route:

1. **Record status:** Which equipment and documentation records still need
   attention?
2. **Roadmap:** Where is the project in its user-managed lifecycle, and what
   comes next?

## Composition

The page uses a quiet two-pane project-brief layout rather than nested cards.
On wide screens Record status is approximately two-thirds of the content width
and Roadmap one-third. Roadmap is sticky only within normal page flow: it has no
fixed height or internal scroll trap. Below 980px the sections stack with
Record status first.

Record status and Roadmap load independently. Each owns its skeleton, error,
retry, and empty state so a slow or failed request does not blank the other
section. Skeleton geometry approximates the final rows, is `aria-hidden`, and
has one adjacent `role="status"` loading announcement. Motion is disabled for
`prefers-reduced-motion`.

## Record status

Record status is a compact, read-only projection of the shared DATA-TABLE
status contract. It covers exactly these 12 registered tables:

- ventilators;
- heat pump outdoor units, indoor units, systems, and options;
- pumps;
- fans;
- hot water heaters and tanks;
- electric heaters;
- appliances;
- thermal bridges.

The initial view shows aggregate counts and nine collapsed product groups.
Heat Pumps discloses its four source tables as separate leaves. Expanded groups
sort attention states first, show at most ten attention records initially, and
keep complete/N/A records behind a separate resolved disclosure. Record rows
show only display name/ID, status, and notes; they do not reproduce technical
specifications such as flow or capacity. Long notes clamp until requested.

Every record and `Open table` link returns to the owning Equipment or Thermal
Bridges route. Record links include `focus={row_id}` so the virtualized
DataTable scrolls to and focuses the exact row. Edits remain on the owning table
surface.

The backend summary endpoint loads the selected project document once and
returns counts plus the compact row projection. Editors read the working draft;
viewers read the selected saved version. The query key includes project,
version, and source, and accepted writes to any in-scope table invalidate the
summary. Group disclosure persists only in session storage, scoped by project.

## Roadmap

Roadmap remains a relational, project-level list independent of versioned
DATA-TABLE content. A brand-new project is not auto-populated. Editors may
explicitly apply the four-item BLDGTYP template or add a custom milestone.

Each populated row shows the state control, title, optional date, and Markdown
notes. Rows are separated by hairlines rather than cards; the first to-do item
gets a subtle current marker. Editors retain drag reorder, `Alt+Arrow` keyboard
reorder, direct state cycling, and edit/delete dialogs.

Management actions use an editor-only `...` menu:

- Edit milestone;
- Move up/down;
- Mark done, to do, or N/A;
- Delete milestone.

The menu and drag affordance appear on hover or `:focus-within` and remain
visible for coarse pointers. They are absent from viewer markup. Viewer dates
are static text, not disabled buttons, and viewer rows contain no mutation or
reorder controls.

## Performance and access invariants

- Do not mount the 12 table hooks or return full FieldDefs/formulas/spec data.
- Bound initial disclosure regardless of project size.
- Keep the two section requests independent and cache the compact summary.
- Anonymous/viewer access uses saved document data and exposes no editor
  controls; backend mutation authorization remains authoritative.
- Status and notes are conveyed by text and accessible names, not color alone.
