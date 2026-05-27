---
DATE: 2026-05-13
TIME: 22:30 EDT
SCOPE: Code review of uncommitted P1-12 (Diff, Downloads, Schemas, and API Docs Baseline).
REVIEWER: Claude (Opus 4.7)
RELATED: planning/ROADMAP.html (P1-12);
         context/technical-requirements/api.md (§schema endpoints);
         context/technical-requirements/llm-mcp-schema.md;
         context/user-stories/00-foundation-shell.md (US-Versions-Lifecycle).
---

# P1-12 — Diff, Downloads, Schemas, And API Docs Baseline — Code Review

## Summary

The change focuses on the **schema/OpenAPI inspectability surface** and
**request-ID visibility** sub-goals of P1-12. New backend module
`features/schemas/` serves auto-generated Pydantic JSON Schemas at
`/api/v1/schemas/project-document/v1.json` and
`/api/v1/schemas/room/v1.json`. A versioned OpenAPI alias is exposed at
`/api/v1/openapi.json` (delegating to FastAPI's generated schema). On the
frontend, `errorMessage` now appends `(Request ID: …)` whenever the
underlying error carries a structured `request_id`. The existing
download-error path is tested for `X-Request-ID` round-tripping. Context
docs (`api.md`, `llm-mcp-schema.md`, `context/README.md`) were updated to
reflect that schemas are generated at request time and that
material/window-type schema endpoints are explicitly deferred until the
corresponding table contracts exist.

Scope is well-aligned with the P1-12 "OpenAPI and project/table schema
baseline or explicit deferral" and "request-id/structured-error
visibility" line items. The remaining P1-12 work — project/table JSON
downloads across normal **and recovery** states and version-vs-version /
version-vs-draft **diff UX** — is acknowledged in the roadmap entry as
pending a browser check; no implementation regressions are present in
this diff for those areas (they were largely landed in earlier P1
slices).

## What lines up with the spec

- **Schema endpoint inventory** matches the now-pruned `api.md` §
  schema-endpoints list. ProjectDocumentV1 and RoomRow are the two
  table contracts currently registered; material/window-type schemas
  are explicitly tied to future table work (`api.md` and the roadmap
  entry both say so).
- **OpenAPI alias** mounted under `/api/v1/` correctly delegates to
  `request.app.openapi()`, which uses FastAPI's internal cache after
  the first call — no per-request regeneration cost in practice.
- **Schema JSON output** uses Pydantic v2 `model_json_schema()` with
  `ref_template="#/$defs/{model}"`, which matches Pydantic's own
  default and keeps `$defs` cross-references stable for downstream
  tooling (LLM MCP consumers, codegen).
- **Request-ID visibility**: `errorMessage` is the single chokepoint
  used by 13 UI surfaces (auth, project list/settings, status,
  equipment, version controls). Centralizing the append at this layer
  is the right place; per-call-site append would have drifted.
- **Download error contract test** (`test_unsupported_table_names_fail_through_registry`)
  now asserts both the response-header `X-Request-ID` echo and the
  envelope-body `request_id`, which matches the structured-error shape
  in `shared/errors.py` and the frontend's `ApiErrorEnvelope` type.
- **Versioned OpenAPI test** asserts that the diff and download paths
  are exposed in the generated OpenAPI, giving the P1-12 inspectability
  surface a contract regression net even though those routes were
  built in earlier slices.
- **Docs hygiene**: the `context/schemas/` folder reference in
  `llm-mcp-schema.md` was correctly downgraded from "auto-generated
  files committed" to "runtime endpoints; static snapshots optional
  later if CI requires it." This is consistent with the choice to
  generate from Pydantic at request time.

## Issues

### L1 — Missing `__init__.py` in `features/schemas/`

`backend/features/schemas/` ships with `routes.py` only and no
`__init__.py`. Every other feature module in `backend/features/`
(`auth`, `mcp`, `project_document`, `project_status`, `projects`,
`shared`, `system`) has an `__init__.py`. This currently works because
Python treats `schemas` as an implicit namespace package, but it
diverges from the project's package convention and from
`CODING_STANDARDS.md`'s feature-module shape. Add an empty
`backend/features/schemas/__init__.py`.

### L2 — Schema test couples to row-model invariants

`test_project_document_and_room_json_schemas_are_exposed` asserts
`room_body["required"] == ["id", "number", "name", "floor_level"]` and
the `id` pattern. This is genuinely useful — it doubles as a contract
test on RoomRow — but it duplicates assertions already covered in
`test_project_document.py` and will fail every time a required field is
added to RoomRow even when the schema-endpoint plumbing is unchanged.
Consider narrowing the schema-endpoint test to "endpoint shape +
`title` + a `$defs` smoke" and leaving row-shape assertions to the
document tests. Not blocking — it's the kind of redundancy that
sometimes catches real regressions.

### L3 — `/api/v1/openapi.json` hidden from itself

`include_in_schema=False` on the OpenAPI alias is the right call (a
schema route advertising itself is noise), but it does mean the
documented endpoint inventory in `api.md` lists a path that is not
discoverable from the generated OpenAPI. Acceptable; flagged only so
future LLM MCP consumers don't get confused looking for it under
`paths`.

### L4 — Request-ID copy is appended unconditionally to user-visible strings

`errorMessage` now appends `(Request ID: <uuid>)` to **every** error
message coming from an `ApiRequestError` that carries a `request_id`.
13 UI surfaces consume this. Only `App.test.tsx` was updated; other
component-level tests that assert on error copy may either pass
incidentally (because their mock errors are plain `Error`s) or rely on
the bare message format. The format itself — a 36-char UUID glued onto
a sentence — is functional but visually heavy. Two follow-ups worth
considering:
1. Browser-check the 13 surfaces (especially modal toasts and inline
   error banners) to confirm the appended ID does not overflow narrow
   layouts.
2. If support workflows want the ID copyable but not always visible,
   consider rendering it as a small monospace suffix rather than
   baking it into the message string. Out of scope for P1-12; logging
   here so it does not slip past P1-13 hardening.

### L5 — No assertion that the schema endpoints include `X-Request-ID` round-tripping

The schema test sends `X-Request-ID: schema-project` and asserts the
response echoes it for the project-document endpoint, which is good.
The room-schema and OpenAPI calls do not send a request ID. Symmetry
would be cheap and would lock in the middleware contract for the new
routes. Minor.

## PRD / context divergences

None material. The change actively closes pre-existing divergences:
- `api.md`'s schema list previously implied material/window-type
  schemas existed; it has been corrected to defer them.
- `llm-mcp-schema.md` previously documented a committed
  `context/schemas/` folder of generated artifacts; it has been
  rewritten to point at the runtime endpoints as the source of truth,
  matching the implementation.

The "CI should verify generated schemas are in sync with Pydantic
models once schema generation is wired" line in `llm-mcp-schema.md` is
still load-bearing. Phase-1 hardening (P1-13) should decide whether the
runtime-only approach satisfies that requirement or whether a snapshot
test that diffs the live endpoint output against committed fixtures is
worth adding. Not a P1-12 blocker.

## Scope items deliberately not in this diff

The roadmap entry notes the remaining P1-12 gate is "browser-level
recovery-state download/diff check before marking complete." The diff
under review does not touch the diff or downloads features; their
plumbing was landed in P1-10 / P1-11 and is exercised by the e2e suite.
This is consistent with the P1-12 "or explicit deferral" wording —
nothing here regresses those paths. The remaining recovery-state
verification is a browser check, not a code change.

## Verdict

Ship after addressing L1 (missing `__init__.py`). L2–L5 are
nice-to-haves; none are blocking for P1-12 acceptance. The schema and
OpenAPI baseline is small, correct, and well-tested at the contract
level; the request-ID surface change is centralized in the right
helper. The roadmap-entry self-assessment ("Remaining P1-12 gate:
browser-level recovery-state download/diff check") is accurate.
