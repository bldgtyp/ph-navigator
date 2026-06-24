---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Done (2026-06-24) — compose_glazing_name + SQL twin + recompute_names; name dropped from write models (extra=forbid) + drift keys; backfill migration 20260624_0042; duplicate copies derived name; option-rename recompute wired
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 3 — server-derived read-only `name` (manufacturer | brand | suffix)
RELATED:
  - ../decisions.md D-3 (backend-computed), D-5 (default-by-id — already done)
  - ../research.md §2 (name-lossless), §3 (sentinel)
  - backend/features/catalogs/frame_types/_name.py + repository.py:242-281 (mirror)
  - backend/alembic/versions/20260623_0039_frame_type_name_backfill.py (mirror)
---

# Phase 3 — Derived `name` (backend)

## Goal

Make `name` a server-derived, read-only label: `manufacturer | brand | suffix`,
` | ` join, drop null/empty, clamp 200. Reject inbound `name`; recompute on any
part change. **No default-resolution change** — `default_refs` already resolves the
sentinel by id (research §3, D-5).

## Depends on / unblocks

- **Depends on:** Phase 2 (validated parts); Phase 0 (cleaned values so derived
  names are canonical).
- **Unblocks:** Phase 4 (import computes name the same way); Phase 5 (read-only
  name cell). Also adds the `recompute_names` that Phase 1's `edit_glazing_type_options`
  calls (see phase-01 §1.2 ordering note).

## Work items

### 3.1 `glazing_types/_name.py` (new) — the composer

Mirror `frame_types/_name.py`, 3 parts:

```python
_NAME_PART_ORDER: tuple[str, ...] = ("manufacturer", "brand", "suffix")

def compose_glazing_name(fields: Mapping[str, object]) -> str:
    parts: list[str] = []
    for key in _NAME_PART_ORDER:
        value = fields.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            parts.append(text)
    return " | ".join(parts)[:200]
```

The all-null case yields `""` — which is why the sentinel is resolved by id, never
by this name (research §3).

### 3.2 `glazing_types/repository.py` — SQL twin + recompute

Add the `concat_ws`/`NULLIF(btrim(...))` SQL twin (3 parts) and a `recompute_names`
that **skips the sentinel**, mirroring `frame_types/repository.py:242-281`:

```python
from features.project_document.envelope_models import APERTURE_DEFAULT_GLAZING_ID

_COMPOSE_NAME_SQL = """
left(
    concat_ws(
        ' | ',
        NULLIF(btrim(manufacturer), ''),
        NULLIF(btrim(brand), ''),
        NULLIF(btrim(suffix), '')
    ),
    200
)
"""

def recompute_names(conn: Connection[Any]) -> None:
    conn.execute(
        f"UPDATE catalog_glazing_types SET name = {_COMPOSE_NAME_SQL} "
        "WHERE deleted_at IS NULL AND id <> %(default_id)s",
        {"default_id": APERTURE_DEFAULT_GLAZING_ID},
    )
```

Keep the three implementations (`_name.py`, `_COMPOSE_NAME_SQL`, the migration
SQL) in sync — add the same "must stay in sync" comment the frame code carries.

### 3.3 Models — make `name` server-derived

In `glazing_types/models.py`, mirror the frame create/update models:

- `CatalogGlazingTypeCreateRequest`: **remove** the `name` field + its validator
  (today `models.py:96-103`). With `extra="forbid"` on `_CatalogGlazingTypeFields`,
  an inbound `name` is then rejected.
- `CatalogGlazingTypeUpdateRequest`: **remove** the `name` field + validator
  (today `:105-113`).
- `CatalogGlazingTypeListItem` keeps `name: str` (it is a read column).

### 3.4 Service — compute on write, recompute on patch

Mirror `frame_types/service.py:109-204`:

- `create_glazing_type`: `name=compose_glazing_name(payload.model_dump())` passed
  to the repository insert (the insert signature drops the caller-supplied `name`
  and takes the computed one).
- `update_glazing_type`: after `_validate_single_selects`, if any of
  `("manufacturer", "brand", "suffix")` is in `values`, fetch the current row
  (existence check), set `values["name"] = compose_glazing_name({**current,
  **values})`, then update.
- `duplicate_glazing_type`: compute `name=compose_glazing_name(src)`; **drop the
  `next_copy_suffix` / `list_sibling_names` logic** (`service.py:153-154`) — a copy
  has identical parts so an identical name, distinguished by id (mirror frame's
  duplicate, `frame_types/service.py:207-261`). `list_sibling_names` in the
  repository becomes unused — flag it as orphaned (clean up only if it's solely a
  duplicate-helper; verify no other caller first).
- `repository.insert_glazing_type` keeps its `name` param but now always receives
  the computed value; `_UPDATABLE_FIELDS` already includes `name`.

### 3.5 Wire Phase 1's option-edit recompute

Add the `recompute_names(conn)` call to `edit_glazing_type_options` (deferred from
phase-01 §1.2): after a rename/merge rewrites `manufacturer`/`brand` cells, the
derived name embeds the old label and must be recomputed. Guard it on
`rows_rewritten` (mirror `frame_types/options_service.py:140-143`).

### 3.6 Backfill migration — `00YY_glazing_type_name_backfill.py` (next free rev)

Mirror `20260623_0039`: `UPDATE catalog_glazing_types SET name = <3-part compose
SQL> WHERE id <> 'recPHNDefGlazng01'`. Inline the SQL (migrations can't import app
code) with the sync comment. Near no-op at migration time (only the sentinel
exists pre-seed) but corrects any pre-existing rows. `downgrade()` = no-op.

### 3.7 Drift comparator — drop `name`

`aperture_drift/comparator.py`: remove `"name"` from `_GLAZING_KEYS` (line 41) and
update the comment to match the `_FRAME_KEYS` rationale (derived name can't drift
independently of its parts).

## Tests

- **Composer parity:** `compose_glazing_name` reproduces every cleaned-seed `name`
  (regression corpus from `glazing-types.v1.json` after Phase 0).
- create computes name; patching a part recomputes it; inbound `name` → 422.
- sentinel: its derived name would be empty but it keeps its label
  (`PHN-Default-Glass` after the Phase 0 rename) and still resolves via
  `get_default_glazing` (id lookup).
- option rename → `recompute_names` updates affected rows' names.
- drift: a row whose only difference is a (now-derived) name reports **no** delta.

## Exit criteria

- `make ci` green. `name` is read-only/derived end-to-end on the backend; default
  glazing still resolves; drift is name-free.

## Risks / notes

- **Sentinel skip is mandatory** — without the `id <>` guard the recompute would
  set the sentinel's name to `""` and violate `GlazingRef.name` `min_length=1`.
- Three name implementations must agree — keep the sync comment; a 2-agent
  `simplify` diff check (as frame did) is cheap insurance.
