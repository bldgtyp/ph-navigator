---
DATE: 2026-05-13
TIME: 14:30 EDT
STATUS: Code review of P1-03 deliverable
SCOPE: Document-level read-safe envelope for /document and editor /draft;
       frontend recovery panel in ProjectShell. Reviews un-committed
       changes representing the P1-03 phase against the roadmap, the
       PRD/§10.5, the US-Errors-SchemaFallback story, the synthesis P0.4
       finding, and the surrounding context technical requirements. Does
       not review against final-app completeness.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md (P1-03 row + ledger)
  - docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md (P0.4 origin)
  - docs/code-reviews/2026-05-13/p1-02-code-review.md (preceding slice)
  - context/PRD.md
  - context/technical-requirements/llm-mcp-schema.md (§10.5)
  - context/technical-requirements/api.md
  - context/technical-requirements/save-versioning.md
  - context/user-stories/00-foundation-shell.md (US-Errors-SchemaFallback)
---

# Code Review — P1-03 Read-Safe-Mode Completion

## Scope Check

P1-03's stated scope from the roadmap (chosen option: implement the
envelope rather than downgrade to download-only recovery):

> Close or explicitly re-scope the older/invalid document recovery
> story. Decide full read-safe envelope vs download-only recovery;
> implement or document the accepted Phase 1 behavior; ensure raw JSON
> remains recoverable; include the `/draft` summary endpoint in the
> invalid/unsupported document check.

This is the synthesis P0.4 (Option A: implement the unsupported-schema
envelope). It is gating Phase 2 catalog work (TB-07).

Explicitly **not** in P1-03 scope (per P1-03 lessons + roadmap):

- Forward-only upgrade shim infrastructure (`upgrade_v1_to_v2.py`).
- Golden fixture corpora for shim regressions.
- MCP read-safe behavior (deferred to TB-17 when MCP gains writes).
- BLDGTYP design-system styling for the recovery panel (P1-04).
- Modal prompts replacing `window.confirm`, restore/discard prompt,
  dirty-switch prompt, beforeunload, stale-ETag UI (P1-11).
- OpenAPI/JSON-Schema endpoint baseline (P1-12).

This review evaluates only against the P1-03 scope as defined above
plus the US-Errors-SchemaFallback acceptance criteria.

## Diff Summary

| File | Status | Notes |
|---|---|---|
| `backend/features/project_document/document.py` | Modified | Hoisted `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1` as the single source. |
| `backend/features/project_document/models.py` | Modified | Added `ProjectDocumentReadSafeEnvelope`, `ReadSafeErrorCode`. |
| `backend/features/project_document/validation.py` | Modified | Split `validate_document` into a strict variant and a non-raising `validate_document_with_errors` returning `(model \| None, errors)`. |
| `backend/features/project_document/store.py` | Modified | Added `get_saved_document_or_read_safe`, `get_draft_summary_or_read_safe`, `read_safe_envelope`, `schema_version_from_raw`; structured WARN log on entry. |
| `backend/features/project_document/service.py` | Modified | Re-exports the two `*_or_read_safe` helpers. |
| `backend/features/project_document/routes.py` | Modified | `GET /document` and `GET /draft` now return a discriminated `\|` union; both threads `request.state.request_id` through to the envelope. |
| `backend/tests/test_project_document.py` | Modified | Extended the existing invalid-schema test with three new assertions (editor `/document`, public `/document`, editor `/draft`). |
| `frontend/src/features/project_document/types.ts` | Modified | Added `ProjectDocumentReadSafeEnvelope`, `ProjectDraftStatus`, `ProjectDocumentResponse`. |
| `frontend/src/features/project_document/lib.ts` | New | Type-guard `isReadSafeProjectDocument`. |
| `frontend/src/features/project_document/api.ts` | Modified | Added `fetchProjectDocument`. |
| `frontend/src/features/project_document/hooks.ts` | Modified | Added `useProjectDocumentQuery` and `projectDocumentQueryKeys.document`. |
| `frontend/src/features/project_document/components/VersionControls.tsx` | Modified | Defensive: treats a read-safe payload as `draftSummary = null`. |
| `frontend/src/features/projects/routes/ProjectShell.tsx` | Modified | Hoisted version resolution to fire `useDraftSummaryQuery` / `useProjectDocumentQuery`; renders `ReadSafeRecoveryPanel` when either returns the envelope. |
| `frontend/src/App.test.tsx` | Modified | Added `readSafePayload` + one editor-path test for the recovery panel. |
| `frontend/src/App.css` | Modified | Added `.read-safe-panel`, `.read-safe-actions`, `.read-safe-diagnostics`, `.read-safe-versions`. |
| `context/technical-requirements/llm-mcp-schema.md` | Modified | §10.5 (3) extended to say "or if the migrated body fails current-schema validation"; declares Phase 1 scope as `/document` + editor `/draft`. |
| `docs/plans/01_IMPLEMENTATION-ROADMAP.md` | Modified | P1-03 status → `[~] In review`; lessons entry recorded; ledger updated. |

