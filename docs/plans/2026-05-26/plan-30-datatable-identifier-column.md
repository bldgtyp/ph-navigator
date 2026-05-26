---
DATE: 2026-05-26
TIME: 11:48 ET (rev 2026-05-26 — decisions resolved)
STATUS: Phase A landed 2026-05-26 — DataTable infrastructure
        (`IdentifierConfig` type, pinned-column rendering, Shift-Enter
        true-blank inserts, `__record_id__` sort plumbing, paste/fill
        guards, broken-identifier ERROR state, duplicate-value warning
        chip, unit tests at `__tests__/identifier*.{ts,tsx}`). Phases
        B (Pumps adopt + uniqueness drop), C (Rooms), and D (catalog /
        remaining tables) still pending. Durable contract written into
        `context/technical-requirements/data-table.md` § Identifier
        Column.
AUTHOR: Claude (Opus 4.7)
SCOPE: Decouple the DataTable's user-visible "ID" column from the
       hidden record PK, and let each feature declare how that
       identifier is sourced (direct field or computed formula).
       Drop the implicit uniqueness assumption on user-facing
       identifier fields where it is the wrong invariant
       (project-document tables); leave it intact where it is the
       right invariant (catalog tables — picker semantics).
RELATED:
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/features/equipment/lib.ts
  - frontend/src/features/equipment/lib/buildEmptyPumpRow.ts
  - frontend/src/features/equipment/lib/roomsFormulaRegistry.ts
  - backend/features/project_document/document.py
  - context/technical-requirements/data-table.md
---

# Plan 30 - DataTable Identifier Column

## P0. Decision

Introduce a declarative `identifier` config on every DataTable feature.
The identifier defines which value the pinned column renders as the
user-facing "ID", and is fully decoupled from the hidden record PK that
the backend and React already use for row identity.

The identifier may resolve in one of two ways:

1. **field** — a direct reference to one of the row's existing fields
   (e.g. Pumps uses `tag`). The cell is editable; writes pass through.
2. **computed** — a function over one or more dependency fields (e.g.
   Rooms concatenates `number` and `name`). The cell is read-only; it
   recomputes whenever a dependency field changes.

The identifier is **never unique-constrained**. Two rows are allowed to
display the same "ID" value; the hidden PK (`pmp_…`, `rm_…`, `rec…`)
continues to provide true row identity for storage, FK joins, React
keys, undo, and clipboard mapping.

This is AirTable parity: the pinned column is a label, not a key.

## P1. Bug Today (Pumps)

Repro from screenshot at `Screenshot 2026-05-26 at 11.41.07 AM.png`:

1. User has Pumps `P-01` and `P-02`.
2. User selects a cell in `P-02` and presses Shift-Enter.
3. The frontend produces a `RowInsertPayload` whose field defaults are
   cloned from the anchor row (`DataTable.tsx`, payload shape at
   `types.ts:202–206`). The clone includes `tag: "P-02"`.
4. `validatePumpsPayload()` at
   `frontend/src/features/equipment/lib.ts:502–527` rejects the write
   because line 511's uniqueness guard fires on the duplicated tag.
5. UI surfaces `"Pump tag already exists in this project."` and the
   blank-row insert never lands.

Two independent defects:

- **D1.** The insert-row code clones the identifier value from the
  anchor row. Identifier values should never be cloned — every new row
  starts with an empty identifier.
- **D2.** Pumps enforces tag uniqueness in the frontend, which both
  duplicates a hidden-PK guarantee and prevents legitimate user choices
  (e.g. multiple unlabeled draft rows).

Both defects fall out cleanly once `identifier` is declarative.

## P2. Type Design

Add to `frontend/src/shared/ui/data-table/types.ts`:

```ts
export type IdentifierConfig<TRow> =
  | {
      kind: "field";
      field: keyof TRow & string;
      label?: string;        // header label, defaults to "ID"
    }
  | {
      kind: "computed";
      label?: string;
      deps: ReadonlyArray<keyof TRow & string>;
      compute: (row: TRow) => string;
    };
```

