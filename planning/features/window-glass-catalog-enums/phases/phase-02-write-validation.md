---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Planned
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 2 — strict write-validation on manufacturer + brand
RELATED:
  - ../decisions.md D-1, D-4 (new values only via the option-add path)
  - backend/features/catalogs/frame_types/service.py:36-60 (the mirror)
  - backend/features/catalogs/glazing_types/service.py (the file to change)
---

# Phase 2 — Strict write-validation (backend)

## Goal

On create/patch, reject any `manufacturer`/`brand` value that is not a known
option label. New labels enter **only** via the explicit option-add path
(`PUT …/options`) or the import auto-add (Phase 4) — never by silently accepting an
arbitrary string on a row write. Columns stay TEXT storing the label (D-2).

## Depends on / unblocks

- **Depends on:** Phase 1 (the option store to validate against).
- **Unblocks:** trustworthy grouping on `manufacturer`/`brand`; Phase 3 derives
  `name` from already-validated parts.

## Work items

### 2.1 `_validate_single_selects` in `glazing_types/service.py`

Mirror `frame_types/service.py:36-60`, narrowed to the two glazing fields:

```python
from features.catalogs._option_seeds import GLAZING_TYPE_SINGLE_SELECT_FIELDS
from features.catalogs import _options_repository as options_repository

def _validate_single_selects(conn: Connection[Any], values: Mapping[str, object]) -> None:
    present = {f: values[f] for f in GLAZING_TYPE_SINGLE_SELECT_FIELDS
               if values.get(f) not in (None, "")}
    if not present:
        return
    known: dict[str, set[str]] = {}
    for row in options_repository.list_all_for_table(conn, catalog_table=CATALOG_TABLE):
        known.setdefault(row["field_key"], set()).add(row["label"])
    for field, value in present.items():
        if value not in known.get(field, set()):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "catalog_option_unknown",
                f"{field!r} value {value!r} is not a known option; add it via the field's options first.",
                {"field": field, "value": value},
            )
```

- null/empty always allowed (the fields are nullable; a null part drops from the
  composed name in Phase 3).
- Exact-label comparison is correct because the store enforces case-insensitive
  label uniqueness (stored labels are canonical).

### 2.2 Wire into create + patch

- `create_glazing_type`: call `_validate_single_selects(conn, payload.model_dump())`
  inside the `transaction()` before the insert (mirror `frame_types/service.py:114-115`).
- `update_glazing_type`: call it on the `exclude_unset` `values` before the update
  (mirror `frame_types/service.py:170`).
- `duplicate_glazing_type`: **no** validation call — the source row's labels were
  already validated on its original write (mirror the frame duplicate note,
  `frame_types/service.py:224-226`).

### 2.3 Fix existing test fixtures

Any existing glazing test that writes a non-canonical `manufacturer`/`brand` (e.g.
free-text placeholders) will now be rejected. Update those payloads to canonical
option values, and add a module **autouse fixture** that reseeds
`catalog_field_options` for glazing per test (mirror the frame Phase 2 fixture
note, `phase-01` Completion). The import path still bypasses validation until
Phase 4.

## Tests

`backend/tests/` (glazing service tests):

- write an unknown `manufacturer`/`brand` → `catalog_option_unknown` (422).
- write a known option → succeeds.
- `PUT …/options` to add a label, then write a row using it → succeeds.
- null/empty `manufacturer`/`brand` → succeeds.

## Exit criteria

- `make ci` green. Unknown values rejected on create + patch; known values pass.

## Risks / notes

- Import (Phase 4) deliberately bypasses this (it auto-adds unknowns), so do not
  route the importer through `_validate_single_selects`.
- This is the first phase that *enforces* the Phase 0 seed↔option agreement — a
  mismatch surfaces here as a rejected seed/fixture row.
