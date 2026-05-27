---
DATE: 2026-05-13
TIME: 10:51 EDT
STATUS: P1-00 baseline artifact
SCOPE: Current Phase 1 gap matrix before P1 implementation resumes.
RELATED:
  - planning/ROADMAP.html
  - planning/archive/dated/2026-05-13/phase-1-full-buildout-plan.md
  - planning/code-reviews/2026-05-13/phase-1-code-review-synthesis.md
  - context/TECHNICAL_REQUIREMENTS.md
  - context/USER_STORIES.md
---

# Phase 1 Baseline And Gap Matrix

## Verification Baseline

Local baseline rerun on 2026-05-13:

| Check | Result | Notes |
|---|---|---|
| `make smoke` | Pass | Docker Postgres healthy on host port `5433`; backend/frontend dependency smoke passed. |
| `make test` | Pass | Backend `45 passed`; frontend `19 passed`. |
| `make lint` | Pass | `ruff check .`; `eslint .`. |
| `make typecheck` | Pass | Backend `uv run ty check`. |
| `cd frontend && npm run format:check` | Pass | Prettier check passed. |
| `cd frontend && npm run build` | Pass | Vite production build passed. |
| `git diff --check` | Pass | No whitespace errors. |
| `make seed-dev-user` | Pass | Local `ed@example.com` seed refreshed after backend tests. |
| `make e2e` | Pass | Chromium e2e `2 passed`: project shell/status/public viewer and same-editor Rooms tab freeze. |

Staging TB-06 / P1-07 check on 2026-05-14:

| Check | Result | Evidence |
|---|---|---|
| API health | Pass | `curl https://ph-navigator-v2.onrender.com/api/v1/health` returned `200` with request id `e8dfc827-887b-41f1-820e-8be5db6788e4`. |
| Unauthenticated session | Pass | `curl https://ph-navigator-v2.onrender.com/api/v1/auth/session` returned structured `401 not_authenticated` with request id `e65d8b59-04c5-4276-8a8a-f31df21faeb5`. |
| Editor sign-in path | Pass after re-seed | Staging `ed@example.com` was re-seeded through the Render external database; direct API login from the staging frontend origin returned `200` with request id `afe93bcb-ffeb-4221-9884-51e4eed7dc67`. |
| P1-07 browser Settings path | Pass | Browser check on project `3bfaaf7b-c70e-4655-addf-b371bf4bd261`: editor opened Project Settings, issued an MCP token with one-time plaintext display, revoked it, and a fresh Viewer context had zero Project Settings buttons and no console errors. |
| P1-07 revoked-token MCP rejection | Pass | A revoked staging token failed the next `/mcp/` request with `401 invalid_token` and request id `bfad7a3a-51ba-4e66-ae7a-75fb85020629`. |
| Active-token MCP staging read | Follow-up | An active staging token currently reaches `/mcp/` as `421 Invalid Host header` with request id `d220be53-5ea0-47b7-8ac5-509d68ad104c`; unauthenticated `/mcp/` reaches FastMCP and returns `401`. Treat this as MCP transport/env hardening for P1-13/TB-04b, not a P1-07 token-admin UI blocker. |

## Gap Classification

Classification terms:

- `Now`: required before Phase 2 catalog/builder/table expansion.
- `Now decision`: required to decide during Phase 1 close-out; implementation
  may land in the named owner slice or be explicitly downgraded/deferred there.
- `Now for UI, later for writes`: Phase 1 must complete the browser-facing
  administration or read surface; write-capable MCP behavior remains a later
  implementation gate unless the roadmap is explicitly re-scoped.
- `Now verification`: implementation likely exists in part, but Phase 1 must
  verify the current coverage before declaring the surface complete.
- `Deferred`: deliberate Phase 1 scope cut that must stay named.
- `Later`: outside Phase 1 full-buildout scope.

