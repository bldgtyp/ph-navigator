> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements including the DataTable model (§1 / §1.7),
> flows (§3), and the state-indicator cheatsheet (§4) remain in
> `../../UI_UX.md` and apply here.

# 2.5 Overview tab (`/projects/{id}/overview`)

Overview is the default project landing page. Legacy
`/projects/{id}/status/*` URLs redirect here while preserving their suffix,
query, and hash.

## Composition

The page uses a two-pane project brief: **Roadmap** on the left and
**Documentation progress** on the right. The requests load independently; each
pane owns its skeleton, error, retry, and empty state.

## Documentation progress

Overview is the at-a-glance read; **Documentation is the drill-down** to every
record and field. Where both surfaces show the same thing they render the same
component, and Overview never edits — it points.

The counts-only projection mirrors Documentation's section and group rollups
without returning records. Editors read the working draft; viewers read the
saved version. Empty sections and groups are omitted.

**Meters.** The three evidence meters come from the shared `StatusAxisRollup`
(`features/project_document/StatusVocabulary.tsx`) — the same component the
Documentation page renders, so a meter never looks or counts differently
depending on which page you read it from. It takes exactly two variations:
`linkFor` (supply it and each meter becomes a deep link; omit it and the meter
renders in place — Overview supplies it for project totals and section meters,
Documentation and Overview's group rows omit it) and `plain` (drops the meter's
chip surface). Project totals set `plain` because they sit on the page ground,
where the chip's white background has nothing to lift off and reads as a
floating panel; padding is unchanged so they still align with the card contents
below.

- `Spec. Status {done}/{total}` → `?needs=spec#{anchor}`;
- `Datasheets {done}/{total}` → `?needs=datasheet#{anchor}`;
- `Site Photos {done}/{total}` → `?needs=photo#{anchor}`.

A meter fills green at complete, turns its count amber at zero, and — when the
axis tracks nothing at all — stays empty with a muted count rather than reading
as finished.

**Layout.** The pane heading matches Roadmap's (`.status-pane-heading`): both
sides of the brief are one mono rail label. Project totals sit directly under
it, on the page ground rather than on a card. Then one card per section.

**Two destinations, two gestures.** The header means "go to the thing": the
section title toggles disclosure, and a hover-revealed `ExternalLink` icon
beside it opens that section's **own tab** (Apertures → Apertures). A meter
means "go to the evidence": it opens Documentation filtered by that axis. The
route resolves through `projectTabPath` from the section key checked against
`PROJECT_TABS` — never a hand-built URL, since a tab slug is not always its
route — and falls back to the Documentation anchor when a section names no tab.

**Attention.** `{n} of {total} need attention` sits at the far end of a heading
— the pane heading for project totals, the card header for each section — and
only while work remains. It is a plain label in `--highlight-text`, the app's
"needs your attention" red (the topbar's uncommitted-changes state uses the
same): one appears on every card, so a filled outlined chip made a secondary
annotation the loudest thing on the page. The denominator is carried because the
count sums three axes and would otherwise exceed the section's record count.
Group rows carry no attention count.

**No status legend.** The legend defines the Needed / Question / Complete / N-A
vocabulary; this pane renders none of it, only counts and bars. It belongs on
Documentation, where those values are actually shown.

**Disclosure** reveals one line per non-empty group: title left, meters right,
matching Documentation's group header. It persists only in session storage,
scoped by project.

A group row has exactly **one** destination — the hover-revealed icon, opening
the Documentation anchor for that group. Its title is a label and its meters are
plain numbers, deliberately: at group scope all three axis deep links resolved
to the same anchor, differing only by a `?needs=` filter that adds nothing once
you are that narrow, so the row was offering four links to one place. Axis deep
links remain on the project-total and section meters, where the filter still
narrows something.

## Roadmap

Roadmap is a relational, project-level list independent of versioned
DATA-TABLE content. A brand-new project is not auto-populated. Editors may
apply the four-item BLDGTYP template or add a milestone. Add/edit dialogs use
`Add milestone`, `Edit milestone`, and `Save milestone`; the field remains
`State`.

Each populated row shows state, title, optional date, and Markdown notes. The
first to-do item gets a subtle current marker. Editors retain reorder,
state-cycle, edit, and delete controls. Viewer markup contains no mutation or
reorder controls.

## Performance and access invariants

- Do not mount owning table hooks or ship record-level payloads.
- Keep Roadmap and Documentation progress queries independent.
- Anonymous/viewer access reads saved document data and exposes no editor
  controls.
- Status and progress remain legible through text and accessible names, not
  color alone.
- The pane heading renders in every state — loading, error, empty and loaded —
  so data landing never shifts the layout.
- Every control in the pane carries a hover **and** a keyboard-focus state from
  `context/DESIGN_SYSTEM.md` § Interaction states. `frontend/working/` holds
  throwaway probes for checking this; the durable checks are the component
  tests plus `make typography-eval`, whose
  `project-overview-documentation-groups` state exists specifically to sweep
  the disclosed group rows.
