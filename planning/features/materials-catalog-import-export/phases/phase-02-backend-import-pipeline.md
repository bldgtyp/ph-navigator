---
DATE: 2026-06-03
TIME: 22:00 EDT
STATUS: Implemented on `feat/materials-catalog-import-export`.
        See "What actually shipped" below for deltas from the
        original spec (review-pass fixes folded back).
AUTHOR: Claude (Opus 4.7)
SCOPE: Server-owned import pipeline + preview/commit endpoints for
       the Materials Catalog.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - phase-01-backend-external-id.md
  - ../../../../backend/features/catalogs/materials/
---

# Phase 2 — Backend Import Pipeline

## Objective

Land the complete import pipeline behind two new endpoints:

- `POST /api/v1/catalogs/materials/import/preview` — parse,
  upgrade, coerce, validate, dedup, return a dry-run report and a
  commit token.
- `POST /api/v1/catalogs/materials/import/commit` — replay the
  cached write set under a token in a single DB transaction.

All logic lives in the backend so a future MCP / CLI caller can
reuse the same endpoints with the same semantics (PRD Resolved
Decision §5).

Export needs no backend work — the frontend serializes from the
list response (which already includes `id` on every row).

## Module layout

New package
`backend/features/catalogs/materials/import_export/` with:

| file | purpose |
|---|---|
| `file_format.py` | Pydantic models for the JSON envelope (`CatalogFile`, `CatalogFileRow`) and current schema version constant. |
| `upgrade.py` | Per-version upgrade functions and the upgrade-chain runner. v1-only at first; the chain is `upgrade_chain: dict[int, Callable[[dict], dict]]` with one entry. |
| `coerce.py` | Pure per-row coercion / validation. Returns `(row_or_none, warnings, errors)`. |
| `pipeline.py` | Orchestration: parse → envelope check → upgrade → coerce → dedup → assemble preview report. No DB writes. |
| `tokens.py` | In-memory token cache: `mint_token(write_set) -> str`, `consume_token(token) -> write_set or None`. TTL = 10 min. |
| `service.py` | Public entry points: `preview_import(file_bytes, user) -> PreviewReport`, `commit_import(token, user) -> CommitReport`. |

Routes live in the existing
`backend/features/catalogs/materials/routes.py` (two new handlers).

## File format types

```python
class CatalogFileRow(BaseModel):
    model_config = ConfigDict(extra="allow")  # unknown keys
                                              # surfaced as warnings
    id: str | None = None
    name: str | None = None
    category: str | None = None
    density_kg_m3: float | None = None
    specific_heat_j_kgk: float | None = None
    conductivity_w_mk: float | None = None
    emissivity: float | None = None
    color: str | None = None
    source: str | None = None
    url: str | None = None
    comments: str | None = None


class CatalogFile(BaseModel):
    kind: Literal["ph-navigator.catalog.materials"]
    schema_version: int
    exported_at: datetime
    exported_by: str | None = None
    app_version: str | None = None
    rows: list[CatalogFileRow]
```

`extra="allow"` is deliberate — we want unknown keys in the parsed
dict so the coerce step can warn about them, not silently drop them
during model validation.

## Upgrade chain (v1)

`upgrade.py` exposes:

```python
CURRENT_SCHEMA_VERSION = 1

upgrade_steps: dict[int, Callable[[dict], dict]] = {
    # 0 → 1: hypothetical legacy step (PRD examples).
    # Wire it in for testability even though no v0 file is in the
    # wild yet — a unit test feeds a fabricated v0 file through
    # the chain.
    0: _upgrade_v0_to_v1,
}

def upgrade_row(row: dict, from_version: int) -> tuple[dict, list[str]]:
    """Run row through upgrade_steps[from_version], upgrade_steps[from_version + 1], …
    until CURRENT_SCHEMA_VERSION. Returns (upgraded_row, warnings).
    Raises if from_version > CURRENT_SCHEMA_VERSION (newer file).
    """
```

`_upgrade_v0_to_v1` demonstrates the renaming rule:
`source_provenance` → `source`, `notes` → `comments`. Used only by
tests in v1; protects the chain from future breakage.

## Coercion rules (per row)

For each field, in order:

| field | rule on mismatch |
|---|---|
| `id` | optional. If present, must match the `rec` + 14 base62-char shape (`^rec[A-Za-z0-9]{14}$`); malformed → row is **errored** with warning `bad_id`. Absent → row will be assigned a fresh id at insert (see Dedup). |
| `name` | required; empty → row is **errored** (excluded from write set, reported in `errors`). |
| `category` | resolve against the twelve option ids (case-insensitive on id, then on display label). No match → blank + warning `unknown_category`. |
| `density_kg_m3`, `specific_heat_j_kgk`, `conductivity_w_mk`, `emissivity` | coerce numeric strings (`"0.0548"`) to float. Negative or non-finite → blank + warning `bad_number`. Emissivity outside `[0, 1]` → blank + warning `emissivity_range`. |
| `color` | accept `#rrggbb` (case-insensitive). Accept legacy ARGB tuple `"a,r,g,b"` and convert (drop alpha). Anything else → blank + warning `bad_color`. |
| `source`, `url`, `comments` | string-coerce; trim whitespace. URL is not validated as an actual URL — keep it permissive. |
| **unknown keys** | dropped + warning `unknown_field:<key>`. |