## Verdict

**Approve with minor amendments.** The P1-03 deliverable meets its
stated completion gate against the synthesis P0.4 and against the
US-Errors-SchemaFallback story's MVP acceptance criteria. The architecture
is sound: validation is shared via `validate_document_with_errors`,
the read-safe envelope is a single Pydantic model with a typed error
code, table reads/writes remain strict (so the invariant "invalid JSON
is recoverable but not editable" holds), and the route response models
explicitly union the success and recovery shapes so OpenAPI consumers
see the surface.

Acceptance-criteria match against US-Errors-SchemaFallback:

- ✅ AC-1: API returns `schema_version_unsupported: true` with raw body
  when current-schema validation fails (`/document`, `/draft`).
- ✅ AC-2: Project workspace renders a read-only fallback page instead
  of the normal tab UI (`ProjectShell.tsx:83`).
- ✅ AC-3: Persistent banner copy matches the spec almost verbatim
  (`store.py:253`, `ProjectShell.tsx:190`).
- ✅ AC-4: Primary CTA "Download raw project JSON" calls the existing
  `/download` endpoint, which returns the unmigrated body.
- ✅ AC-5: Editor diagnostic block contains `project_id`, `version_id`,
  saved `schema_version`, current schema version, and `request_id`.
- ✅ AC-6: Save/Save As/table edits/etc. are not rendered because the
  recovery panel returns before the normal shell mounts `VersionControls`
  or `ProjectTabContent`. Switching versions remains available.
- ✅ AC-7: Public viewer sees banner + JSON download but NOT the
  diagnostic block (`ProjectShell.tsx:197`). The backend also nulls
  `validation_errors` for non-editor callers (`store.py:71`).
- ✅ AC-8: Backend emits structured WARN log with `error_code`,
  `project_id`, `version_id`, `schema_version`, `request_id`
  (`store.py:237-246`).

Findings below are largely about edge polish, a small spec drift in
`api.md`, two real but minor bugs, and a few test-coverage gaps. None
are gating for marking P1-03 complete; H1 and H2 should be fixed in this
slice before merge.

## Findings

Severity scale follows the synthesis convention (H1/H2 = high, M = medium,
L = low / nit, P = positive note).

### H1 — Public-viewer diagnostic-block secrecy is enforced only in the frontend

**Where:** `backend/features/project_document/store.py:55-73`,
`backend/features/project_document/store.py:104-147`,
`frontend/src/features/projects/routes/ProjectShell.tsx:197-220`.

**Observation:** For unauthenticated viewers, the backend's `GET
/document` envelope still includes `schema_version`,
`current_schema_version`, `request_id`, and `source`. Only
`validation_errors` is empty-listed for non-editors. The current
`ReadSafeRecoveryPanel` hides the diagnostic `<dl>` block to viewers,
so it works in practice — but the criterion (US-Errors-SchemaFallback
AC-7) is "without admin diagnostics that expose internals beyond the
request id." Any non-browser client (a future MCP `get_document`,
direct cURL, etc.) that hits the public `/document` will see saved/current
schema versions.

**Risk:** Low for Phase 1 (those values are not secrets), but the
secrecy guarantee should not be frontend-only. The current shape also
makes it tempting for a later UI to lazily expose those fields without
re-checking auth.

**Recommendation:** Either (a) accept that saved/current `schema_version`
are public diagnostics (update AC-7 wording in the user story to reflect
that) or (b) null out `schema_version` / `current_schema_version` in
the envelope for non-editors the same way `validation_errors` is gated.
(a) is the smaller change and matches what already happens; (b) is
defensible if the team wants the secrecy to hold across all clients.

### H2 — `access.is_editor` is "has a session", not "may edit this project"

**Where:** `backend/features/project_document/store.py:71`
(`errors if access.is_editor else []`).

**Observation:** `ProjectAccess.is_editor` is currently defined as
`self.user is not None` (`features/projects/access.py:30-31`). In V1
all signed-in users have edit rights on all projects, so this is
behaviorally identical to "is editor for this project". Once project-
level ACLs land (post-MVP), a signed-in user opening a project in
`view` mode will still satisfy `is_editor`, which means they would leak
the editor-only `validation_errors` diagnostics.

**Risk:** Low today, latent for the next access-model change. The
backend service is the right layer to enforce this — if it's hidden
behind a property that means something different later, this finding
will resurface as a real diagnostic leak.

**Recommendation:** Replace `access.is_editor` with `access.mode ==
"edit"` (or a new explicit `is_edit_mode` property) at this call site,
so the diagnostics gate matches the route's access mode rather than the
user's session existence. The view-mode `/document` should always
return `validation_errors = []`; the edit-mode `/draft` should always
return diagnostics. This keeps the contract right under future ACL
changes.

### M1 — `request.state.request_id` direct attribute access can `AttributeError`

**Where:** `backend/features/project_document/routes.py:58, 85`.

**Observation:** The new routes do `request.state.request_id`. Elsewhere
in the codebase (`backend/features/shared/errors.py:50`) the pattern is
`getattr(request.state, "request_id", "")` for safety. In practice the
middleware always sets `request_id`, so this won't fire — but the
project convention is `getattr`.

**Risk:** Low. Cosmetic / consistency.

**Recommendation:** Use `getattr(request.state, "request_id", "")` to
match the existing pattern, OR pull the dependency into a small helper
like `RequestId = Annotated[str, Depends(current_request_id)]` so that
read-safe routes (and any later routes) get the id through the same
seam.

### M2 — `api.md` doesn't document the read-safe envelope shape

**Where:** `context/technical-requirements/api.md` §9.4 / §9.5.

**Observation:** `llm-mcp-schema.md` §10.5 (3) is correctly updated to
say the envelope applies to `GET /document` and editor `GET /draft` in
Phase 1. But the API spec still describes those endpoints as returning
the document/summary models with no mention of the union with
`ProjectDocumentReadSafeEnvelope`. Future readers (and any
OpenAPI-from-spec consistency check) will see drift.

**Risk:** Low for Phase 1; rises when MCP read-safe is added in TB-17
or when OpenAPI generation lands (P1-12 or TB-19).

**Recommendation:** Add a sentence to §9.4 and §9.5 of `api.md`
mirroring the `llm-mcp-schema.md` §10.5 (3) update, and reference the
`schema_version_unsupported: true` envelope shape (or link to that
section). A schema example block would help any future client author
who reads the API doc first.

### M3 — Brief flash where normal shell can render before read-safe pre-empts

**Where:** `frontend/src/features/projects/routes/ProjectShell.tsx:44-106`.

**Observation:** The project query and the draft/document query fire
in parallel. While `projectQuery` returns first and `editorDraftStatusQuery`
or `viewerDocumentQuery` is still in-flight, the early returns fall
through and the **normal shell** renders with `VersionControls` and tab
content. Once the draft/document settles to a read-safe envelope, React
swaps to `ReadSafeRecoveryPanel` on the next render. In the meantime,
a fast editor could click `Save` or `Save As` against the unmigrated
body. Their click would then be rejected by the backend (write paths
still validate), but the UX is a brief flicker of unsafe affordances.

**Risk:** Low — backend writes remain validation-gated, so no data is
lost. UX-only.

**Recommendation:** Hold the normal shell until the relevant query has
either errored, returned a real summary, or returned an envelope. A
minimal version: in the early-return block, if `editorDraftStatusQuery
.isLoading` (for editors) or `viewerDocumentQuery.isLoading` (for
viewers) is true and `projectData` is present, render
`<ShellMessage title="Project" message="Loading version..." />`
instead of falling through. This also gives a stable loading state when
switching between versions.

### M4 — Test coverage gap: editor `validation_errors`, draft-body read-safe, viewer recovery panel

**Where:** `backend/tests/test_project_document.py` (extended test);
`frontend/src/App.test.tsx` (one new test).

**Observation:** Three real branches are not exercised:

1. The new test asserts public-viewer `validation_errors == []` but does
   NOT assert the editor case returns a non-empty list. The editor
   diagnostic path is the more interesting one to lock in (since H1/H2
   live there).
2. The store has a dedicated branch for `source = "draft"` when the
   draft body fails validation but the version body is valid
   (`store.py:125-136`). No test inserts an invalid draft body, so this
   branch is dead-letter unless P1-03 is later extended to introduce
   schema migrations (which would change all of this anyway). Worth
   covering because Save-then-schema-bump could produce exactly this
   state.
3. The viewer-side rendering — `useProjectDocumentQuery` + the
   recovery panel without the `<dl>` diagnostics — is not tested. Only
   the editor `/draft` envelope flow has a frontend test.

**Risk:** Low; behavior works in the manual Playwright check the slice
recorded. But the regression footprint is exactly the corners that the
backend code paths exist to handle.

**Recommendation:** Add:

- A backend assertion `assert len(document.json()["validation_errors"])
  > 0` for the editor `/document` response (one extra line in the
  existing test).
- A backend test that corrupts a `project_version_drafts` row body and
  asserts `/draft` returns the envelope with `source = "draft"`.
- A frontend test mirroring the existing read-safe test but with
  `access_mode: "viewer"` on the project payload, asserting
  `getByText` cannot find the "Saved schema" `<dt>` label.

### M5 — Read-safe panel reuses `.version-list` class with different semantics

**Where:** `frontend/src/features/projects/routes/ProjectShell.tsx:223`,
`frontend/src/App.css:403`.

**Observation:** The "Open another version" version buttons are wrapped
in `<div className="version-list">`, which already exists in `App.css`
as a CSS grid used by the version-popover. The visual outcome is fine
(grid of buttons), but the panel is not actually inside a popover, so
reusing the class couples two unrelated UI affordances. A future
restyle of the popover could ripple into the recovery panel.

**Risk:** Low. Cosmetic / maintainability.

**Recommendation:** Either rename to `read-safe-version-list` (or
similar), or add a more specific selector under `.read-safe-versions`
so the recovery panel's layout is unambiguously its own. P1-04 will
restyle this anyway, but isolating the selector now keeps the styling
boundaries clean.

### M6 — Recovery panel `<h1>` lacks `id`, second hierarchy in same `<main>` is fine but inconsistent

**Where:** `ProjectShell.tsx:179`.

**Observation:** The normal shell has `<h1 id="project-title">{project
.name}</h1>` paired with `aria-labelledby="project-title"` on the
section. The recovery panel uses `<h1>{projectName}</h1>` without an
id, and instead labels the section by the `read-safe-title` `<h2>`
(`aria-labelledby="read-safe-title"`). That's accessible, but the
`<h1>` is then orphaned from any explicit relationship — and the same
page now has both `<h1>` and an `aria-labelledby` pointing at an
`<h2>`. Screen readers will read fine; the inconsistency is a small
nit.

**Risk:** Very low.

**Recommendation:** Either keep the `id="project-title"` pattern on
the `<h1>` and point the section `aria-labelledby` at the `<h1>` (more
natural), or drop the `<h1>` and promote `<h2 id="read-safe-title">`
to the project-level heading inside the recovery section.

### L1 — `validate_document_with_errors` exposes raw Pydantic message strings

**Where:** `backend/features/project_document/validation.py:44-48`.

**Observation:** `errors = [str(error["msg"]) for error in exc.errors()]`
returns Pydantic error messages directly (e.g. `"Input should be 1"`).
Those strings can include the rejected value, which is fine for editor
diagnostics but not always user-friendly. Phase 1 scope only displays
them in the editor-only diagnostic block, which is acceptable.

**Risk:** Very low; cosmetic.

**Recommendation:** No change for P1-03. Worth noting for the future
"Contact admin / file issue" UX in case the diagnostics get a proper
viewer.

### L2 — `ProjectDocumentReadSafeEnvelope.body: Any` opens a serialization fast path that's hard to limit

**Where:** `backend/features/project_document/models.py:44`.

**Observation:** `body: Any` means the entire raw saved body is
inlined into the response. The body is already recoverable from the
`/download` endpoint, so for client purposes this is duplicative. A
malformed body that happens to be very large (e.g. 5MB of cruft from a
broken migration) will be sent both via `/document` AND `/download`.
Phase 1 doc bodies are small in practice; HBJSON and assets are stored
elsewhere. No body-size cap is enforced on the envelope.

**Risk:** Very low for Phase 1. Worth recording so the assumption is
explicit.

**Recommendation:** No change. If/when document bodies grow, consider
truncating or omitting `body` from the envelope and pointing clients
to `/download`. Add a brief comment in `models.py` or the lessons log
that the duplication is intentional.

### L3 — `schema_version_from_raw` is correct but its `row_schema_version: object` typing is loose

**Where:** `backend/features/project_document/store.py:263-270`.

**Observation:** The helper accepts `object` so it works with whatever
psycopg returns from the `schema_version` column. The `not isinstance
(_, bool)` guard for the `bool-as-int` case is good defense. The
loose typing reads as "I don't know what this is" rather than the
narrower truth ("DB column is INTEGER, but Python might wrap it as
psycopg's Numeric").

**Risk:** Negligible.

**Recommendation:** Typing it as `int | None` (and casting at the call
site) would communicate intent more clearly. Not blocking.

### L4 — Recovery panel has no copy-to-clipboard control for the diagnostic block

**Where:** `ProjectShell.tsx:198-219`.

**Observation:** US-Errors-SchemaFallback AC-5 allows either a
"Contact admin / file issue" link OR a "copyable diagnostic block".
The current `<dl>` is selectable (the user can drag-select and copy),
so this technically satisfies "copyable" in the loose sense. A copy
button would be nicer when the issue ends up in a Slack thread.

**Risk:** Negligible.

**Recommendation:** Defer to P1-04 (design system) or post-MVP unless
support tickets surface it as friction.

### L5 — `ProjectDocumentResponse` type unhelpfully wide

**Where:** `frontend/src/features/project_document/types.ts:30`.

**Observation:** `ProjectDocumentResponse = Record<string, unknown> |
ProjectDocumentReadSafeEnvelope`. The non-envelope branch is typed as
`Record<string, unknown>` because no frontend code consumes the full
document body today (the recovery panel only needs the envelope; the
normal shell loads table slices, not the full document). That's
honest but means consumers of `useProjectDocumentQuery` get no
help if they later try to read fields off the document body.

**Risk:** Negligible while the only consumer is the read-safe gate.

**Recommendation:** Once a real consumer of the success branch lands
(none planned for Phase 1), narrow this to a proper document type or
re-use the backend-generated client.

### P1 — Strict-table invariant is preserved cleanly

The roadmap goal "table reads and writes remain strict so invalid JSON
is recoverable but not editable" is implemented by simply not introducing
a `*_or_read_safe` variant for the table-slice endpoints (`store.py:157`
still calls `validate_document`). This is the right shape — the document-
level surfaces are read-safe, the table-level surfaces stay validation-
gated, and the difference is local enough to reason about.

### P2 — Single validation helper, used everywhere

`validate_document_with_errors` is a behavior-preserving extraction
from the existing `validate_document`. The strict variant now delegates
to it. The two paths share one Pydantic call site and one error-shape
contract. This was the right small refactor for this slice.

### P3 — `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` constant matches the §10.5 lazy-migration model

Hoisting the constant means the read-safe envelope's
`current_schema_version` cannot drift from the `ProjectDocumentV1`
literal default. When `ProjectDocumentV2` lands, bumping the constant
will surface validation-failure diagnostics with both saved and current
versions correctly. Worth keeping that constant exported even when V2
adds a new module.

### P4 — Structured WARN log includes the right ops fields

The `extra={...}` payload in `read_safe_envelope` is well-formed for
JSON log shipping: `error_code` + the three ids + saved `schema_version`
+ `request_id`. That matches the AC-8 contract from US-Errors-
SchemaFallback and the request-id propagation seam from TB-01.

## Out-of-scope but worth recording

- **MCP `get_document` still raises on invalid bodies.** This is by
  design per the P1-03 lesson "MCP read-safe behavior should be
  revisited when TB-17 adds draft writes." Worth a roadmap note so it
  doesn't get lost when MCP writes start landing. The current TB-17
  references in the roadmap don't yet mention read-safe behavior.
- **No forward-only upgrade shims exist yet.** P1-03 ships the
  *envelope* (the structural fallback) without any actual migration
  path, because Phase 1 has only one schema version. That is correct
  for now; the shim plumbing belongs to the slice that introduces
  `ProjectDocumentV2`. Recording it here so reviewers don't expect a
  shim infrastructure under P1-03.
- **Stale-ETag UI / restore-discard prompt / beforeunload** still
  unowned by a current slice; they are queued for P1-11. The read-
  safe panel's "Open another version" buttons currently `setSearchParams`
  unconditionally with no draft-still-open prompt — but no editable
  draft can exist alongside the read-safe state in V1 (the row body
  itself is unmigratable), so the prompt would be a no-op here.

## Verification

The roadmap ledger for P1-03 cites:

- `make lint`; `make typecheck`; `make test` (backend 49 passed,
  frontend 22 passed);
- `cd frontend && npm run build`;
- Browser Playwright check at `http://127.0.0.1:5173/projects/.../equipment`
  with intercepted unsupported-schema `/draft` response confirming the
  recovery panel, raw JSON CTA, diagnostics, and no Save button.

I did not re-run the local toolchain as part of this review. The
recorded evidence is consistent with the diff under review.

## Recommended Disposition

Mark P1-03 complete after the following minimal amendments:

1. H1: pick (a) or (b); if (a), update the US-Errors-SchemaFallback
   AC-7 wording in `00-foundation-shell.md` to reflect that saved/current
   `schema_version` are public diagnostics. If (b), gate
   `schema_version` and `current_schema_version` on edit-mode at
   `store.py:read_safe_envelope` the same way `validation_errors` is
   gated.
2. H2: replace `access.is_editor` at `store.py:71` with an edit-mode
   check that won't change semantics under future ACLs.
3. M2: add a sentence to `api.md` §9.4/§9.5 mirroring the
   `llm-mcp-schema.md` §10.5 (3) update.
4. M4: add the three suggested test cases (one backend `len(errors)`
   assertion, one invalid-draft-body backend test, one viewer-side
   frontend test).

M1, M3, M5, M6, L1–L5 are accepted as polish that can ride with later
slices (P1-04 design-system pass naturally covers M5/M6; M3 is a good
target for P1-11 concurrency UX work).

Phase 2 gating (per the roadmap's pre-TB-07 note): P1-03 satisfies the
read-safe blocker. Combined with P1-01 and P1-02 already complete, the
remaining gate for TB-07 is now the DataTable extraction (P1-08) or
its explicit re-scope.