DataTable accepts `identifier?: IdentifierConfig<TRow>`. When provided:

- The pinned column is rendered from the identifier config, with the
  header label defaulting to `"ID"`.
- For `kind: "field"`, the cell is editable and writes through to
  `row[field]` via the normal cell-edit pathway.
- For `kind: "computed"`, the cell is read-only. It recomputes when any
  of `deps` changes. Editing is disabled — the user edits the
  dependency fields instead (which may live in other columns or be
  hidden, at the feature's discretion).
- The identifier value is **never** passed through cell-uniqueness
  checks, sort-stability tiebreakers, or React-key derivation. Those
  continue to use `getRowId(row)`, which reads the hidden PK.

When `identifier` is omitted, DataTable falls back to today's behavior
(first column is whatever `columns[0]` is, no special semantics).

## P3. Insert-Row Behavior

**Per D10: Shift-Enter creates a truly blank row across ALL
fields**, not just the identifier. This is a broader change than the
original draft proposed — full AirTable parity for row insertion.

Concretely:

- DataTable populates `RowInsertPayload.fieldDefaults` exclusively
  from each `FieldDef.default` (or the field-type natural zero when
  `default` is omitted) — **never** from the anchor row.
- The `anchorRow` parameter on `BuildEmptyRow` stays in the
  signature because a future "Duplicate record" right-click action
  will reuse the same builder. For the Shift-Enter path, the
  anchor's *position* still matters (so the new row inserts below
  it), but its *values* do not.
- Feature `buildEmptyRow` implementations must be **audited to
  remove anchor-value-cloning code**. The current
  `makeBuildEmptyPumpRow` (frontend/src/features/equipment/lib/
  buildEmptyPumpRow.ts:6) clones the anchor row into `base` then
  overlays fieldDefaults — that clone path must come out (or be
  gated behind a future `mode: "duplicate"` flag the Duplicate
  action will pass).
- The identifier-specific clearing rule from the original draft is
  redundant under D10 — the whole row is blank, so the identifier
  is naturally blank too.

**Out of scope (deferred to a follow-up plan):** the explicit
"Duplicate record" command exposed via row-right-click context
menu. That action reuses `buildEmptyRow` with `anchorRow` carrying
the source row, and the builder clones non-identifier values from
it (the identifier still starts blank under the new rules).

## P4. Backend Changes

**Correction from earlier survey.** The Pydantic document model in
`backend/features/project_document/document.py` enforces uniqueness via
`model_validator` for the three project-document identifiers:

- `pump.tag` — lines 482–486 (`raise ValueError("Duplicate pump tag: ...")`)
- `room.number` — lines 408–419 (`raise ValueError("Duplicate room number: ...")`)
- `window_type.name` — lines 498–501 (`raise ValueError("Duplicate window type name: ...")`)

Because the persisted store is a JSON document, the Pydantic validator
**is** the schema constraint. Relaxing the frontend guard without
relaxing these validators yields a 422 the first time a user actually
saves a duplicate. The plan's earlier "no schema change" framing was
wrong.

For Pumps (Phase B):

- Remove the tag-uniqueness `model_validator` branch in `document.py`
  (lines 482–486). Keep `pump.id` uniqueness — that's the hidden PK.
- Remove the tag-uniqueness check from `validatePumpsPayload()` at
  `frontend/src/features/equipment/lib.ts:511`.
- Update or remove the corresponding unit tests in
  `backend/tests/...` and `frontend/src/features/equipment/lib.test.ts`
  (the "Pump tag already exists" assertion, and any backend test that
  asserts `Duplicate pump tag` is raised).
