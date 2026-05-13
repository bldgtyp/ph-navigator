---
DATE: 2026-05-13
STATUS: Synthesis review for Phase 1 close-out
SCOPE: PH-Navigator V2 after TB-00 through TB-06, before Phase 2 builder/catalog work
SOURCES:
  - docs/code-reviews/2026-05-13/arch-review-claude.html
  - docs/code-reviews/2026-05-13/arch-review-codex.html
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md
  - context/CODING_STANDARDS.md
  - context/TECH_STACK.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/api.md
---

# PH-Navigator V2 Phase 1 Code Review Synthesis

## Purpose

This document consolidates the two independent Phase 1 architecture/code
reviews into one refactor-oriented review. Use it as the source document for
the cleanup pass before starting later feature phases.

The two source reviews are strongly aligned. Both conclude that the Phase 1
architecture is fundamentally sound, the single JSONB `ProjectDocumentV1`
model remains the right v1 persistence decision, and the main risk is not the
data model itself but the lack of a reusable document/draft/table boundary now
that Phase 2 will add more editable tables.

## Executive Summary

Phase 1 proved the intended vertical architecture:

- relational project/auth/status metadata;
- versioned JSONB project document bodies;
- Pydantic validation at the document boundary;
- server-side draft buffers with ETags;
- explicit Save / Save As / Discard / Lock workflows;
- public read-only access through the same project access seam;
- frontend server state in TanStack Query;
- an MCP read surface reusing existing project/document services.

There is no evidence in either review that the app should pivot away from the
JSONB document body model. The refactor need is narrower: make the table-slice,
draft, and version boundaries explicit before copying the Rooms tracer pattern
into Windows, Envelope, ERVs, Fans, catalogs, or MCP writes.

Recommended Phase 1 close-out:

1. Split `backend/features/project_document/` by workflow and table contract.
2. Add a backend table registry so `/document/tables/{table_name}` and
   `/draft/tables/{table_name}` are genuinely generic.
3. Add a document/draft summary API and frontend feature so project header
   Save / Discard / Diff controls no longer depend on the Rooms slice.
4. Resolve the TB-06 read-safe-mode acceptance gap.
5. Extract the shared frontend DataTable and table draft-broadcast primitives
   before deep Phase 2 table work.

## How The Reviews Align

| Topic | Claude review | Codex review | Synthesis |
|---|---|---|---|
| Phase 1 architecture | Solid skeleton; no PRD detour. | Directionally right; proves through-line. | Aligned. Continue the architecture with targeted refactor. |
| JSONB project body | Keep for v1; design seams for scale. | Keep for v1; do not add relational project-element tables. | Aligned. JSONB is not the problem. Boundary design is. |
| Biggest backend risk | `project_document` is becoming a god-feature and has dependency coupling with `projects`. | Document service is half generic and half Rooms-specific. | Aligned. Split service responsibilities and table contracts now. |
| Biggest frontend risk | Project header and query invalidation are drifting into cross-feature coupling. | Project header/version chrome is coupled to Rooms. | Aligned. Move document chrome state into a table-neutral frontend feature. |
| Table UI | `TablePrimitiveStub` is acceptable but temporary. | Real shared DataTable should gate Phase 2. | Aligned. Do not build several table pages on the stub. |
| Read-safe-mode | Raw download exists; shell-wide fallback still owed. | Current behavior is download-only recovery, not the planned envelope. | Aligned. Make an explicit decision before marking TB-06 fully complete. |
| UI stack drift | Tailwind/shadcn, Zustand, OpenAPI client, JSON Schema, idempotency remain deferred. | Focuses on immediate Phase 2 architecture gates. | Claude provides broader backlog; Codex identifies the near-term cuts. |

There is no substantive disagreement. The main difference is emphasis:

- Claude casts a wider ADR queue, including styling stack, OpenAPI generation,
  audit helper placement, idempotency, JSON Schema endpoint, and feature-folder
  naming.
- Codex narrows the refactor gate to the document table boundary, generic
  draft/version state, read-safe-mode, and DataTable extraction.

The practical path is to handle the concrete blockers first, then fold the
broader ADRs into later roadmap slices where they naturally become necessary.

## Refactor Priorities

### P0 - Resolve Before Phase 2 Table Work

These are the changes that prevent Phase 2 from copying tracer-bullet debt.

#### P0.1 Split `project_document` Workflow Responsibilities

**Current problem:** `backend/features/project_document/service.py` combines
schema loading, Rooms table reads/writes, draft creation/update, save/save-as,
discard, version metadata patching, diff, downloads, ETag helpers, validation,
and audit logging. The source reviews cite it at roughly 525 lines, already
past the project standard's 300-line review threshold and close to the 600-line
split threshold.

