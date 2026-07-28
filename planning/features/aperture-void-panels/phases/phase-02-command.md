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
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    element_kind: ApertureElementKind
```

Note the field name `element_kind` — the union discriminator already uses
`kind` for the command name; do not overload it.

- Add to the `ApertureCommand` union + `AUDIT_KIND_BY_APERTURE_COMMAND`
  (`"setElementKind": "project_version_aperture_element_set_kind"`).
- Handler in `handlers/element.py` (alongside setElementName/Operation):
  - →`void`: clear all four frames, `glazing_id`, `operation`, set kind.
    (Per D-3 default: server clears unconditionally; the *frontend* owns the
    confirm. If D-3 flips to hard-refuse, refuse when any assignment is set.)
  - →`glazed`: just set kind (element becomes a normal unfinished sash).
  - No-op when kind already matches (return unchanged document, mirroring
    existing idempotent-handler patterns if present — check `_shared.py`).

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
  idempotent no-op; unknown element/aperture errors match existing codes.
- Each guard: refusal error code + document unchanged.
- merge void+void OK (result void); merge mixed refused; split void →
  1×1 voids.

## Verification

`make ci` green. No UI yet — exercise via pytest and (optionally) MCP
`apply_aperture_command` against the local fixture project.