| ID | Area | Current baseline | Classification | Owner slice |
|---|---|---|---|---|
| G-01 | TB-06 staging evidence | Local TB-06 and current local e2e pass; staging API is healthy and editor sign-in is unblocked after re-seeding. Full TB-06 staging browser evidence still belongs to the release gate. | Now | TB-06 ledger follow-up / P1-13 release gate |
| G-02 | `project_document` workflow boundary | API works but `features/project_document/service.py` still owns draft, version, diff, downloads, Rooms table behavior, ETags, validation, and audit logging together. | Now | P1-01 |
| G-03 | Generic table route contract | Routes are generic, but implementation is Rooms-specific through `RoomsSliceResponse`, `RoomsSliceReplaceRequest`, `require_rooms_table()`, `apply_rooms_replace()`, and `rooms_response()`. | Now | P1-01 |
| G-04 | Header/version chrome state | Save, Save As, Discard, Diff, and table JSON affordances are still coupled to Rooms/Equipment query state and copy. | Now | P1-02 |
| G-05 | Read-safe-mode | Raw saved project JSON recovery exists, but unsupported-schema/read-safe workspace envelope is not implemented. | Now decision | P1-03 |
| G-06 | App visual system | Current UI remains scaffold CSS with shared primitives only in narrow places; BLDGTYP token/shadcn/Tailwind posture is not landed. | Now | P1-04 |
| G-07 | Dashboard MVP completion | Sign-in, create/open, list, and public viewer paths work; pin/unpin, pinned ordering, row action polish, Catalogs routing, and delete policy remain incomplete or need explicit cuts. | Now decision | P1-05 |
| G-08 | Project shell completion | Default Status route, tabs, version dropdown, lock/read-only banners, and downloads work; breadcrumbs, IP/SI placement, settings overflow, and table-neutral dirty state remain incomplete. | Now | P1-05 / P1-02 |
| G-09 | Status full MVP | Complete for Phase 1: local/browser pass covers backend CRUD/template, empty state/template apply, current-step timeline, state/date edit, keyboard/up-down reorder, modal delete, public Viewer read-only rendering, sanitized Markdown display plus edit-modal preview, drag/drop reorder, and MCP-readable REST posture. Review/simplify follow-up added sanitizer regression coverage, delete-dialog/preview a11y polish, shared Markdown/order-index helpers, drag/drop no-op guards, and delete-cache no-op handling. Explicit MVP deferrals: inline title edit, `⋯` row-action menu, production icon-library drag handle, touch drag/drop support, richer drop-target affordance, and Markdown renderer lazy-loading/bundle-budget work. Ed confirmed complete on 2026-05-13. | Complete | P1-06 |
| G-10 | Project Settings UI | Complete for Phase 1: local and staging browser checks provide the editor-only Project Settings modal, metadata edit flow, read-only metadata display, and browser MCP token issue/list/revoke flow. | Complete | P1-07 |
| G-11 | MCP token/browser admin | Browser token administration is complete for issue/list/revoke with one-time plaintext display and revoked-token rejection. Write-capable MCP tools remain out of current implementation and belong to later write slices. Active-token MCP reads on staging expose a separate `421 Invalid Host header` transport/config issue to resolve before release. | Browser admin complete; transport follow-up | P1-07 / P1-13 / TB-04b hardening / post-Phase 1 write slices |
| G-12 | Shared DataTable | Rooms still renders through `frontend/src/shared/ui/TablePrimitiveStub.tsx`; real `<ProjectDataTable>` extraction is not landed. | Now | P1-08 |
| G-13 | Single-select option manager | Backend validates Rooms options enough for current tracer; full shared single-select UX, paste match/create, header option modal, reorder/color/merge/delete behavior are not landed. | Now | P1-09 |
| G-14 | Rooms full MVP | Add/edit draft restore/save/save-as/lock/download/diff work; Rooms lacks real DataTable behavior, full 8-column modal posture, ERV assignment represented in a forward-compatible way, natural-sort/table toolbar/copy, and complete single-select semantics. | Now | P1-10 |
| G-15 | Equipment sub-tabs | Equipment currently exposes Rooms only; Thermal Bridges/Pumps placeholders and ERV/Fan full tables are not landed; keep out of Phase 1 close-out unless the roadmap is explicitly re-scoped. | Deferred | TB-18 / Phase 6 |
| G-16 | Draft/version/concurrency UX | Initial P1-11 local pass now covers restore/discard, dirty version-switch, `beforeunload`, stale Save conflict UI, same-session draft prompt suppression keyed by draft ETag, and Rooms live lock downgrade. Existing same-editor Rooms e2e was updated for the shared DataTable row-open gesture. Remaining gate is the manual P1-11 browser checklist; local undo invalidation is a no-op until an undo stack exists, and MCP edit-lease UX belongs to the later MCP write slice. | In progress | P1-11 / TB-17 |
| G-17 | Draft JSON-Patch endpoint | `PUT /draft/tables/{name}` exists for the Rooms tracer, but the general `PATCH /draft` JSON-Patch endpoint from the API/save-versioning requirements is not implemented. | Now decision | P1-12 / MCP-write gate |
| G-18 | Idempotency-Key middleware | Mutating REST idempotency is specified for repeated clients, but no explicit implementation owner exists in the Phase 1 matrix yet. | Now decision | P1-11 / P1-12 / MCP-write gate |
| G-19 | In-place re-auth/session-expiry modal | Root sign-in and session checks work, but the production edit-mode session-expiry modal and retry/preserve-current-tab pattern are not implemented. | Now decision | P1-05 / P1-11 |
| G-20 | Diff/download/OpenAPI baseline | Project/table JSON downloads and simple diff work for Rooms; OpenAPI availability, request-id support in user-facing failure flows, and recovery-state downloads need completion or explicit deferral. | Now | P1-12 |
| G-21 | Project/table JSON Schema endpoints | Generated project/table JSON Schema endpoints are not implemented. This is separate from FastAPI OpenAPI and should be a named gate before MCP writes/schema-version work. | Now decision | P1-12 / MCP-write gate |
| G-22 | Action logging | Core login/project/version/MCP audit events exist in implementation areas touched so far; complete v1 logging coverage should be checked while Settings/status/version hardening lands. | Now verification | P1-07 / P1-13 |
| G-23 | Assets/HBJSON/model viewer/catalog/windows/envelope | These are documented later-phase surfaces and should not block Phase 1 full-buildout unless a dependency is explicitly pulled forward. | Later | TB-07+ / Phase 3+ |