**Why it matters:** Windows and Envelope will need the same draft/version/table
operations. If the current service shape is copied, the core document workflow
will become difficult to review and hard to make safe for MCP writes.

**Recommended implementation shape:**

```text
backend/features/project_document/
  routes.py
  models.py
  repository.py
  document.py
  store.py          # load saved/draft document views, etags, raw body reads
  drafts.py         # replace draft, save, save-as, discard, lock checks
  versions.py       # version metadata patching / default-version semantics
  diff.py           # registered-table diff summaries
  downloads.py      # project/table JSON responses and raw recovery path
  tables/
    __init__.py
    registry.py
    rooms.py
```

This is the conservative split: keep the API resource under
`features/project_document/` for now, but split the internal workflow modules.
The more aggressive Claude suggestion to split into separate feature packages
(`versions`, `drafts`, `document`, `diff`, `downloads`) can be revisited after
the in-package boundaries are stable.

**Acceptance checks:**

- `routes.py` wires dependencies and delegates; it does not own workflow.
- draft and save logic no longer sits beside Rooms-specific code.
- repository stays raw SQL only.
- tests still express save/version/draft behavior, not implementation layout.

#### P0.2 Add A Backend Document Table Registry

**Current problem:** routes are named generically
`/document/tables/{table_name}` and `/draft/tables/{table_name}`, but the
implementation is Rooms-only through `RoomsSliceResponse`,
`RoomsSliceReplaceRequest`, `require_rooms_table()`, `apply_rooms_replace()`,
and `rooms_response()`.

**Why it matters:** The public route shape promises a generic table API. If the
second table arrives by copying the Rooms path, each table will diverge in
validation, diff, download, and ETag behavior.

**Recommended implementation shape:**

```text
backend/features/project_document/tables/
  registry.py       # table_name -> TableContract
  rooms.py          # Rooms models, validators, response builder, replace fn
  windows.py        # added when Windows lands
  envelope.py       # added when Envelope lands
```

`TableContract` should own:

- request model for replace/patch;
- response model or serializer;
- option/reference validation hook;
- apply function from `ProjectDocumentV1` plus payload to updated body;
- diff/download row extraction hooks where needed.

**Acceptance checks:**

- unsupported table names fail through the registry, not a Rooms helper;
- the generic table routes do not import Rooms models directly;
- adding the next table requires registering a table handler, not duplicating
  route/service branches.

#### P0.3 Add Document/Draft Summary API And Frontend Feature

**Current problem:** project header controls infer draft/version state from the
Rooms query. Save / Save As / Discard / Diff are document-version operations,
but the UI currently depends on `features/equipment` and uses Rooms-specific
copy and query keys.

**Why it matters:** A project may have a draft because Windows changed, not
because Rooms changed. The project header should not import every table feature
to know whether the document is dirty.

**Recommended backend endpoint:**

```text
GET /api/v1/projects/{project_id}/versions/{version_id}/draft
```

Suggested response:

```text
source: "saved" | "draft"
version_etag: string
draft_etag: string | null
dirty_tables: string[]
last_patched_at: string | null
is_locked: boolean
can_edit: boolean
```

**Recommended frontend shape:**

```text
frontend/src/features/project_document/
  api.ts
  hooks.ts
  types.ts
  draft-channel.ts
  components/
    VersionControls.tsx
    SaveAsModal.tsx
    DiffModal.tsx
```

`features/projects` should own project shell/navigation. The new
`features/project_document` should own document draft/version state and version
chrome controls.

**Acceptance checks:**

- project header no longer imports `features/equipment`;
- Save / Save As / Discard decisions use document summary state;
- table-specific downloads remain table-specific, but document-level actions
  are table-neutral.

#### P0.4 Resolve TB-06 Read-Safe-Mode Acceptance

**Current problem:** raw project JSON download works when schema validation
fails, but document/table read APIs still return an invalid-document error. The
roadmap language points toward an unsupported-schema envelope and read-safe UI
state, not only a raw download escape hatch.

**Why it matters:** Once schema evolution begins, saved user work must remain
recoverable and visible enough to navigate. A raw download is a good recovery
path but not the full planned user experience.

**Decision required:**

- Option A: implement the unsupported-schema envelope before declaring TB-06
  fully complete.
- Option B: explicitly downgrade Phase 1 acceptance to download-only recovery,
  mark the fuller envelope as a named Phase 2/production-hardening item, and
  update the roadmap and technical requirements.

**Recommended lean:** implement the envelope now if small. If not small, record
the downgrade explicitly before starting more table pages.

#### P0.5 Extract Shared Table Draft Broadcast / Freeze Semantics

**Current problem:** same-editor tab coordination is correct in spirit but
Rooms-specific in implementation.

