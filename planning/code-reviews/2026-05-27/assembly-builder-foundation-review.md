---
DATE: 2026-05-27
TIME: 22:00 EDT
STATUS: Foundation code review — Assembly Builder (Phases 1–8 implementation surface).
AUTHOR: Claude (Opus 4.7)
SCOPE:
  - backend/features/envelope/
  - frontend/src/features/envelope/
RELATED:
  - planning/archive/assembly-builder/README.md
  - planning/archive/assembly-builder/STATUS.md
  - planning/archive/assembly-builder/PRD.md
  - context/CODING_STANDARDS.md
GOAL: Sanity-check the foundation before a real UI/UX build-out. The
      feature is still a rough wireframe; review focuses on architecture,
      naming, documentation, coupling, duplication, magic numbers,
      readability, and module-size discipline so the polish phase
      doesn't pour effort on top of a shaky base.
---

# Assembly Builder — Foundation Code Review

## TL;DR

The foundation is **broadly sound** and clearly the result of disciplined,
phase-by-phase work. Layering matches the project's house style
(`routes → models → service` and `routes → api → hooks → components` on
the frontend), Pydantic v2 contracts are tight (`extra="forbid"`,
discriminated unions, SI-canonical units), and TanStack Query
invalidation is thoughtful rather than blanket. There are no obvious
correctness landmines, no hidden globals, no `Any`-soup, no silent
catches, no manual `useEffect` fetch loops.

The **single biggest issue is module size** — `backend/features/envelope/service.py`
is **1061 lines**, well past the documented hard limit of 1000
(`context/CODING_STANDARDS.md` §Module Size And Splitting). It is the
largest service file in the repo (next-largest is `projects/service.py`
at 559). The file is a faithful command-bus implementation, but it now
mixes seven distinct concerns (assembly geometry, layer/segment editing,
material picking, catalog copy-in, drift, refresh, ETag/transaction
plumbing) and earns the documented exception only by splitting.

The **second-biggest issue is the long-tail dispatcher** —
`_apply_command` is a 100-line `isinstance` cascade. It works and is
fully type-checked, but it scales linearly with command count and
buries the per-command intent behind generic plumbing.

The **third theme** is consistent module size pressure on the frontend:
`EnvelopePage.tsx` (509), `EnvelopeEditorDialogs.tsx` (665), and
`SpecificationsPanel.tsx` (389) are all past or at the soft limit.

Everything else is small, mostly stylistic, and fixable in an afternoon
of clean-up before serious UI work begins.

---

## What's working well

These are the things I'd leave alone — they are doing real work and
match the rest of the repo.

1. **Strict, discriminated command contracts.** `models.py` exposes a
   single `EnvelopeCommand` discriminated union with `kind` literal
   discriminator, 22 command DTOs all with `ConfigDict(extra="forbid")`,
   and explicit field bounds (`gt=0`, `ge=0/le=1`, `max_length`,
   `allow_inf_nan=False`). This is the right contract for a JSON-document
   feature and matches `context/CODING_STANDARDS.md` §Typing Standard.

2. **SI-canonical persistence with units only at the edges.** Every
   stored physical quantity is SI (`width_mm`, `thickness_mm`,
   `conductivity_w_mk`, `density_kg_m3`, `specific_heat_j_kgk`). IP/SI
   only lives in modal display helpers
   (`formatLengthFromMm`/`parseLengthToMm`, `ModalUnitToggle`,
   `useLengthDraft`). This is the documented invariant in the PRD §15
   defaults — strictly followed.

3. **Read-model separation from document shape.**
   `selectors.build_envelope_read_parts` walks the document once,
   layering on `AssemblyThermalStatus` and `ProjectMaterialUseSite[]`
   without mutating the document. `AssemblyRead`/`ProjectMaterialRead`
   subclass the document Pydantic types and add only derived fields —
   exactly the right shape for "document body + computed read view."

4. **ETag protocol is correctly wired.** `_load_command_context`
   distinguishes draft-etag vs version-etag, raises 409 with structured
   `expected` payloads, and returns enough state for the caller to
   re-respond with the unchanged body on a no-op (`next_body ==
   base_body`). The `draftWriteHeaders` helper on the frontend
   (`api.ts`) is the standard `project_document/table-slice` pattern.

