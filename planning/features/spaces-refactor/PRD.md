---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Codex)
SCOPE: Product, data, and UX contract for Spaces, Space-Types, and
  Rooms-to-Space-Type linking.
RELATED:
  - planning/features/spaces-refactor/README.md
  - planning/features/spaces-refactor/PLAN.md
  - context/user-stories/30-tables-equipment.md
  - context/technical-requirements/data-model.md
---

# Spaces Refactor - PRD

## Problem

Rooms currently exist as a top-level project tab and capture per-room
metadata for PHN-first energy-model workflows. Projects also need a
small per-building vocabulary of room/space types - Hallway, Restroom,
Apartment, Mechanical Room, or project-specific equivalents - without
hardcoding a global list.

The app needs a first-class place to define those types, then link each
Room to at most one type. The type table should also make the inverse
relationship visible so users can inspect which Rooms use each type.

## Product Contract

### Top-Level Navigation

The current top-level **Rooms** tab becomes **Spaces**.

Spaces has sub-tabs:

| Order | Sub-tab | Purpose |
|---|---|---|
| 1 | Space-Types | Define the project-specific type vocabulary. |
| 2 | Rooms | Edit the existing Rooms schedule and link each Room to one type. |

Default route:

```text
/projects/:projectId/spaces -> /projects/:projectId/spaces/space-types
```

Legacy compatibility:

```text
/projects/:projectId/rooms -> /projects/:projectId/spaces/rooms
```

Any existing row-focus URLs that point at Rooms should move to:

```text
/projects/:projectId/spaces/rooms?focus=<room_id>&open=1
```

### Space-Types Table

The new DataTable is a project-document table with table key
`space_types`.

Fields:

| Field | FieldDef key | Type | Required | Notes |
|---|---|---|---|---|
| Tag | `record_id` | short text | Yes for non-empty rows | User-facing primary key. Must be unique within the Space-Types table after trim/case normalization. |
| Name | `name` | short text | No | Display label / human-readable type name. |
| Rooms | server-computed inverse link | reverse linked records | Read-only | Shows Rooms whose Space Type points at this row. Not persisted on Space-Type rows. |

Space-Types must start empty for every project. No seeded rows like
Hallway, Restroom, or Apartment are allowed.

Empty state:

```text
No space types yet. + Add space type
```

### Rooms Link Field

Rooms gets a built-in `linked_record` FieldDef:

| Field | Proposed FieldDef key | Type | Target | Cardinality |
|---|---|---|---|---|
| Space Type | `space_type_id` | linked_record | `["space_types"]` | Single-link, `max_links: 1` |

Storage follows the existing record-linking architecture: the
`space_type_id` value lives in each Room row's `custom_links` bag, even
though the field is feature-author-declared rather than user-created.

Behavior:

- A Room may have zero or one Space-Type.
- The picker lists Space-Type rows from the same project/version.
- Picker labels prefer `Tag`, then `Name`, then row id as fallback.
- Deleting a Space-Type must clear or reject affected Room links by an
  explicit implementation decision in Phase 02. Preferred behavior:
  clear the affected Room links and surface a warning, matching existing
  cross-table cascade behavior for removed target rows.
- The Rooms table remains PHN-first. HBJSON upload or viewer metadata
  must not mutate Rooms or Space-Types.

### Reverse Link On Space-Types

Space-Types responses expose the existing inverse-link overlay for the
target table path `["space_types"]`.

The UI renders a read-only Rooms column that lists linked Room pills.
Clicking a Room pill should navigate to:

```text
/projects/:projectId/spaces/rooms?focus=<room_id>&open=1
```

If a Room link references a missing Space-Type id, validation should
reject the write before save; read overlays should only include valid
links.

## Non-Goals

- No predefined Space-Type rows.
- No cross-project/global Space-Type catalog.
- No type-driven calculations in this feature.
- No model-viewer drift comparison in this feature.
- No V1 repo changes.

## Acceptance Criteria

1. `space_types` exists in the project-document schema and table
   registry, defaults to an empty table, and is served through the
   generic table-slice endpoints.
2. Space-Type rows support add/edit/delete through the shared DataTable
   flow with `Tag` and `Name`.
3. Space-Type `Tag` is treated as the primary record identifier and is
   unique within the table.
4. Rooms includes a built-in **Space Type** linked-record field with
   `max_links: 1` targeting `["space_types"]`.
5. Rooms cell writes persist a single Space-Type link through
   `custom_links.space_type_id`.
6. Space-Types responses include inverse-link metadata and row-level
   incoming Rooms link data.
7. Space-Types UI renders a read-only reverse Rooms column.
8. Top-level project navigation shows **Spaces**, not **Rooms**.
9. Spaces sub-tabs show **Space-Types** and **Rooms**.
10. Legacy `/rooms` routes and existing Rooms deep-link intents redirect
    to the new Spaces/Rooms URL.
11. Locked-version/viewer mode renders both tables read-only.
12. `make format` and `make ci` pass after implementation.

## Open Questions For Implementation

1. Should deleting a Space-Type clear affected Room links automatically
   or block deletion until links are removed? The plan recommends
   clearing links with a warning because it matches existing table
   cascade patterns, but implementation should confirm with current
   controller behavior.
2. Should Space-Type `Name` be allowed to duplicate when `Tag` is
   unique? The plan assumes yes.
3. Should the default Spaces sub-tab be Space-Types or Rooms? The plan
   assumes Space-Types because it is the setup table; legacy Rooms URLs
   preserve direct access for room-heavy workflows.
