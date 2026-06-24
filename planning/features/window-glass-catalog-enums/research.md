---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Research backing the window-glass-catalog-enums refactor
RELATED: ./README.md, ./PLAN.md, ./decisions.md
---

# Research — Window-Glazing Catalog enum + derived-name refactor

All claims cited to `file:line` at the state of 2026-06-24. This refactor mirrors
the completed `window-frames-catalog-enums`; where the mechanics are identical the
frame archive is cited rather than repeated.

## 0. What already exists from the frame refactor (the reuse inventory)

The frame refactor (merged 2026-06-24) built everything generic. **Glazing reuses,
it does not rebuild:**

- ✅ **Option store table** `catalog_field_options` — migration `20260623_0037`;
  keyed `(catalog_table, field_key, option_id)`, label-string storage, functional
  unique index `ux_catalog_field_options_label` on
  `(catalog_table, field_key, lower(btrim(label)))`. **No new table needed.**
- ✅ **Shared repository** `backend/features/catalogs/_options_repository.py` — its
  `_PHYSICAL_TABLE` allowlist *already* maps `"glazing_types" → "catalog_glazing_types"`
  (`_options_repository.py:30-34`). `list_options`, `list_all_for_table`,
  `replace_options`, `count_rows_using_label`, `rename_label`, `seed_options`,
  `append_options` are all `catalog_table`-parameterized — **zero changes**.
- ✅ **Seeds/fold module** `backend/features/catalogs/_option_seeds.py` — currently
  frame-only; glazing adds `GLAZING_TYPE_OPTION_SEEDS` /
  `GLAZING_TYPE_SINGLE_SELECT_FIELDS` / `GLAZING_TYPE_VALUE_FOLDS` constants here.
- ✅ **`SingleSelectOption`** model + `validate_option_list` / `mint_option_id` /
  `OPTION_COLOR_PALETTE` (`project_document/rows.py`, `project_document/options.py`)
  — reused as-is.
- ✅ **Derived-name pattern** — frame's `frame_types/_name.py` (`compose_frame_name`),
  the SQL twin `repository._COMPOSE_NAME_SQL`, `repository.recompute_names`, and the
  backfill migration `20260623_0039` are the exact template for the 3-part glazing
  composer.
- ✅ **Default-resolution by id** — `default_refs.get_default_glazing` (`:86-96`)
  already fetches the sentinel by `APERTURE_DEFAULT_GLAZING_ID` (`recPHNDefGlazng01`,
  `envelope_models.py:37`), **not** by name. (The frame refactor's D-5 covered both
  catalogs.) So a derived (possibly empty) sentinel name does **not** break the
  default lookup — see §3.