**Why it matters:** Windows, Envelope, and future MCP/browser edit lease flows
need the same conflict policy. Repeating per-table BroadcastChannel protocols
will create inconsistent conflict behavior.

**Recommended frontend primitive:**

```text
useTableDraftBroadcast({
  projectId,
  versionId,
  tableName,
  activeScope,
  overlaps,
  onRemoteAccepted,
  onRemoteConflict,
})
```

Table features should supply scope-overlap detection. The shared primitive
should own channel naming, causal ETag guards, cache update hooks, and
conflict/freeze signaling.

### P1 - Resolve As First Phase 2 Architecture Slices

These do not all need to land before the first refactor PR, but they should be
sequenced deliberately before heavy builder/catalog work.

#### P1.1 Extract The Real Shared DataTable

`TablePrimitiveStub` served the Rooms tracer. It should not become the basis
for catalog manager, Windows, ERVs, Fans, and Envelope tables.

Recommended gate: make shared DataTable extraction the first Phase 2
architecture slice before catalog manager expansion.

Minimum scope:

- controlled row/selection/editing API;
- stable column definitions;
- paste/coercion hooks where relevant;
- keyboard-friendly row actions;
- table-level dirty/error state;
- no table-specific domain logic inside the shared component.

#### P1.2 Decide Draft Write Granularity

Rooms can tolerate whole-table replacement. Envelope, Windows, and MCP writes
may need semantic operations or JSON Patch to keep conflict surfaces small.

Recommended lean:

- whole-table replace remains acceptable for simple tables;
- define a semantic `WriteOp` / server-side patch translation before Envelope;
- do not require full JSON Patch everywhere before Phase 2 starts.

#### P1.3 Clarify Frontend State Stack Timing

The implementation currently uses URL params, TanStack Query, and local state.
That is acceptable for Rooms. The planned stack includes Zustand for active
version/tab/dirty state/queued patch ops/viewer state.

Recommended lean:

- do not introduce Zustand solely to satisfy the stack doc;
- introduce it when cross-component UI state appears naturally, likely around
  Windows builder, Assembly canvas, or viewer selection;
- record the trigger in the roadmap so the decision does not drift.

#### P1.4 Decide Tailwind / shadcn / BLDGTYP Token Cutover

Both reviews note drift from the planned frontend styling stack. The risk is
that each feature adds more vanilla CSS to migrate later.

Recommended lean:

- if Phase 2 begins with table and builder UI, schedule a small styling-system
  setup slice early;
- keep the slice focused on infrastructure and a few representative components,
  not a full visual redesign;
- avoid letting `App.css` continue as the default destination for feature CSS.

#### P1.5 Decide OpenAPI Type Generation Timing

Frontend types are currently handwritten and mirrored per feature. This is
manageable now and becomes more expensive as endpoints multiply.

Recommended lean:

- defer until after the project-document refactor if needed;
- adopt before large MCP/write/schema work or broad table expansion;
- keep generated client thin and compatible with the existing `fetchJson`
  error/request-id behavior.

### P2 - Cleanups To Batch Opportunistically

These are real but should not block the Phase 1 close-out refactor.

- Move `body_size_bytes()` out of `features/projects/service.py` into a
  document-owned helper.
- Hoist audit/request helpers out of `features/auth/` into `features/shared/`
  once the next write-heavy feature appears.
- Consolidate frontend option-label helpers in the Rooms table code.
- Codify frontend/backend feature naming: frontend features map to visible
  tabs/routes; backend features map to API resource/workflow boundaries.
- Keep MCP as a thin facade over existing services; do not let MCP server code
  grow independent workflow logic.
- Add JSON Schema endpoint before MCP write tools.
- Add idempotency-key support before relying on repeated mutating writes from
  browser or MCP clients.
- Revisit O(whole-document) validation only when document size or profiling
  proves it is a real cost.

## JSONB Decision

Both reviews explicitly recommend keeping the single JSONB project document as
the V2 v1 source of truth.

Reasons this still fits:

- version immutability is simple: one saved row, one body, one ETag;
- certification/version workflows behave like file saves;
- catalog bookshelf copies belong to the project version body;
- PHX / Honeybee / downstream exports want a file-format-style model;
- MCP and LLM tools benefit from whole-document fetch plus stable IDs and
  JSON Schema;
- MVP reads are project/version scoped, not cross-project reporting queries.

Known costs:

- whole-document validation on table reads/writes;
- one draft ETag per document rather than per table;
- larger conflict surface for whole-table replace;
- no natural cross-project analytics without sidecar indexes or reporting
  projections.

Decision: keep JSONB as source of truth. Do not add relational shadows of
project model tables in v1. Add table registry and draft boundaries so future
fast paths, generated columns, GIN indexes, or per-table draft scopes can be
introduced only when measured need appears.

## Consolidated ADR / HITL Queue