5. **Pure thermal layer.** `thermal.py` is small (263 lines), no SQL,
   no FastAPI imports, pure data → data with frozen dataclasses and a
   hash function over (assembly subtree, referenced material physics).
   The `ThermalIssue` record is reused by both runtime preview and
   HBJSON export — that reuse is exactly the right shape and was called
   out as Phase 5's intended invariant.

6. **No-op short-circuit in commands.** `apply_envelope_command`
   correctly returns the unchanged response without writing a new draft
   row when `next_body == base_body`. Same pattern in
   `_replace_project_materials` and `apply_project_materials_replace`.
   This is the right idempotent shape and avoids ETag churn.

7. **Frontend invalidation is targeted.** `useEnvelopeCommandMutation`
   uses two named sets (`broadThermalInvalidationCommands`,
   `materialDriftInvalidationCommands`) so a layer-thickness edit
   invalidates one assembly's thermal cache but a `delete_assembly`
   invalidates the broader thermal namespace. Drift cache invalidates
   only on commands that can actually change drift state. This is a
   level above what most of the repo does and worth keeping.

8. **No silent failures.** Catches re-raise (`applyAttachmentChange`)
   and `_not_found` is `NoReturn`. Errors bubble through
   `errorMessage` / `exportErrorDetails` and become visible to the
   user.

---

## High-priority issues

### H1. `backend/features/envelope/service.py` is past the 1000-line hard limit (1061 lines)

**Why it matters:** `context/CODING_STANDARDS.md` §Module Size And
Splitting calls 1000 lines "not acceptable for feature code without a
written exception in the relevant plan/review doc." This file has no
such exception. It is currently the largest service in the codebase
(`projects/service.py` 559, `assets/service.py` ~30 KB but split via
related files). It also crosses multiple workflow concerns, which is
the project's preferred split signal.

**Recommendation — split along workflow lines.** Per the standards'
"split by workflow first, then by policy" guidance, keep `service.py`
as the orchestration entry point and extract the per-command bodies.
For example:

```text
backend/features/envelope/
  service.py                  # apply_envelope_command + read entry points
  commands/
    __init__.py
    assemblies.py             # _create_assembly, _duplicate_assembly, _delete_assembly,
                              #   _flipped_orientation, _renumber_layers
    layers.py                 # _add_layer, _delete_layer (and _target_layer_index)
    segments.py               # _add_segment, _delete_segment, _update_segment helpers,
                              #   _target_segment_index, _renumber_segments
    materials.py              # _pick_catalog_material, _hand_enter_material,
                              #   _update_project_material, _detach_segment_material,
                              #   _used_project_materials, _project_material_from_catalog
    drift.py                  # _project_material_drift_item,
                              #   _project_material_drift_fields, _load_catalog_material_rows
    refresh.py                # _refresh_project_material_from_catalog, _refresh_values
  identifiers.py              # _new_id (used by multiple modules)
  errors.py                   # _not_found and small policy helpers like
                              #   _ensure_unique_assembly_name
```

This is the same shape `project_document/` already uses (see `drafts.py`,
`versions.py`, `custom_fields.py`, `refresh.py`, `validation.py`).
Nothing about the current code prevents this split — the helpers are
already pure functions on `ProjectDocumentV1` and the per-command
service surface is the natural seam.

Functions called in `_apply_command` simply move to the
`commands/<topic>.py` modules and `_apply_command` calls them by name.
The cross-cutting helpers (`_update_assembly`, `_update_layer`,
`_update_segment`, `_replace_assemblies`, `_replace_project_materials`,
`_find_assembly`, `_find_project_material`, `_find_segment`,
`_renumber_*`) become a small `document_ops.py` (or similar) — they
are the only real coupling and they are tiny.

The reason to do this **before** UI buildout: Phase 8 still wants to
add scale fixtures, more browser smoke, and probably more commands.
Adding to a 1000-line file is where regressions hide.

---

### H2. `_apply_command` is a 100-line `isinstance` dispatch (`service.py:300–400`)

**Why it matters:** Every new command adds another `if isinstance(...)`
branch. The dispatch is a single function with no internal structure —
no grouping, no symmetry between create/update/delete, no easy way to
read "what does this feature do" at a glance. It works because Pydantic
validates the discriminator, but a reader has to skim 22 branches to
find the one they care about, and a reviewer has to skim them to be
sure no new branch silently falls into the `unknown_envelope_command`
422 path.