- ✅ **Import-v2 machinery** — frame's `import_export/{file_format,upgrade,coerce,
  tokens,pipeline,service}.py` show the full pattern (schema bump, value folds,
  derived-name on import, auto-add unknown options, `dropped` count). Glazing
  mirrors it (Phase 4).
- ✅ **Frontend single-select UX** — `SingleSelectCell`/`SingleSelectPopover`,
  `FieldOption`, the `legacyOptions` schema-mutation, the frame
  `fieldDefs.ts`/`controller.ts` id↔label translation — all reusable templates
  (Phase 5).

**Genuinely net-new for glazing:** a `glazing_types/options_service.py`, a
`glazing_types/_name.py`, the two glazing migrations (seed + name backfill), the
write-validation hook, the import-v2 upgrade, and the frontend wiring — all *thin
mirrors* of frame code, plus the glazing option/fold constants.

## 1. Current data shape

The glazing-types catalog is a **relational table** (`catalog_glazing_types`),
flattened in `backend/alembic/versions/20260604_0016_catalog_glazing_types_flatten.py`.
The promoted fields plus `suffix` are `Text`, nullable:

- **`manufacturer`** / **`brand`** — `str | None`, `max_length=200`
  (`glazing_types/models.py:67-68`). These become single-select.
- **`suffix`** — `str | None`, `max_length=80` (`models.py:69`). **Stays text.**
- **`name`** — required, user-editable column (`models.py:97` create
  `min_length=1 max_length=200`; update patches it). Becomes derived/read-only.
- There is **no UNIQUE** on `name`, only a partial active-name index. No composite
  uniqueness on `(manufacturer, brand, suffix)`; identity is the `id` UUID.

### The seed proves the motivation

`backend/seeds/catalogs/glazing-types.v1.json` — `schema_version: 1`, **43 rows**,
a `bldgtyp:airtable-export`. Distinct values (the candidate option sets):

- **manufacturer (14 distinct, with drift):** `Alpen`(3), `Internorm`(4),
  `Kawneer`(7), `Lamilux`(1), `Lepage`(1), `Mercury`(1), `Rehau`(1), `smartwin`(5),
  `Tishler`(1), `Viking`(5), `Wythe`(1) — already canonical; plus three **drift
  cases**: `INTUS`(10) → should fold to `Intus`, `ZOLA`(1) → `Zola` (both
  title-cased in the frame catalog), and `DEFAULT`(2) → an artifact (D-6). After
  folding: 13 canonical manufacturers, all already present in the frame
  manufacturer set except `Lepage` (glazing-only) — good cross-catalog consistency.
- **brand (~40 distinct, near-unique):** glass make-up strings, almost all
  appearing once — e.g. `4-18Ar-4-18Ar-4`, `44.2_CG/12Ar/4/14Ar/CG_6`,
  `Cardinal 5-272/12/5/12/180-5`, `Door Panel`, `LOUVER`, `TRIO-E`. Only `GL-1`,
  `GL-4` repeat (×2). `1 W/m2-k` / `2 W/m2-k` are the two `DEFAULT`-row brands.
  ⇒ **High-cardinality identity field**, see `decisions.md` D-1.
- **suffix (8 distinct + 33 null):** `3CK-IL`, `48Y-IL-1`, `48Y-IL-2`,
  `ClimaGuard 1.0`, `Horizontal`, `L`, `P48`, `S`, `T`(×2). Stays free text.

## 2. NAME-as-formula is lossless (against the cleaned seed)

Ed's formula composes `name = manufacturer | brand | suffix`, dropping null/empty
parts with ` | ` separators. Verified against the seed:

| Row `name` (stored) | manufacturer / brand / suffix |
|---|---|
| `Alpen \| 1-3/8" OA, SolarControl-6 TGT, Triple Pane, Argon Fill, Tempered, 3/16"` | Alpen / `1-3/8" OA, …` / null |
| `INTUS \| 6_CG/12Ar/4/16Ar/CG_4` | INTUS / `6_CG/12Ar/4/16Ar/CG_4` / null |
| `ZOLA \| 4-18Ar-4-18Ar-4 \| ClimaGuard 1.0` | ZOLA / `4-18Ar-4-18Ar-4` / **ClimaGuard 1.0** |
| `DEFAULT \| 1 W/m2-k` | DEFAULT / `1 W/m2-k` / null |

So composing `manufacturer | brand | suffix` (drop null/empty, ` | ` separator)
reproduces every existing `name`. **Caveat:** for the drift rows the *canonical*
derived name changes by design — `INTUS | …` → `Intus | …`, `ZOLA | … | …` → `Zola
| … | …`. That is the intended cleanup; name is lossless against the **cleaned**
seed, not the raw one. All 43 rows have a non-null manufacturer, so the formula's
leading `MANUFACTURER` (no `IF` guard) is satisfied for real rows; the composer
still drops a null manufacturer gracefully (matters only for the all-null
sentinel, §3).

**The formula engine needs no change** — same conclusion as frame (the
project-document formula engine already supports `IF`/`&`/AirTable-truthiness),
but, as with frame, catalogs are not formula-capable, so `name` is **computed
server-side in Python** (D-3 below), not run as a live formula field.

