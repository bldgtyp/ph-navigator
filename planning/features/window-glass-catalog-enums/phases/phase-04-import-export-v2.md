---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Planned
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 4 — import/export schema v2 (fold + derived name + auto-add)
RELATED:
  - ../decisions.md D-4 (import auto-adds unknown options)
  - ../research.md §4 (import is the main backend work)
  - backend/features/catalogs/frame_types/import_export/* (the v2 template)
  - backend/features/catalogs/glazing_types/import_export/* (the v1 files to change)
---

# Phase 4 — Import / export v2 (backend)

## Goal

Bring glazing import/export from schema **v1 → v2**: fold legacy casing
(`INTUS`/`ZOLA`), compute `name` on import instead of requiring it, resolve
`manufacturer`/`brand` against the option store and **auto-add** unknowns on commit
(D-4), and surface `dropped`/`new_option` counts in the preview. All six glazing
import/export files change; each is a **direct mirror** of the frame v2 file.

## Depends on / unblocks

- **Depends on:** Phase 0 (`GLAZING_TYPE_VALUE_FOLDS`), Phase 1 (`append_options`),
  Phase 3 (`compose_glazing_name`).
- **Unblocks:** Phase 5 frontend import dialog v2 (it just renders the new counts).

## Work items (one per file — mirror the frame v2 file at each)

### 4.1 `file_format.py` — bump the version

- `CURRENT_SCHEMA_VERSION = 1` → `2`. Keep `name` optional in `CatalogFileRow`
  (it is already nullable on input; it becomes computed). Update the module
  docstring to reference window-glass-catalog-enums + auto-add.

### 4.2 `coerce.py` — derive name, drop the missing-name gate

- Import `from features.catalogs.glazing_types._name import compose_glazing_name`.
- **Remove** the `ERR_MISSING_NAME` gate (the const + the raise that fires when
  `name` is missing/blank — frame's coerce has no such gate).
- After the parts coerce, set `cleaned["name"] = compose_glazing_name(cleaned)`
  (the composer clamps to 200, so the separate length check on `name` can go).
- Keep `name` in the canonical-fields set but treat it as computed output.

### 4.3 `upgrade.py` — add the v1→v2 step

- Change the step return type to `dict[str, object] | None` and guard the
  while-loop against a `None` (a dropped row) — mirror frame's `upgrade.py`.
- Add `_upgrade_v1_to_v2(row)`:
  - **Drop `DEFAULT` rows (D-6):** return `None` when
    `str(row.get("manufacturer", "")).strip() == "DEFAULT"` (→ counted as
    `dropped`). Mirrors frame's `FRAME_TYPE_DROP_MANUFACTURERS` check; a glazing
    `GLAZING_TYPE_DROP_MANUFACTURERS = frozenset({"DEFAULT"})` const in
    `_option_seeds.py` keeps it declarative.
  - **Casing fold:** for each `field, fold_map` in `GLAZING_TYPE_VALUE_FOLDS`,
    `value = row.get(field)`; if `isinstance(value, str)` and
    `fold_map.get(value.strip().lower())` is not None, set the canonical.
- Register it in the steps dict at key `1:`.
- (Glazing has **no** swapped-field special case — simpler than frame.)

### 4.4 `tokens.py` — carry new options

- Add `new_options: dict[str, list[str]] = field(default_factory=dict)` to
  `WriteSet` (mirror frame).

### 4.5 `pipeline.py` — detect new options + dropped rows

- `build_preview(...)`: add a `known_options: dict[str, set[str]] | None = None`
  parameter; init `dropped_count = 0` and `new_options: dict[str, list[str]] = {}`.
- On `upgrade_row(...) is None` → `dropped_count += 1; continue`.
- After coercing each new row, for each field in `_new_option_fields(row,
  known_options)` (a new helper over `GLAZING_TYPE_SINGLE_SELECT_FIELDS`): add a
  `new_option:<field>` warning + append the value to `new_options[field]`.
- Add `dropped: int = 0` to `PreviewCounts`; pass `dropped=dropped_count`; build
  `WriteSet(rows_to_insert=..., new_options=new_options)`.

### 4.6 `service.py` — read known options + auto-add on commit

- `_read_known_options(conn) -> dict[str, set[str]]` over
  `GLAZING_TYPE_SINGLE_SELECT_FIELDS` (mirror frame); pass it to `build_preview`
  in `preview_import`.
- `_auto_add_new_options(conn, write_set.new_options)` — for each field in
  `GLAZING_TYPE_SINGLE_SELECT_FIELDS`, `options_repository.append_options(conn,
  catalog_table="glazing_types", field_key=field, new_labels=labels)`. Call it in
  `commit_import` **before** the row inserts, inside the same transaction (D-4:
  auto-add is frictionless on the batch path; create/patch still reject unknowns).

## Export

`name` continues to serialize (now computed); `manufacturer`/`brand` serialize as
**labels** (consistent with the catalog CSV-download convention and frame v2). No
export schema change beyond the version bump.

## Tests

Mirror the frame import/export tests:

- round-trip: export → import → identical rows.
- a v1 file with `INTUS` and **no** `name` imports clean as v2 (folded to `Intus`,
  name computed).
- an unknown `brand` auto-adds with a `new_option:brand` warning and is selectable
  after commit.
- D-6 drop: each `DEFAULT` row is dropped with the `dropped` count incremented
  (a 2-`DEFAULT`-row file → `dropped == 2`).
- seed parity: importing the cleaned seed yields the same rows the row-seed loader
  produces.

## Exit criteria

- `make ci` green. v1 files upgrade cleanly to v2; unknowns auto-add; preview shows
  `dropped`/`new_option`.

## Risks / notes

- **Riskiest file: `coerce.py`** — dropping the missing-name gate while making
  `name` derived. Mitigate with the composer-parity test (Phase 3) + a round-trip
  test here.
- Keep the importer **off** `_validate_single_selects` — it auto-adds, by design.
- `_new_option_fields` + `append_options` dedup case-insensitively (matches the
  label unique index) — reuse, don't reinvent.
