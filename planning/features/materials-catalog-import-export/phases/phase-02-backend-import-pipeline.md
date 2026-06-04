---
DATE: 2026-06-03
TIME: 22:00 EDT
STATUS: Draft for implementation.
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
list response (which already includes `external_id` after Phase 1).

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
    external_id: str | None = None
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

- `new`: `external_id` is None, **or** `external_id` is not None
  but no existing `catalog_materials.external_id` matches.
- `matched`: `external_id` is not None **and** matches an existing
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
   == 5; commit → 5 inserts, all with fresh `external_id`s.
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
