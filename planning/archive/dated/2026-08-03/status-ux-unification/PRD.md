DATE: 2026-08-03
TIME: 11:25 EDT
STATUS: Accepted — behavior contract for the status UX unification
AUTHOR: Claude with Ed May
SCOPE: Vocabulary contract, exact user-visible strings, and
  surface-by-surface target behavior for every status surface.
RELATED:
  - ./README.md
  - ./decisions.md
  - ./research.md
  - ../../../../../context/UI_UX.md
  - ../../../../../context/ui/pages/documentation-tab.md
---

# PRD — Status UX unification

## 1. The mental model we are selling

Every product/record in the project carries up to **three independent
questions**, answered by three independent statuses:

| Axis | Question | Values |
| --- | --- | --- |
| **Spec. Status** | Do we know what the thing is — product selected, performance values confirmed? | Needed / Question / Complete / N/A |
| **Datasheet** | Is the manufacturer datasheet PDF on file? | Needed / Complete / N/A |
| **Site Photos** | Are installed-condition photos from the site on file? | Needed / Complete / N/A |

Two derived words, used everywhere and defined in the legend:

- **needs attention** — status is `Needed` or `Question` (or `Unknown`).
- **resolved** — status is `Complete` or `N/A`.

The Roadmap (project lifecycle milestones: To do / Done / N/A) is a
deliberately separate concept and keeps its separate vocabulary. It never
uses the word "status" in UI copy — its rows are **milestones**.

## 2. Vocabulary contract — exact strings

One frontend module (extending
`frontend/src/features/project_document/specification-status.ts`) exports
every string below. No surface hand-writes an axis label, value label,
tooltip, or rollup phrase.

### 2.1 Axis labels

| Context | Spec axis | Datasheet axis | Photo axis |
| --- | --- | --- | --- |
| Column header / row cell / select aria-label | `Spec. Status` | `Datasheet` | `Site Photos` |
| Progress meters (Overview + Documentation headers) | `Spec. Status` | `Datasheets` | `Site Photos` |
| Filter chips (Documentation) | `Needs spec` | `Needs datasheet` | `Needs site photos` |

The only permitted plural drift is `Datasheets` in meters. Retired
spellings: `Status` (as a column header for the spec axis),
`Specification Status` (UI display; the internal field key and backend
constants may keep the long name), `Spec`, `Photos`, `Missing datasheets`,
`Missing photos`, `Needed specs`.

### 2.2 Value labels

Unchanged: `Needed` / `Question` / `Complete` / `N/A` (spec axis),
`Needed` / `Complete` / `N/A` (evidence axes). `Unknown` remains a
response-only state coerced to `Needed` for display. Per D-4, `Question`
is **not** added to the evidence axes.

### 2.3 Tooltips (single source, shown on every column header and select)

- **Spec. Status**: "Design specification: is the product selected and are
  its performance values confirmed? Datasheets and site photos are tracked
  separately."
- **Datasheet**: "Manufacturer datasheet PDF on file for this product."
- **Site Photos**: "Installed-condition photos from the site."

### 2.4 Legend (shared popover/info affordance on Overview, Documentation, and the report panels)

> **Needed** — work remains; follow up.
> **Question** — open question; see the record's Notes. (Spec. Status only)
> **Complete** — confirmed and on file.
> **N/A** — requirement intentionally does not apply.
> A record is **resolved** when its status is Complete or N/A.

### 2.5 Rollup phrases

- `{n} need attention` (never "still need attention", never "unfinished")
- `{n} of {m} resolved` (never bare `{n}/{m} resolved`)
- Meters render `{axis label} {done}/{total}`.

The Aperture U-Value report's per-aperture completeness column keeps its
own meaning but adopts the phrase `{n} need attention` in place of
`{n} unfinished`.

## 3. One control

- **Editors:** the shared `StatusSelect` pill-select, everywhere a status is
  editable: Documentation rows, Materials panel, Glazings/Frames report
  panels (replacing the `AutocompleteSelect` + `StatusDot` composite), and
  as the visual model for the DataTable single-select status cell.
- **Viewers:** the shared `StatusPill`, everywhere a status is read-only:
  report panels in viewer mode, Overview meters' detail affordances,
  Documentation viewer mode.
- **DataTables:** `SingleSelectStatusPill` remains the in-grid renderer (it
  must live inside the DataTable cell system) but restyles onto the same
  `--report-status-*` token family so it is visually identical.
