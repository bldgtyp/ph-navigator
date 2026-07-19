> Split from `context/UI_UX.md` §2 (Pages - narrative). Cross-cutting design
> intent (§0), common elements including evidence/status grammar (§1.8),
> flows (§3), and the state-indicator cheatsheet (§4) remain in
> `../../UI_UX.md` and apply here.

# 2.10 Documentation tab (`/projects/{id}/documentation`)

The Documentation tab is the project-wide evidence view for specification
status, datasheets, and installed-site photos. It is meant to be readable by
anonymous contractors and certifiers first, while still reflecting the signed-in
editor's working draft.

The route is a top-level project tab, placed after Model in the project tab
bar. The legacy `/projects/{id}/envelope/site-photos` route redirects to
`/projects/{id}/documentation#envelope` so old Envelope photo links land on the
Envelope section of the new page.

## Data model

The page is a projection of the project document's documentation summary.
Editors read the draft summary and may edit evidence/status affordances from
the page; viewers read the saved document summary. The query key includes
project id, version id, and access mode, and accepted writes to owning tables
invalidate the summary.

The summary carries three independent axes:

- specification status, from the stored `Specification Status` field;
- datasheets, derived from datasheet attachment ids or datasheet N/A waiver;
- photos, derived from site-photo attachment ids or photo N/A waiver.

The page fetches asset preview URLs in one bulk call for the visible
datasheets and photos. Rows never duplicate attachment data; they display the
same attachment ids stored on the owning record.

## Composition

The header shows the selected version, whether the data is draft or saved, a
draft-publish hint for editors, and three rollup chips:
`Spec N/M`, `Datasheets N/M`, and `Photos N/M`.

Below the header, per-axis filter chips show only records missing specs,
datasheets, or photos. Filter chips are button toggles with text labels and
`aria-pressed`; missing state is a work item, not an application error.

Sections follow the documentation summary order:

- Envelope;
- Equipment;
- Apertures;
- Thermal Bridges.

Each section has an anchor id, section-level rollups, a copy-link control, and
a "How to photograph" modal trigger. Complete sections may render collapsed as
one-line stubs with an expand control. Incomplete sections render their records
directly and do not pretend to be collapsible.

Groups with no records are omitted. If filters hide every record in a populated
group, the group remains visible with a "No records match the active filters"
message.

## Record rows

Rows use a unified evidence grid:

- record identity: display name, optional sub-label, and an `Open owner` link
  back to Equipment, Apertures, Envelope, or Thermal Bridges;
- spec chip for viewers or a status select for editors;
- photo evidence state and thumbnail strip;
- datasheet evidence state and file strip.

Envelope rows also show a compact assembly strip as a material/assembly cue.
Record names open a detail modal with identity fields, source table,
specification status, photos, and datasheets. Editors get the same status,
photo, and waiver controls in the modal; viewers get read-only evidence.

## Editor writes

The Documentation page uses the owning record's normal write path:

- photo changes use attachment attach/detach endpoints and chain draft etags;
- envelope material spec and datasheet waivers write through envelope commands;
- aperture product spec and waiver changes write through envelope commands;
- equipment, heat-pump leaf, and thermal-bridge scalar fields write through
  guarded draft-table replaces.

Envelope material/assembly photo writes and photo waivers fan out over every
segment id supplied by the documentation summary. Missing segment ids fail the
write rather than silently producing partial evidence.

Static directions content lives in `frontend/src/features/documentation/directions/`.
The Equipment directions modal renders one shot-list card per populated
equipment family (Ventilators, Heat Pumps leaves, Pumps, Fans, hot water,
electric heaters, Appliances) so a contractor can distinguish the required
nameplate/context/accessory photos for each row family. Example-image slots
intentionally render placeholders until BLDGTYP-owned photos are selected.

## Access invariants

- Viewer markup has no upload, delete, waiver, or status-edit controls.
- Editors see and edit draft evidence here; the draft-publish hint focuses the
  standard Save Version control.
- Locked versions keep the standard project locked-version banner behavior.
- Phone-width layout stacks cells so contractors can read the page on site.
