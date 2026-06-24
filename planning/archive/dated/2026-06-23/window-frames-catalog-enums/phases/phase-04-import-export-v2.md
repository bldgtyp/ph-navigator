---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Complete (2026-06-23) — import v2: fold + compute-name + auto-add; CI green
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 4 — import schema v2: fold legacy values into options, compute name on import, drop missing-name gate
RELATED:
  - ../research.md §4 (import is the main backend work)
  - ./phase-00-canonical-vocab-and-cleanup.md (the fold map), ./phase-03 (name composer)
  - backend/features/catalogs/frame_types/import_export/*
---

# Phase 4 — Import / export v2 (backend)

## Goal

Bump the catalog file `schema_version` 1→2 and add an **upgrade step** that folds
legacy/typo values into canonical options and computes `name` from the parts on
import — so the committed seed (which loads *through this pipeline* —
`scripts/seed_frame_catalog.py:64-78`) and any user import both arrive clean and
validated. This is where Phase 0's fold map does its work.

## Depends on / unblocks

- **Depends on:** Phase 1 (option store / resolution target), Phase 2
  (`_validate_single_selects`), Phase 3 (`compose_frame_name`).
- **Unblocks:** Phase 5 (frontend import dialog → v2), Phase 6 re-seed.

## Why import is the load-bearing cleanup path

The seed is not raw SQL — it replays `preview_import → commit_import`. So:
- folding `OP-TO-FIX → OP-to-FX` in the **upgrade chain** cleans the seeded rows
  on the next `seed_frame_catalog.py` run;
- the same upgrade serves user-supplied v1 files;
- ⇒ **no separate in-place row-rewrite migration** (no deploy/no users).

## Work items

### 4.1 Bump schema version

`import_export/file_format.py:10`: `CURRENT_SCHEMA_VERSION: Final[int] = 2`.
`CatalogFile.schema_version` stays `int`; `CatalogFileRow` (`:15-43`) is unchanged
(it already has the six fields + accepts extras).

### 4.2 Upgrade step v1 → v2 (`import_export/upgrade.py`)

Extend the existing chain (`_upgrade_v0_to_v1` `:20-26`, `upgrade_row` `:38-55`)
with `_upgrade_v1_to_v2(row)`:

- **Fold values** using Phase 0's `FRAME_TYPE_VALUE_FOLDS` (lower(trim) → canonical)
  for each of the six: `OP-TO-FIX → OP-to-FX`, casing variants → canonical.
- **Swapped Mercury row:** if `(manufacturer, brand)` matches the transposed pair
  (`Mercury` / `CURRIES`), rewrite to `(Curries, Mercury)`.
- **`Default` artifact row:** drop the row entirely (return a sentinel the
  pipeline filters) — it must not seed a `Default` manufacturer option (D-6; the
  real default is the `recPHNDefFrame001` sentinel, Phase 3).
- **`source` casing:** fold `manufacturer` → `Manufacturer`.
- `name` is **not** upgraded here — it is computed after resolution (4.4).

Register `_upgrade_v1_to_v2` in `upgrade_steps[1]`; `upgrade_row` chains 0→1→2.
`SchemaVersionTooNewError` for `from_version > 2` stays.

### 4.3 Option-resolution on import

After folding, each of the six must resolve to a **known option** (the Phase 1
store). Two sub-policies — pick per D-4 intent:

- **Auto-add (recommended, matches D-4 "frictionless add"):** an unknown-but-clean
  value (e.g. a genuinely new `brand`) is added to the option store via the Phase 1
  `replace_options`/add path during commit, then accepted. Surface a preview
  warning (`new_option:<field>`) so the import isn't silently growing vocab.
- **Flag-only:** unknown value → row errored, user adds the option first. Stricter,
  more friction. Use only if Ed wants curated vocab for `brand`/`manufacturer`.

Implement in the pipeline/commit layer (it needs DB access to the store), not in
the pure `coerce_row`. Preview (`pipeline.build_preview` `:64`) classifies; commit
(`import_export/service.commit_import` `:124`) performs the add inside its
transaction.

### 4.4 Coerce: drop missing-name gate, compute name

`import_export/coerce.py`:
- Remove `ERR_MISSING_NAME` (`:29`) and the name-validation gate (`:100-110`,
  early-return at `:113`). `name` is no longer a required inbound field.
- Remove `"name"` from `_CANONICAL_FIELDS` (`:71`) as an *input* (it becomes
  computed output). Keep the 200-char guard concept — apply it in
  `compose_frame_name` (Phase 3 already clamps to 200).
- After the six are folded + resolved, compute `name = compose_frame_name(row)`
  and stamp it on the coerced row so the insert carries it.
- Keep `_FIELD_MAX_LENGTHS` (`:32-47`) for the other text fields.

### 4.5 Export

- `name` continues to serialize (now computed) — export is unchanged on the wire
  for `name`.
- The six serialize as **labels** (not `opt_*` ids), consistent with the
  label-string storage (D-2) and `planning/archive/table-csv-download` D4.
- Bump exported `schema_version` to 2.

## Tests

`backend/tests/test_catalog_frame_types_import*.py`:

- **Round-trip:** export current catalog → import → identical rows (incl. computed
  `name`).
- **Legacy v1 file** with `OP-TO-FIX` and **no `name`** imports clean as v2:
  `mull_type` folded to `OP-to-FX`, `name` computed, no `missing_name` error.
- Swapped `Mercury | CURRIES` row imports as `manufacturer=Curries, brand=Mercury`.
- `Default` artifact row is dropped (not inserted; preview counts reflect it).
- Unknown `brand` under auto-add policy → option created + row inserted + preview
  `new_option` warning; under flag-only policy → row errored.
- **Seed parity:** running the real `seed_frame_catalog.py` over the cleaned
  `frame-types.v1.json` yields 0 errors and the Phase 0 option/name sets.

## Exit criteria

- `make ci` green.
- A v1 file with `OP-TO-FIX` + missing `name` imports clean as v2; round-trip is
  identity; seed script runs error-free.

## Risks / notes

- **Second-highest-risk site** (after default-by-id). The upgrade + resolution +
  name-compute order matters: fold → resolve/auto-add → compute name → validate.
  Get the order wrong and either name is computed from dirty values or validation
  rejects a value the upgrade was about to fix.
- Auto-add during commit must be inside the commit transaction so a failed row
  doesn't leak a half-added option.
- Keep the cleaned seed JSON public-repo-safe.

## Completion (2026-06-23)

**D-4 sub-policy decided by Ed: AUTO-ADD (frictionless).** An import value that
is unknown after folding is added to the option store on commit (with a
`new_option:<field>` preview warning), rather than erroring the row. (Asymmetric
with create/patch, which reject unknown values — documented in
`import_export/service.py`.)

- **`file_format.CURRENT_SCHEMA_VERSION` 1→2.**
- **`upgrade._upgrade_v1_to_v2`** (reads the frozen Phase 0 maps from
  `_option_seeds`): drop the `Default` row (→ `None`, a new `dropped` count),
  fix the transposed `Mercury/CURRIES` pair, then value-fold (`OP-TO-FIX →
  OP-to-FX`, `source manufacturer → Manufacturer`). `upgrade_row` now returns
  `dict | None`. Order: **drop → swap → fold**.
- **`coerce`**: dropped `ERR_MISSING_NAME`; `name` is computed via
  `compose_frame_name` (now a leaf `frame_types/_name.py` so coerce doesn't
  import the service) on the folded+coerced parts; inbound `name` ignored.
- **`pipeline.build_preview(known_options=…)`**: flags `new_option:<field>` for
  unknown new-row values and collects them into `WriteSet.new_options`; threads a
  `dropped` count.
- **`service.commit_import`**: `_auto_add_new_options` delegates to the new
  generic `_options_repository.append_options` (case-insensitive dedup against the
  unique index), inside the insert transaction. `preview_import` snapshots
  `known_options`.
- **No export endpoint exists**, so §4.5 was N/A; the "round-trip" became a
  **seed-parity** test (the cleaned seed imports clean through v2: 0 errored /
  dropped, 189 new, 0 new-option).
- **Tests:** v1 `OP-TO-FIX` fold + computed name; swapped-Mercury fix; `Default`
  drop; auto-add + warning; missing-name now computed (not errored); seed parity;
  `append_options` case-insensitive dedup. Import-module autouse option-reset.
- **4-agent simplify review** caught + fixed a real case-insensitivity bug in
  auto-add (two case-variant values would have collided on the unique index) and
  extracted the leaf `_name.py` + the generic `append_options` helper.
- **Verification:** full backend suite **991 passed, 2 skipped** (pre-simplify);
  re-run green after the simplify fixes; head `20260623_0039`.
