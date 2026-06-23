---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Draft — depends on Phase 2 (clean values feed the name)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 3 — server-compute `name` from parts (read-only) + switch default-frame/glazing lookup to by-id
RELATED:
  - ../decisions.md D-3 (backend-computed A), D-5 (default by id)
  - ../research.md §2 (formula is lossless), §4 (blast radius)
  - backend/features/project_document/apertures/default_refs.py
  - backend/features/aperture_drift/comparator.py
---

# Phase 3 — Derived `name` + default-frame-by-id (backend)

## Goal

Make `name` a **server-computed, read-only** label composed from the parts, and
fix the one place that used `name` as a join key (the default-frame/glazing
sentinel lookup) to resolve by **deterministic id** instead — because a derived
name computes to empty for the all-null sentinel row (research §4).

## Depends on / unblocks

- **Depends on:** Phase 2 (the six fields are clean, so the composed name is
  stable). Phase 1 only indirectly.
- **Unblocks:** Phase 4 (import computes name the same way), Phase 5 (renders
  name read-only).

## The composition (D-3, mirrors the AirTable formula — research §2)

```
name = " | ".join(part for part in
    [manufacturer, prefix, brand, use, operation, location, mull_type, suffix]
    if part not in (None, ""))
```

- Separator `" | "`, drop null/empty parts. AirTable-truthiness parity: `None`
  and `""` are dropped (research §2). This reproduces **every** existing seed
  `name` (verified lossless, research §2 table) — so the backfill is a no-op diff
  on clean data, which is the regression test.
- Order is fixed: manufacturer, prefix, brand, use, operation, location,
  mull_type, suffix. `material` is **not** in the name.

## Work items

### 3.1 `compose_frame_name(...)` in the service

Add to `frame_types/service.py`:

```python
_NAME_PART_ORDER: Final = ("manufacturer", "prefix", "brand", "use",
                           "operation", "location", "mull_type", "suffix")

def compose_frame_name(fields: Mapping[str, object]) -> str:
    parts = [str(fields[k]).strip() for k in _NAME_PART_ORDER
             if fields.get(k) not in (None, "")]
    name = " | ".join(p for p in parts if p)
    return name[:200]   # keep the existing 200-char column guard
```

### 3.2 Compute on create + patch; reject inbound `name`

- **Models** (`models.py`): drop `name` from the write surface.
  - `CatalogFrameTypeCreateRequest` (`:131-137`): remove the required
    `name: str = Field(min_length=1, max_length=200)` (`:132`) and its validator
    (`:136-137`). Name is no longer a client input.
  - `CatalogFrameTypeUpdateRequest` (`:140-148`): remove `name` (`:143`) and its
    validator (`:147-148`). Patching `name` directly is now rejected by the model
    (`extra` is forbidden on these request models — confirm and rely on it; if
    `extra="ignore"`, add an explicit reject).
  - `CatalogFrameTypeListItem`/`Public` keep `name` (read surface, computed).
- **Service create** (`:78-117`): compute `name = compose_frame_name(payload
  values)` after Phase 2 validation, pass it into `repository.insert_frame_type`
  (the repo signature already takes `name` — `repository.py:150-217`).
- **Service patch** (`:120-157`): after applying the patched subset, recompute
  `name` from the **merged** row (fetch current + overlay patch, or compute from
  the post-update row) and write it. Simplest: do the `update_frame_type` for the
  six/other fields, then a second `UPDATE … SET name=%(name)s` using the
  refreshed row — or extend `repository.update_frame_type` to always set `name`
  from a computed value the service passes in. Prefer passing computed `name` into
  the existing update `values` dict so it rides the one statement (note: `name`
  must be in `_UPDATABLE_FIELDS` — it already is, `repository.py:69-90`).
- **Duplicate** (`:160-207`): `next_copy_suffix` currently mutates `name`
  (`:172`). With derived name, the copy's name is recomputed from its parts and
  would **equal the source** (no `(copy)` suffix, since parts are identical).
  Decision needed (small): either (a) keep a non-derived `(copy)` disambiguation
  by appending to `suffix`, or (b) accept duplicate names (identity is the id; the
  active-name index is non-unique). **Recommend (b)** — names are descriptive, not
  unique keys, and the index is already partial/non-unique
  (`20260514_0009:127-132`). Drop the `next_copy_suffix` call for frame-types and
  note why.

