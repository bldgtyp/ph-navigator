---
DATE: 2026-05-24
TIME: planning (detailed implementation phasing)
STATUS: Draft. Phase 3 of plan-13 (custom fields). Builds on the
        completed Phase 1 envelope (plan-14) and the completed Phase 2
        schema-editor surface (plan-15: ✅ P2.0–P2.7 shipped; P2.8 exit
        tests + Playwright + a11y pass land alongside or just before
        Phase 3 begins). Phase 3 lights up the two remaining
        non-formula schema-editor capabilities:
        (a) `single_select` custom fields with a full option-list
            lifecycle (US-CF-7) wired through the same
            `single_select_options["<table_path>.<cf_id>"]` namespace
            the core fields already use;
        (b) `changeType` mutation with per-row coercion preflight and
            an explicit "Convert anyway" confirmation that clears
            incompatible cells atomically (US-CF-4).
        Nine sub-phases. Each is a single PR that leaves
        `make typecheck`, `make test`, `make lint`, `make smoke` green.
        Formula fields and fan-out to ERVs / Pumps / Fans / Thermal
        Bridges remain on the Phase 4 / 5 roadmap.
PARENT-PLAN: docs/plans/2026-05-24/plan-13-custom-fields-overview.md
PARENT-STORY: context/user-stories/32-custom-fields.md
              (US-CF-4, US-CF-7; partial top-ups on US-CF-1 menu,
               US-CF-2 add-field popover, US-CF-13 duplicate of
               single_select sources)
RELATED:
  - context/technical-requirements/data-model.md §6.2
    (single_select_options shape) and §6.6.4
    (custom-field option-list namespace)
  - context/technical-requirements/data-table.md
    (Write Pipeline: FieldSchemaMutation, clipboard match-or-create)
  - context/technical-requirements/llm-mcp-schema.md §10.3
    (custom-field schema tools, structured error taxonomy)
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md §3 D1
    (type change destructive-with-preflight), D7 (popover surface),
    D12 (cf_* identity), D15 (typed schema mutations), D16
    (immediate draft validation)
  - docs/plans/2026-05-24/plan-14-custom-fields-phase-1-document-shape.md
  - docs/plans/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
  - docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md
    (P3.0 appends three new error codes alongside the Phase 2 set)
  - backend/features/project_document/custom_fields.py
    (`CustomFieldType`, `coerce_custom_value` — Phase 3 extends both
     for single_select option-id resolution)
  - backend/features/project_document/document.py
    (`single_select_options` envelope, `SingleSelectOption`)
  - backend/features/project_document/schema_mutations.py
    (Phase 3 implements the reserved `ChangeTypeMutation` branch and
     introduces `EditOptionsMutation`)
  - backend/features/project_document/tables/contracts.py
    (`CustomFieldCapability.option_list_namespace_prefix` is the
     namespace seed for `<table_path>.<cf_id>` keys)
  - backend/features/project_document/tables/rooms.py
    (Rooms-side wiring for option-list read/replace helpers)
  - backend/features/project_document/drafts.py
    (`apply_schema_mutation_to_draft` — no signature change; gains
     two new mutation kinds through the discriminated union)
  - backend/features/mcp/server.py
    (Phase 3 adds two MCP write tools: `change_custom_field_type`,
     `edit_custom_field_options`)
  - frontend/src/shared/ui/data-table/lib/customFieldMutations.ts
    (Phase 3 adds `buildChangeTypeMutation`, `buildEditOptionsMutation`)
  - frontend/src/shared/ui/data-table/components/FieldEditorPopover.tsx
    (existing core single-select option editor — Phase 3 migrates it
     onto the typed `editOptions` mutation and reuses it for custom
     single-selects)
  - frontend/src/shared/ui/data-table/components/AddFieldPopover.tsx
    (Phase 3 lights up the `single_select` pill and adds an inline
     option-list editor for new custom single-selects)
  - frontend/src/features/equipment/routes/EquipmentTab.tsx
    (Phase 3 wires `handleChangeFieldType`, `handleEditFieldOptions`,
     and removes the Phase 2 single-select duplicate guard)
BACKWARDS-COMPAT: none required (pre-deployment, CLAUDE.md §16,
                  plan-13 §4.1). `schema_version` stays at 2; Phase 3
                  only adds capability on top of the Phase 1 envelope.
                  The legacy `WriteOp.schemaMutation` `variant:
                  "legacyOptions"` slot used by the core single-select
                  editor since Phase 2 is **retired** in P3.7 — its
                  semantics move into the typed `EditOptionsMutation`
                  surface; no shim chain. The `before` / `after` /
                  `cellWrites` slots on `WriteOp.schemaMutation` are
                  deleted in the same PR.
---

# Plan 16 — Phase 3: type change + custom single-select (Rooms)

## Goal

Editors can:

1. **Add a custom `single_select` field** on Rooms via the existing
   add-field popover. The popover's `single_select` pill is no longer
   disabled; selecting it reveals an inline option-list editor (label
   + color per option). Options are stored under the existing
   `single_select_options["rooms.<cf_id>"]` key (same machinery, same
   lifecycle, and same match-or-create paste semantics as the core
   Floor / Building Zone fields).
2. **Edit a single-select field's options** (add / rename / reorder /
   recolor / delete) through the existing `FieldEditorPopover`, which
   is migrated in this phase from the legacy untyped
   `WriteOp.schemaMutation.variant: "legacyOptions"` path onto a
   typed `EditOptionsMutation`. The same path serves both core and
   custom single-selects.
3. **Change a custom field's type** through a `<ChangeTypePopover>`
   anchored to the header cell. The popover shows the current type,
   a target-type picker, a per-row coercion preflight (up to 25 rows
   shown plus an overflow count), and a primary action that flips
   between **Convert** (preflight clean) and **Convert anyway
   (incompatible values cleared)** behind an acknowledgement
   checkbox. Commit emits one `ChangeTypeMutation` carrying the
   before/after `CustomFieldDef` plus a `cell_writes` list clearing
   every incompatible cell — atomic from the undo, audit, and
   persistence perspectives.
4. **Duplicate a custom `single_select` field** (Phase 2's guard in
   `EquipmentTab.handleDuplicateCustomField` is removed). The
   duplicate deep-copies the option list under a fresh `cf_*` id +
   fresh `opt_*` ids, preserving option labels / colors / order;
   row values are not copied (US-CF-13 criterion 2 stays).

The same backend service path serves the browser and the new MCP
write tools (`change_custom_field_type`, `edit_custom_field_options`).
Formula fields stay deferred to Phase 4; fan-out to other tables
stays deferred to Phase 5.

Exit criteria from plan-13 §5 phase 3 drive the acceptance tests in
P3.8:

- Rooms can host a custom `single_select` with full option lifecycle
  (add / rename / reorder / color / delete) plus the existing
  match-or-create clipboard coercion.
- Any custom field can be retyped to any other compatible type with
  preflight; incompatible values are cleared only behind an explicit
  user acknowledgement.
- Schema mutations remain idempotency-aware, fingerprint-gated,
  immediately validated, and audit-logged.
- The legacy single-select option-editor write surface is gone; both
  core and custom single-select option edits use the typed
  `editOptions` mutation.

## Phase summary

| Phase | Title | Visible change | Risk |
|-------|-------|----------------|------|
| 3.0 | Story promotion + ADR addendum + open-decisions log + scaffold | None | Trivial |
| 3.1 | Backend: `single_select` config + namespace + option-id coercion + Rooms wiring | None (no editor UI yet) | Medium — pins the `<table_path>.<cf_id>` contract for the rest of Phase 3 |
| 3.2 | Backend: typed `EditOptionsMutation` (add / rename / reorder / recolor / delete with cascade clear) + apply service | None | Medium — single mutation kind covers both core and custom single-selects |
| 3.3 | Backend: `ChangeTypeMutation` dispatch + per-row coercion preflight + atomic cell-clear application | None | High — most invasive backend phase; locks the coercion-matrix decisions from P3.0 |
| 3.4 | Backend: REST + MCP write tools for changeType + editOptions; expand structured error taxonomy | New endpoints reachable; no UI driving them yet | Medium |
| 3.5 | Frontend: `useTableSchema` resolves custom single-select options + add-field popover lights up single_select pill | Editors can create a custom single_select field with inline option list | Medium |
| 3.6 | Frontend: `<ChangeTypePopover>` + preflight worker + change-type menu wiring | Editors can change a custom field's type | High — new dialog with destructive-with-acknowledgement flow |
| 3.7 | Frontend: migrate `FieldEditorPopover` (core single-select option editor) onto typed `editOptions`; delete legacy `WriteOp.schemaMutation` `before` / `after` / `cellWrites` slots; remove the Phase 2 duplicate-single-select guard | None visible | Medium — touches every existing core single-select option-edit callsite |
| 3.8 | Exit-criteria acceptance tests + Playwright smoke + focused a11y pass on the change-type and option-editor surfaces | None new — verification only | Low |

Each phase is a PR. Halting between phases leaves Rooms working: the
new mutation kinds are inert until P3.4 exposes them; the add-field
popover's `single_select` pill stays disabled until P3.5; the
change-type dialog only ships in P3.6; the legacy option-editor path
keeps working through P3.7's migration cutover.

## Review amendments — Codex, 2026-05-25