The coerce step's contract:

```python
def coerce_row(row: dict) -> CoercedRow:
    """Returns CoercedRow with .row (clean dict or None),
    .warnings: list[Warning], .errors: list[Error]."""
```

A row with any `errors` is excluded from the write set. Warnings
do not exclude the row.

## Dedup

After coerce, partition rows:

- `new`: `id` is None, **or** `id` is not None
  but no existing `catalog_materials.id` matches.
- `matched`: `id` is not None **and** matches an existing
  row.

MVP policy is **Skip matches**, so `matched` rows are dropped from
the write set. They appear in the preview counts as
"matched (will be skipped)" so the user understands.

## Preview report shape

```python
class PreviewReport(BaseModel):
    token: str
    schema_version: int
    counts: PreviewCounts  # new, matched, errored, warnings
    warnings: list[PreviewWarning]  # grouped by reason, with row indices
    errors: list[PreviewError]
    rows_preview: list[PreviewRow]  # first N rows for UI display
```

The full normalized write set is **not** in the response — only
the summary. The token references the cached write set on the
server.

## Token cache

`tokens.py` exposes:

```python
def mint_token(write_set: WriteSet, user_id: str) -> str: ...
def consume_token(token: str, user_id: str) -> WriteSet | None: ...
```

- In-memory dict keyed by token (uuid4).
- Entries expire after 10 minutes (TTL stored alongside the value).
- `consume_token` removes the entry on success (one-shot).
- Scoped to `user_id` so a stolen token can't be replayed by
  another session.
- A janitor task (or lazy expiry on `consume_token`) reaps stale
  entries.

Documented limitation: process-local. In a multi-worker deploy a
preview generated by worker A and committed against worker B
would 410 Gone. Acceptable for MVP (single backend process in dev);
revisit when we go multi-worker.

## Routes

```python
@router.post("/import/preview", response_model=PreviewReport)
def preview_import_route(
    request: Request,
    file: UploadFile,  # or raw JSON body — see note below
    auth: CurrentUser,
) -> PreviewReport: ...


@router.post("/import/commit", response_model=CommitReport)
def commit_import_route(
    payload: CommitRequest,  # { token: str }
    request: Request,
    auth: CurrentUser,
) -> CommitReport: ...
```

Note on body: `multipart/form-data` upload via `UploadFile` is
the most browser-friendly form and matches the file-picker UX.
Confirm during implementation that `UploadFile` works smoothly
with the frontend `fetch` call from the modal; if `application/json`
with the file contents inlined is simpler, do that instead — both
satisfy the contract.

**Body size limit.** Configure FastAPI / Uvicorn to cap upload at
**8 MB** (catalogs are small; a 1000-row file is ~200 KB). Reject
larger bodies at the framework layer with a 413.

## Permission

`CurrentUser` already enforces auth. Catalog edits are
catalog-admin-only today (see existing `routes.py`); preview is
allowed for any authenticated user; commit requires the same
permission as `create_material`. Match the existing pattern —
don't invent a new one.

## Tests

Add `backend/tests/catalogs/test_materials_import.py`:

1. **Envelope check.** Bad `kind` → 400.
2. **Schema version newer than current** → 400 with a clear
   message.
3. **Round-trip.** Seed three rows; GET the list, build a file
   from it, preview → counts.new == 0, counts.matched == 3;
   commit → 0 inserts; DB unchanged.
4. **Seed empty.** Empty DB; preview a 5-row file → counts.new
   == 5; commit → 5 inserts, all with fresh `id`s.
5. **Coercion paths.** One row per warning type
   (unknown_category, bad_number, emissivity_range, bad_color,
   unknown_field). Assert the warning is present in the report
   and (where applicable) the value lands blank.
6. **Required-field error.** Row with missing `name` is in
   `errors`, excluded from write set, does not block other rows.
7. **Upgrade chain.** Fabricated v0 file with `notes` /
   `source_provenance` → after preview, those values land under
   `comments` / `source` in `rows_preview`.
8. **Token lifecycle.** Commit with stale token → 410. Commit
   with token from a different user → 403. Commit twice with the
   same token → second call 410.
9. **Atomicity.** Mock a DB failure mid-batch; assert no rows
   were inserted and the response is a 500 with an error report.

## Verification