### 3.3 Backfill migration — `20260623_0039_frame_type_name_backfill.py`

- `UPDATE catalog_frame_types SET name = <composed>` for all rows. Compose in SQL
  with `concat_ws(' | ', NULLIF(manufacturer,''), NULLIF(prefix,''), …)` —
  `concat_ws` already skips NULLs, and `NULLIF(x,'')` folds empty strings, exactly
  matching `compose_frame_name`. Verify the SQL and Python agree on a fixture row.
- Reversible-enough: `downgrade()` is a no-op (name was already this value on
  clean data). Keep the `ix_catalog_frame_types_active_name` index.

### 3.4 Default-frame/glazing lookup → by id (D-5)

`backend/features/project_document/apertures/default_refs.py`:

- Today `get_default_frame()` (`:74-75`) and `get_default_glazing()` (`:86-87`)
  call `_fetch_by_name(table, columns, NAME)`; `_fetch_by_name` (`:98-111`) runs
  `WHERE name = %(name)s AND deleted_at IS NULL LIMIT 1` (`:104`).
- Replace with `_fetch_by_id(table, columns, record_id)` →
  `WHERE id = %(id)s AND deleted_at IS NULL LIMIT 1`, using the deterministic
  sentinel ids from the seed migration
  (`20260605_0018_apertures_default_catalog_seed.py`): `recPHNDefFrame001`
  (`:34`), `recPHNDefGlazng01` (`:36`). Define those ids as constants near
  `APERTURE_DEFAULT_FRAME_NAME` in `envelope_models.py:29-30` (or import from a
  shared constants module) so seed and lookup share one source.
- The column tuples `_FRAME_COLUMNS` (`:28-47`) / `_GLAZING_COLUMNS` (`:49-60`)
  are unchanged (they already include all six). The seed migration is unchanged
  (it already inserts by those ids).
- `APERTURE_DEFAULT_FRAME_NAME`/`_GLAZING_NAME` constants may become unused for
  lookup; keep them only if the seed idempotency still references the name —
  otherwise remove to avoid a dead name-as-key path.

### 3.5 Drift comparator cleanup (cosmetic)

`backend/features/aperture_drift/comparator.py:21-39`: `_FRAME_KEYS` includes
`"name"` (`:22`) with a TB-09.a "renamed in place" comment. A derived name can
never drift independently of its parts, so comparing it is redundant. **Drop
`"name"` from `_FRAME_KEYS`** and update the comment. Pure cleanup (the
comparator is field-agnostic, so this only removes a duplicate delta).

## Tests

- **Composer regression (the headline test):** for every row in
  `frame-types.v1.json` (post Phase 0 cleanup), `compose_frame_name(row)` ==
  the row's stored `name`. This is the lossless-derivation proof (research §2).
- SQL backfill == Python composer on a fixture set (parity).
- create/patch: client cannot set `name` (rejected/ignored); response `name`
  reflects the parts; patching `operation` changes `name`.
- default-frame/glazing dispatch resolves the sentinel **by id** even though its
  composed name is empty (`recPHNDefFrame001` has all-null parts).
- drift no longer reports a `name` delta when parts are unchanged.

## Exit criteria

- `make ci` green.
- Composer matches every existing seed name; default lookup resolves; drift clean.

## Risks / notes

- **Highest-risk site in the whole refactor** is 3.4 — but it has a single
  verified call path (`default_refs.py:104`) and deterministic seed ids. Land 3.4
  with its own test before relying on derived name elsewhere.
- **Patch recompute:** the subtlety is recomputing name from the *merged* row, not
  just the patched subset. Compute from the post-update fetched row to avoid a
  stale-merge bug.
- Optional: mirror `compose_frame_name` in TS for optimistic display (Phase 5);
  backend stays the source of truth.
