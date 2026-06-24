---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Done (2026-06-24) — options service + models + routes + seed migration 20260624_0041; generic DTOs relocated to _shared.py; 44 contract tests green
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 1 — wire glazing onto the EXISTING catalog option store
RELATED:
  - ../decisions.md D-2 (existing store), D-7 (built generic for this)
  - ../research.md §0 (reuse inventory)
  - backend/features/catalogs/_options_repository.py (already glazing-ready)
  - backend/features/catalogs/frame_types/options_service.py (the mirror template)
  - planning/archive/dated/2026-06-23/window-frames-catalog-enums/phases/phase-01-catalog-option-store.md
---

# Phase 1 — Wire glazing onto the existing option store

## Goal

Expose `manufacturer` + `brand` option lists for glazing through the **existing**
`catalog_field_options` store: a service, models, routes, and a seed migration.
**No new table and no repository changes** — `_options_repository.py` already
maps `glazing_types → catalog_glazing_types` (`:30-34`) and every function is
`catalog_table`-parameterized (research §0).

## Depends on / unblocks

- **Depends on:** Phase 0 (`GLAZING_TYPE_OPTION_SEEDS` to seed).
- **Unblocks:** Phase 2 (write-validation reads this store), Phase 5 (frontend
  fetches/edits these options).

## What is reused unchanged (do not re-implement)

- `catalog_field_options` table (migration `20260623_0037`).
- `_options_repository.py`: `list_options`, `list_all_for_table`, `replace_options`,
  `count_rows_using_label`, `rename_label`, `seed_options`, `append_options`.
- `SingleSelectOption`, `validate_option_list`, `mint_option_id`, `OPTION_COLOR_PALETTE`.

## Work items

### 1.1 Generic option models — relocate, then reuse

Frame defined two **catalog-generic** option DTOs in `frame_types/models.py`:
`CatalogFieldOptionsResponse` (one field's list — the PUT response) and
`EditCatalogOptionsRequest` (field_key + options + replacements). Glazing needs
both, so:

- **Recommended:** relocate `CatalogFieldOptionsResponse` and
  `EditCatalogOptionsRequest` to a shared module — `catalogs/_shared.py` (already
  the home of shared catalog DTOs like `CatalogManufacturerListResponse`) — and
  re-export from `frame_types/models.py` for back-compat-free import-site updates.
  Then both features import the generics from one place. Small, generic, no
  behavior change.
- **Lower-effort alternative:** import the two from `frame_types.models` into
  glazing. Works, but couples glazing → frame; prefer the relocate.

Add the glazing-specific aggregate:

```python
# glazing_types/models.py
class CatalogGlazingTypeOptionsResponse(BaseModel):
    """Both glazing single-select fields' option lists in one fetch."""
    model_config = ConfigDict(extra="forbid")
    fields: dict[str, list[SingleSelectOption]]
```

(`name`-as-derived model changes are Phase 3, not here.)

### 1.2 Service — `backend/features/catalogs/glazing_types/options_service.py` (new)

Direct mirror of `frame_types/options_service.py` with the glazing constants:

```python
CATALOG_TABLE = "glazing_types"

def list_glazing_type_options() -> CatalogGlazingTypeOptionsResponse:
    # connection(); list_all_for_table(conn, catalog_table="glazing_types");
    # seed both GLAZING_TYPE_SINGLE_SELECT_FIELDS to [] so empty fields still appear.

def edit_glazing_type_options(payload, user, request) -> CatalogFieldOptionsResponse:
    # 1. field_key in GLAZING_TYPE_SINGLE_SELECT_FIELDS else catalog_field_key_unknown (422)
    # 2. validate_option_list(payload.options)
    # 3. walk stored options: in-place rename -> rename_label; removed+in-use ->
    #    require replacements[label] (else catalog_option_in_use 409 / replacement
    #    -unknown 422), fold via rename_label
    # 4. replace_options(...)
    # 5. if any row rewritten: glazing_repository.recompute_names(conn)   # Phase 3
    # 6. log_catalog_action(conn, "catalog_options_edit", ...)

def seed_glazing_type_options(conn) -> None:
    options_repository.seed_options(conn, catalog_table=CATALOG_TABLE,
                                    option_seeds=GLAZING_TYPE_OPTION_SEEDS)
```

> **Note the `recompute_names` call in step 5** is a Phase 3 dependency
> (`glazing_repository.recompute_names` doesn't exist until Phase 3). Two options:
> sequence Phase 1's `edit` to no-op the recompute until Phase 3 lands, or land
> Phase 1's `edit` writing options only and add the recompute in Phase 3. Cleanest:
> ship `edit` in Phase 1 **without** the recompute (options have no derived-name
> dependency yet, since `name` is still a stored text column until Phase 3), and
> add the `recompute_names` call in Phase 3 when the derived name exists. Document
> this ordering in the Phase 3 doc.

### 1.3 Routes — `glazing_types/routes.py`

Add, **before** the `/{record_id}` routes (Starlette resolves in declaration
order — see the frame note `routes.py:95-96`):

```python
@router.get("/options", response_model=CatalogGlazingTypeOptionsResponse)
def get_glazing_type_options(auth: CurrentUser) -> CatalogGlazingTypeOptionsResponse: ...

@router.put("/options", response_model=CatalogFieldOptionsResponse)
def put_glazing_type_options(payload: EditCatalogOptionsRequest, request: Request,
                             auth: CurrentUser) -> CatalogFieldOptionsResponse: ...
```

Import the two service fns + the three models. No router registration change
(`catalogs/__init__.py` already collects the glazing router).

### 1.4 Seed migration — `00XX_seed_catalog_glazing_type_options.py` (next free rev)

Mirror `20260623_0038`: read `GLAZING_TYPE_OPTION_SEEDS`, insert each label with a
minted `option_id`, `order = index`, round-robin color, `ON CONFLICT DO NOTHING` on
the case-insensitive label index. `downgrade()` deletes
`WHERE catalog_table = 'glazing_types'`.

- Next free revision is ≈`0040` (latest head is `20260623_0039`) — **use whatever
  is free at implementation time** and set `down_revision` to the current head.
- Seed via the migration (not the row-seed script) so options exist independent of
  whether catalog rows were seeded — Phase 2 validates against them regardless.

## Tests

`backend/tests/test_catalog_field_options.py` already exists for frame and the
store is generic — extend it (or add a glazing-parameterized case) for:

- list returns the seeded glazing sets (manufacturer = 13, brand = N from Phase 0).
- add option → appears; case-insensitive label dup rejected.
- delete unused → succeeds; delete in-use without replacement → `catalog_option_in_use`.
- merge: delete A with `replacements[A]=B` → rows rewritten to B.

## Exit criteria

- `make ci` green. `GET/PUT …/glazing-types/options` reachable; seed produces the
  Phase 0 sets.
- The generic option models live in one shared place (relocate done) — no
  glazing→frame model import.

## Risks / notes

- **Field-key injection:** unchanged from frame — `_options_repository` allowlists
  the physical table and quotes `field_key` via `sql.Identifier`. Nothing new here.
- **`recompute_names` ordering** (see 1.2 note) — keep `edit` recompute-free until
  Phase 3 adds the derived name.