- `cd backend && uv run pytest tests/catalogs/test_materials_import.py` green.
- `make check-backend` green.
- Manual `curl`: preview a hand-rolled JSON file, inspect the
  report, commit, confirm rows appear in
  `GET /api/v1/catalogs/materials`.

## Out of scope

- Update-matches / add-all-as-new policies.
- Frontend modal (Phase 3).
- Frame / Glazing catalogs.
- Multi-worker token store (Redis etc.).

## What actually shipped (deltas from spec)

The `/simplify` precision review on the first cut surfaced seven
issues; all seven were fixed before merge. The deltas the frontend
in Phase 3 needs to know about:

1. **Negative `schema_version` → 400.** The envelope check rejects
   negative versions explicitly so the upgrade chain never crashes
   on them. Error code: `catalog_import_bad_envelope`.

2. **ARGB tuple `a,r,g,b` with alpha=0 → `null` (not `#000000`).**
   Legacy WUFI exporters use `0,0,0,0` as a "no color set" sentinel
   (see `research/Material Data-Grid view.csv`). The coerce step
   treats alpha=0 as None rather than collapsing to opaque black.

3. **Length caps on text fields.** `coerce.py` mirrors
   `_CatalogMaterialFields` (`models.py`): name ≤ 200, source ≤
   400, url ≤ 2000, comments ≤ 4000, color ≤ 40. Oversize values
   blank + warn (`field_too_long:<field>`). Oversize `name` chains
   to `missing_name` and errors the row. This stops the import
   path from landing values that later PATCH would 422-reject.

4. **`build_preview` takes `existing_ids: dict[str, bool]`**, not
   `set[str]`. The bool is the active flag. Inactive-id matches
   still classify as `matched` (and skipped), but surface a
   `matched_inactive_skip` warning so the user knows their
   re-import did not land. Frontend should render that warning
   prominently for matched-inactive cases.

5. **Race-safe commit via per-row SAVEPOINT.** Each insert runs
   inside `SAVEPOINT import_row_<i>`; a `psycopg.errors.UniqueViolation`
   (i.e. another writer landed the same file-supplied id between
   preview and commit) ROLLBACK-TO-SAVEPOINTs and the row is added
   to `CommitResponse.skipped_conflict_ids`. Non-conflict errors
   still propagate and abort the whole batch (atomicity test #9
   continues to hold).

6. **`CommitResponse` has a new field.** Final shape:
   ```python
   class CommitResponse(BaseModel):
       inserted: int
       inserted_ids: list[str]
       skipped_conflict_ids: list[str] = []
   ```

7. **Route is async + streaming body read.** `POST /import/preview`
   reads the body via `request.stream()` with a running byte cap,
   so the 8 MB limit kicks in WHILE streaming — chunked
   Transfer-Encoding without a Content-Length header is also
   bounded. JSON parsing happens after the size guard, not before.
   Returns 413 (`catalog_import_too_large`) on oversize. Also
   handles malformed JSON with a clean 400
   (`catalog_import_bad_json`).

8. **Label-id map drift guard.** `coerce.py` asserts at module
   load that `set(_CATEGORY_LABEL_TO_ID.values()) ==
   set(MATERIAL_CATEGORY_IDS)`. A future PR adding a thirteenth
   category id without extending the label map fails CI at import
   time. A regression test (`test_label_to_id_map_matches_canonical_ids`)
   provides a second line of defense.

### Final error-code surface

| HTTP | error_code | trigger |
|---|---|---|
| 400 | `catalog_import_bad_json` | body is not valid JSON |
| 400 | `catalog_import_bad_envelope` | missing/bad `kind`, missing/bad/negative `schema_version`, non-array `rows` |
| 400 | `catalog_import_schema_too_new` | `schema_version > CURRENT_SCHEMA_VERSION` |
| 403 | `catalog_import_token_forbidden` | commit token belongs to another user |
| 410 | `catalog_import_token_missing` | commit token never minted, expired, or already consumed |
| 413 | `catalog_import_too_large` | body exceeds 8 MB (streamed) |

### Final warning / error reason codes (per row)

Warnings (recoverable; row still imports):

- `unknown_field:<key>` — file row has a key not in the canonical set
- `unknown_category` — file value didn't match any id or label
- `bad_number` — non-numeric / negative / non-finite numeric field
- `emissivity_range` — emissivity > 1.0
- `bad_color` — color was neither `#rrggbb` nor a valid ARGB tuple
- `field_too_long:<field>` — value exceeded that field's cap
- `matched_inactive_skip` — row matched a soft-deleted catalog id

Errors (row excluded from write set):

- `bad_id` — `id` did not match `^rec[A-Za-z0-9]{14}$`
- `missing_name` — name absent, empty, or blanked by `field_too_long`
- `missing_category` — category absent or unknown
- `bad_row_shape` — row entry was not a JSON object
