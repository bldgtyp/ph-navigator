---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: D-2 accepted (pending Ed's PRD confirmation); D-1/D-3/D-4 open
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Accepted / rejected / open decisions for aperture void panels.
RELATED: ./PRD.md §7 §9
---

# Decisions — aperture void panels

## Accepted

- **A-1 — Void element kind over rectangular chunking or polygon outlines.**
  Chunking cuts the continuous transom band, invents phantom mullions, and
  splits one unit across placement elevations; polygon outlines abandon the
  grid model and touch every command/consumer. A void kind preserves the
  coverage invariant and confines the change to interpretation, not geometry.

- **A-2 — `kind: Literal["glazed","void"]` enum rather than `is_void: bool`.**
  Reserves `"solid"` (spandrel) as an additive extension; default `"glazed"`
  keeps every existing document/wire payload valid with no migration.

- **A-3 — Route-3 export omits void elements** rather than emitting them with
  a flag. The GH consumer places elements by absolute grid indices inside full
  grid dims, so omission needs zero changes in `honeybee_grasshopper_ph_plus`
  / `honeybee_ph`, and old GH definitions keep working against new payloads.

- **D-2 — Solid spandrel panels DEFERRED to a future feature** (Ed leaned
  toward folding them in 2026-07-28; recommendation to defer accepted on the
  grounds in PRD §7: multi-repo cost, PHI-vs-Phius modeling semantics best
  settled by a live project + certifier, unresolved catalog fork, and the
  existing g=0-glazing escape hatch. The enum slot is the part that was
  expensive to retrofit; that lands now.)

## Open (defaults in PRD §9)

- **D-1** — UI label "Filler" for wire value `void`.
- **D-3** — glazed→void with existing assignments: confirm-then-clear
  (default) vs hard-refuse.
- **D-4** — Canvas void treatment: muted fill + token-based diagonal hatch.
