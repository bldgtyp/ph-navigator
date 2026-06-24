---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Implemented — shipped in #13 (commit 51dcd77).
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 3 — pick one REST action-URL style and align
       `projects/routes.py` and `assets/routes.py` to it. Update
       frontend callers in the same commit.
EFFORT: ~30 min
BUCKET: Now
DEPENDS_ON: none
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §3.3
  - `backend/features/projects/routes.py`
  - `backend/features/assets/routes.py`
  - `frontend/src/` call sites for the renamed URLs
---

# Phase 3 — REST action-URL style

## Goal

Eliminate the split between Google `:verb` style and slash-verb style
across action URLs. Pick exactly one, rename the others, document the
choice, and update frontend callers.

## Background

The review §3.3 shows the split:

```python
# projects/routes.py — Google/AIP style
@router.post(":bulk-delete", ...)
@router.post("/{project_id}:delete", ...)
@router.post("/{project_id}:restore", ...)

# assets/routes.py — slash-verb style
@router.post("/{asset_id}/complete-upload", ...)
@router.post("/{asset_id}/attach")
@router.post("/{asset_id}/detach")
```

Both work. The review calls it a coin flip — what matters is
consistency, captured before clients outside this repo learn either
shape.

## Decision (capture at start of phase)

Record the choice in `decisions.md` (D1) with one sentence of
reasoning. A defensible default: **slash-verb** — more idiomatic in
FastAPI, plays better with OpenAPI tooling, easier to spell in URLs
without thinking about `:` escaping. But pick what the team prefers
and commit.

## Pre-work

1. Inventory every action route across the backend:

   ```bash
   grep -RnE 'router\.(post|put|patch|delete)\("/?[^"]*(:|/)(bulk-|attach|detach|complete-|delete|restore|reset|cancel|publish|verify)[^"]*"' backend/features/
   ```

   This catches both styles.

2. Inventory frontend callers for any URL slated to change:

   ```bash
   grep -RnE "(:|/)(bulk-delete|delete|restore|bulk-restore|attach|detach|complete-upload)" frontend/src/
   ```

## Steps

1. Apply the chosen style to every action route in `projects/routes.py`
   and `assets/routes.py`. Sweep the other features (`catalogs/*`,
   `envelope/`, `project_document/`, `assets/`, etc.) and align the
   stragglers too — same standard everywhere is the point.
2. Update every frontend call site found in pre-work. The frontend
   uses `tanstack-query` per `CLAUDE.md`; updates are usually in the
   query/mutation hooks, not scattered.
3. Add a one-line note in `backend/README.md`:

   > **Action URLs** use slash-verb style:
   > `POST /resource/{id}/verb-phrase`. Do not use Google `:verb`
   > style in this API.

   If `backend/README.md` does not exist, put the note in the route
   registration block of `backend/main.py` as a comment.
4. Run frontend lint + tests:

   ```bash
   cd frontend && pnpm run format && pnpm run lint
   cd frontend && pnpm test
   ```

5. Run backend tests, focused on routes:

   ```bash
   cd backend && uv run pytest tests/features/projects tests/features/assets -q
   ```

6. Run `make e2e` to confirm Playwright tests still hit the routes
   they expect. If a Playwright test hits a renamed URL directly,
   update it.
7. `make format` + `make ci`.

## Files touched

- `backend/features/projects/routes.py`
- `backend/features/assets/routes.py`
- Possibly other `backend/features/*/routes.py` files (depending on
  inventory).
- `backend/README.md` (or `backend/main.py` block comment).
- Frontend hooks/services that call the renamed URLs (under
  `frontend/src/`).
- Possibly `frontend/tests/e2e/*` test files.

## Verification

- `grep -RE 'router\.(post|put|patch|delete)\("/[^"]*:[a-z]'
  backend/features/` returns nothing (if slash-verb chosen), or the
  inverse for `/verb` URLs (if `:verb` chosen).
- All frontend calls pass `pnpm run lint` and `pnpm test`.
- `make e2e` green against a fresh backend + frontend.
- `make ci` green.

## Risks

- **Missed call site**: a frontend hook or e2e test references an old
  URL directly and 404s silently in a flow not covered by tests.
  Mitigation: the `grep` in pre-work is exhaustive; cross-check with
  `make e2e`.
- **MCP tool URLs**: if any MCP tool constructs URLs by string, it
  needs the same update. `grep` for the renamed URLs in
  `backend/features/mcp/`.

## Done when

- One commit with backend + frontend renames + docs note.
- CI + e2e green.
- `decisions.md` D1 marked accepted with the chosen style.
- `STATUS.md` updated.