- Audit any downstream code that treats `tag` as a join key:
  energy-model writers (PHX / honeybee-ph export, if any path exists in
  V2 yet), report exports, AirTable sync paths, `sortedPumps()`
  tiebreakers at `lib.ts:237–243`. Update each to key off the hidden
  `id` (`pmp_…`) instead. Sort display order may still use `tag` as the
  primary sort field with `id` as the stable tiebreaker; only
  **identity** joins need to change.
- MCP write path: pumps mutations come through MCP as well as through
  the inline-edit pipeline. After the validator is relaxed, MCP can
  also land duplicate tags. Acceptable — both paths share the
  document-model contract.

For Rooms (Phase C):

- Remove the room-number-uniqueness `model_validator` branch in
  `document.py` (lines 408–419). Keep `room.id` uniqueness.
- Remove the room-number branch in `validateRoomsPayload()` at
  `lib.ts:481`. Also remove the `nextFreeRoomNumber` helper at
  `lib.ts:375–392` and its callsites — the carve-out exists only to
  work around the uniqueness rule, and falls out once the rule is
  gone.
- Update tests: `frontend/src/features/equipment/lib.test.ts` line 267
  (`"Room number already exists in this project."`) and any backend
  test asserting `Duplicate room number`.

For Window Types (Phase D or later):

- Same pattern: remove the `window_type.name` uniqueness validator in
  `document.py` (lines 498–501) and any frontend mirror, **if and only
  if** Window Types is being modelled as a project-document table.
  Confirm before changing — Window Types may share semantics with the
  catalog tables instead (see below).

For catalog features (Materials, Glazing, Frame):

- **Per D2: drop uniqueness here too**, but **not in this plan's
  Phases A–C**. Catalog uniqueness relaxation rides with the catalog
  rollout because it requires coordinated changes to the
  bookshelf-picker UX (disambiguator in dropdowns) and the
  `catalog_origin` provenance display (currently renders by name —
  must switch to render `rec_…` id + name or name + version).
- The catalog-side `identifier` config adopts
  `kind: "field", field: "name"` for pinned rendering as part of
  Phase D. The uniqueness validator on catalog `name` stays until
  the catalog rollout that picks it up alongside the picker UX work.
- All linked-record references (project documents pointing at
  catalog records) must key off the catalog `rec_…` PK, never the
  display name. Audit at the time of catalog rollout.

## P5. Frontend Changes

DataTable core (`frontend/src/shared/ui/data-table/`):

- Add `IdentifierConfig<TRow>` to `types.ts`.
- Add `identifier?: IdentifierConfig<TRow>` to `DataTable` props in
  `DataTable.tsx`.
