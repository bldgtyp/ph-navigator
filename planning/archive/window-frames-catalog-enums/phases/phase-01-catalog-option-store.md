---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Complete (2026-06-23) — store + repo/service/routes/models + seed + tests landed; CI green
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 1 — build the generic, catalog-scoped, user-extensible single-select option store
RELATED:
  - ../decisions.md D-2 (store B, label-string), D-4 (inline add), D-7 (build generic)
  - ../research.md §3 (architecture tension), §5 (reuse inventory)
  - ./phase-00-canonical-vocab-and-cleanup.md (the seed payload)
  - ./phase-02-write-validation.md (first consumer of the store)
---

# Phase 1 — Catalog option store (backend)

## Goal

Stand up a **new catalog-scoped option store**: a global table + repository +
service + routes + Pydantic models that let users list/add/rename/merge/reorder/
delete the option set for a `(catalog_table, field_key)` pair, seeded with the
Phase 0 canonical sets. This is the foundation requirement #4 needs and the one
genuinely net-new build (research §6).

## Depends on / unblocks

- **Depends on:** Phase 0 (canonical sets to seed).
- **Unblocks:** Phase 2 (write-validation reads this store), Phase 5 (frontend
  manage-options UI), and — by design (D-7) — later glazing/materials adoption.

## Design decisions baked in

- **D-2 (B):** new global relational table, **not** the project-document
  `single_select_options` JSON map (that is document-scoped; catalogs are
  global). Reuse the *model* and *validators*, not the document accessors.
- **D-2 sub-choice:** rows store the option **label string** (columns stay TEXT);
  the store is the vocabulary registry, not an id-join target. Rename/merge is a
  row-rewrite, which is exactly the `OP-TO-FIX` cleanup tool.
- **D-7:** keys are `(catalog_table, field_key)` so glazing/materials reuse it
  with zero redesign.

## Reuse (research §5) — do not re-implement

- `SingleSelectOption` (`backend/features/project_document/rows.py:24-37`):
  `id` (`^opt_[A-Za-z0-9_-]+$`, ≤80), `label` (1-120, trimmed), `color`
  (`^#[0-9A-Fa-f]{6}$`), `order` (float). Use **as-is** for the option DTO.
- `validate_option_list(options)` (`.../project_document/options.py:73-119`) —
  document-independent; rejects duplicate ids/labels (case-insensitive trimmed),
  bad hex, bad order. Reuse directly. (Error code is
  `custom_field_option_list_invalid`; acceptable, or wrap with a catalog-specific
  code.)
- `mint_option_id()` (`.../options.py:161-163`) — `opt_<16 hex>`. Reuse.
- `OPTION_COLOR_PALETTE` (`.../options.py:151-158`) — default colors for minted
  options.
- **Not reusable:** `option_list_key`, `read_option_list`, `replace_option_list`,
  `remove_option_list` — these operate on a `ProjectDocumentV1` body. The catalog
  store is relational and needs its own repository.

## Work items

### 1.1 Migration — `20260623_0037_catalog_field_options.py`

(Next free revision; latest is `20260623_0036`. Follow the manual-revision,
no-autogenerate pattern of `20260603_0015_catalog_materials_flatten.py`.)

```sql
CREATE TABLE catalog_field_options (
    catalog_table TEXT    NOT NULL,          -- 'frame_types' | 'glazing_types' | 'materials'
    field_key     TEXT    NOT NULL,          -- 'manufacturer' | 'brand' | 'use' | ...
    option_id     TEXT    NOT NULL,          -- 'opt_<hex>'
    label         TEXT    NOT NULL,
    color         TEXT    NOT NULL,          -- '#rrggbb'
    "order"       DOUBLE PRECISION NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (catalog_table, field_key, option_id)
);
-- case-insensitive label uniqueness within a field (matches validate_option_list semantics)
CREATE UNIQUE INDEX ux_catalog_field_options_label
    ON catalog_field_options (catalog_table, field_key, lower(btrim(label)));
```

- `downgrade()` → `op.drop_table("catalog_field_options")` (reversible; non-
  destructive, unlike the flatten migrations).
