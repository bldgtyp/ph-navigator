# STATUS — spaces-ventilator-link

**State:** 🟡 Requested — need documented, **not scoped**. No backend or UI work
started. Data-model shape and field/UI approach are undecided (Ed's call).

**Ask:** SPACES / ROOMS records need a **built-in link field to a VENTILATORS
record** so each room is associated with the specific ventilator that serves it.
This is a built-in relationship needed on essentially every project — not a
per-project custom column. See `README.md` for why and the open questions.

**Deliberately NOT decided here:** cardinality (single vs. multi ventilator per
room), field/UI type (picker vs. generic reference field), whether the ventilator
side shows served rooms, and delete/orphan behavior.

## Checklist

- [x] Document the need (this folder).
- [ ] Decide cardinality: one ventilator per room vs. multiple.
- [ ] Decide field type / UI: room-side picker of VENTILATORS records vs. a
      reusable cross-table reference-field pattern.
- [ ] Decide directionality: one-way room→ventilator link, or ventilator-side
      rollup of served rooms (+ aggregate airflow).
- [ ] Decide delete/orphan policy when a linked ventilator is removed.
- [ ] Data-model change: built-in room field + reference storage.
- [ ] Built-in field wiring (ships for every project).
- [ ] UI / data-entry (blocked on the decisions above).
