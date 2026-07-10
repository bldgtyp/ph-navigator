# Feature request: built-in "Ventilator" link field on SPACES / ROOMS

```
STATUS:  Active — scoped for implementation.
DATE:    2026-07-09
AUTHOR:  Ed + Claude (recorded)
SCOPE:   SPACES / ROOMS record schema — a built-in reference field pointing at a
         VENTILATORS record. Backend data model + built-in field wiring; room-side UI.
RELATED: EQUIPMENT / VENTILATORS table; feedback_datatable_uniformity_ironlaw;
         context/UI_UX.md (DataTable / field model)
```

> **Purpose of this doc:** record and execute the built-in room→ventilator link.

## One-liner

A **SPACES / ROOMS** record needs a **built-in link field to a VENTILATORS record** —
i.e. each room is associated with the specific ventilator (ERV/HRV or terminal unit)
that serves it. This must be a **built-in** field, not a per-project custom column:
essentially every project needs this relationship.

## Why

Room-to-ventilator assignment is a standard part of a PH ventilation model: each
conditioned space is served by a specific ventilation unit, and the room's airflow
requirements roll up to that unit. Today there is no first-class way to express
"this room is served by *that* ventilator," so the link has to be reconstructed by
hand or kept outside the tool. Because it's needed on basically every project, it
belongs in the built-in room schema — consistent with the DataTable uniformity
iron-law that basic, universally-needed affordances are parent-owned, not opt-in
([[feedback_datatable_uniformity_ironlaw]]).

## The need (what must become true — not how)

1. **Storage.** A SPACES / ROOMS record can hold a reference to one VENTILATORS
   record (a room → ventilator link).
2. **Built-in.** The field ships as a standard/built-in room field for every
   project, not something a user adds per-project.
3. **Referential integrity.** The link points at a real ventilator record and
   behaves sensibly when that ventilator is renamed, reordered, or deleted.

## Decisions

- **Cardinality:** single ventilator per room (`max_links: 1`).
- **Field type / UI:** reuse the existing `linked_record` field type with target
  path `["equipment", "ervs"]`, surfaced as a built-in Rooms field.
- **Direction / rollup:** room-side edit is primary; Ventilators show read-overlay
  inverse room links from the existing inverse-link machinery. Airflow rollups are
  deferred.
- **Delete behavior:** deleting a ventilator silently clears any Rooms links to
  that ventilator, matching the existing optional-link cascade posture.

## Phases

1. **Phase 01 — built-in link and UI:** add the backend built-in field, validation,
   ventilator-delete cascade, room-side picker/pills, and ventilator-side inverse
   room visibility.
2. **Phase 02 — verification and closeout:** run focused backend/frontend tests,
   update this packet with evidence, then archive if complete.