## Requirement Coverage Snapshot

| Source | Baseline conclusion |
|---|---|
| `context/user-stories/00-foundation-shell.md` | Auth/dashboard/project shell/status/version/concurrency are partially implemented. Phase 1 still owes dashboard polish decisions, shell/header completion, read-safe-mode, and draft/version UX hardening. |
| `context/user-stories/30-tables-equipment.md` | Rooms tracer proves the document-table path, but the shared table, single-select, full Rooms, and Equipment sub-tab acceptance criteria are mostly not complete. |
| `context/user-stories/50-settings-ops-llm.md` | P1-07 local implementation now covers Project Settings and browser token administration. Full asset/write MCP remains later than the Phase 1 close-out. |
| `context/technical-requirements/data-model.md` | JSONB project document source-of-truth remains confirmed; no reason to add relational shadows. Table registration and per-table contracts are the immediate gap. |
| `context/technical-requirements/save-versioning.md` | Draft buffer, ETags, Save, Save As, Discard, lock, diff, downloads, restore prompts, dirty switches, stale Save UX, and Rooms same-editor/lock-downgrade handling exist locally for the tracer path. Remaining gaps are read-safe behavior, full manual P1-11 browser evidence, and later MCP edit-lease/write behavior. |
| `context/technical-requirements/api.md` | Implemented routes cover the current tracer. Missing or incomplete surfaces include draft summary, generic table registry behavior, the general JSON-Patch draft endpoint, idempotency, schema endpoints, assets/HBJSON, and explicit OpenAPI/schema publication posture. |
| `context/technical-requirements/llm-mcp-schema.md` | Read-only MCP and project-scoped bearer-token auth are implemented. `query_table`, MCP writes, asset tools, schema docs, and richer structured MCP errors remain future work. |
| `context/technical-requirements/frontend-viewer-units.md` | App surfaces exist at scaffold level. Display system, read-only affordance polish, three-layer editor-state UX, DataTable, viewer, and unit display remain incomplete. |
| `context/technical-requirements/data-table.md` | Technical contract is not implemented beyond the Rooms stub/tracer. This is a hard gate before cloning table work. |
| `context/technical-requirements/stack-auth-migration.md` | Stack/auth baseline remains coherent: uv/npm/Postgres/raw SQL/Pydantic/FastAPI/React. Tailwind/shadcn and richer folder layout are planned but not fully reflected in code. |

## Decisions To Carry Into P1-01+

1. Keep JSONB `ProjectDocumentV1` as the v1 source of truth. The gap is reusable boundaries, not persistence direction.
2. Treat DataTable extraction as a blocker before adding more editable project tables.
3. Treat read-safe-mode as an explicit P1-03 decision: implement the unsupported-schema envelope now if small, or record a named Phase 1 downgrade to download-only recovery.
4. P1-07 can close on token-admin/browser evidence; do not mark TB-06 or the Phase 1 release gate fully complete until the broader staging browser evidence lands.
5. Keep ERVs/Fans/Pumps/Thermal Bridges out of the Phase 1 close-out unless the roadmap is explicitly re-scoped.
6. Treat idempotency, the general JSON-Patch draft endpoint, and JSON Schema endpoints as named decision gates before MCP writes rather than implicit Phase 1 omissions.
7. Do not block P1-11 completion on undo-stack behavior or MCP edit leases: no bounded undo stack exists in the current Rooms path, and browser/MCP lease UX is owned by the later write-capable MCP slice.
