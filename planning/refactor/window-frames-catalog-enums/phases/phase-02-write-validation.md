---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Draft — depends on Phase 1
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 2 — strict option validation on create/patch for the six single-select fields
RELATED:
  - ../decisions.md D-1 (all six strict), D-2 (label-string storage), D-4 (add-on-write only via explicit path)
  - ./phase-01-catalog-option-store.md (the store this validates against)
  - backend/features/catalogs/frame_types/{models.py,service.py,repository.py}
---

# Phase 2 — Strict write-validation on the six fields (backend)

## Goal

Make create/patch of a frame-type **reject** any of the six fields whose value is
not a known option label, so the catalog can never re-acquire the
`OP-to-FX`/`OP-TO-FIX` class of drift. New values enter **only** through the
explicit option-add path (Phase 1 `PUT …/options`, D-4) — never by silently
accepting an arbitrary string on a row write.

## Depends on / unblocks

- **Depends on:** Phase 1 (option store + `list_options`).
- **Unblocks:** nothing hard-gates on it, but it must land before Phase 4 import
  v2 so imported rows are validated by the same rule.

## The six fields

`manufacturer`, `brand`, `use`, `operation`, `location`, `mull_type`
(`models.py:81-86`). `prefix`/`suffix`/`material` stay free text — unchanged.

## Work items

### 2.1 Validation helper (service layer)

Add to `frame_types/service.py` (or a small `_validation.py`):

```python
SINGLE_SELECT_FIELDS: Final = ("manufacturer", "brand", "use", "operation", "location", "mull_type")

def _validate_single_selects(conn, values: Mapping[str, object]) -> None:
    """Reject any of the six whose non-null value is not a known option label.

    Reads the live option store (Phase 1). null/empty is always allowed
    (the fields are nullable; null drops from the composed name).
    """
    options_by_field = {f: {o["label"] for o in repo.list_options(conn, catalog_table="frame_types", field_key=f)}
                        for f in SINGLE_SELECT_FIELDS}
    for field in SINGLE_SELECT_FIELDS:
        value = values.get(field)
        if value in (None, ""):
            continue
        if value not in options_by_field[field]:
            raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "catalog_option_unknown",
                            f"{field!r} value {value!r} is not a known option")
```

Comparison is **exact-label** (case-sensitive) because the store already enforces
case-insensitive label uniqueness, so labels are canonical by construction.

### 2.2 Wire into create + patch

- `create_frame_type` (`service.py:78-117`): call `_validate_single_selects(conn,
  payload values)` inside the existing `transaction()` before
  `repository.insert_frame_type(...)`.
- `update_frame_type` (`service.py:120-157`): it already computes
  `payload.model_dump(exclude_unset=True)` (line 126); validate that dict (only
  the patched subset is checked) before `repository.update_frame_type(...)`.
- `duplicate_frame_type` (`service.py:160-207`): source row is already valid; no
  new validation needed (it copies stored labels). Note in code so a future
  reader doesn't add a redundant check.

### 2.3 Keep columns TEXT (D-2)

No schema change. The columns continue to store the label string; validation is
the only new gate. `models.py` field `max_length` constraints (200/40) stay as a
cheap first-line guard but are now superseded by the option-set check.

### 2.4 Interaction with the inline-add path (D-4)

Row writes are strict. The **only** way a new label becomes valid is `PUT
…/options` (Phase 1). The frontend (Phase 5) performs add-option **then** the row
write, so the value is known by the time the row PATCH lands. Document this
ordering contract in the service docstring — it is the load-bearing invariant for
`brand`/`manufacturer` where new product lines arrive often (D-1).

## Tests

Extend `backend/tests/test_catalog_frame_types*.py`:

- create with a known `operation` label → 201.
- create with unknown `operation` (`"tilt turn"`) → 422 `catalog_option_unknown`.
- patch one field to an unknown label → 422; other fields untouched.
- create/patch with `mull_type=None` → allowed.
- add option via `PUT …/options`, then create a row using it → 201 (round-trip).
- duplicate a valid row → 201 (no false rejection).

## Exit criteria

- `make ci` green.
- Writing an unknown value is rejected on both create and patch; adding the option
  first then using it succeeds.

## Risks / notes

- **Per-write store read:** `_validate_single_selects` reads the option store on
  every create/patch. Six small `SELECT`s inside the existing transaction — cheap
  at catalog scale (~hundreds of rows). If it ever matters, batch via
  `list_all_for_table`. Not worth optimizing now.
- **Import path reuses this:** Phase 4 calls the same helper after the upgrade
  step resolves labels, so there is exactly one validation rule.