These are the material issues found during review. They are folded
into the phase tasks below; do not treat them as optional polish.

1. **Custom option lists need to become first-class slice state.**
   The current Rooms response / frontend `RoomsSlice` shape only
   exposes the two core option keys (`rooms.floor_level`,
   `rooms.building_zone`). P3.1 / P3.5 must widen the response,
   frontend types, clone/validate helpers, and table-schema synthesis
   to preserve and expose arbitrary `rooms.<cf_id>` option-list keys.
   Otherwise custom `single_select` fields can be created in the
   backend but the browser cannot render, paste, or edit them
   reliably.
2. **Core option edits and custom option edits do not clear values the
   same way.** The P3.2 draft says deleted options clear
   `row.custom[field_id]`, but that only works for custom fields.
   Core fields such as `floor_level` and `building_zone` need
   contract-owned core value accessors, or P3.2 must limit
   `EditOptionsMutation` to custom fields until those accessors exist.
   Since this plan explicitly migrates the core editor in P3.7, P3.2
   should add the accessors now. Required core selects also need their
   own deletion policy: `rooms.floor_level` cannot simply clear to
   `None` because the Room model requires it.
3. **`expected_schema_fingerprint` is not an option-list concurrency
   guard.** The schema fingerprint tracks core/custom field identity
   and type; it intentionally does not include option labels, colors,
   or order. `editOptions` must still ride the whole-draft ETag /
   `If-Match` path, and MCP tools should require or forward the same
   guard. Add tests for two concurrent option edits so the second one
   receives the draft conflict instead of silently overwriting.
4. **Add-field-with-options must be atomic or explicitly recoverable.**
   The P3.5 two-round-trip `AddField` then `EditOptions` flow can leave
   behind a valid-but-empty custom `single_select` column if the second
   request fails. That contradicts the "one semantic gesture / one
   undo / one audit row" discipline from plan-13 D15 for dependent
   option-list changes. Prefer a single mutation shape for adding a
   single-select field with initial options; if the team keeps two
   requests, the plan needs a repair/delete fallback and tests for the
   half-created-field state.
5. **`ChangeTypeMutation.after` must not be an unrestricted field
   rewrite.** Letting clients submit a full `CustomFieldDef` risks
   bypassing rename duplicate checks or mutating `created_at`,
   `created_by`, description, or advisory slug during a type change.
   P3.3 should either narrow the payload to `to_type` + `config`, or
   enforce that all non-type/config metadata matches the current field.
6. **The conversion matrix needs deterministic, loss-aware rules.**
   `long_text -> short_text` truncation is destructive and must use the
   acknowledgement path, not a silent ✅. Text-to-single-select option
   generation must define case-insensitive distinctness, deterministic
   ordering (first row encounter is the most user-legible), and a
   stable cap rule. Number-to-text needs locale-independent formatting
   so Python and TypeScript preflight agree.
7. **Structured error codes cannot come only from the Pydantic
   document validator.** `validate_document(...)` currently wraps
   model-validator failures as `invalid_project_document`. If Phase 3
   wants `custom_field_option_id_unknown` or
   `custom_field_option_list_invalid` at REST / MCP boundaries, those
   checks need to run in the schema-mutation / table-service layer
   before the final whole-document validation, or the tests should
   assert the generic document-validation envelope for raw invalid
   documents.

---

## Phase 3.0 — Story promotion + ADR addendum + open-decisions log + scaffold

**Goal.** Zero-behavior preamble. Promote US-CF-4 and US-CF-7 from
Draft to Phase 3, extend the Phase 2 error-codes ADR with the new
Phase 3 codes, **close the two open type-coercion decisions in
chat before P3.1 starts**, and create empty files so subsequent PRs
only touch behavior.

### Tasks

1. **Promote user stories** in `context/user-stories/32-custom-fields.md`
   from Draft → Phase 3 for US-CF-4 and US-CF-7. Update the summary
   table at the top of the file accordingly. US-CF-2 already lists
   `single_select` as a Phase 3 deferral inside its criteria block;
   flip that note to active. US-CF-13 (duplicate) already names
   `single_select` as deferred to Phase 3 — flip that note to active.
2. **Promote `data-table.md` "Write Pipeline"** so the
   `EditOptionsMutation` and `ChangeTypeMutation` discriminator
   branches are described as active in Phase 3 (the
   `ChangeTypeMutation` shape was reserved in plan-15 P2.1; the
   `EditOptionsMutation` kind is new).
