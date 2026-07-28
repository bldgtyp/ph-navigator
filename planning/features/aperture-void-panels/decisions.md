---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: All decisions resolved 2026-07-28 (Ed)
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

- **D-1 — UI label "Empty"** for wire value `void` (Ed, 2026-07-28; "Filler"
  proposal rejected). Every surface showing the label carries a clear
  explanatory tooltip (PRD §5) — the term alone must never be the only
  explanation.

- **D-3 — Confirm-then-clear** (Ed, 2026-07-28): converting a glazed element
  with existing assignments to Empty shows a confirm dialog listing what will
  be cleared; the server clears unconditionally, the frontend owns the
  confirm.

- **D-4 — Canvas treatment: near-fully transparent + dashed outline** (Ed,
  2026-07-28): void cells are only very lightly shown — almost fully
  transparent fill with a dashed outline, which reads unmistakably as "not
  there". (Supersedes the drafted diagonal-hatch proposal.) Final token
  values chosen during Phase 4 per `context/DESIGN_SYSTEM.md`.