- Do **not** seed in this migration body — seed via the option-seed step (1.5)
  to keep schema and reference data separable and re-runnable.

### 1.2 Repository — `backend/features/catalogs/_options_repository.py` (shared)

Place at the catalogs package root (sibling of `_shared.py`) since it serves all
three catalogs (D-7). Raw psycopg `sql`, mirroring `materials/repository.py`:

```python
def list_options(conn, *, catalog_table: str, field_key: str) -> list[dict[str, Any]]: ...
def list_all_for_table(conn, *, catalog_table: str) -> list[dict[str, Any]]: ...   # all six fields at once
def replace_options(conn, *, catalog_table: str, field_key: str,
                    options: list[SingleSelectOption]) -> None: ...                # full-list upsert+prune in one tx
def count_rows_using_label(conn, *, catalog_table: str, field_key: str, label: str) -> int: ...  # cascade guard
def rename_label(conn, *, catalog_table, field_key, old_label, new_label, user_id) -> int: ...   # also rewrites row cells (D-2)
```

- `replace_options` is the workhorse: diff incoming vs stored by `option_id`,
  insert new, update changed label/color/order, delete removed — all inside the
  caller's transaction.
- `count_rows_using_label` queries the owning catalog table
  (`catalog_frame_types`) `WHERE <field_key> = %(label)s AND deleted_at IS NULL`
  — the delete cascade-guard. `field_key` is validated against an allowlist
  before interpolation via `sql.Identifier` (never raw-format user input).

### 1.3 Models — extend `frame_types/models.py`

```python
class CatalogFieldOptionsResponse(BaseModel):       # one field's list
    field_key: str
    options: list[SingleSelectOption]

class CatalogFrameTypeOptionsResponse(BaseModel):   # all six at once (one fetch for the grid)
    fields: dict[str, list[SingleSelectOption]]      # {'manufacturer': [...], ...}

class EditCatalogOptionsRequest(BaseModel):
    field_key: str
    options: list[SingleSelectOption]                # full replacement list
    replacements: dict[str, str] = {}                # deleted_label -> replacement_label, for cascade (merge)
```

Validate `field_key ∈ {the six}` in the service, not the model, so the same DTO
serves glazing/materials later.

### 1.4 Service + routes — under the frame_types feature

Service (`frame_types/options_service.py` or fold into `service.py`):

- `list_frame_type_options() -> CatalogFrameTypeOptionsResponse` — `connection()`
  scope, one `list_all_for_table(conn, catalog_table="frame_types")`.
- `edit_frame_type_options(payload, user, request) -> CatalogFieldOptionsResponse`
  — `transaction()` scope:
  1. validate `field_key` ∈ six;
  2. `validate_option_list(payload.options)`;
  3. compute deleted labels = stored − incoming;
  4. **cascade guard:** for each deleted label with
     `count_rows_using_label > 0`, require a `replacements[label]` (merge target);
     reject with a catalog option-in-use error if absent;
  5. apply: `rename_label` for each merge (rewrites row cells to the target
     label), then `replace_options`;
  6. `log_catalog_action(conn, "catalog_options_edit", ...)`.

Routes (`frame_types/routes.py`, mirror existing CRUD + `CurrentUser`):

- `GET  /api/v1/catalogs/frame-types/options` → `CatalogFrameTypeOptionsResponse`
- `PUT  /api/v1/catalogs/frame-types/options` → `EditCatalogOptionsRequest` →
  `CatalogFieldOptionsResponse`

Register: routes already collected via `features/catalogs/__init__.py` → the
`main.py:86-87` include loop, so no wiring change beyond adding the handlers.

### 1.5 Seed step — initial option lists

Two viable mechanisms; pick **migration data-seed** for determinism:

- Add a second migration `20260623_0038_seed_catalog_frame_type_options.py` that
  inserts the Phase 0 canonical sets (read from
  `backend/features/catalogs/_option_seeds.py::FRAME_TYPE_OPTION_SEEDS`), minting
  `option_id` per label and assigning `order = index`, `color` round-robin from
  `OPTION_COLOR_PALETTE`. Idempotent via `ON CONFLICT DO NOTHING` on the label
  unique index.
