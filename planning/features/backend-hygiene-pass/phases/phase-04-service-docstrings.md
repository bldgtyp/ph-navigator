---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Not started
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 4 — docstring pass on transactional public service
       functions. No behavior changes.
EFFORT: ~45 min
BUCKET: Now
DEPENDS_ON: none
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §3.2
  - `context/CODING_STANDARDS.md` (docstring "why" bar)
  - `backend/database.py` (model for what a good docstring looks like)
---

# Phase 4 — Service docstring pass

## Goal

Add a one-paragraph docstring to every public service function that
manages a transaction, raises `api_error`, or maintains a cross-table
invariant. The bar (from `database.py`): name the invariant and the
transaction scope. ~20 minutes of writing per service file, ~45 minutes
total.

## Target list

From the review §3.2 plus a sweep at planning time:

### `backend/features/auth/service.py`

- `authenticate` — 86 lines, three transaction scopes, conflict
  handling, audit logging. **Mandatory.**
- `logout` / `revoke_session` / similar lifecycle functions if their
  invariants aren't already obvious from the call site.

Existing good examples in this file: `set_session_cookie`,
`clear_session_cookie`.

### `backend/features/projects/service.py`

- `create_project` (line ~280)
- `update_project_metadata` (line ~314)
- `delete_project` (line ~369)
- `bulk_delete_projects` (line ~419)
- `restore_project` (line ~471)
- `hard_delete_project` (line ~558)

These are the public transactional surface of the projects feature.
Cover all six.

### `backend/features/catalogs/materials/service.py`

- Every public function. The review §3.2 calls this file out
  specifically: "no docstrings on public functions". Default to the
  same one-paragraph pattern.

### `backend/features/assets/service.py`

- Every public function that opens a DB transaction or coordinates R2
  (intent / complete-upload / attach / detach / serve-url / cleanup).
  Private helpers don't need docstrings unless their behavior is
  non-obvious.

## Docstring shape

Use the same pattern as `backend/database.py`:

```python
def create_project(
    payload: CreateProjectRequest,
    user: UserPublic,
    request_meta: Request,
) -> ProjectDetail:
    """Create a project and seed its v0 working version atomically.

    Runs in a single repository transaction so that the project row
    and its initial `project_versions` row are inserted together; a
    failure after the project insert would leave a project with no
    versions, which `get_project_detail` cannot serve. Raises
    ``api_error(409, "bt_number_in_use", ...)`` on `bt_number`
    conflict and re-raises the underlying repository error
    otherwise.
    """
```

Patterns to follow:

- Lead with one sentence on the invariant the function maintains.
- Name the transaction scope ("single repository transaction", "no
  transaction; pure transform", "two transactions: one for ... one
  for ...").
- Name the specific `api_error` codes raised, so a reader can find
  every error path from the docstring.
- Skip the obvious. Don't paraphrase the signature; readers can see
  the types.

## Steps

1. For each function in the target list, read the body and write the
   docstring against the actual transaction structure. Do not write
   from the function name alone — the review's whole point is that
   these functions hide non-obvious invariants.
2. Run `ruff` (the project should lint clean; docstrings shouldn't
   add issues, but check for line-length on the first line and PEP
   257 summary-on-one-line conventions if enforced).
3. `make format` + `make ci`.

## Files touched

- `backend/features/auth/service.py`
- `backend/features/projects/service.py`
- `backend/features/catalogs/materials/service.py`
- `backend/features/assets/service.py`

## Verification

- Visual review: pick three docstrings at random and verify the named
  transaction scope and `api_error` codes actually match the function
  body. (If you can do this and the docstring is right, a future
  reader can too. That's the bar.)
- `make ci` green.

## Risks

- **Docstrings drift from code.** Mitigation: lead each docstring with
  the invariant — invariants change less often than implementation
  detail. Avoid documenting line-level mechanics that a `git blame`
  would tell you anyway.
- **Over-documentation.** Don't add docstrings to the private helpers
  unless the help is non-obvious. This pass is specifically about the
  *public* transactional surface.

## Done when

- One commit per service file, or one commit total if the diff is
  contained. CI green. `STATUS.md` updated.