**Recommendation — table-driven dispatch.** The standard pattern in
the rest of this codebase (see `project_document/tables/registry.py`'s
`get_table_contract`) is a typed mapping. Sketch:

```python
CommandHandler = Callable[[Connection[Any], ProjectDocumentV1, EnvelopeCommand], ProjectDocumentV1]

_COMMAND_HANDLERS: dict[str, CommandHandler] = {
    "create_assembly": _handle_create_assembly,
    "rename_assembly": _handle_rename_assembly,
    # ...
}

def _apply_command(conn, body, command):
    try:
        handler = _COMMAND_HANDLERS[command.kind]
    except KeyError:
        raise api_error(422, "unknown_envelope_command", "Unknown envelope command.")
    return handler(conn, body, command)
```

The handlers can take the typed command directly and only `cast` inside
the body, or each handler signature can be `(conn, body, command: SpecificCommand) -> ProjectDocumentV1`
and registered with a small typed wrapper. This trades a 100-line
chain for a one-line registry and one-line per handler. It also makes
each handler discoverable (`grep -n "create_assembly" service.py` lands
on the registry entry; the cascade currently spreads attention across
three places: model, dispatcher, helper).

Doing this in tandem with H1's split (each `commands/<topic>.py`
module registers its handlers) is the natural place to land both
changes.

---

### H3. Largest frontend files cross the 300/500-line review thresholds

`context/CODING_STANDARDS.md` §Component Size And Splitting calls
300 a split signal and 500 the hard ceiling without a documented
exception. Current state:

| File | Lines | Status vs standard |
|---|---|---|
| `components/EnvelopeEditorDialogs.tsx` | 665 | **Past 500 hard ceiling.** Holds 9 distinct dialogs + `useLengthDraft` hook + 2 shared building blocks. |
| `routes/EnvelopePage.tsx` | 509 | Past 500. Holds routing, layout, all callback wiring, attachment workflow, drift dialog gate, copy/paste keyboard handler. |
| `components/SpecificationsPanel.tsx` | 389 | Past 300 review threshold. Holds card grid, drift summary, use-site row, asset-id collector. |

**Recommendations:**