- Wire the pinned-column renderer:
  - `kind: "field"`: promote the backing FieldDef's column to the
    pinned leading slot (per D4). Header reads "Record-ID" (per D6,
    overriding the FieldDef's `display_name`). The column inherits
    the FieldDef's `field_key`, sort/filter/group registry entry,
    and `ViewState.columnWidths` id.
  - `kind: "computed"`: register a synthetic read-only column with
    reserved id `__record_id__`. Recomputation invokes the
    `compute` callback whenever any of `deps` changes. Compute runs
    on every render; memoise per (rowId, dep-tuple) if profiling
    shows it matters for large tables.
- Update the row-insert path: populate `fieldDefaults` from
  `FieldDef.default` only — no anchor cloning (per D10).
- Suppress the hide-column menu item on the pinned slot. Clamp
  column-drag-reorder to the second-leading drop target as the
  minimum (per D7).
- Sort plumbing for the synthetic `__record_id__` column (per D5):
  minimal grid-local registry entry (`field_type: "text"`,
  `read_only_schema: true`); the existing sort pipeline can resolve
  it without round-tripping through the document store.
- Clipboard / fill / paste guards for read-only identifier cells
  (per D11): paste-rectangle planner skips them with a toast count;
  fill propagates as no-op; copy emits compute output.
- Broken-identifier ERROR state (per D9): when an identifier's
  `kind: "field"` references a missing `field_key` (or a custom
  field's `cf_*` id no longer in the schema), header shows the
  warning glyph and cell bodies render `ERROR`.
- Duplicate-value warning chip (per D13): O(n) pass per render over
  visible rows; cells with conflicting values show a warning glyph
  with tooltip "Also used on row N (and X more)". Non-blocking.

Pumps feature (`frontend/src/features/equipment/`):

- Declare `identifier: { kind: "field", field: "tag" }` when mounting
  the Pumps DataTable.
- Update `buildEmptyPumpRow()` — `tag: null` is already correct, no
  change needed there. Remove the tag-cloning side of insert if any
  exists in `pumpsController.ts`.
- Remove the tag-uniqueness check from `validatePumpsPayload()`.

Rooms feature:

- Declare a computed identifier:
  ```ts
  identifier: {
    kind: "computed",
    deps: ["number", "name"],
    compute: (room) => [room.number, room.name].filter(Boolean).join(" — "),
  }
  ```
- Verify the existing `number`/`name` columns remain editable as normal
  columns (the identifier column is a read-only mirror, not a
  replacement).

Catalog tables (Materials, Glazing, Frame):

- Declare `identifier: { kind: "field", field: "name" }` (or whichever
  field is the user-meaningful label). Lower priority than Pumps and
  Rooms.

## P6. Implementation Phases

Phase A — DataTable infrastructure (no user-visible change):

1. Add `IdentifierConfig<TRow>` to `types.ts`.
2. Add `identifier?: IdentifierConfig<TRow>` prop to `DataTable`,
   default behavior unchanged when omitted.
3. Wire pinned-column rendering:
   - `kind: "field"` → promote-and-replace (D4).
   - `kind: "computed"` → synthetic `__record_id__` column with
     lexical sort (D5).
   - Header label always "Record-ID" (D6).
   - Hide / reorder suppressed on the pinned slot (D7).
4. Flip Shift-Enter to true-blank inserts (D10): populate
   `fieldDefaults` from `FieldDef.default` only — no anchor cloning.
5. Sort plumbing for `__record_id__` (grid-local registry entry).
6. Clipboard / fill / paste guards for read-only computed cells (D11).
7. Broken-identifier ERROR state (D9).
8. Duplicate-value warning chip (D13).
9. Unit tests in `frontend/src/shared/ui/data-table/__tests__/`
   covering: pinned-column rendering for both kinds, header label,
   hide/reorder suppression, true-blank insert, computed sort,
   read-only paste/fill toast, broken-identifier ERROR rendering,
   duplicate warning chip on duplicate values, no warning on empty.

Phase B — Pumps adopts identifier + uniqueness drop (fixes the
screenshot, ships the architecture together per D1):

1. Declare `identifier: { kind: "field", field: "tag" }` on the
   Pumps DataTable mount.
2. Remove the tag-uniqueness `model_validator` branch in
   `backend/features/project_document/document.py` (lines 482–486).
3. Remove the tag-uniqueness check from `validatePumpsPayload()`
   (`frontend/src/features/equipment/lib.ts:511`).
4. Audit `buildEmptyPumpRow.ts:6` and remove the
   `{...anchorRow, id: rowId}` clone path so the Shift-Enter row
   starts truly blank (D10). Verify no other code path depends on
   the clone.
5. Audit any `tag`-as-join-key sites: `sortedPumps()`
   (`lib.ts:237–243`), clipboard / undo handlers, any
   export / sync paths. Use hidden `id` (`pmp_…`) for identity;
   `tag` may still drive display sort with `id` as tiebreaker.
6. Update / remove tests: `lib.test.ts` "Pump tag already exists"
   assertion, and any backend test asserting `Duplicate pump tag`.
7. Manual smoke via Playwright MCP: Shift-Enter on `P-02` — confirm
   a fully blank row appears with no error banner. Type `P-01` —
   confirm save succeeds and the warning chip surfaces "Also used
   on row N".

Phase C — Rooms adopts computed identifier + uniqueness drop:

1. Declare the computed identifier with
   `deps: ["number", "name"]` and
   `compute: (r) => [r.number, r.name].filter(Boolean).join(" — ")`.
2. Remove the room-number-uniqueness `model_validator` branch in
   `document.py` (lines 408–419).
3. Remove the room-number branch in `validateRoomsPayload()`
   (`lib.ts:481`).
4. Remove `nextFreeRoomNumber` (`lib.ts:375–392`) and its callsites
   — the helper exists only to work around the uniqueness rule.
5. Audit `makeBuildEmptyRoomRow` (or its equivalent) for the same
   anchor-clone path; remove it.
6. Update tests: `lib.test.ts:267` ("Room number already exists")
   and any backend test asserting `Duplicate room number`.
7. Verify formula-registry interaction (`roomsFormulaRegistry.ts`)
   — the identifier compute callback is grid-side only and does
   not feed the backend formula resolver.
8. Manual smoke: insert a blank row — pinned column shows blank
   until `number` or `name` is typed, then updates live. Insert a
   second blank row in the same table — warning chip should NOT
   surface on either (empty identifiers do not warn, per D13).

Phase D — Catalog tables and remaining project-document tables:

1. Materials, Glazing, Frame: declare
   `identifier: { kind: "field", field: "name" }` for pinned
   rendering. **Do NOT drop catalog name uniqueness in this
   phase** — that comes with the catalog rollout (see P4 catalog
   note).
2. Window Types: declare identifier, **do NOT drop name
   uniqueness** (D12 — deferred).
3. Other project-document tables (Fans, ERVs, Thermal Bridges as
   they come online): declare identifiers per their feature; drop
   any equivalent uniqueness validators in `document.py` at the
   same time.

## P7. Downstream Audit

Things that may currently assume identifier uniqueness, and how to
adapt:

- `sortedPumps()` at `equipment/lib.ts:237–243` — sorts by
  `tag ?? use ?? id`. Keep `tag` as the primary sort key, but ensure
  the fallback chain ends in the hidden `id` so duplicate tags get a
  stable secondary order.
- Pumps clipboard / undo handling — confirm row identity is read from
  `getRowId` (the hidden PK), not from `tag`. The earlier survey
  suggests this is already the case but verify before flipping.
- Any AirTable sync code that maps Pump → Airtable record by `tag`
  should switch to mapping by hidden `id`.
- Report/export paths that group rows by `tag` should be reviewed —
  duplicate tags would silently merge rows under the old assumption.
- Equivalent audit for Rooms (`number`), catalog tables (`name`).

This audit is the gating risk for Phase B. If any downstream consumer
silently breaks when duplicate tags appear, dropping the uniqueness
guard would produce data-integrity bugs that the UI doesn't surface.

## P7.5. ViewState And Interaction Semantics

The plan introduces two distinct identifier shapes; they interact with
ViewState (filter, sort, group, aggregations, column order, widths,
hide) differently. Decisions land in P10 — the table below names the
axes that need an answer rather than assuming one.

**`kind: "field"` (Pumps `tag`, catalog `name`).**

The identifier column **replaces** the field's regular leading-column
slot rather than rendering alongside it. There is one cell per row per
field; the identifier config promotes the chosen FieldDef to the
pinned slot and inherits its `field_key`, `display_name` (unless
overridden by `label`), `read_only`, sort/filter/group/aggregation
registry entries, and `ViewState.columnWidths` id. No new column id
is minted, so persisted ViewState round-trips cleanly.

**`kind: "computed"` (Rooms `number — name`).**

The identifier column is a **synthetic** read-only column with no
backing FieldDef in the document store. It carries the reserved id
`__record_id__` and:

- header label is "Record-ID" (per D6, universal across all tables);
- supports **lexical sort** on the compute output (per D5) via a
  minimal grid-local registry entry (`field_type = "text"`,
  `read_only_schema = true`); not filterable, not groupable, not
  aggregable;
- is hidden from the column-config menu's hide / move actions (per
  D7);
- has a fixed default width with user resize allowed (width persists
  under `__record_id__` in `ViewState.columnWidths`);
- copies as TSV using the compute output;
- paste over a computed identifier cell is dropped with a toast (the
  paste-rectangle planner already handles per-cell read-only); fill
  propagates a no-op for the same reason;
- never appears in `ViewState.columnOrder` (it's always leading and
  pinned);
- `sanitizeViewStateForSchema` whitelists `__record_id__` so it
  survives schema-fingerprint changes.

**AirTable-parity constraints (apply to both kinds, per D7).**

- The identifier column **cannot be hidden** via
  `ViewState.hiddenColumns`. The hide-column menu item is suppressed
  for the pinned slot.
- The identifier column **cannot be reordered** off the leading
  position. Column-drag-reorder clamps the second-from-leading
  position as the minimum drop target.
- Width is resizable and persists per `(user, project, table_key)`
  alongside other column widths.

**Required-field interaction (`kind: "field"`).**

If the backing FieldDef carries `required: true`, the insert-row
identifier-clearing rule produces a row that fails the required-field
check on first save. For Pumps `tag` this is fine (the field is
nullable). For any future required identifier field, the feature
must either drop the `required` flag or override
`buildEmptyRow` to seed a value. Documented as a known footgun.

**Schema-mutation guards (`kind: "field"` against a custom field).**

Per D9: no suppression. All header context-menu items (Delete,
Change-type, rename) remain available for the identifier-backing
field. Delete surfaces a confirmation modal listing the identifier
as a dependency (AirTable parity); user can proceed. After
deletion, the identifier column renders an **ERROR state** — a
warning glyph in the header with tooltip "This field has a
configuration error" and cell bodies show `ERROR`. Re-wiring the
identifier through feature config clears the error.

**AirTable-parity: Shift-Enter behavior.**

Per D10, Shift-Enter creates a **truly blank row** — all fields
start at their `FieldDef.default` (or the field-type natural zero).
Full AirTable parity. The previous clone-from-anchor
"duplicate-and-edit" workflow moves to an explicit "Duplicate
record" right-click action that is **out of scope for this plan**
and tracked as a follow-up.

**Duplicate-value warning chip.**

Per D13, identifier cells that share a value with another row in
the same table render a non-blocking warning chip (glyph +
tooltip). Computation is per-render, O(n) over visible rows,
keyed by identifier value. Applies to both kinds.

## P8. Out Of Scope

- **No SQL schema migration.** The relational schema (drafts /
  versions / blob storage) is untouched. The Pydantic
  `model_validator` relaxations in `document.py` are the
  document-model schema change — they ride with the application
  code, no Alembic migration needed.
- **No rename of existing fields.** Pump.tag stays `tag`;
  Room.number stays `number`. The identifier is a UI projection,
  not a new stored field.
- **No user-configurable identifier formulas at runtime.** The
  identifier config is declared in code per feature. A future
  plan could expose this to end users (closer to AirTable's
  formula-field primary), but that is out of scope here.
- **No change to PK generation.** Catalog `rec_…`, Pump `pmp_…`,
  Room `rm_…` continue as today.
- **No "Duplicate record" right-click context menu action in
  Phase B.** The Shift-Enter → true-blank shift removes the
  implicit duplicate workflow; the explicit replacement is
  tracked as a follow-up plan.
- **No catalog uniqueness relaxation in Phase D.** Catalog
  uniqueness drops ride with the catalog rollout (which also
  must update the bookshelf-picker UX and `catalog_origin`
  provenance display to handle duplicate names).
- **No Window Types uniqueness relaxation** (D12 — deferred).
- **No visual treatment of the pinned column beyond what D7
  requires** (no special tint, lock glyph, or "Record-ID" badge
  beyond the header label itself). Defer to UX once the
  structural changes ship.

## P9. Open Questions (resolved or absorbed)

The original Open Questions list has been folded into P10's decision
items below. Two notes carried forward without changes:

- **Non-blocking duplicate warning.** If we drop hard-error
  uniqueness, an in-cell warning chip (warning icon + tooltip "Tag
  also used on row N") could replace the workflow nudge. Tracked as
  a follow-up, not part of this plan's scope.
- **Visual treatment of the pinned column.** Tinted background / lock
  glyph / "ID" badge — defer to UX once the structural decisions in
  P10 are settled.

## P10. Decisions Required Before Implementation

These are the load-bearing decisions that shape the implementation.
Each one has a recommended default in **bold**, with the tradeoff
that pushes the other way.

**D1. Bundling vs. unbundling the two changes.** ✅ **DECIDED:
ship together, Pumps first.** No existing users; app is in early
design, so blast radius is bounded. One Phase B PR removes both the
frontend and Pydantic uniqueness checks for `pump.tag` and lands the
identifier abstraction. Rooms and Window Types follow as separate
phases.

**D2. Catalog uniqueness.** ✅ **DECIDED: drop uniqueness
everywhere, including catalog tables.** Goal is uniform behavior
across every table — identifier is always a label, never a key.
Linked-record references should be wired to catalog `rec_…` PKs
(unique by construction), not to display names. Acknowledged
follow-up: when catalogs come online, the bookshelf-picker UX and
`catalog_origin` provenance display will need to handle duplicate
names (e.g. show row context or disambiguator). Tracked, not blocking
this plan. The catalog-side Pydantic / repository uniqueness
validators come out as part of the catalog rollout — not in Phase B.

**D3. Backend MCP write path.** ✅ **DECIDED: MCP shares the
document-model contract.** No route-layer override; both paths
accept duplicate identifiers once the Pydantic validators are
relaxed.

**D4. `kind: "field"` rendering — replace or supplement.** ✅
**DECIDED: promote-and-replace.** The backing FieldDef's column
moves to the pinned leading slot. One cell per row per field;
inherits its `field_key`, sort/filter/group registry, and
`ViewState.columnWidths` id. No new column id is minted.

**D5. `kind: "computed"` filter/sort/group support.** ✅
**DECIDED: lexical sort only.** The synthetic identifier column
supports header-driven sort on the compute output (string compare,
locale-aware where the rest of the table does so). Filter, group,
and aggregation are **not** wired in v1 — users drive those through
the dep columns.

Implementation note: the synthetic column needs a minimal registry
entry (`field_id = "__record_id__"`, `field_type = "text"`,
`read_only_schema = true`) so the sort pipeline can resolve it
without inventing a new code path. The entry is grid-only — it does
not round-trip through `WriteOp` or the FieldDef document store.

**D6. Identifier header label.** ✅ **DECIDED: always
"Record-ID".** Universal header across every table — Pumps, Rooms,
Fans, ERVs, Thermal Bridges, Materials, Frames, Glazing, etc. The
label disambiguates from the hidden **Database-ID** (`pmp_…` /
`rm_…` / `rec_…`), which is what `getRowId` returns and the user
never sees. No per-feature override.

Naming rationale: features should not assume the user always wants
`tag` (Pumps), `name` (Materials), or `model` (Fans) to be the
identifier — those are conventions, not invariants. "Record-ID"
is generic enough to fit every table without retraining the user
when they move between domains.

**D7. Hide / reorder of the identifier column.** ✅ **DECIDED:
both forbidden.** Hide menu item suppressed on the pinned slot;
column-drag-reorder clamps the second-leading position as the
minimum drop target. Matches AirTable's primary-field constraints.

**D8. Required-field interaction (`kind: "field"`).** ✅
**DECIDED: document as a known footgun.** Default expectation is
`required: false` — true for ~99% of fields. Tables are designed
for **maximum user flexibility**; downstream consumers must handle
nulls gracefully. When a feature does mark an identifier field
`required: true`, the feature owner is responsible for either
dropping the flag or overriding `buildEmptyRow` to seed a value.
DataTable does not enforce.

**D9. Schema-mutation guards (`kind: "field"` against a custom
field).** ✅ **DECIDED: allow all schema mutations — AirTable
parity, let it break gracefully.** No suppression of Delete /
Change-type / rename in the header menu for the identifier-backing
field. When a backing field is deleted (or changed in a way that
breaks the identifier wiring):

- The header context-menu's "Delete field" surfaces a confirmation
  modal listing the dependent identifier as an impacted dependency
  (mirroring AirTable's "Deleting this field will impact N
  dependencies" UX). The user can proceed.
- After deletion (or breaking change), the identifier column
  renders an **ERROR state** in each cell — a warning triangle
  glyph in the header with tooltip "This field has a configuration
  error. The identifier references a field that no longer exists,"
  and cell bodies show `ERROR` (or the warning glyph), matching
  AirTable's broken-formula visual treatment.
- Re-wiring the identifier through the feature's config code clears
  the error state on next mount.

**D10. AirTable-parity gap on Shift-Enter cloning.** ✅ **DECIDED:
Shift-Enter creates a truly blank row.** Full AirTable parity. All
fields (not just the identifier) start at their `FieldDef.default`
(or the field-type natural zero) instead of being cloned from the
anchor.

The clone-from-anchor "duplicate-and-edit" workflow does not go
away — it moves to an **explicit "Duplicate record" command**
exposed through the row-level right-click context menu. The
context-menu action is **deferred to a follow-up plan**; this plan
only flips Shift-Enter to true-blank semantics.

Implementation consequence: the `BuildEmptyRow` consumer signature
keeps `anchorRow` (for the future Duplicate path) but the
`fieldDefaults` map no longer includes anchor values for the
Shift-Enter path. The DataTable populates `fieldDefaults` from
`FieldDef.default` only. Feature `buildEmptyRow` implementations
must be audited to ensure they don't reach into `anchorRow` for
defaults.

**D11. Clipboard / fill / paste over computed identifier cells.**
✅ **DECIDED: drop with toast.** Paste lands the other cells in
the rectangle; computed identifier cells are skipped and a toast
surfaces the count. Fill is a no-op on those cells. Copy from a
computed identifier emits the compute output as TSV.

**D12. Window Types treatment.** ✅ **DECIDED: defer.** Keep the
`window_type.name` validator in place. Window Types' relationship
to the project-document / catalog split is unresolved; assign it in
a follow-up audit.

Note that D2's "drop uniqueness everywhere" intent extends to
Window Types in principle, but the Window Types data path (windows
referencing catalog frame / glazing via `catalog_origin`) deserves
its own pass before relaxing.

**D13. Replacing the duplicate-error UX.** ✅ **DECIDED: build
the warning chip in this plan.** After the hard-error uniqueness
rule drops, the identifier column surfaces a **non-blocking warning
chip** on any cell whose value matches another row in the same
table:

- Visual: a small warning glyph (e.g. ⚠) in the cell's corner or
  trailing inline area, not consuming a tint channel.
- Tooltip: "Also used on row N" — where N is the user-visible
  row position (1-indexed) of the conflicting row. If multiple
  conflicts exist, say "Also used on rows N, M, K (and X more)"
  capped at three explicit row numbers.
- Computation: O(n) pass over the visible rows per table render,
  keyed by the identifier value (or compute output for
  `kind: "computed"`). Empty / null identifiers do not warn.
- Behavior: non-blocking — saving a duplicate is still allowed. The
  chip is purely informational.
- Applies to both `kind: "field"` and `kind: "computed"`.
