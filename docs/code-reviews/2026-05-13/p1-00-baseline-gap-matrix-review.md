---
DATE: 2026-05-13
TIME: 11:10 EDT
STATUS: Code review of P1-00 deliverable
SCOPE: Review of the P1-00 (Phase 1 Baseline And Gap Matrix) deliverable
       against the PRD, technical requirements, user stories, prior
       code-review synthesis, and the actual code state.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md
  - docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md
  - docs/plans/2026-05-13/phase-1-full-buildout-plan.md
  - docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md
  - context/PRD.md
  - context/USER_STORIES.md
  - context/technical-requirements/api.md
  - context/technical-requirements/save-versioning.md
---

# Code Review — P1-00 Phase 1 Baseline And Gap Matrix

## Scope Check

P1-00 is by design a **no-code inventory slice**. The reviewed change set is:

- `docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md` (new, 92 lines)
- `docs/plans/01_IMPLEMENTATION-ROADMAP.md` (status table + P1-00 row updates only)

The review compared both files against `context/PRD.md`,
`context/USER_STORIES.md`, `context/technical-requirements/*`, the prior
code-review synthesis, and the actual code state at HEAD `ce3c946`.

## Verdict

**Approve with minor amendments.** The gap matrix is accurate,
well-classified, and consistent with the PRD. The verification baseline
numbers (backend 45 / frontend 19) match reality. The "Now / Deferred /
Later" classifications are defensible. The matrix is fit for purpose as
a P1-00 deliverable. The amendments below are completeness gaps in the
matrix, not errors.

## Accuracy Of Gap Claims (Verified)

