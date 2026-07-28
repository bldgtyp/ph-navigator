---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Not started
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 2 — `setElementKind` command + void guards on existing commands.
RELATED: ../PRD.md §3, ../decisions.md D-3
---

# Phase 2 — Command surface

## New command

`backend/features/project_document/aperture_commands/models.py`:

```python
class SetElementKind(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["setElementKind"] = "setElementKind"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_ids: list[str] = Field(min_length=1, max_length=400)
    element_kind: ApertureElementKind
```

Notes: `element_kind`, not `kind` — the union discriminator already uses
`kind` for the command name. `element_ids` is a **list** (review F-3,
decisions A-5), mirroring `pasteAssignment`: one document write, one audit
row, all-or-nothing (any unknown id fails the whole batch).

- Add to the `ApertureCommand` union + `AUDIT_KIND_BY_APERTURE_COMMAND`
  (`"setElementKind": "project_version_aperture_element_set_kind"`).
- Handler in `handlers/element.py` (alongside setElementName/Operation):
  - →`void`: clear all four frames, `glazing_id`, `operation`, set kind (D-3:
    server clears unconditionally; the *frontend* owns the confirm).
  - →`glazed`: just set kind (element becomes a normal unfinished sash).
  - Elements already at the requested kind: no-op within the batch; a batch
    that changes nothing returns the unchanged document (mirror existing
    idempotent-handler patterns — check `_shared.py`).

## Guards on existing handlers

Follow the existing command-error style in `handlers/` (find the established
error-code helper in `_shared.py` before inventing anything):

| File | Guard |
| --- | --- |
| `handlers/picks.py` | `pickFrame` / `pickGlazing` refuse a void target (`aperture_element_is_void`) |
| `handlers/element.py` | `setElementOperation` refuses a void target |
| `handlers/paste.py` | `pasteAssignment` refuses a void source or any void target |
| `handlers/merge_split.py` | `mergeElements`: all sources must share one kind; merged element keeps it. `splitElement`: children inherit `kind` (no other change — void assignments are already null) |

Unchanged: sidebar CRUD, dimensions, flip, refresh (unreachable for voids),
manufacturer filters.

## Documented-behavior tests (no code change — review F-5/F-6)

- **`addRow`/`addColumn` straddle grows voids** (`_add_along_axis`,
  `dimensions.py` — verified): inserting a row/column *through* a void
  extends its span, so new cells become "not window" without an explicit
  gesture. This is intended (the void grows with the grid) but it is a second
  void-creation path besides `setElementKind`: assert it with a test and
  state it in the handler docstring.
- **`deleteRow`/`deleteColumn` can orphan the last glazed element** and leave
  an all-void aperture (orphans whose span == the deleted index are dropped).
  Not blocked here; Phase 3's `no_glazed_elements` warning + export guard
  surface it. Add a test that the resulting document validates.

## Frontend types only

`frontend/src/features/apertures/types.ts`: add the `setElementKind` variant
to the `ApertureCommand` union (UI wiring is Phase 4).

## MCP

Nothing to do — `apply_aperture_command` passes the union through. Add one
contract test exercising `setElementKind` through the MCP dispatch path if the
existing suite covers commands individually (mirror whatever
`apertures_mcp`/contract tests do for `setElementOperation`).

## Tests

- setElementKind →void clears assignments + audits; →glazed round-trip;
  batch across several elements is one write/audit; mixed batch where some
  elements already match; all-or-nothing on one unknown id; idempotent no-op;
  unknown aperture errors match existing codes.
- Each guard: refusal error code + document unchanged.
- merge void+void OK (result void); merge mixed refused; split void →
  1×1 voids.
- Straddle-growth + delete-to-all-void documented-behavior tests (above).

## Verification

`make ci` green. No UI yet — exercise via pytest and (optionally) MCP
`apply_aperture_command` against the local fixture project.
