# Feature request: built-in "Ventilator" link field on SPACES / ROOMS

```
STATUS:  Requested — documented, NOT scoped. Data-model + UI approach TBD (Ed).
DATE:    2026-07-09
AUTHOR:  Ed + Claude (recorded)
SCOPE:   SPACES / ROOMS record schema — a built-in reference field pointing at a
         VENTILATORS record. Backend data model + built-in field wiring; UI TBD.
RELATED: EQUIPMENT / VENTILATORS table; feedback_datatable_uniformity_ironlaw;
         context/UI_UX.md (DataTable / field model)
```

> **Purpose of this doc:** record the *need* so it is not forgotten. It does **not**
> yet propose a data-model shape or UI — those are open. When settled, add scope/phases.

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

## Open questions (for whenever this is picked up)

- **Cardinality:** one ventilator per room (single link), or can a room draw from
  more than one unit? (Assume single-link to start unless PH modeling needs more.)
- **Field type / UI:** dropdown/picker of existing VENTILATORS records vs. a
  generic cross-table reference field. Is this the first cross-table "link" field
  in the SPACES schema, or does a reference-field pattern already exist to reuse?
- **Direction / rollup:** does the ventilator side also need to show its served
  rooms (and their aggregate airflow), or is the link one-directional from the room?
- **Delete behavior:** what happens to a room's link when its ventilator record is
  deleted — null it out, block the delete, or warn?
```