| Gap | Claim | Verified state | Verdict |
|---|---|---|---|
| G-02 | `project_document/service.py` mixes draft/version/diff/downloads/Rooms/audit | 525 lines, all listed concerns interleaved (e.g. Rooms helpers at L57-69, L96-105, L499-525 sit next to draft logic at L142-220 and audit at L438-455) | Accurate |
| G-03 | Generic table routes are Rooms-only in implementation | `require_rooms_table()` at `service.py:417-423` hard-rejects any other name; routes import `RoomsSliceResponse`/`RoomsSliceReplaceRequest` directly | Accurate |
| G-04 | Header Save/Discard/Diff still coupled to Rooms slice | `ProjectHeaderControls.tsx:45-47` calls `useRoomsSliceQuery`; `hasDraft = roomsSlice?.source === "draft"` | Accurate |
| G-05 | Raw recovery exists; read-safe envelope not implemented | `/download` returns raw body even for `schema_version: 999`; `/download/tables/{name}` still raises `422 invalid_project_document` | Accurate but worth noting: per-table download is validation-gated by design (api.md §9.7 / save-versioning §8.4 #8). The "envelope" gap is workspace-level only. |
| G-06 | No Tailwind/shadcn/tokens | `package.json` has no Tailwind/shadcn/radix; `App.css` uses hardcoded hex; no `tailwind.config*`, no `components/ui/` | Accurate |
| G-11 | MCP token issue/list/revoke service + REST exist; no browser UI | `features/mcp/routes.py:19,24,33` confirms three routes; no Settings frontend feature | Accurate |
| G-12 | Rooms still on `TablePrimitiveStub` | `RoomsTable.tsx:55` renders through stub; no `@tanstack/react-table` import in repo | Accurate |
| G-16 | Concurrency UX still incomplete | `BroadcastChannel` lives in `equipment/hooks.ts:84` (Rooms-specific, not extracted); no `beforeunload` listener anywhere; `window.confirm` is currently the version-switch/discard prompt | Accurate, slightly understated — `beforeunload` is fully absent (PRD §8.1 calls for it explicitly), worth surfacing |
| G-18 | Action logging exists, scattered | Centralized `auth_repository.log_action` (L167-196) called from 4+ feature services; not unified at write boundary | Accurate |
| Baseline checks | 45 backend / 19 frontend | `pytest --collect-only`: 45 collected. `npm test`: 19 passed | Accurate |

No factual errors were found in the matrix.

## Architectural / PRD Divergences The Matrix Misses

These are real divergences from `context/` that the matrix should surface
so they do not get implicitly deferred without a named owner slice:

1. **Idempotency-Key middleware is unowned.** `api.md §9.5` says *"All
   mutating REST writes accept `Idempotency-Key`"* with explicit replay
   semantics. The matrix's `api.md` row mentions "idempotency where
   applicable" parenthetically but no `G-` row owns it. The code-review
   synthesis ADR-12 lists this as required before MCP writes.
   Recommendation: add it as its own row (Now decision; P1-11 or P1-12
   candidate) so the deferral is explicit.

2. **JSON-Patch draft endpoint (`PATCH /draft`) is missing.** `api.md
   §9.5` and `save-versioning §8.3` both call for JSON-Patch ops; only
   `PUT /draft/tables/{name}` is implemented today (`routes.py:78`). The
   matrix mentions this only as one item in the `api.md` prose row
   ("JSON-Patch draft endpoint") and does not classify it. Phase 2 tables
   (Envelope, Windows) and MCP writes will both want semantic patches per
   the code-review synthesis P1.2. Worth its own row.

3. **In-place re-auth / session-expiry modal still has no slice owner.**
   TB-01 and TB-03 lessons both list this as a blocker before production
   editable workflows. PRD §13 / `00-foundation-shell.md` US-Concurrency
   reference it. The matrix does not surface it — G-16 covers tab
   concurrency and lock downgrade, not session expiry. Recommendation:
   name it as a Now-or-Deferred gap with an explicit P1-05 / P1-07 /
   P1-11 owner.

4. **JSON Schema endpoint timing.** PRD §5 / §10 promises *"OpenAPI +
   JSON Schema documents published at well-known endpoints"* as a
   first-class API surface. Code-review synthesis ADR-11 makes this a
   blocker before MCP writes. G-17 mentions OpenAPI + schema together
   but treats them as one item. Splitting them — OpenAPI vs
   project/table JSON-Schema endpoints — would let the read-only MCP path
   (TB-04b) ship now without binding the schema work to P1-12.

5. **`beforeunload` warning is fully absent.** PRD §8.1 calls this out
   explicitly as part of the file-app mental model: *"Closing the browser
   with unsaved changes triggers a `beforeunload` warning."* G-16 lists
   it but the framing understates a PRD-named MVP affordance.

## Internal Consistency Concerns

1. **TB-06 status accounting.** The roadmap row at line 594 keeps TB-06
   as "Local complete; staging pending" while the new P1-00 row at line
   595 is marked Complete. That is fine — P1-00 is the slice that *names*
   the TB-06 blocker, not the slice that fixes it. But the matrix's
   recommendation under "Decisions To Carry Into P1-01+" #4 ("Do not mark
   TB-06 fully complete until staging browser evidence lands") should be
   reflected as an open follow-up in the roadmap Lessons row for P1-00
   (currently it only mentions "TB-06 staging evidence still open").
   Worth a one-line cross-reference.

2. **Gap classification term overlap.** "Now decision" appears for G-05
   and G-07 (read-safe-mode and dashboard pin/reorder). The legend at
   lines 42-44 only defines `Now`, `Deferred`, `Later`. Either extend the
   legend or change those to `Now` with the decision logged in the HITL
   section of the full-buildout plan.

3. **G-15 "Equipment sub-tabs" vs `30-tables-equipment.md`.** The matrix
   routes ERV/Fan/Pumps/TBs to TB-18 / Phase 6. That is consistent with
   PRD §7 / `30-tables-equipment.md`, but the matrix does not restate the
   Rooms→ERV reference dependency that US-EQ-2 implies (Rooms can
   reference ERV ids today only as forward-compatible strings).
   Recommendation: in G-14's text, name the "ERV assignment field
   represented in a forward-compatible way" requirement from the
   full-buildout plan so a future P1-10 author does not accidentally drop
   the field.

## Security / Performance / Architecture Flags (informational)

Since this slice ships no code, there are no new security or performance
vulnerabilities. The matrix does flag the pre-existing posture correctly:

- Project URLs are public-readable by design (PRD §4); writes are
  server-gated through `require_project_access`. Verified: backend uses
  the seam consistently.
- MCP tokens are project-scoped and hashed; revocation works (G-11).
- The whole-table replace pattern carries a known O(whole-document)
  validation cost; the code-review synthesis defers measurement to real
  load, and the matrix correctly does not add it as a Now item.

## Recommended Amendments To Matrix Before Closing P1-00

1. Add three rows: **Idempotency-Key middleware** (Now decision; ADR-12
   / P1-11 candidate), **`PATCH /draft` JSON-Patch endpoint** (Now
   decision; P1-11 or P1-12), **In-place re-auth modal** (Now; P1-05 /
   P1-07 / P1-11 candidate).
2. Split G-17 into "OpenAPI baseline" vs "Project/table JSON Schema
   endpoints" since they have different downstream consumers and
   different timing pressures.
3. Strengthen G-16 to call out the missing `beforeunload` listener as a
   named MVP PRD affordance (PRD §8.1), not just a bullet in a list.
4. Tighten the classification legend to either drop "Now decision" or
   define it.
5. Cross-link the P1-00 progress-ledger row to the named TB-06
   follow-up so the staging credential issue stays visible.

None of these block accepting P1-00 — the matrix is honest about being an
inventory pass, and the recommended amendments are small text edits in
the same artifact, not new investigation.

## Verification Method

- Read all uncommitted files end-to-end.
- Read `context/PRD.md` §§1-11, `context/USER_STORIES.md`,
  `context/user-stories/00-foundation-shell.md` (relevant ranges),
  `context/technical-requirements/api.md` §§9.1-9.10,
  `context/technical-requirements/save-versioning.md` §§8.1-8.6.
- Spawned two parallel `Explore` agents to grep/Read the backend and
  frontend specifically against the matrix's claims; cross-checked their
  findings against direct Reads of `service.py`, `routes.py`,
  `ProjectHeaderControls.tsx`, `equipment/hooks.ts`,
  `shared/ui/TablePrimitiveStub.tsx`, and `package.json`.
- Re-ran `pytest --collect-only` (45) and `npm test` (19) to verify the
  baseline test counts.
- Confirmed `PATCH /draft` is not registered in
  `features/project_document/routes.py`.