3. **Append to the Phase 2 errors ADR**
   (`docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md`) a
   "Phase 3 codes" section listing:
   - `custom_field_illegal_type_conversion` — HTTP 422,
     `recoverability: fatal`. Raised when the source type cannot be
     converted to the target type at all (e.g. `formula` →
     anything; or when the type pair is on the explicit "not
     supported" matrix from §"Open decisions" below). `details`
     carries `from_type`, `to_type`.
   - `custom_field_coercion_preflight_required` — HTTP 422,
     `recoverability: fatal`. Raised when a `changeType` mutation
     would clear at least one row but the request did not set
     `acknowledge_destructive: true`. `details` carries
     `incompatible_row_count`, `total_row_count`, and the first
     25 `incompatible_rows` (`{row_id, raw_value, reason}`). The
     UI re-renders the preflight from this payload.
   - `custom_field_option_id_unknown` — HTTP 422,
     `recoverability: fatal`. Raised when a row's `custom[cf_id]`
     references an option id that does not exist in the field's
     option list (Phase 3 makes this an explicit validation step;
     Phase 2 left option-id existence implicit).
   - `custom_field_option_list_invalid` — HTTP 422,
     `recoverability: fatal`. Raised when an `EditOptionsMutation`
     payload has duplicate option ids, duplicate (case-insensitive
     trimmed) labels, malformed colors, or non-positive `order`
     values. `details` names the offending entry.

   Add their HTTP status, `recoverability`, `details` keys, and
   user-facing message templates the change-type popover and
   option editor display.

4. **Open decisions to close in chat before P3.1 starts.** These
   are *not* implementation decisions to make during a sub-phase
   PR. Each requires a one-line entry below `## 8. Resolved
   decisions` in plan-13 §3 (D19, D20, D21) and a one-paragraph
   note in this plan's `## Open questions` section once decided.

   - **D19. Source-→-target conversion matrix.** Which type pairs
     are convertible (perhaps with row losses) and which are
     refused outright with `custom_field_illegal_type_conversion`?
     Strawman to seed the discussion:

     | from \\ to | short_text | long_text | number | url | single_select |
     |---|---|---|---|---|---|
     | `short_text` | — | ✅ | ✅ if every value is numeric or empty | ✅ if every value is a valid URL or empty | ⚠ requires policy decision: auto-create-options vs. clear-all (see D20) |
     | `long_text` | ⚠ to `short_text` is lossy if values exceed 4000 chars; requires ack and clears/truncates by D19 policy | — | ✅ if numeric | ✅ if every value is URL | ⚠ same as above |
     | `number` | ✅ (rendered with locale-independent JSON/string formatting) | ✅ (same formatting) | — | ❌ | ❌ |
     | `url` | ✅ | ✅ | ❌ | — | ⚠ same as above |
     | `single_select` | ✅ (label substituted) | ✅ (label) | ❌ | ❌ | — |
     | `formula` | ❌ | ❌ | ❌ | ❌ | ❌ |
     | any → `formula` | ❌ (set formula via dedicated mutation in Phase 4) |

     Every ✅ pair runs `coerce_custom_value` per row; any failure
     becomes a preflight diagnostic. Every ❌ pair raises
     `custom_field_illegal_type_conversion` immediately and the
     popover greys out that target pill with a tooltip explaining
     why.

   - **D20. text → single_select conversion policy.** Two viable
     behaviors:
     - **(a) Auto-create options from distinct row values** —
       mimics AirTable. Each distinct trimmed non-empty source
       value becomes a fresh `opt_*` option (color cycled from
       the palette); empty / whitespace values clear. Pros:
       data-preserving; matches user expectation in the AirTable
       comparison the project is anchored against. Cons: more
       complex coercion path; can produce 100+ options on a
       free-text column; harder to undo.
     - **(b) Clear every row; force the user to enter options
       manually post-conversion** — simpler, more honest. The
       preflight reports "X rows will be cleared" and the user
       acknowledges. Pros: trivial coercion; deterministic
       outcome. Cons: throws away data.

     **Recommendation in chat: (a) with a hard cap (e.g. 50
     distinct options; case-insensitive/trimmed distinctness;
     deterministic first-row-encounter ordering; anything over the
     cap falls to the clear-with-ack diagnostic).** Confirm or
     override in D20.

   - **D21. single_select → text conversion: label or id?**
     When converting `single_select` to `short_text` / `long_text`,
     do the resulting text values carry the option **label** (more
     useful, but the new text loses the connection to the original
     option lifecycle — rename an option later in another version
     and the converted column won't update) or the option **id**
     (preserves identity but reads as gibberish to a human)?

     **Recommendation in chat: label.** The option-list namespace
     is removed at conversion time anyway (since the field is no
     longer single_select), so id-preservation has no benefit.

5. **Backend scaffold** (one-line placeholders so typecheck stays
   green):
   - extend `backend/features/project_document/schema_mutations.py`
     with two stub Pydantic models (`EditOptionsMutation`,
     unchanged `ChangeTypeMutation` placeholder body), discriminator
     entries, and a `# TODO P3.2 / P3.3` body for the dispatcher
     branches — keep the `_raise_unsupported_mutation("changeType")`
     reject path in place until P3.3 implements the real branch.
   - new `backend/features/project_document/options.py` —
     **shared option-list helpers** (read namespaced list, replace
     namespaced list, derive cleared cell writes from a delete,
     uniqueness + color + order validation). Phase 3 P3.1 fills
     this in; Phase 3 P3.2 consumes it; Phase 3 P3.7's frontend
     migration mirrors its semantics.

6. **Frontend scaffold:**
   - `frontend/src/shared/ui/data-table/components/ChangeTypePopover.tsx`
     — placeholder default-export with a `// TODO P3.6` body.
   - `frontend/src/shared/ui/data-table/components/CustomFieldOptionListEditor.tsx`
     — placeholder for the inline option-list editor used inside
     both `AddFieldPopover` (when type = `single_select`) and the
     migrated `FieldEditorPopover` (P3.7). The component is the
     single chokepoint where option lists are rendered for both
     creation and editing.
   - `frontend/src/shared/ui/data-table/lib/coerceCustomFieldType.ts`
     — placeholder for the **shared TypeScript port of
     `coerce_custom_value`**; populated in P3.6 with byte-equal
     parity tests against a shared fixture corpus (precedent: the
     formula corpus discipline in plan-13 §4.4 R2).
   - `frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts`
     — placeholder for the source-→-target convertibility table
     from D19; populated in P3.6.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Diff is doc + empty files only.
- D19 / D20 / D21 closed in chat and recorded in plan-13 §3 +
  this plan's `## Open questions` section before opening the P3.1
  PR.

---

## Phase 3.1 — Backend: `single_select` config + namespace + option-id coercion + Rooms wiring

**Goal.** Make `single_select` a real Phase 3 type at the model
layer. The `CustomFieldDef.config` for a single_select field is
empty (options live in the namespaced `single_select_options` map,
not in `config`); validation enforces that. Every row's
`custom[cf_id]` value for a single_select field must resolve to an
option id that exists in
`single_select_options["<table_path>.<cf_id>"]`. The Rooms
`CustomFieldCapability` exposes the namespaced read / replace
helpers the next phases need. **No editor UI in this phase**; the
dev-seed helper grows a `seed_rooms_custom_single_select(...)`
variant so backend tests can construct populated single-select
columns end-to-end.

### Backend changes

**`backend/features/project_document/options.py`** — new module
(scaffolded in P3.0, populated here):

```python
def option_list_key(table_path: tuple[str, ...], field_id: str) -> str:
    """Build the `<table_path>.<cf_id>` key for the
    `single_select_options` envelope. table_path is the registered
    contract path (e.g. `("rooms",)` or `("equipment", "ervs")`)."""

def read_option_list(
    body: ProjectDocumentV1, key: str,
) -> list[SingleSelectOption]: ...

def replace_option_list(
    body: ProjectDocumentV1, key: str, options: list[SingleSelectOption],
) -> ProjectDocumentV1: ...

def validate_option_list(options: Iterable[SingleSelectOption]) -> None:
    """Reject duplicate ids, duplicate labels (case-insensitive
    trimmed), malformed colors, non-positive `order`s. Raises
    api_error('custom_field_option_list_invalid', ...) — the same
    shape EditOptionsMutation surfaces in P3.2."""

def find_cells_referencing_option(
    rows: Iterable[Mapping], field_id: str, option_id: str,
) -> list[tuple[str, object]]:
    """Return (row_id, raw_value) pairs for every row whose
    `custom[field_id] == option_id`. Used by both the delete-option
    cascade in P3.2 and the change-type preflight in P3.3."""
```

**`backend/features/project_document/custom_fields.py`** —
extend `coerce_custom_value` so the `single_select` branch accepts
an *optional* `option_list` argument:

```python
def coerce_custom_value(
    value: object,
    field_type: CustomFieldType,
    *,
    option_list: list[SingleSelectOption] | None = None,
) -> JsonScalar | None:
    ...
    if field_type is CustomFieldType.single_select:
        if value is None or value == "":
            return None
        if not isinstance(value, str):
            raise ValueError("single_select value must be an option id string")
        if option_list is not None and not any(o.id == value for o in option_list):
            raise ValueError(
                f"single_select value {value!r} is not a known option id"
            )
        return value
```

Phase 1 / 2 callers that pass no `option_list` keep the
already-shipped permissive behavior. Phase 3 callers (whole-document
validation, schema-mutation preflight) pass the resolved list and
benefit from the stricter check.

**`backend/features/project_document/document.py`** —
`validate_document_references` (the existing
`model_validator(mode="after")`) gains a pass that resolves every
single-select custom field's option list and re-runs
`coerce_custom_value` with `option_list=...` for each row's
`custom[cf_id]`. Raw model-validation failures still surface through
`invalid_project_document`; the named
`custom_field_option_id_unknown` code is produced by the
schema-mutation / table-service preflight before final validation.
This closes the gap the exploration tour identified: Phase 2 left
option-id existence implicit for custom single-selects (it had
nothing to validate against because the type wasn't shippable);
Phase 3 makes it explicit.

**`backend/features/project_document/tables/contracts.py`** —
`CustomFieldCapability` gains two thin wrappers:

```python
@dataclass(frozen=True)
class CustomFieldCapability:
    # ... existing fields ...
    read_field_option_list: Callable[
        [ProjectDocumentV1, str],          # field_id
        list[SingleSelectOption],
    ]
    replace_field_option_list: Callable[
        [ProjectDocumentV1, str, list[SingleSelectOption]],
        ProjectDocumentV1,
    ]
```

Both delegate to `options.read_option_list` / `replace_option_list`
with the table contract's `table_path` baked in. Wrappers exist so
future tables (ERVs / Pumps / Fans) get the right namespace for
free, without exporting `table_path` through the schema-mutation
service layer.

**`backend/features/project_document/tables/rooms.py`:**

- Wire `read_field_option_list` / `replace_field_option_list` onto
  `rooms_custom_fields` using the `table_path = ("rooms",)` already
  registered on the Rooms contract.
- Widen `RoomsSliceResponse.single_select_options` from the current
  core-only `dict[RoomOptionKey, ...]` shape to a string-keyed map
  that includes all `rooms.<cf_id>` custom option lists for Rooms.
  Keep the two core keys present for existing code, but do not filter
  the response down to `ROOM_OPTION_KEYS`.
- Preserve arbitrary existing `rooms.<cf_id>` entries in
  `apply_rooms_replace` and `extract_rooms_diff_value`; replace-table
  payloads may stay core-only until P3.7 retires the legacy option
  editor, but response / diff / MCP read surfaces must not hide custom
  option lists once P3.1 lands.
- Extend `_dev_seed.py` with
  `seed_rooms_custom_single_select(body, *, display_name, options,
  ...)`. Pre-creates the field + its option-list entry under
  `single_select_options["rooms.<cf_id>"]`. Used only by tests
  and dev shells (D11; the same "TEST/DEV ONLY" guard as the
  existing helper).

### New tests

`backend/tests/test_project_document_custom_fields_phase_3.py`
(new file; mirrors the Phase 1 / Phase 2 naming):

- `test_custom_single_select_round_trip` — seed a field with two
  options; set `room.custom[cf_id]` to each option id; GET the
  Rooms slice; assert values survive.
- `test_custom_single_select_rejects_unknown_option_id` —
  set `room.custom[cf_id] = "opt_does_not_exist"`; assert 422
  `custom_field_option_id_unknown` when the write enters through the
  schema/table service layer. Raw whole-document validation may still
  surface `invalid_project_document`; do not rely on the Pydantic
  model validator alone for the structured code.
- `test_custom_single_select_rejects_when_option_list_missing` —
  field with `field_type = single_select` but
  `single_select_options["rooms.<cf_id>"]` absent → validation
  rejects (treated as empty list; any non-null row value fails).
- `test_option_list_namespace_isolation` — two custom single_select
  fields on Rooms get fully independent option lists; deleting an
  option in one does not affect the other; option-id collisions
  across the two fields are allowed (option ids are namespaced by
  field).
- `test_rooms_response_includes_custom_option_list_keys` — a seeded
  `rooms.<cf_id>` option list is present in the Rooms slice response,
  table download / MCP read envelope, and diff extraction.
- `test_coerce_custom_value_with_option_list_argument` — unit test
  the new `coerce_custom_value(..., option_list=...)` branch
  (accept known id; reject unknown id; empty / None → None).
- `test_validate_option_list_rejects_duplicates_and_bad_colors` —
  unit test `options.validate_option_list` for every reject path.

### Acceptance

- `make typecheck`, `make test`, `make lint`, `make smoke` green.
- No HTTP / MCP surface change yet — all tests are direct service
  / model calls or the existing slice round-trip with seeded data.
- No frontend change in this PR.

---

## Phase 3.2 — Backend: typed `EditOptionsMutation` + apply service

**Goal.** Land the typed `EditOptionsMutation` and its dispatch in
`apply_schema_mutation`. One mutation covers add / rename / reorder
/ recolor / delete in a single semantic gesture (matches the existing
"Save options" UX gesture of `FieldEditorPopover`; D15 — one
gesture, one mutation, one audit row). Delete cascades atomically:
every row that referenced the deleted option is updated in the same
apply call, with the cleared/replaced-row count returned in the audit
payload. Custom fields clear `custom[cf_id]`; core fields use
contract-owned accessors and required-core-field policy.

This phase covers **both core and custom single-selects** under one
typed surface. The legacy Phase 2 single-select option editor
keeps working through its existing untyped path until P3.7 cuts
over; that migration is intentionally a separate PR so the typed
mutation is in service for at least one P3.4 deployment before
existing callsites move onto it.

Review constraint: because this mutation edits option-list state, the
draft ETag remains the real concurrency guard. The schema fingerprint
still prevents applying an option edit to the wrong table schema, but
it does not include option labels/colors/order and must not be treated
as sufficient conflict protection by REST, MCP, or frontend callers.

### Backend changes

**`backend/features/project_document/schema_mutations.py`** — add
the typed mutation:

```python
class EditOptionsMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG
    kind: Literal["editOptions"]
    table_key: str
    field_id: str                          # cf_* for custom; core key for core
    next_options: list[SingleSelectOption]
    expected_schema_fingerprint: str
```

The mutation does **not** carry `cell_writes` — the server derives
them by diffing `next_options` against the current option list and
running `find_cells_referencing_option` for every deleted option.
This keeps the wire shape compact and the apply path authoritative
(the client cannot accidentally over-clear by handcrafting
`cell_writes`).

Add to the discriminator union:

```python
FieldSchemaMutation = Annotated[
    AddFieldMutation | RenameFieldMutation | DeleteFieldMutation
    | DuplicateFieldMutation | SetDescriptionMutation
    | EditOptionsMutation                          # P3.2
    | ChangeTypeMutation                           # P3.3 (real branch)
    | SetFormulaMutation,                          # still reserved for P4
    Field(discriminator="kind"),
]
```

Extend `AUDIT_KIND_BY_MUTATION`:

```python
AUDIT_KIND_BY_MUTATION["editOptions"] = "project_version_custom_field_edit_options"
AUDIT_KIND_BY_MUTATION["changeType"]  = "project_version_custom_field_change_type"
```

**`apply_schema_mutation` dispatch** for `EditOptionsMutation`:

1. Resolve the contract via `get_table_contract(table_key)`.
2. Field id may be a **core** single-select field key (e.g.
   `floor_level`) or a **custom** `cf_*` id. Use:
   - `core_field_keys` membership → core branch, namespace key is
     the existing `ROOM_FLOOR_LEVEL_OPTION_KEY` / etc. lookup table
     (a small `core_option_list_key_by_field_id` map on the
     contract, populated for Rooms in this PR).
   - else custom → resolve via
     `contract.custom_fields.read_field_option_list(...)`.
   For Phase 3 only Rooms ships, so the core map covers
   `floor_level` and `building_zone`; ERVs / Pumps / Fans pick it
   up in Phase 5 by extending their own contracts.
   The same contract also needs core single-select row accessors:
   `read_core_option_value(row, field_id)` and
   `set_core_option_value(row, field_id, value)`. Deleted core
   options clear `room.floor_level` / `room.building_zone`, not
   `row.custom[field_id]`. For required core fields such as
   `rooms.floor_level`, the mutation must either require a replacement
   option id per deleted referenced option or reject the delete with a
   structured validation error; clearing to `None` would create an
   invalid Room.
3. Validate `next_options` via `options.validate_option_list(...)`
   → `custom_field_option_list_invalid` on failure.
4. Diff `next_options` against `current_options`:
   - **Added** ids (in `next` not in `current`) → fine.
   - **Renamed / recolored / reordered** (id present in both) →
     fine; row values reference option ids, so label / color /
     order changes don't touch row data (US-CF-7 criterion 4).
   - **Deleted** ids (in `current` not in `next`) → derive cell
     writes via `find_cells_referencing_option` for every deleted
     id. Custom fields clear `row.custom[field_id]`; core fields
     clear through the core row accessors above.
5. Replace the option list via the appropriate helper (core
   namespace map or `replace_field_option_list`).
6. Re-run `validate_document` (immediate validation, save-versioning
   §8.3).
7. Return `(next_body, {"deleted_option_ids": [...],
   "cleared_row_count": N})`.

**Per-mutation rules (P3.2 specific):**

- Empty `next_options` is allowed for custom single-select fields and
  nullable core selects (clears every row's value). Required core
  selects are the exception: either the mutation supplies replacements
  for referenced deleted options or the server rejects the edit before
  validation.
- Reordering is reflected by the `order` field on
  `SingleSelectOption`. The mutation must preserve every existing
  id's `order` exactly as supplied by the client; the server does
  not re-normalize order values.
- Recoloring is supported — `color` is per-option metadata only;
  no row impact.
- Field-not-found (the `field_id` resolves to neither a core
  single-select nor a custom single-select) → existing
  `custom_field_invalid_field_id`.
- Field-type-not-single-select (e.g. attempting to edit options on
  a `short_text` custom field) → `custom_field_invalid_field_id`
  with a `details.reason: "field_type_not_single_select"`.

### New tests

`backend/tests/test_project_document_schema_mutations.py` — extend:

- `test_edit_options_adds_renames_recolors_reorders_no_row_impact`
  — apply a mutation that does all four; assert no row's
  `custom[cf_id]` changed; assert `cleared_row_count == 0`.
- `test_edit_options_delete_cascades_to_row_clears` — seed three
  rows referencing an option to be deleted; assert the rows'
  `custom[cf_id]` is `None` after apply; assert
  `cleared_row_count == 3`.
- `test_edit_options_rejects_duplicate_labels`,
  `test_edit_options_rejects_malformed_color`,
  `test_edit_options_rejects_duplicate_ids` — three reject branches.
- `test_edit_options_rejects_field_with_wrong_type` — set a
  `short_text` custom field; attempt `editOptions` → reject.
- `test_edit_options_rejects_stale_fingerprint` — standard
  optimistic-concurrency check.
- `test_edit_options_works_for_core_single_select` — apply to
  `rooms.floor_level`; assert option label rename round-trips and
  no row impact for renames.
- `test_edit_options_delete_cascades_for_nullable_core_single_select`
  — delete a referenced `rooms.building_zone` option and assert
  affected rows have `building_zone = None` through the core accessor,
  not a stray `custom.building_zone` key.
- `test_edit_options_rejects_required_core_select_delete_without_replacement`
  — deleting a referenced `rooms.floor_level` option does not clear
  to `None`; it either requires explicit replacements or rejects with
  the agreed structured error.
- `test_edit_options_concurrent_option_edits_conflict_on_draft_etag`
  — two requests with the same schema fingerprint but stale
  `If-Match` / draft ETag do not silently overwrite each other.
- `test_edit_options_emits_correct_audit_payload` — assert
  `deleted_option_ids` and `cleared_row_count` keys.

### Acceptance

- All previous tests still pass.
- New tests pass.
- `make typecheck`, `make test`, `make lint` green.

---

## Phase 3.3 — Backend: `ChangeTypeMutation` dispatch + coercion preflight + atomic cell clears

**Goal.** Implement the reserved `ChangeTypeMutation` branch.
Per-row preflight runs the target-type coercion against every row's
current `custom[cf_id]`. Compatible values are preserved; incompatible
values are cleared. The client must declare
`acknowledge_destructive: true` in the request to commit a mutation
that clears any cells; otherwise the server returns a structured
`custom_field_coercion_preflight_required` error carrying the full
preflight payload (so the popover renders the same diagnostics the
backend computed; the client-side preflight is an optimization for
UX, but the server is authoritative).

This phase locks the conversion-matrix decisions from P3.0 D19 /
D20 / D21.

### Backend changes

**`backend/features/project_document/schema_mutations.py`** —
populate the real `ChangeTypeMutation` branch (replace the existing
`_raise_unsupported_mutation("changeType")` line). Update the
Pydantic shape from the placeholder to:

```python
class ChangeTypeMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG
    kind: Literal["changeType"]
    table_key: str
    field_id: str
    after: CustomFieldDef                      # must preserve `id`, change `field_type` + `config`
    acknowledge_destructive: bool = False
    expected_schema_fingerprint: str
```

Note: the placeholder `cell_writes: list[dict[str, object]]` field
in the Phase 2 stub is **removed** — the server derives clears,
the client never supplies them. (Removing the slot is a wire-shape
break, but Phase 2 never accepted the mutation, so no caller exists.)

Review constraint: the `after` object is accepted only as a typed
convenience, not as a general field rewrite. The server must enforce
that `after.id`, `display_name`, `field_key`, `description`,
`created_at`, and `created_by` match the current field exactly unless
a later plan explicitly broadens this mutation. Only `field_type` and
the target type's `config` may change. An equivalent narrower payload
(`to_type` + `config`) is also acceptable and safer.

**Dispatch path:**

1. Look up the current `CustomFieldDef` by `field_id`; reject if
   absent (`custom_field_invalid_field_id`).
2. Reject if `after.id != field_id` (identity must be preserved —
   D12).
3. Reject if `after.field_type == before.field_type` (no-op
   mutation; should be a `setDescription` or option-list edit
   instead).
4. Consult the convertibility matrix from D19; reject pairs marked
   `❌` with `custom_field_illegal_type_conversion`.
5. For text → `single_select` (D20 policy), apply the auto-create
   policy: enumerate distinct trimmed non-empty source values,
   casefold for distinctness using the same `normalize_display_name`
   rule as option-label validation, and preserve deterministic
   first-row-encounter order for option creation. Create one fresh
   `opt_*` option per distinct value (color cycled from
   `OPTION_COLOR_PALETTE`), capped at 50 distinct options. Any row
   whose normalized value first appears after the cap becomes a
   coercion failure (it will be cleared with acknowledgement).
   Materialize the generated
   `single_select_options["<table_path>.<cf_id>"]` entry as part of
   the apply.
6. For `single_select` → text (D21 policy), substitute the option
   **label** for the option id at apply time. Removal of the
   field's option-list entry from `single_select_options` happens
   as part of the apply (the namespace key becomes stale once the
   field is no longer single_select).
7. Run **per-row preflight**: iterate every row's
   `custom[field_id]`; call `coerce_custom_value(value,
   after.field_type, option_list=...)`. Collect:
   - `compatible_writes: list[(row_id, coerced_value)]`
   - `incompatible: list[{row_id, raw_value, reason}]`
8. If `incompatible` is non-empty **and** `acknowledge_destructive`
   is `False`, raise `custom_field_coercion_preflight_required`
   with `details = {incompatible_row_count: N, total_row_count: M,
   incompatible_rows: incompatible[:25]}`. The popover renders
   this payload (P3.6 reads the same shape from the typed error).
9. Otherwise, apply:
   - replace the `CustomFieldDef` entry (id preserved; position
     preserved);
   - write `coerced_value` into every row's `custom[field_id]`
     from `compatible_writes`;
   - set `custom[field_id] = None` for every row in `incompatible`;
   - if the new type creates / removes option-list entries (D20 /
     D21 cases), update the namespaced `single_select_options`
     accordingly.
10. Re-run `validate_document`.
11. Return `(next_body, audit_payload)` where `audit_payload`
    carries `from_type`, `to_type`, `compatible_row_count`,
    `cleared_row_count`, and (when D20 fires) `created_option_count`.

Type-specific notes:

- `long_text -> short_text` values over the short-text maximum are
  destructive. The D19 resolution must choose "truncate with ack" or
  "clear with ack"; the implementation must not silently truncate.
- `number -> short_text` / `long_text` uses locale-independent string
  formatting shared by the Python and TypeScript coercion corpus.
- `url` validation must name the parser / accepted schemes once in
  D19 so browser preflight and backend validation do not diverge.

**Convertibility matrix table** lives in
`backend/features/project_document/custom_fields.py` as a constant
`CONVERSION_MATRIX: dict[tuple[CustomFieldType, CustomFieldType],
ConversionPolicy]` so the frontend's TS port in P3.6 mirrors a
single source of truth (frontend regenerates it from a small JSON
fixture committed alongside the constant).

### New tests

`backend/tests/test_project_document_schema_mutations.py` — extend:

- `test_change_type_text_to_number_preflight_clean` — every row's
  value parses as a number; mutation commits without
  acknowledgement; rows carry coerced numeric values.
- `test_change_type_text_to_number_requires_acknowledgement_on_failure`
  — one row holds `"abc"`; preflight returns
  `custom_field_coercion_preflight_required` with the row's id in
  `details.incompatible_rows`; second call with
  `acknowledge_destructive: true` succeeds, clears that row, keeps
  the others.
- `test_change_type_short_text_to_url_validates_url` — distinct
  preflight outcomes for `"https://example.com"` (kept) vs
  `"not a url"` (cleared with ack).
- `test_change_type_text_to_single_select_auto_creates_options`
  (D20 policy) — three distinct values + one empty; resulting
  option list has three options with cycled colors; rows reference
  the new ids; empty row stays `None`.
- `test_change_type_text_to_single_select_caps_at_50_options` —
  60 distinct values; first 50 become options; remaining 10 rows
  are coercion failures requiring ack.
- `test_change_type_single_select_to_text_substitutes_label` (D21)
  — every row's stored option id is replaced by the option label;
  `single_select_options["rooms.<cf_id>"]` is removed.
- `test_change_type_rejects_no_op_same_type`.
- `test_change_type_rejects_id_change`.
- `test_change_type_rejects_metadata_rewrite` — changing type cannot
  also rename the field, rewrite `created_by`, or mutate advisory
  slug / description fields.
- `test_change_type_long_text_to_short_text_requires_ack_for_truncation`
  — covers the D19 lossy short-text policy once resolved.
- `test_change_type_rejects_illegal_pair_number_to_url`.
- `test_change_type_rejects_any_to_formula`,
  `test_change_type_rejects_formula_to_anything`.
- `test_change_type_preserves_position_and_view_state_id` —
  before/after, the field is at the same position in `custom_fields`
  and its `cf_*` id is unchanged.
- `test_change_type_emits_correct_audit_payload`.

### Acceptance

- All previous tests still pass.
- New tests pass.
- `make typecheck`, `make test`, `make lint` green.

---

## Phase 3.4 — Backend: REST + MCP write tools for changeType + editOptions

**Goal.** Expose P3.2 and P3.3 through the existing draft-write
pipeline. The REST endpoint `POST .../custom-fields:mutate` already
accepts the discriminated `FieldSchemaMutation` union; the new
mutation kinds slot in automatically (Pydantic's discriminator
handles dispatch). Add two MCP write tools mirroring the Phase 2
five (`change_custom_field_type`, `edit_custom_field_options`).
Map the new error codes through the existing `recoverability`
table.

### Backend changes

**`backend/features/project_document/routes.py`** — no signature
change. The new mutations ride through the same endpoint Phase 2
shipped. Add endpoint-level test cases for the new error codes
(see "New tests" below).

**`backend/features/project_document/drafts.py`** — no signature
change. `apply_schema_mutation_to_draft` already returns
`(BaseModel, dict[str, object])` and the new mutation kinds emit
their own `audit_payload` shapes. The audit-log writer reads
`AUDIT_KIND_BY_MUTATION[kind]` via the existing helper.

**`backend/features/mcp/server.py`** — two new tools:

```python
@mcp.tool()
def change_custom_field_type(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    after: dict[str, object],                  # CustomFieldDef dict
    expected_schema_fingerprint: str,
    ctx: Context,
    acknowledge_destructive: bool = False,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    """Change a custom field's type. If the conversion would clear
    cells and `acknowledge_destructive` is False, returns a
    structured preflight error the caller can re-issue with
    acknowledgement after surfacing the diagnostics to its user."""
```

```python
@mcp.tool()
def edit_custom_field_options(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,                             # cf_* or core single-select key
    next_options: list[dict[str, object]],
    expected_schema_fingerprint: str,
    ctx: Context,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    """Add / rename / reorder / recolor / delete single-select
    options. Deletes cascade to row clears; the response carries
    `cleared_row_count`."""
```

Both delegate to the same `_apply_mcp_schema_mutation_with_audit`
helper Phase 2 introduced (and tag `updated_via='mcp'`). Both pass
through the editor MCP token scope check the Phase 2 helper
already enforces. Because option-list edits are not protected by the
schema fingerprint alone, the MCP helper must forward `if_match` /
`if_match_version` into the same draft ETag guard used by browser
writes; if an MCP caller omits both, the helper must either resolve
the current ETag immediately before applying or reject with the
existing stale-write error rather than doing an unguarded overwrite.
Extend the recoverability map:

```python
_SCHEMA_MUTATION_RECOVERABILITY.update({
    "custom_field_illegal_type_conversion": "fatal",
    "custom_field_coercion_preflight_required": "fatal",
    "custom_field_option_id_unknown": "fatal",
    "custom_field_option_list_invalid": "fatal",
})
```

The preflight-required code is `"fatal"` (not `"refresh"`)
because retrying without `acknowledge_destructive: true` won't
help — the caller must show the diagnostics to its user and
re-issue with the ack flag. The error envelope's `details` payload
gives the caller everything it needs without a re-fetch.

### New tests

`backend/tests/test_project_document_schema_mutation_endpoint.py`
— extend:

- `test_post_change_type_returns_422_preflight_required` — POST a
  `changeType` mutation without `acknowledge_destructive`; assert
  422 + `custom_field_coercion_preflight_required` + the full
  `details.incompatible_rows` payload.
- `test_post_change_type_succeeds_with_acknowledge_destructive` —
  resend with the ack; assert 200 + updated envelope.
- `test_post_change_type_illegal_conversion_pair_returns_422`.
- `test_post_edit_options_round_trip` — happy path including option
  add + rename + delete cascade.
- `test_post_edit_options_emits_audit_log` — kind
  `project_version_custom_field_edit_options`,
  `details.cleared_row_count` present.
- `test_post_change_type_emits_audit_log` — kind
  `project_version_custom_field_change_type`.

`backend/tests/test_mcp_custom_fields.py` — extend the existing
combined Phase 2 test (or add a second combined test that builds
its own fresh `build_mcp_server()` instance — see plan-15 P2.3
notes on FastMCP test isolation):

- `test_mcp_change_custom_field_type_round_trip`,
- `test_mcp_change_custom_field_type_preflight_required` →
  `recoverability: fatal` + populated details,
- `test_mcp_edit_custom_field_options_round_trip` with delete
  cascade,
- `test_mcp_change_custom_field_type_rejects_illegal_pair`,
- `test_mcp_change_custom_field_type_emits_audit_with_updated_via_mcp`.

### Security review checkpoint

Same routine as P2.3. Confirm the new tools share the
`project:write` scope gate and project-scoped binding. Append a
one-paragraph note to the Phase 2 ADR's security-checkpoint
section recording any findings (or "no blocking findings").

### Acceptance

- All MCP / endpoint tests green.
- `make typecheck`, `make test`, `make lint`, `make smoke` green.
- Security checkpoint paragraph appended.

---

## Phase 3.5 — Frontend: `useTableSchema` resolves custom single-select options + add-field popover lights up `single_select` pill

**Goal.** Editors can create a new custom `single_select` field
from the existing add-field popover. The `single_select` pill is
no longer disabled; selecting it reveals
`<CustomFieldOptionListEditor>` inline (the scaffold from P3.0).
At least one option must be defined before Submit enables (matches
the AirTable UX). On commit, the popover creates the field and its
initial option list as one atomic semantic gesture. Preferred
implementation: extend `AddFieldMutation` with an optional
`initial_options` payload that is legal only when `after.field_type ==
"single_select"`, and have the backend write the namespaced option
list in the same apply/audit/undo step. A dedicated
`addSingleSelectField` discriminator is also acceptable. Do not ship a
bare two-POST path unless this plan is amended with a repair/delete
fallback and tests for the half-created-field state.

`useTableSchema` synthesizes the `FieldDef.options` for custom
single-select columns by reading
`roomsSlice.single_select_options["rooms.<cf_id>"]`. After this PR
the DataTable-level match-or-create coercion can recognize custom
single-select labels because `optionsForField()` reads from
`fieldDef.options`; the Rooms commit path still must persist those
new `cf_*` option ids and option-list additions as called out below
(US-CF-7 criterion 3).

### Frontend changes

**`frontend/src/shared/ui/data-table/hooks/useTableSchema.ts`** —
extend the synthesis path so a `CustomFieldDef.field_type ==
"single_select"` becomes a `FieldDef` with:

- `field_type: "single_select"`,
- `options: roomsSlice.single_select_options[\`rooms.${cf_id}\`] ?? []`,
- the same `read_only_schema: false` and `cf_*` `field_key`
  Phase 2 already sets.

The hook signature gains a `singleSelectOptions: Record<string,
SingleSelectOption[]>` arg (passed from the table envelope) so the
hook stays pure (no slice import).

`EquipmentTab` must then pass `roomsTableSchema.fieldDefs` (or an
equivalent merged field-def list) to view-state sanitization and
RoomsTable rendering. Do not keep a core-only `roomsTableFieldDefs`
source for the sanitizer after custom option-bearing fields exist;
otherwise hidden/order/filter state for custom columns can be stripped
or computed against stale options.

**`frontend/src/shared/ui/data-table/components/CustomFieldOptionListEditor.tsx`**
— real component (P3.0 placeholder replaced). Renders a list of
`<input>` rows for labels with a 6-swatch color picker per row
(reuses `OPTION_COLOR_PALETTE`), a drag-to-reorder affordance
(reuse the row-reorder primitive from
`HideFieldsPanel.tsx` if shape-compatible; otherwise a small
Up / Down button pair — `react-dnd` is intentionally not
introduced for one component), and an "Add option" button.

API:

```tsx
export type CustomFieldOptionListEditorProps = {
  options: SingleSelectOption[];
  onChange: (next: SingleSelectOption[]) => void;
  mintOptionId: () => string;                  // `opt_<ulid>`
  minOptionCount?: number;                     // default 1; AddFieldPopover sets to 1
  disabled?: boolean;
};
```

The component is **controlled** — it never holds option state
internally; the parent (`AddFieldPopover` in P3.5,
`FieldEditorPopover` in P3.7) owns the array and commits via its
own dispatcher.

**`frontend/src/shared/ui/data-table/components/AddFieldPopover.tsx`:**

- The `single_select` pill loses its `disabled` + planned-phase
  tooltip; selecting it expands the option editor (the four other
  pills hide the editor).
- The Submit button stays disabled while the option list is empty
  and surfaces an inline message ("Add at least one option").
- On submit for `single_select`:
  - Mint the `cf_*` id via `mintCustomFieldId()`.
  - Build an `AddFieldMutation` whose `after.field_type =
    "single_select"`, `after.config = {}`, and the initial option
    list in the agreed atomic payload (`initial_options` or a
    dedicated `addSingleSelectField` mutation).
  - Dispatch one schema mutation. The server writes the custom-field
    entry plus `single_select_options["rooms.<cf_id>"]` together,
    re-runs validation once, and returns one audit payload. The
    popover closes only after the refreshed slice includes both the
    field and its options.

**`frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`:**

- Add `buildEditOptionsMutation({tableKey, fieldId, nextOptions,
  schemaFingerprint})`. Validates non-empty labels, deduplicates by
  trimmed-lowercase label, validates color shape. Throws
  `SchemaMutationBuildError` on preflight failure.
- Add `mintOptionId()` (`opt_<ulid>`) re-exported from the same
  module the `mintCustomFieldId` lives in for consistency.

**`frontend/src/features/equipment/routes/EquipmentTab.tsx`:**

- `handleAddCustomField` grows the atomic branch for
  `single_select`: dispatch the agreed initial-options mutation in
  one request. If implementation temporarily chooses the two-request
  fallback, this handler must delete or repair the field when the
  option-list write fails, and the fallback must have tests before
  shipping.
- Add `handleEditFieldOptions(fieldId, nextOptions)` that builds
  the typed mutation and dispatches via the existing
  `commitSchemaMutation`. P3.7 wires this into the migrated
  `FieldEditorPopover`; in P3.5 it's only exposed via the
  add-field follow-up.
- Extend the Rooms write payload path for custom field cell writes:
  `applyWriteToRoom` must route `cf_*` keys through
  `setCustomValue`, and `roomsPayloadFromCellWrites` must merge
  `newOptions[cf_id]` into
  `single_select_options["rooms.<cf_id>"]`. The current core-only
  `isRoomOptionKey(...)` filter is not enough for custom
  single-select match-or-create paste.

### New tests

- `useTableSchema.test.ts` — extend: a custom `single_select`
  field paired with a non-empty namespaced option list produces a
  `FieldDef` with the right `options` array.
- `CustomFieldOptionListEditor.test.tsx` — controlled add /
  remove / rename / color / reorder; min-option-count enforced;
  disabled state is fully read-only.
- `AddFieldPopover.test.tsx` — extend: selecting `single_select`
  pill reveals the option editor; Submit is disabled with zero
  options; Submit dispatches the agreed atomic add-with-options
  mutation; popover stays open on failure.
- `customFieldMutations.test.ts` — extend with builder tests for
  `buildEditOptionsMutation`.
- `RoomsTable.addField.test.tsx` — happy-path add a `single_select`
  with two options; assert one atomic schema-mutation POST (or, if
  the documented fallback is chosen, assert the recovery behavior);
  assert the new column appears in the grid with the options the
  user defined.
- `RoomsTable.customSingleSelectPaste.test.tsx` — paste an
  unrecognized label into a custom single-select; assert the row's
  `custom[cf_id]` stores the new option id and
  `single_select_options["rooms.<cf_id>"]` includes the created
  option.

### Acceptance

- Vitest, typecheck, lint green.
- Manual Playwright MCP smoke: open Rooms (editor), click `+`, pick
  `single_select`, add a name + two options, submit; confirm the
  new column renders the option pills and the cell editor offers
  the two options. Paste an unrecognised label; confirm
  match-or-create creates a third option. Save.

---

## Phase 3.6 — Frontend: `<ChangeTypePopover>` + preflight worker + change-type menu wiring

**Goal.** Editors can change a custom field's type. The header
context menu's custom-field branch gains a `Change type` item
(custom fields only; US-CF-6 keeps it absent on core fields).
Clicking opens `<ChangeTypePopover>` anchored to the header cell.

The popover shows the source type, a target-type picker with
disabled-with-tooltip pills for illegal pairs (per the D19 matrix
shipped as the new TS `typeConversionMatrix.ts` constant), and a
live preflight panel computed in the browser via the TS port of
`coerce_custom_value`. The preflight UI is **advisory** —
authoritative preflight runs server-side on submit, and a
`custom_field_coercion_preflight_required` error rendered into
the popover panel re-uses the same component (the server's payload
is the source of truth on commit).

### Frontend changes

**`frontend/src/shared/ui/data-table/lib/coerceCustomFieldType.ts`**
— TS implementation of `coerce_custom_value` matching the backend
byte for byte:

```ts
export type CoerceResult =
  | { ok: true; value: JsonScalar | null }
  | { ok: false; reason: string };

export function coerceCustomValue(
  rawValue: unknown,
  toType: CustomFieldType,
  args?: { optionList?: SingleSelectOption[] },
): CoerceResult;
```

Pin parity via a shared fixture JSON under
`backend/tests/fixtures/custom_field_coercion_corpus.json`. Both
Vitest and pytest run the corpus and assert byte-equal outputs.
(Precedent: the formula corpus discipline plan-13 §4.4 R2
mandates for Phase 4 — Phase 3 sets up the same harness on the
smaller coercion surface, so Phase 4's formula corpus can reuse it.)

**`frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts`**
— TS port of the D19 matrix:

```ts
export type ConversionPolicy =
  | "identity"                          // same type → not allowed
  | "lossless"                          // every value coerces
  | "lossy"                             // some values may clear
  | "create_options"                    // text → single_select (D20)
  | "substitute_labels"                 // single_select → text (D21)
  | "forbidden";                        // ❌ — pill disabled with tooltip

export const CONVERSION_MATRIX: Record<
  CustomFieldType,
  Partial<Record<CustomFieldType, ConversionPolicy>>
>;
```

Pin parity with the backend constant via a small JSON fixture
imported on both sides.

**`frontend/src/shared/ui/data-table/components/ChangeTypePopover.tsx`**
— real component:

```tsx
export type ChangeTypePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  fieldDef: FieldDef;                         // current type lives here
  rows: ReadonlyArray<{ id: string; custom: Record<string, unknown> }>;
  optionListByField: Record<string, SingleSelectOption[]>;
  schemaFingerprint: string;
  tableKey: string;
  dispatchWrite: (op: WriteOp) => Promise<void>;
};
```

Surface:

1. **From → To** header (`Number → URL`).
2. **Target picker** — five pills (Phase 3 ships
   `short_text` / `long_text` / `number` / `url` / `single_select`;
   `formula` is disabled-with-tooltip pointing at Phase 4). The
   current type's pill is hidden. Forbidden targets (per the matrix)
   are disabled with a tooltip explaining the policy
   ("Number columns can't convert to URL — values won't parse as
   URLs").
3. **Preflight panel** — live, computed on every target change:
   - Total row count.
   - Compatible row count.
   - Incompatible row count, with the first 25 rows in a scrollable
     list (`row id · raw value · reason`) and an overflow indicator.
   - For text → `single_select` (D20): preview of the
     auto-created option list (up to 50 entries; rows that exceed
     the cap are marked as cleared).
4. **Acknowledgement** — when incompatible count > 0 (or text →
   single_select cap overflows), a checkbox "I understand the
   listed values will be cleared" gates the primary action. Default
   unchecked.
5. **Primary action** — `Convert` (clean preflight) or `Convert
   anyway (X values cleared)` (preflight has clears + ack
   checked).

On submit:

1. Build `buildChangeTypeMutation({tableKey, fieldId, after,
   acknowledgeDestructive: incompatibleCount > 0, schemaFingerprint})`
   where `after` carries the same `cf_*` id, the new
   `field_type`, and minimal `config` (e.g. `precision` for
   `number`).
2. Dispatch via `commitSchemaMutation`.
3. On `custom_field_coercion_preflight_required` — re-populate the
   preflight panel from the server's `details` payload (the client
   preflight was stale or out of sync; trust the server). Keep
   the popover open. Acknowledgement state is preserved.
4. On `custom_field_illegal_type_conversion` — close the popover
   and surface the error in the standard banner.
5. On other errors — same error-band pattern as `AddFieldPopover`.

**`frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`**
— add a `Change type` item to the custom-field menu (placed between
`Rename field` and `Duplicate field`). Wired by parent (DataTable)
to a new optional `onChangeFieldType?: () => void` callback.

**`frontend/src/shared/ui/data-table/DataTable.tsx`** —
add `onChangeFieldType?: (fieldKey: string) => void` prop; manage
`ChangeTypePopover` open state inside DataTable (mirror the P2.7
edit-description popover pattern); compute `existingRows` and
`optionListByField` from props.

**`frontend/src/features/equipment/routes/EquipmentTab.tsx`** —
new `handleChangeFieldType(fieldKey, after)` builds the typed
mutation with the active `schemaFingerprint` and dispatches via
`commitSchemaMutation`. Routes
`custom_field_coercion_preflight_required` errors through to
the popover (catch the typed error and re-throw to the popover's
onSubmit handler — same pattern as
`custom_field_duplicate_name`).

**`frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`**
— add `buildChangeTypeMutation({tableKey, fieldId, after,
acknowledgeDestructive, schemaFingerprint})`. Drops the
`cellWrites` slot (Phase 2's reservation removed; the server
derives clears authoritatively).

### New tests

- `coerceCustomValue.test.ts` — drive the shared corpus; assert
  every case matches the expected outcome.
- `typeConversionMatrix.test.ts` — every pair in the matrix has a
  policy; forbidden pairs match the backend's `CONVERSION_MATRIX`.
- `ChangeTypePopover.test.tsx` — popover renders source/target;
  forbidden pill disabled with tooltip; preflight count updates
  on pill change; acknowledgement gate works; happy-path submit
  dispatches the right mutation; server preflight error
  re-renders panel without closing.
- `RoomsTable.changeType.test.tsx` — open from header context
  menu; complete a `short_text → number` conversion with three
  clean rows and one dirty row; assert two POSTs (first 422, ack,
  second 200) and the resulting grid state.

### Acceptance

- Vitest + typecheck + lint green.
- Shared `custom_field_coercion_corpus.json` exercised by both
  sides; both green.
- Manual Playwright MCP smoke: open Rooms; on a `short_text`
  field with mixed values, open Change type, pick `number`,
  observe preflight diagnostics, acknowledge, convert; confirm
  the column is now numeric and the incompatible row's cell is
  empty.

---

## Phase 3.7 — Frontend: migrate `FieldEditorPopover` onto typed `editOptions` + retire legacy slots + unlock single-select duplicate

**Goal.** Move the existing core single-select option editor
(`FieldEditorPopover`) off the untyped
`WriteOp.schemaMutation.variant: "legacyOptions"` path and onto
the typed `EditOptionsMutation`. Reuse the same popover (and the
same `<CustomFieldOptionListEditor>` from P3.5) for custom
single-select fields — wire it into the header context menu's
`Edit options…` item (custom single-select fields only; core
single-select fields keep the same item via the legacy entry
point, now typed). Delete the `before` / `after` / `cellWrites`
slots on `WriteOp.schemaMutation` and the `variant: "legacyOptions"`
branch — no shim chain (pre-deploy). Remove the Phase 2 guard in
`EquipmentTab.handleDuplicateCustomField` that rejected
`single_select` and `formula` sources; allow `single_select`
duplicates (the backend's `duplicateField` apply path already
deep-copies `config`, but for `single_select` it must also
deep-copy the namespaced option list under a fresh
`<table_path>.<new_cf_id>` key with fresh `opt_*` ids — a small
extension to the existing `duplicateField` branch in
`schema_mutations.py`).

### Backend changes

**`backend/features/project_document/schema_mutations.py`** —
extend the `duplicateField` branch:

- After cloning the `CustomFieldDef`, if `source.field_type ==
  "single_select"`:
  - Read `source` option list via
    `capability.read_field_option_list(body, source_field_id)`.
  - Generate fresh `opt_*` ids for each option (copying label /
    color / order verbatim).
  - Write the new list under the new field's namespace via
    `capability.replace_field_option_list(body, new_field_id,
    new_options)`.
  - Audit payload gains `duplicated_option_count`.

Tests in `test_project_document_schema_mutations.py`:

- `test_duplicate_single_select_field_deep_copies_option_list` —
  source has three options; duplicate has three options with
  *different* ids, same labels, same colors, same order; deleting
  an option on the source after the duplicate doesn't affect the
  duplicate (independence).
- `test_duplicate_single_select_field_does_not_copy_row_values` —
  US-CF-13 criterion 2 stays.

### Frontend changes

**`frontend/src/shared/ui/data-table/types.ts`** —
shrink `WriteOp.schemaMutation` to a single shape:

```ts
| {
    kind: "schemaMutation";
    mutation: FieldSchemaMutation;          // required, no longer optional
  };
```

Delete `variant`, `before`, `after`, `cellWrites`. **Every caller**
(P2.4's legacy-option branch in EquipmentTab, the existing
`FieldEditorPopover` consumers, the option-editor preview in
`useGridWriteReducer`, etc.) is migrated in the same PR.

**`frontend/src/shared/ui/data-table/components/FieldEditorPopover.tsx`:**

- Replace the existing untyped emit (build of `{kind:
  "schemaMutation", variant: "legacyOptions", before, after,
  cellWrites}`) with a typed
  `buildEditOptionsMutation(...)` + dispatch. Same UX surface (no
  user-visible change).
- Reuse `<CustomFieldOptionListEditor>` from P3.5 as the
  option-list body of the popover (replaces the existing
  hand-rolled option rows).
- Open the popover via the header context menu's
  `Edit options…` item for both core and custom single-select
  fields. The trigger is the same item; the popover doesn't care
  whether the `field_id` is `cf_*` or a core key.

**`frontend/src/features/equipment/routes/EquipmentTab.tsx`:**

- Delete `collapseRoomCellWritesToReplacements` and the
  `legacyOptions` branch in `handleTableWrite`. The new branch
  routes every `schemaMutation` through `commitSchemaMutation`
  (the typed path Phase 2 P2.4 introduced).
- Delete `replaceRoomOptionsPayload` (replaced by the
  `editOptions` mutation dispatch).
- Remove the `if (source.field_type === "single_select")` guard
  in `handleDuplicateCustomField`. (The `formula` guard stays
  until Phase 4.)

**`frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`:**

- The `Edit options…` item already exists; ensure it's available
  on both core and custom single-select fields, hidden on every
  other type.

**`frontend/src/shared/ui/data-table/components/ColumnHeaderMenu.tsx`:**

- The existing `Edit options…` menu item on the legacy column
  header menu now also fires the typed dispatch — keep the menu
  surface but rewire to typed mutations.

### New tests

- `FieldEditorPopover.test.tsx` — regression: a save of edited
  options dispatches one `editOptions` mutation; rendered surface
  is identical to before; delete-option cascade UI shows the
  affected row count and proceeds on confirm.
- `RoomsTable.duplicateCustomField.test.tsx` — duplicate a
  custom `single_select` field; the new field appears with the
  same options (different ids); row values are not copied.
- `EquipmentTab.legacyOptionsRemoved.test.tsx` — grep-style
  assertion: no caller in the codebase emits a `schemaMutation`
  WriteOp without `mutation`. (Implemented as a TypeScript
  compile-time check — the type narrows `mutation` to required.)
- `RoomsTable.test.tsx` — full menu surface for a custom
  `single_select` field now includes `Edit options…` and
  `Change type`.

### Acceptance

- Vitest + typecheck + lint green. The lint passes will surface
  any reach into the deleted `before` / `after` / `cellWrites`
  slots; fix them in the same PR.
- Backend test count for `duplicateField` grows by two.
- Manual Playwright MCP smoke: edit options on a core
  `rooms.floor_level` field; confirm the option editor still
  works through the typed path. Duplicate a custom
  `single_select` field; confirm the option list is deep-copied
  with fresh ids and the rows in the original column are
  unaffected.

---

## Phase 3.8 — Exit-criteria acceptance tests + Playwright smoke + a11y pass

**Goal.** Verify the plan-13 §5 Phase 3 exit criteria end-to-end,
both browser and MCP, and run a focused a11y pass on the new
surfaces (change-type popover, custom-option-list editor,
expanded add-field popover with the single-select branch).

### Backend end-to-end tests

`backend/tests/test_project_document_custom_fields_phase_3.py` —
extend (the file already exists from P3.1):

1. **Add single_select round-trip via the typed pipeline** — POST
   `addField`; then POST `editOptions` with three options; then
   PUT row writes setting `custom[cf_id]` to each option id; GET
   round-trip.
2. **Option-delete cascade** — start with three options + three
   referencing rows; POST `editOptions` removing one option; assert
   the referencing row's `custom[cf_id]` is `None`; assert the
   audit payload carries `cleared_row_count == 1`.
3. **Change-type clean preflight** — `short_text` column with all-
   numeric values; POST `changeType` to `number` without ack;
   assert 200 + values coerced.
4. **Change-type dirty preflight** — `short_text` column with one
   non-numeric value; first POST returns 422 +
   `custom_field_coercion_preflight_required` + the offending row
   in `details`; second POST with `acknowledge_destructive: true`
   returns 200 with that row cleared.
5. **Change-type text → single_select auto-create** — D20 policy:
   distinct values create options; cap at 50 triggers ack flow.
6. **Change-type single_select → text label substitution** — D21
   policy.
7. **Illegal-pair rejection** — POST `changeType` from `number` to
   `url` → 422 `custom_field_illegal_type_conversion`.
8. **Duplicate single_select deep-copy independence** — duplicate;
   edit options on the original; confirm the duplicate's option
   list is untouched.
9. **Browser–MCP cross-talk** — change a field's type via REST;
   immediately read via MCP `get_table` and confirm the new type;
   edit options via MCP; confirm REST `GET /draft/tables/rooms`
   reflects the change; audit log distinguishes channels via
   `details.updated_via`.

### Frontend acceptance tests

`frontend/src/features/equipment/__tests__/RoomsTable.customFieldsPhase3.test.tsx`:

- Add `single_select` via the popover → edit options → duplicate
  → change type → all through the rendered UI, none through the
  API client directly; assert the expected sequence of typed
  `schemaMutation` WriteOps.
- Viewer mode shows the field as a normal single-select column
  (option labels + colors render) and hides every schema-editor
  affordance — no `Change type`, no `Edit options`, no `+` cell.

### Playwright e2e

`frontend/tests/e2e/custom-fields-phase-3.spec.ts`:

- Full plan-13 §5 Phase 3 exit-criteria walkthrough against a
  running dev stack. Screenshots under
  `docs/plans/2026-05-24/screenshots/plan-16-p3-8/`.

### A11y pass

Run an axe scan + manual keyboard walkthrough on:

- change-type popover: focus traps inside; Tab order is
  Target pills → Acknowledgement checkbox → Cancel → Convert;
  preflight panel announces row-count via `aria-live="polite"`;
  forbidden pills carry an `aria-describedby` pointing at their
  tooltip;
- option-list editor: arrow-key reorder works as well as the Up /
  Down buttons; color picker swatches are reachable via Tab and
  selectable via Enter / Space; option-delete uses a non-color
  signal (icon + label) in addition to the trash glyph;
- inline option editor inside `AddFieldPopover` for
  `single_select`: when the type pill switches away from
  single_select and back, focus returns to a sensible location
  (not lost to the popover root);
- contrast of the disabled "forbidden" target pills.

File a11y findings in
`docs/plans/2026-05-24/plan-16-a11y-notes.md`. Any blocking issue
is fixed in this PR; non-blocking notes feed the Phase 5 a11y
polish pass (plan-13 §5).

### Acceptance

- All Phase 3 acceptance tests pass.
- `make test`, `make e2e`, `make smoke` green.
- A11y notes filed; no critical findings remain open.
- Manual exit-criteria walkthrough complete; screenshots filed.

---

## Cross-cutting verification checks

After each phase, run:

- `make typecheck` (backend mypy + frontend tsc);
- `make test` (pytest + vitest);
- `make lint`;
- `make smoke` (lightweight end-to-end against the running stack);
- `make e2e` at phase boundaries that touch user-visible behavior
  (3.5, 3.6, 3.7, 3.8).

If `make smoke` exposes a regression after the legacy-slots
removal in P3.7, the most likely culprit is a consumer that was
reading `op.before` / `op.after` / `op.cellWrites` off a
`WriteOp.schemaMutation`. The TypeScript compiler should catch
this in P3.7 itself (the slot is no longer in the type union); if
something slips through `make smoke`, grep for `op.before` and
`op.cellWrites` across `frontend/src/`.

## Rollback notes

- **Pre-deploy.** No production data exists. Rolling back any
  phase is a `git revert` plus a `make test` to confirm fixtures
  still align.
- **No `schema_version` bump.** Phase 3 only adds capability on
  top of the Phase 1 envelope; the document shape is unchanged.
  Reverting any sub-phase does not orphan stored state.
- **Two cutover PRs to watch.** P3.4 (MCP tools) and P3.7 (legacy
  option-editor migration) are the riskiest to revert mid-flight.
  Both are designed to keep the older paths intact through the
  end of the prior sub-phase (P3.3 leaves the REST endpoint
  unchanged; P3.6 keeps the legacy option editor on its untyped
  path). If P3.7 needs to be reverted, P3.6 still ships a fully
  functional change-type and single-select-add experience; only
  option editing on existing single-selects falls back to the
  Phase 2 untyped path until P3.7 lands again.

## Out of scope (Phase 4+)

These belong to subsequent plans, not Phase 3:

- `formula` custom fields, the grammar + AST + dual evaluator
  parity corpus, and the read-overlay computed shape (Phase 4 —
  US-CF-8, plan-13 §4.4). Phase 3 leaves `formula` as a
  disabled-with-tooltip target pill and rejects
  `changeType` *to* `formula` outright (D19 matrix).
- `SetFormulaMutation` (still reserved in the discriminator;
  rejects with `custom_field_unsupported_mutation` until Phase 4).
- Fan-out to ERVs / Pumps / Fans / Thermal Bridges — the contract
  abstraction from plan-14 P1.2 + plan-16 P3.1 already supports
  them via per-table option-list namespaces and per-table core
  single-select key maps; Phase 5 (plan-18+) wires them up.
- Granular per-field permissions (deferred — D9). Editor login
  remains the only gate on schema mutations in Phase 3.
- Cross-version schema-copy / project-templating for custom
  single-select option lists (plan-13 R9 deferred work).

## Open questions

These must be **closed in chat before P3.1 starts** (P3.0
prerequisite). Record the resolution as decisions D19 / D20 / D21
in plan-13 §3 and as a one-paragraph note here once resolved.

- **D19. Source-→-target conversion matrix.** Strawman in P3.0
  Tasks §4. Confirm or override per pair. The strawman's only
  contentious pairs are `text → single_select` (D20 follow-up)
  and `single_select → text` (D21 follow-up); everything else is
  mechanical.
- **D20. text → single_select conversion policy.** Auto-create
  with hard cap, or clear-all? Recommendation: auto-create with
  a 50-option cap; rows exceeding the cap fall to the ack flow.
- **D21. single_select → text conversion: label or id?**
  Recommendation: label. Confirm.

If a question surfaces *during* implementation that wasn't
anticipated in P3.0 (most likely candidate: whether to extend
`AddFieldMutation` with `initial_options` or add a dedicated
`addSingleSelectField` discriminator for the atomic add path), raise
it in chat and amend this plan in place before continuing — do not
silently make the call inside a sub-phase PR (same discipline as
plans 14 and 15).
