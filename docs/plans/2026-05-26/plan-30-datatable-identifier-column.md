---
DATE: 2026-05-26
TIME: 11:48 ET (rev 2026-05-26 — post-review)
STATUS: Draft. Open decisions in P10 must be resolved before
        implementation.
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

Update the row-insert builder so the identifier field is excluded from
the anchor-clone defaults:

- For `kind: "field"`, the new row's `row[field]` is set to `null` (or
  `""` for non-nullable string fields) regardless of the anchor's
  value.
- For `kind: "computed"`, no carve-out is needed — the cell value is
  derived, not stored, so cloning the dependency fields is fine. (Open
  question: do we also want to clear the dependency fields on insert?
  For Rooms, blank `number` + `name` is the right default. See P8.)

This logic lives in DataTable, not per-feature. Features can still
override `buildEmptyRow` for feature-specific defaults, but the
identifier-clearing rule applies before that override runs (and the
override may opt back in by setting the field explicitly).

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
- Wire the pinned-column renderer to read from the identifier config
  when present, falling back to `columns[0]` otherwise.
- Update the row-insert path to clear `row[identifier.field]` for
  `kind: "field"` before invoking any feature-level `buildEmptyRow`.
- For `kind: "computed"`, register the identifier as a synthetic
  read-only column. Recomputation reuses the existing formula-field
  infrastructure where possible (`roomsFormulaRegistry.ts` shows the
  pattern for Rooms; the identifier can declare a `compute` callback
  directly without requiring backend formula support).

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

1. Add `IdentifierConfig<TRow>` type.
2. Add `identifier` prop to `DataTable`, default behavior unchanged
   when omitted.
3. Wire pinned-column rendering.
4. Wire insert-row identifier-clearing for `kind: "field"`.
5. Unit tests in `frontend/src/shared/ui/data-table/__tests__/`
   covering: identifier rendering for both kinds, insert-row clearing,
   recomputation on dep change for `kind: "computed"`.

Phase B — Pumps adopts identifier (fixes the screenshot):

1. Declare `identifier: { kind: "field", field: "tag" }`.
2. Remove `validatePumpsPayload()` tag-uniqueness branch.
3. Audit and update any `tag`-as-join-key sites.
4. Manual smoke via Playwright MCP: Shift-Enter on `P-02`, confirm a
   blank row appears below with empty `tag`, confirm no error banner.
5. Manual smoke: type `P-01` into the new row, confirm save succeeds
   (duplicate allowed).

Phase C — Rooms adopts computed identifier:

1. Declare the computed identifier with `number`+`name`.
2. Verify formula-registry interaction (the existing Rooms formula
   machinery should not conflict — the identifier is a UI concern, not
   a backend formula field).
3. Manual smoke: insert a blank row, confirm pinned column shows blank
   until `number` or `name` is typed, then updates live.

Phase D — Remaining tables (catalog, etc.):

1. Declare identifiers for each table in turn.
2. No required ordering; each table is independent.

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

If the backing field is a user-defined custom field (`cf_*`), the
header context-menu's Delete / Change-type / (rename is fine) items
are suppressed for that field while it is wired as the identifier.
The plan reuses `read_only_schema`-style suppression here rather than
adding a new flag — the identifier-config registration sets a
runtime guard the menu consults. Renaming the display name is still
allowed (the field's `field_key` / `cf_*` id is what the identifier
config references, not the display name).

**AirTable-parity gap (Shift-Enter cloning).**

AirTable's blank-row insert produces an empty row across every
column. PHN's current insert clones all non-identifier fields from
the anchor row. The plan **does not close this gap** — it only
carves out the identifier — and that is intentional because the
clone-from-anchor behavior is load-bearing for several PHN
workflows (e.g. duplicate a Pump's electrical specs and edit only
the tag). Acknowledged as a deliberate divergence from AirTable
parity. If a future plan wants full parity, the per-feature
`buildEmptyRow` is the right knob.

## P8. Out Of Scope

- No DB schema migration. The hidden PKs already exist and are already
  separate from user-typed fields at the data layer.
- No rename of existing fields (Pump.tag stays `tag`; Room.number stays
  `number`). The new identifier column is a UI projection, not a new
  stored field.
- No support for user-configurable identifier formulas at runtime. The
  identifier config is declared in code per feature. A future plan
  could expose this to end users (closer to AirTable formula fields),
  but that is out of scope here.
- No change to the catalog `rec…` PK generation or Pumps `pmp_…` PK
  generation. Those continue as today.

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

**D8. Required-field interaction (`kind: "field"`).** When the
backing field has `required: true`, the cleared identifier on
insert violates required.

- **(a) Document as a known footgun.** Features must drop `required`
  on the identifier field or override `buildEmptyRow` to seed.
- (b) DataTable infers the required-clear conflict and refuses to
  mount the config (loud failure).

**D9. Schema-mutation guards (`kind: "field"` against a custom
field).**

- **(a) Suppress Delete / Change-type for the identifier-backing
  field while wired.** Rename stays allowed (identity is the
  `cf_*` id, not the display name).
- (b) Allow all schema mutations; let the user un-wire the
  identifier first.

**D10. AirTable-parity gap on Shift-Enter cloning.**

- **(a) Acknowledge the divergence; keep current clone-from-anchor
  behavior for non-identifier fields.** Matches PHN's existing
  "duplicate-and-edit" workflow.
- (b) Move toward true blank-row inserts (separate, larger plan).

**D11. Clipboard / fill / paste over computed identifier cells.**

- **(a) Drop with toast on paste; no-op on fill; copy emits compute
  output as TSV.** Mirrors how read-only cells already behave.
- (b) Whole-paste fails preflight if the rectangle covers any
  computed identifier cell.

**D12. Window Types treatment.** ✅ **DECIDED: defer.** Keep the
`window_type.name` validator in place. Window Types' relationship
to the project-document / catalog split is unresolved; assign it in
a follow-up audit.

Note that D2's "drop uniqueness everywhere" intent extends to
Window Types in principle, but the Window Types data path (windows
referencing catalog frame / glazing via `catalog_origin`) deserves
its own pass before relaxing.

**D13. Replacing the duplicate-error UX.** Today the user sees
`"Pump tag already exists in this project."` — a workflow nudge that
catches their own typos. After the rule drops, that nudge disappears.

- **(a) Ship without replacement.** Document as a deliberate
  regression; follow up with the in-cell warning chip from P9 in a
  later plan.
- (b) Build the warning chip as part of this plan.
