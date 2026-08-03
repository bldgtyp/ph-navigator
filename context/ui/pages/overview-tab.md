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

The counts-only projection mirrors Documentation's section and group rollups
without returning records. Editors read the working draft; viewers read the
saved version. Empty sections and groups are omitted.

Each section presents three linked meters:

- `Spec. Status {done}/{total}` → `?needs=spec#{section-anchor}`;
- `Datasheets {done}/{total}` → `?needs=datasheet#{section-anchor}`;
- `Site Photos {done}/{total}` → `?needs=photo#{section-anchor}`.

The combined unresolved count is shown as `{n} need attention` when non-zero.
The section title links to its unfiltered Documentation anchor. Section
disclosure reveals the same three meters per non-empty group, with group-anchor
deep links. Disclosure persists only in session storage, scoped by project.
The shared status legend defines resolved and N/A semantics.

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
