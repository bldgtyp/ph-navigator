---
DATE: 2026-06-04
TIME: 09:10 ET
STATUS: DONE — landed in commit `59766fa` on `main`. Gzip smoke tests
        live in `backend/tests/test_gzip_middleware.py`. Starlette
        1.0.0 auto-excludes `text/event-stream`, so the MCP mount
        keeps streaming.
AUTHOR: Claude (Opus 4.7)
SCOPE: Add `GZipMiddleware` to the FastAPI app so JSON responses
       compress on the wire. Materials Catalog GET drops from
       ~197 KB to ~12 KB. No API contract change. The streaming
       MCP mount must continue to work unbuffered.
RELATED:
  - ../PRD.md §P3 Phase 1
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md §2
  - backend/main.py
  - backend/features/mcp/server.py (streamable HTTP mount)
---

# Phase 1 — GZipMiddleware

## P0. Goal

Compress every JSON response > 1 KB on `/api/v1/*` when the client
sends `Accept-Encoding: gzip`. Verify the Materials Catalog GET
ships ~12 KB on the wire instead of 197 KB.

## P1. Files touched

- `backend/main.py` — add middleware registration.
- `backend/tests/` — add a small middleware smoke test if one does
  not already exist.

## P2. Implementation steps

1. Import `GZipMiddleware`:
   ```python
   from fastapi.middleware.gzip import GZipMiddleware
   ```
   No new dependency — it ships with Starlette / FastAPI.

2. Register the middleware **before** `request_context_middleware`
   (so the request context still wraps the compressed response) and
   **before** `app.mount("/mcp", phn_mcp.streamable_http_app())` —
   FastAPI runs middleware in registration order. Use:
   ```python
   app.add_middleware(GZipMiddleware, minimum_size=1000)
   ```
   `minimum_size=1000` skips tiny responses where the gzip overhead
   exceeds the savings.

3. **Verify streaming MCP is not buffered.** GZipMiddleware buffers
   the response to compute the content length. For a streaming
   endpoint, that defeats the streaming. Two options:
   - (a) Mount `/mcp` as a sub-app (the current pattern via
     `app.mount`) — Starlette routes middleware around mounted
     sub-apps in some configurations. Confirm by running the MCP
     smoke test (`backend/scripts/smoke_mcp_read.py`) after the
     change and verifying the response streams chunk-by-chunk.
   - (b) If streaming is broken, swap to a per-route gzip approach:
     wrap individual catalog routes with `Depends(...)` that adds
     `Content-Encoding`, or use the `brotli-asgi` package with an
     exclude-path config.

   Document which path was taken in this phase doc when the work
   lands.

4. Add or update a smoke test in `backend/tests/` that:
   - Calls `GET /api/v1/catalogs/materials` with
     `Accept-Encoding: gzip` and asserts
     `response.headers["content-encoding"] == "gzip"`.
   - Calls the same endpoint with `Accept-Encoding: identity` and
     asserts no `content-encoding` header is set.
   - Calls a tiny endpoint (e.g. `GET /api/v1/system/health` if it
     exists) and asserts no gzip applied because the body is
     under 1 KB.

## P3. Acceptance criteria

- `curl -s -H 'Accept-Encoding: gzip' -D- -o /dev/null
  http://127.0.0.1:8000/api/v1/catalogs/materials | grep -i
  content-encoding` returns `content-encoding: gzip`.
- The same `curl` with `-o body.gz` produces a body that decompresses
  to identical bytes as a fresh `curl -H 'Accept-Encoding: identity'`
  call.
- Materials list response on the wire is ≤ 15 KB for the 410-row
  fixture (12,371 bytes is the measured ceiling; allow some slack).
- MCP smoke test (`backend/scripts/smoke_mcp_read.py`) still passes
  and the streamed payload still arrives in chunks rather than
  one block.
- `make ci` is green from the repo root.

## P4. Verification commands

```bash
# Backend smoke
cd backend && uv run pytest tests/ -k gzip -v

# Wire size + headers
SESSION=<paste from cookie>
curl -s -H "Accept-Encoding: gzip" -H "Cookie: phn_session=$SESSION" \
  -D- -o /tmp/materials.gz \
  http://127.0.0.1:8000/api/v1/catalogs/materials
ls -la /tmp/materials.gz
gunzip -c /tmp/materials.gz | wc -c

# MCP regression
cd backend && uv run python scripts/smoke_mcp_read.py
```

Record actual wire size in `../STATUS.md` after merge.

## P5. Risk

- **MCP streaming.** Mitigation: the smoke test above is mandatory
  before merge. If streaming breaks, fall back to per-route gzip
  per step P2.3(b).
- **Reverse proxy double-compression.** If anything fronts FastAPI
  in production that also compresses, double-compression is wasteful
  but not broken. Out of scope here; flag in `STATUS.md` if a
  proxy enters the picture later.

## P6. Effort

~30 minutes including the smoke test. Single-file change in
`backend/main.py` plus one test file.

## P7. Hand-off notes

The next phase (Phase 2 — client-side `is_active` filter) is
independent and can be picked up in parallel by another agent.
Coordinate via branch naming only.