## 3. The default-glazing sentinel (why derived name is safe)

The `PHN-Default-Glazing` sentinel is seeded by migration
`20260605_0018_apertures_default_catalog_seed.py` with **id `recPHNDefGlazng01`,
`name = "PHN-Default-Glazing"`, and `manufacturer`/`brand`/`suffix` all NULL**
(only `u_value_w_m2k`/`g_value`/`color`/`source` set). Two consequences:

1. Its derived name would compose to `""`, but `GlazingRef.name` requires
   `min_length=1` (`envelope_models.py:122-125`). ⇒ `recompute_names` for glazing
   **must skip the sentinel** (exactly as frame skips `recPHNDefFrame001` —
   `frame_types/repository.py:264-281`), so it keeps its seeded label.
2. The default lookup resolves by **id**, not name (`default_refs.py:86-96`), so
   the empty-derived-name does not break aperture creation. **No default-resolution
   change is required** — this was already handled by the frame refactor.

The two `DEFAULT`-manufacturer *seed* rows (`DEFAULT | 1 W/m2-k`, `DEFAULT | 2
W/m2-k`) are **distinct** from this sentinel — they are AirTable rows in the seed
file, not the migration-seeded sentinel. See `decisions.md` D-6.

## 4. Downstream-consumer blast radius

Mapped every reader of glazing `name` and the two promoted fields. **Smaller than
frame; no frontend-consumer breakage.**

### `name` as a key — none that break

- **Default-glazing lookup** already resolves by id (`default_refs.py:86-96`) — no
  change (§3, §0).
- **Pickers / refs** filter on `manufacturer` and dedupe on `catalog_record_id`,
  never on `name` (`glazing_types/repository.py:74-95` filters manufacturer;
  aperture refs aggregate on record id). `GlazingRef` copies `name` for display —
  keeps working; it just reads the computed value.

### Drift comparator — drop `name`

`backend/features/aperture_drift/comparator.py:40-50` still lists `"name"` in
`_GLAZING_KEYS` (line 41). Once `name` is derived it can never drift independently
of its parts (which are already compared), so **drop `"name"` from `_GLAZING_KEYS`**
— mirroring the frame change to `_FRAME_KEYS` (`comparator.py:21-22`, already done).
Cosmetic; removes a duplicate delta.

### Import / export — the main backend work (Phase 4)

`glazing_types/import_export/` is still **schema v1**:
`file_format.CURRENT_SCHEMA_VERSION = 1`; coerce has an `ERR_MISSING_NAME` gate
(name is a *required* input) with a 200-char check; `upgrade.py` has only the
v0→v1 rename step; `pipeline.py`/`service.py`/`tokens.py` have no option-resolution
or auto-add. Frame's v2 versions are the template. See `phases/phase-04`.

### Other readers — no change

MCP, `aperture_u_value`, hbjson export, and seeds read the fields as plain
strings; enum values are still strings, so they keep working.

## 5. What is genuinely missing (new build, all thin mirrors of frame)

- Glazing option/fold **constants** in `_option_seeds.py`.
- A **seed migration** (manufacturer + brand options) + a **name-backfill
  migration** — mirror `20260623_0038` / `20260623_0039`.
- `glazing_types/options_service.py` + the generic option **models** + the
  `GET/PUT …/glazing-types/options` **routes**.
- **Write-validation** on `manufacturer` + `brand` in `glazing_types/service.py`.
- `glazing_types/_name.py` (`compose_glazing_name`) + `repository._COMPOSE_NAME_SQL`
  + `repository.recompute_names` + service create/patch wiring.
- **Import schema v2** with casing fold + derived-name-on-import + auto-add.
- **Seed-data cleanup** of `glazing-types.v1.json` (Phase 0).
- **Frontend** single-select + read-only name + inline-add (Phase 5).