| ID | Decision | Recommended lean | Timing |
|---|---|---|---|
| ADR-1 | Confirm JSONB project document remains v1 source of truth. | Confirm; define measured revisit triggers. | Now |
| ADR-2 | Split `project_document` by workflow. | In-package module split first; revisit package rename later. | Now |
| ADR-3 | Define table registry boundary. | One backend registry mapping `table_name` to typed handlers. | Now |
| ADR-4 | Move document chrome state out of Rooms. | Add draft summary endpoint + frontend `project_document` feature. | Now |
| ADR-5 | Clarify TB-06 read-safe-mode. | Implement envelope or explicitly downgrade to download-only recovery. | Now |
| ADR-6 | Set DataTable extraction gate. | First Phase 2 architecture slice. | Before catalog/table expansion |
| ADR-7 | Draft write granularity. | Whole-table for simple tables; semantic write ops before Envelope/MCP writes. | Before Envelope or MCP writes |
| ADR-8 | Zustand timing. | Introduce when cross-component state appears, not preemptively. | Windows/Envelope/viewer decision point |
| ADR-9 | Tailwind/shadcn/tokens timing. | Small setup slice early in Phase 2 if UI surface is about to grow. | Early Phase 2 |
| ADR-10 | OpenAPI generated frontend types. | Adopt before endpoint surface grows materially. | Phase 2 |
| ADR-11 | JSON Schema endpoint. | Required before MCP write tools. | Before TB-17 |
| ADR-12 | Idempotency-Key middleware. | Add before repeated browser/MCP mutating workflows. | Before MCP writes or production edit workflows |

## Suggested Refactor Slice Plan

### RF-01 - Project Document Module Split

Goal: split workflow responsibilities without changing behavior.

Scope:

- introduce `store.py`, `drafts.py`, `versions.py`, `diff.py`, `downloads.py`;
- keep public routes stable;
- move `body_size_bytes()` into document-owned code;
- preserve existing tests and add targeted tests only where behavior becomes
  easier to assert.

Verification:

- `cd backend && uv run ruff check .`
- `cd backend && uv run ty check`
- `cd backend && uv run pytest`

### RF-02 - Table Registry And Rooms Handler

Goal: make the existing generic table routes genuinely registry-backed while
only Rooms is registered.

Scope:

- add `tables/registry.py` and `tables/rooms.py`;
- move Rooms request/response/apply/reference logic into the Rooms handler;
- make unsupported table behavior registry-owned;
- leave API URLs unchanged.

Verification:

- backend project-document tests;
- one browser Rooms edit/save smoke if the frontend path is touched.

### RF-03 - Document Draft Summary And Header Decoupling

Goal: make project chrome table-neutral.

Scope:

- add draft summary endpoint;
- add `frontend/src/features/project_document/`;
- move Save / Save As / Discard / Diff state hooks out of `features/projects`
  or at least out of direct Rooms dependencies;
- remove `features/projects` import of `features/equipment`.

Verification:

- frontend tests for header state against saved/draft/locked cases;
- backend tests for summary response;
- browser smoke: edit Rooms, header detects draft, save/discard works.

### RF-04 - Read-Safe-Mode Decision Implementation

Goal: close or explicitly re-scope the TB-06 acceptance gap.

Scope:

- either implement unsupported-schema envelope and frontend read-only recovery
  banner;
- or update roadmap/technical requirements to state download-only recovery as
  the Phase 1 behavior and name the fuller follow-up.

Verification:

- backend invalid-schema saved-body test;
- frontend recovery-state test if implemented;
- roadmap update either way.

### RF-05 - Shared Table UI / Broadcast Preparation

Goal: prepare for Phase 2 tables without broad feature implementation.

Scope:

- extract generic draft broadcast/freeze helper;
- define shared DataTable API and migrate Rooms only if the slice stays small;
- otherwise land DataTable as the first Phase 2 architecture slice.

Verification:

- frontend tests for broadcast conflict behavior;
- browser smoke with two tabs on Rooms.

## Open Questions

1. Should RF-04 implement the full read-safe envelope now, or should Phase 1
   explicitly accept download-only recovery?
2. Should DataTable extraction happen before or immediately after RF-03?
3. Should the first split keep all code under `features/project_document/`, or
   should route groups become separate backend feature packages now?
4. Should styling-stack setup be paired with DataTable extraction, or kept as a
   separate Phase 2 slice?

## Final Recommendation

Treat Phase 1 as architecturally successful but not ready to clone into Phase
2 yet. The refactor should be small, mechanical, and boundary-focused:

- keep JSONB;
- split document workflows;
- make table contracts explicit;
- make draft/version chrome table-neutral;
- close the read-safe-mode decision;
- then proceed to Phase 2 with DataTable and table-specific feature work.