- Alternative considered: extend `seed_frame_catalog.py` to also seed options —
  rejected: options should exist independent of whether catalog rows were seeded
  (Phase 2 validates against them regardless).

## Tests

`backend/tests/test_catalog_field_options.py` (new):

- list returns seeded canonical sets per field (counts match Phase 0: use=6,
  operation=7, location=6, mull_type=3, manufacturer=13, brand=23).
- add option → appears in list; label uniqueness (case-insensitive) rejected.
- delete unused option → succeeds.
- delete in-use option without replacement → rejected (cascade guard).
- merge (`OP-TO-FIX`-style): delete label A with `replacements[A]=B` → rows
  referencing A are rewritten to B; A removed.
- `validate_option_list` failures surface as the expected error code.

## Exit criteria

- `make ci` green (`ty check`, `ruff`, `pytest`).
- `GET/PUT …/frame-types/options` reachable; seed produces the exact Phase 0 sets.
- Store is field-key-generic (no frame-only assumptions in `_options_repository`)
  — confirmed by passing `catalog_table="glazing_types"` in a unit test even
  though glazing isn't wired this refactor.

## Risks / notes

- **`field_key` interpolation:** `count_rows_using_label`/`rename_label` build SQL
  against a dynamic column. Allowlist + `sql.Identifier` only — never f-string the
  column. This is the one injection-sensitive spot.
- **Order type:** `SingleSelectOption.order` is `float`; column is
  `DOUBLE PRECISION` to match (allows fractional reordering without renumbering).
- Keep all seed labels generic/public-repo-safe (no licensed product data).

## Completion (2026-06-23)

Built as planned, with these concrete decisions:

- **Migrations:** `20260623_0037_catalog_field_options.py` (table + functional
  unique index `ux_catalog_field_options_label` on
  `(catalog_table, field_key, lower(btrim(label)))`); `20260623_0038_seed_…`
  seeds the six frame-type fields from `_option_seeds.FRAME_TYPE_OPTION_SEEDS`
  (`ON CONFLICT DO NOTHING`). Single alembic head `20260623_0038`. **No FK** to
  the row tables (label-string storage) → options survive `clean_catalog_tables`.
- **Repository** `features/catalogs/_options_repository.py` (shared, generic):
  `list_options`, `list_all_for_table`, `replace_options` (full DELETE+INSERT —
  lists are tiny, avoids upsert label-collision ordering), `count_rows_using_label`,
  `rename_label`. Physical table from a fixed allowlist; `field_key` via
  `sql.Identifier`.
- **Service** `frame_types/options_service.py`: `list_frame_type_options`,
  `edit_frame_type_options` (validate field ∈ six → `validate_option_list` →
  in-place renames rewrite rows → delete/merge cascade → `replace_options`), and
  the reusable `seed_frame_type_options(conn)` (also used by the test fixture).
- **Models** added to `frame_types/models.py`: `CatalogFieldOptionsResponse`,
  `CatalogFrameTypeOptionsResponse`, `EditCatalogOptionsRequest`.
- **Routes** `GET/PUT /api/v1/catalogs/frame-types/options`, declared **before**
  `/{record_id}` (Starlette declaration-order match).
- **Errors:** `catalog_field_key_unknown` (422), `catalog_option_in_use` (409),
  `catalog_option_replacement_unknown` (422); option-list shape reuses
  `custom_field_option_list_invalid` (422).
- **Tests:** `tests/test_catalog_field_options.py` (10) — canonical counts,
  add, case-insensitive dup reject, delete-unused, cascade-guard, merge,
  in-place rename, replacement-not-in-list, unknown-field-key, generic store.
  Module autouse fixture resets `catalog_field_options` per test for isolation.
- **Verification:** full backend suite **978 passed, 2 skipped**; `ruff`/`ty`
  clean.

**Note for Phase 2:** existing frame tests in `test_catalogs_frame_types.py` use
non-canonical values (`manufacturer="Skyline"`, `brand="Ridge"`). They pass now
(no write-validation yet) but Phase 2's strict check will reject them — Phase 2
must update those payloads to canonical option values (or add the options).