- One CSS token set backs all of them (the `report-status-chip` family is
  canonical). The `--report-status-missing` alias is renamed/retired for its
  non-status consumers as part of this consolidation (carried over from the
  spec-status packet's deferrals).

## 4. Surface-by-surface target behavior

### 4.1 Overview tab (today: Status tab)

- Tab slug `overview`, label `Overview`, tab copy: "Project roadmap and
  documentation progress at a glance." Legacy `/projects/{id}/status/*`
  redirects to `/projects/{id}/overview/*` preserving search + hash.
- Layout keeps the two-pane project brief: **Roadmap** left, **Documentation
  progress** right.
- Roadmap is unchanged except copy: modal titles become "Add milestone" /
  "Edit milestone", submit "Save milestone"; the field stays `State`.
- **Documentation progress** replaces the record tree entirely. Per
  Documentation section (Apertures, Envelope, Equipment, Thermal Bridges),
  one row with: section title (links to `/documentation#{anchor}`), three
  meters (`Spec. Status {d}/{t}`, `Datasheets {d}/{t}`,
  `Site Photos {d}/{t}`), and `{n} need attention` when n > 0. Each meter
  links to `/documentation?needs={axis}#{anchor}`.
- Sections with zero records are hidden (matches Documentation).
- Each section row is expandable to per-group meter rows (same three-meter
  layout, deep links via group anchors; empty groups hidden) — accepted for
  v1 per D-12. No record rows, no statuses, no notes — those live in
  Documentation.
- Data source: a counts-only rollup projection of the documentation summary
  (editors read draft, viewers read saved version — unchanged access rules).
  The 15 owning data hooks stay unmounted; no record-level payload ships to
  this page.

### 4.2 Documentation tab

- Keeps its role as the single record-level evidence surface — the only
  place record statuses are listed project-wide and edited outside the
  owning tables.
- Header meters, row cells, and filter chips adopt §2 strings.
- Filters become URL-addressable: `?needs=spec,datasheet,photo`
  (comma-separated, order-insensitive). Chip toggles write the param
  (history replace); the param initializes chip state on load; `#anchor`
  continues to expand + scroll and composes with `?needs=`.
- Adds the shared legend affordance next to the header meters.
- No taxonomy change: sections stay Apertures / Envelope / Equipment /
  Thermal Bridges in nav-tab order. The old Mechanical / Domestic Hot Water
  top-level split disappears with the Status record pane (D-6); equipment
  remains grouped per table within the Equipment section.

### 4.3 DataTable status columns (equipment + thermal bridges)

- Column header displays `Spec. Status` with the §2.3 tooltip. The stored
  field key (`status`) and option ids are untouched.
- Whether the header rename lands backend-side (`STATUS_DISPLAY_NAME`) or as
  a frontend display mapping depends on the Phase 01 verification of where
  built-in FieldDef display names are persisted (see PLAN §Phase 01 risk).
- The backend field description becomes the §2.3 Spec. Status tooltip text
  (replacing "Record completeness for dashboard accounting.").

### 4.4 Materials / Glazings / Frames report panels

- Column header `Status` → `Spec. Status`; datasheet column `Datasheet`;
  photo column `Site Photos` (Materials' expanded headings align:
  `Datasheets` → `Datasheet` files list is fine as a heading `Datasheet`,
  photos heading `Site Photos`).
- Editor control switches to `StatusSelect` (Apertures panels).
- Filter chips keep value-based filtering (`Needed / Question / Complete /
  N/A` + `All`) — they filter one axis, so axis chips are not needed here.
- Summary adopts `{n} of {m} resolved`; legend affordance added.

### 4.5 Retired surfaces

- `RecordStatusSummary` (frontend) and the `status-summary` endpoints +
  `status_summary.py` (backend) are deleted once the Overview meters land.
  Gate: a consumer sweep proving nothing else (MCP tools, gh_api, tests)
  depends on them. The Roadmap `status-items` API and MCP
  `list_status_items` are unrelated and unchanged.

## 5. Non-goals

- No change to stored document values, option ids, schema version, or the
  two storage families (typed `specification_status` vs `custom_values`
  option-ids). Encoding unification is explicitly rejected (D-9).
- No change to Roadmap data model or API routes.
- No new evidence axes and no `Question` on evidence axes (D-4).
- No AirTable/V0 work.

## 6. Acceptance

1. A grep audit finds no retired spelling (§2.1 list) in user-visible
   frontend strings.
2. Every status select/pill on Documentation, Materials, Glazings, Frames,
   and DataTables renders from the shared control set and token family.
3. `/projects/{id}/documentation?needs=datasheet#equipment` opens with the
   Equipment section expanded, scrolled into view, and only the
   needs-datasheet filter active.
4. `/projects/{id}/status` redirects to `/projects/{id}/overview`; the tab
   bar reads Overview; the record tree is gone; meters match Documentation
   header counts exactly for the same version/draft.
5. Viewer (anonymous) mode shows identical numbers with zero edit
   affordances.
6. `make ci` green; browser smoke on the agent fixture covers items 3–5.