- **Split `EnvelopeEditorDialogs.tsx` by dialog family.** It is already
  a switch over `dialog.kind` — break it into one file per family
  (`AssemblyNameDialog`, `LengthDialog`, `ConfirmDialog`, `SegmentDialog`)
  with a thin `EnvelopeEditorDialogs.tsx` doing the routing. `useLengthDraft`
  is reused by `LengthDialog` and `SegmentDialog` — promote it to
  `hooks/useLengthDraft.ts`. `DialogActions` belongs in `shared/ui/` or
  alongside `ModalDialog` (it's domain-neutral).
- **`SegmentDialog` (~165 lines inside the 665-line file) is the densest
  knot.** It renders width input + stud spacing + continuous-insulation
  checkbox + project-material picker + catalog-material picker +
  hand-enter + detach + nested `ProjectMaterialEditor`. This is the
  component most likely to grow when UI/UX polish starts — split the
  material-picker fieldset out now, before the polish PR has to do it
  under deadline.
- **Move attachment handling out of `EnvelopePage.tsx`.**
  `applyAttachmentChange` is 56 lines of mutation orchestration that
  doesn't belong in a page component. Either move it into
  `features/envelope/hooks.ts` as `useEnvelopeAttachmentMutation`, or
  push it down into `SpecificationsPanel` (the only caller). Today
  the page is one screen of routing-and-redirect, half a screen of
  callbacks, and a tall JSX tree — extracting the mutation drops it
  back under 400 lines.

---

### H4. `EnvelopePage.tsx` mixes routing, redirect logic, and feature state

This is the same root cause as H3 but worth calling out separately:
`routes/EnvelopePage.tsx` is doing four jobs simultaneously:

1. Subroute parsing and `<Navigate>` redirects (lines 117–162).
2. Feature data wiring (`useEnvelopeReadQuery`,
   `useMaterialCatalogDriftQuery`, command mutation, export mutation).
3. Local UI state (zoom, dialog, copied assignment, refresh material,
   attachment busy).
4. The whole envelope JSX tree.

`context/CODING_STANDARDS.md` §App And Routing Boundaries asks for
"page layout + feature hooks + smaller components" only. The redirect
guard cascade and `envelopeSubpath` regex could live in `paths.ts`
(already the home of `isEnvelopeSubroute`), and the copy-keyboard
`useEffect` could live with the canvas component that consumes
`copiedAssignment`.

This isn't urgent but the longer the page stays this dense the harder
it gets to add toolbar features, view modes, or the planned drift
overlay polish.

---

## Medium-priority issues

### M1. Magic numbers in `AssemblyCanvas.tsx` should be named or themed

```ts
const BASE_PX_PER_MM = 0.18;
const MIN_LAYER_HEIGHT = 30;
const MIN_SEGMENT_WIDTH = 72;
```

These are named (good) but their *reason* isn't:

- Why `0.18`? — that calibrates "how many pixels per mm at zoom=1".
- Why `30` and `72`? — they're "minimum readable dimensions so tiny
  layers/segments stay clickable".

Two issues:

1. The values appear in three multiplications scattered through the
   render: `canvasWidth = Math.max(360, maxWidth * BASE_PX_PER_MM * zoom)`,
   `layerHeight = Math.max(MIN_LAYER_HEIGHT, layer.thickness_mm * BASE_PX_PER_MM * zoom)`,
   `flexBasis = Math.max(MIN_SEGMENT_WIDTH, segment.width_mm * BASE_PX_PER_MM * zoom)`.
   This is the right place for a small helper: `pxFromMm(mm, zoom, minPx)`.
2. The constants belong somewhere documented. Either `envelope.css`
   custom properties (`--envelope-px-per-mm`), or a top-of-file comment
   explaining the calibration ("ensures the typical 250 mm wall fits
   visibly in a 1280-wide canvas at zoom=1"), so a polish-phase author
   doesn't accidentally double them and break every screenshot.

There's also `360` (minimum canvas width), `12` (minimum layer-width
percentage), `2`/`0.6`/`0.1` (zoom max/min/step) hardcoded across
`EnvelopePage.tsx` and `AssemblyCanvas.tsx`. Pull all of them into a
single `envelope-canvas.constants.ts` with one comment per value
explaining the calibration intent.

### M2. `materialColor` regex is hand-rolled and fragile (`lib.ts:61`)

```ts
const match = material.argb_color.match(/\((\d+),(\d+),(\d+),(\d+)\)/);
if (!match) return "var(--bg-page)";
return `rgb(${match[2]} ${match[3]} ${match[4]})`;
```

The format `"(A,R,G,B)"` is a project-wide convention (set in
`_hand_enter_material` default `"(255,230,230,230)"` and stored on
catalog rows). It also appears across catalogs editors
(`MaterialEditorModal`, `FrameTypeEditorModal`, `GlazingTypeEditorModal`)
as a plain text input. A future Phius/PHPP roundtrip will care about
the alpha channel.

Recommendations, in priority order:

1. Move the parser/formatter into `shared/lib/argbColor.ts` with `parseArgb`
   and `argbToCssRgb` helpers, so envelope and catalogs stop diverging.
2. Whitespace tolerance: `(255, 230, 230, 230)` (with spaces) currently
   fails the regex and falls back to `--bg-page`. That's a silent
   round-trip loss when a user pastes a value.
3. Tests live in a `argbColor.test.ts` next door.

This is M-priority because the current behavior is correct on the data
the backend hand-rolls; the risk is when the field becomes user-edited
in a polish UI.

### M3. `_load_catalog_material_rows` opens its own transaction (`service.py:849–861`)

```python
def _load_catalog_material_rows(materials):
    ...
    with transaction() as conn:
        rows = catalog_materials_repository.get_materials_by_ids(conn, sorted_ids)
    ...
```

This is the only function in the file that does so. Drift reports call
it through `get_project_material_drift_report`, which is read-only and
has no outer transaction — so opening one inside is fine in isolation.
But it breaks the symmetry with the rest of the service: every other
catalog hit (`_pick_catalog_material`, `_refresh_project_material_from_catalog`)
takes the caller's `conn`. If a future read path or batch job ever
wraps drift in its own transaction, this nested `transaction()` becomes
a debugging surprise.

**Recommendation:** thread a `conn` parameter through
`get_project_material_drift_report → _project_material_drift_item →
_load_catalog_material_rows`. The drift route handler can open the
transaction. Symmetry > one extra parameter.

### M4. `_next_copy_name` / `_next_custom_material_name` are duplicates

```python
def _next_copy_name(assemblies, source_name):
    names = {a.name.strip().casefold() for a in assemblies}
    base = f"{source_name} Copy"
    if base.casefold() not in names: return base
    for index in range(2, 1000):
        candidate = f"{base} {index}"
        if candidate.casefold() not in names: return candidate
    return f"{base} {_new_id('asm')}"

def _next_custom_material_name(materials, source_name):
    # same shape with "(Custom)" suffix and "pmat" fallback
```

Both are "find next free name with this suffix, give up at 1000". Pull
into `_next_unique_name(existing_names: Iterable[str], suffix: str,
fallback_prefix: str) -> str`. The `range(2, 1000)` cap is itself a
magic number worth a comment (what happens at copy #1000? — the ID
fallback fires, which is fine, but say so).

### M5. Frontend `EnvelopeReadSource` is duplicated across the file tree

```ts
// types.ts
export type EnvelopeReadSource = "draft" | "version";
// query-keys.ts inline
read: (..., source: "draft" | "version") => ...
thermal: (..., source: "draft" | "version") => ...
materialDrift: (..., source: "draft" | "version") => ...
```

The query-key signatures should reuse the named type. Minor but it's
the kind of drift that creates "two sources of truth" bugs when a
third option (e.g. `"locked"`) is ever added.

### M6. Test files are flat, phase-named, and growing fast

```
tests/test_envelope_phase01.py  317
tests/test_envelope_phase03.py  157
tests/test_envelope_phase04.py  197
tests/test_envelope_phase05.py  285
tests/test_envelope_phase06.py  258
tests/test_envelope_phase07.py  209
```

Naming tests by **delivery phase** is convenient during phased rollouts
but ages badly — a reader six months from now has to know the phase
numbering to find "the catalog-drift tests" (phase 07) or "the layer/segment
editing tests" (phase 03). Either:

1. Rename by topic alongside the H1 split — `test_envelope_layers.py`,
   `test_envelope_materials.py`, `test_envelope_drift.py`,
   `test_envelope_thermal.py`, `test_envelope_export.py`. Or
2. Add a `tests/envelope/` folder with one file per concern and keep the
   current phase files as transitional shims.

This is the same shape as `test_project_document_custom_fields_phase_1.py`
through `_phase_4.py` already in the repo — a known pattern, but
arguably the wrong direction for both features. Worth deciding for
the project as a whole during Phase 8 close-out.

---

## Low-priority issues / nitpicks

### L1. Docstring coverage is thin and uneven

`context/CODING_STANDARDS.md` requires docstrings on public functions
that "encode project behavior" and explicitly says they should explain
**why**. Coverage right now:

- **Strong**: `models.py` (every command has at least a one-liner
  explaining intent — `"Copy/paste material assignment fields without
  geometry or evidence."` is a great example).
- **Strong**: top of `thermal.py` (`"Return SI-canonical thermal values
  or explicit incomplete-state flags."`), top of
  `selectors.build_envelope_read_parts`.
- **Thin**: `service.py` — `apply_envelope_command` has a one-liner but
  the policy contract (no-op when body unchanged, requires editor
  access, distinguishes draft-etag vs version-etag, drafts get tagged
  with `updated_via`) lives only in the code. That's exactly the kind
  of "why" the standard asks for.
- **Missing**: `hbjson_export.export_hbjson_constructions` does not
  document the saved-version-only invariant or why the export raises
  422 (a deliberate Phase 5 decision per PRD §15).
- **Missing**: All command helpers (`_add_layer`, `_pick_catalog_material`,
  etc.) are pure-mechanical so a function comment isn't needed — but
  the module top of `service.py` ("Envelope read and semantic command
  workflows.") could pick up the cross-cutting invariants
  (segment-width normalization, name uniqueness, materials always
  validated against the document before assignment).

Frontend docstring coverage is essentially zero, which is consistent
with the rest of the frontend in this repo, but the larger files
(`EnvelopePage`, `EnvelopeEditorDialogs`) would benefit from a top-of-file
4–6 line block on "what shape of state this owns."

### L2. `ID_ALPHABET` uses lowercase letters + digits, 12 chars (`service.py:71`)

```python
ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
def _new_id(prefix: str) -> str:
    return f"{prefix}_{''.join(secrets.choice(ID_ALPHABET) for _ in range(12))}"
```

`36^12 ≈ 4.7×10^18` so collision risk is moot for this domain
(documents have at most a few thousand IDs each). Worth a one-line
docstring explaining "human-readable nanoid-style ids, scoped per
document; 36^12 keyspace is intentional vs UUIDs to keep
`assembly_id`/`layer_id`/`segment_id` short in JSON-Patch paths."

The `_new_id` prefix is duplicated as string literals (`"asm"`,
`"lyr"`, `"seg"`, `"pmat"`). Pull into named constants:

```python
ID_PREFIX_ASSEMBLY = "asm"
ID_PREFIX_LAYER = "lyr"
ID_PREFIX_SEGMENT = "seg"
ID_PREFIX_PROJECT_MATERIAL = "pmat"
```

so a future "what's `lyr_…` again?" search lands somewhere meaningful.

### L3. Hard-coded fallback color `"(255,230,230,230)"` in two places

In `_hand_enter_material` (`service.py:586`) and as a default for the
canvas CSS fallback `var(--bg-page)` in `materialColor`
(`lib.ts:62`). These are independent — backend default ARGB vs frontend
"no material" placeholder — but both are values without a name. Define
`DEFAULT_HAND_ENTERED_MATERIAL_COLOR` in `service.py` and reference it
in a one-line docstring.

### L4. Comments in source code are sparse

The codebase generally follows the "no obvious-comments" rule
(consistent with `CLAUDE.md` "default to no comments"). The one place
this hurts is the **thermal math** in `thermal.py:_calculate_parallel_path_r_value`
and `_calculate_isothermal_planes_r_value`. These implement the PH
average of Parallel-Path and Isothermal-Planes methods (per PRD §5).
The math is right but a reader who isn't a CPHC has no anchor:
- a 3-line module/function block citing the two methods (ASHRAE
  Fundamentals Ch. 25, or the PH Institute envelope guide) would let
  Claude and a future engineer reason about edge cases (zero-width
  segments, single-segment fast paths, the `total_u` guard) without
  re-deriving the formulae.

### L5. `_apply_command` `raise api_error` after the cascade is dead code given the discriminated union (`service.py:400`)

```python
raise api_error(422, "unknown_envelope_command", "Unknown envelope command.")
```

Pydantic's discriminator means an unknown `kind` never enters this
function — it fails validation at the route boundary. The `raise` is
defense-in-depth and is fine to keep, but a one-line comment "defensive;
Pydantic discriminator already rejects unknown kinds at the route"
would tell a reader why the path is unreachable. (When H2 lands, the
new dispatch will replace this with a structural KeyError, which is
arguably cleaner because it actually reflects how Python sees it.)

### L6. `EnvelopeEmptyState` lives in `components/EnvelopeStates.tsx` (3 tiny states)

Combined file is 26 lines for three states. This is *fine* — three
files for three states would be over-decomposition. Just calling it
out so we don't accidentally "split" them while doing H3.

### L7. `hbjson_export.py` line 19 uses bare HTTP status

```python
raise api_error(422, ...)
```

Sibling code uses `from starlette import status` and
`status.HTTP_422_UNPROCESSABLE_ENTITY`. Trivially fixable; matters for
grep consistency.

### L8. `useEnvelopeHbjsonExportMutation` builds and tears down a DOM link

```ts
const link = document.createElement("a");
try {
  link.href = url; link.download = ...; document.body.append(link); link.click();
} finally {
  link.remove(); URL.revokeObjectURL(url);
}
```

Same pattern lives elsewhere in the repo (likely `shared/lib/download.ts`
or similar). If it doesn't yet, this is the moment — the `try/finally`
around `URL.revokeObjectURL` is exactly the kind of thing that wants
one place to be right.

---

## Patterns to keep doing

- **Single read response shape for every source.** `EnvelopeReadResponse`
  always carries `source` + `version_etag` + optional `draft_etag`.
  The frontend never has to branch on "did this come from a save or a
  draft?" — the response carries it. Worth holding the line on this.
- **Per-command `model_config = ConfigDict(extra="forbid")`.** Catches
  typos at the boundary. Keep it on every new command.
- **No FastAPI imports in `thermal.py` / `hbjson_export.py` /
  `selectors.py`.** Pure data → data layer is exactly what `ty check`
  is best at, and what makes these the easiest files to test in
  isolation. Don't dilute them with route concerns.
- **Frontend mutation hooks return typed `mutationFn` args.**
  `useEnvelopeCommandMutation` takes `{ current, command }` which is
  the right shape: the caller has to read the current slice (to supply
  the ETag) instead of the hook reaching for a stale snapshot.

---

## Suggested sequence of fixes (before serious UI/UX work)

These are ordered by leverage — each one makes the next one easier.

1. **H1 split of `service.py` into `commands/` + small ops module.**
   30–60 min. No behavior change. Run `pytest tests/test_envelope_phase0*.py`
   and the targeted Ty gates from `STATUS.md` afterwards.
2. **H2 dispatch table.** Lands inside `service.py` (or wherever the
   thin `apply_envelope_command` ends up after H1). 15–30 min. Same
   gates.
3. **H3 + H4 frontend split.** `EnvelopeEditorDialogs.tsx` →
   per-dialog files; `useLengthDraft` → its own hook;
   `applyAttachmentChange` → `useEnvelopeAttachmentMutation`;
   redirect logic → `paths.ts`. 1–2 hours including running the
   existing `EnvelopePage.test.tsx`.
4. **M1 canvas constants.** Pull the magic numbers into one
   module with comments. 15 min. Visible in any browser smoke screenshot
   if drift happens, so do it before the polish phase changes the
   visual baseline.
5. **M2 / L3 `argbColor` shared helper.** 30 min including tests, but
   it can wait until the catalogs feature is touched again — no
   imminent regression risk.
6. **L1 / L4 docstrings.** Pass over `apply_envelope_command`,
   `export_hbjson_constructions`, both thermal math functions, and
   the module top of `service.py`. 30 min. Lowest risk, highest payoff
   for future readers (including Claude).
7. **M6 test rename.** Either bundle with H1 (so each new
   `commands/<topic>.py` ships with `tests/envelope/test_<topic>.py`)
   or defer to a project-wide test-naming pass.

Items M3, M4, M5, L2, L5–L8 are pure polish; pick them up opportunistically
when nearby code is being edited.

## Out of scope for this review

- **Performance / scale.** Phase 8 still owes a realistic scale fixture
  (PRD §13). The full-document `model_dump(mode="json")` round-trip in
  every command is fine at 5 assemblies, defensible at 50, and worth
  re-measuring at 500. Not a code-shape issue yet.
- **Accessibility.** Phase 8 owes a real a11y pass; the current canvas
  uses `<section>`/`<article>` semantically (good) but the per-segment
  button row is keyboard-noisy. Will look different once the polished
  UI shape is decided.
- **MCP write tool boundary.** I trust the Phase 8 claim that it shares
  `EnvelopeCommandRequest`, but verifying the exact contract live is
  worth a separate read of `features/mcp/tools.py`.
- **HBJSON shape vs Honeybee canonical.** PRD §15 notes the open
  question on whether to take a Honeybee package dependency. The
  current hand-authored JSON is plausible but not validated against
  Honeybee — a one-shot import-test against a small Honeybee install
  would catch shape drift cheaply.

---

## Net assessment

Good bones. The architecture decisions made over Phases 1–7
(SI-canonical persistence, discriminated semantic commands, ETag
protocol, shared thermal `ThermalIssue` records, project-document
draft/version separation, table contracts for attachments) are the
right ones and have been executed consistently. The Phase 8 hardening
agenda already calls out the missing scale/browser work.

The cleanup before serious UI/UX work is narrow: **split the
1061-line service file, replace the long isinstance cascade, and break
up the three biggest frontend files.** Those three changes will make
the polish phase noticeably less painful — and the rest of the
nitpicks above can be cleared opportunistically as nearby code is
touched.
