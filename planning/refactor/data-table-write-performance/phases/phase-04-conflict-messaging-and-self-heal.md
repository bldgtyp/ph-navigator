---
DATE: 2026-07-09
TIME: -
STATUS: Planned — depends on phase-01 (residual 409s are genuine
  conflicts only after the queue exists).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 4 — truthful conflict copy
  keyed to the actual 409 cause, and a narrow one-shot self-heal
  (refetch → rebuild → resend once) for row-scoped ops per PRD D-9.
  Small phase.
RELATED:
  - ../PRD.md §2 (F-5), §6 (D-6, D-9), §7 (A-5)
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts (runWithConflictHandling)
  - frontend/src/features/project_document/lib.ts (isDraftStaleError, isVersionLockedError)
  - frontend/src/shared/ui/data-table/feature/types.ts (ConflictMessages)
  - backend/features/project_document/write_spine.py:89-105 (the two 409 codes)
  - features/*/routes/*PageConfig.ts + equivalents (per-table conflict copy constants)
---

# Phase 4 — Honest conflict messaging + one-shot self-heal

## 1. Goal

After Phase 1, a 409 can only mean a **genuine** cross-editor change
(another tab, another user, an MCP agent, or a save/version event) —
never the user's own typing speed. This phase makes the UX say that
truthfully, and quietly absorbs the conflicts that are safe to absorb.

## 2. Work items

### 2.1 Distinguish the two 409 causes in copy

Backend already returns distinct codes (`write_spine.py:89-105`):

- `draft_etag_mismatch` — the draft advanced under us → "This draft was
  changed outside this view (another tab, editor, or agent). Reloaded
  the latest draft; your last change was not applied." — reload framing,
  no instruction to the user to do it themselves if we already did
  (D-6 auto-refetches; make the copy match the behavior).
- `version_etag_mismatch` — the *saved version* changed before this
  draft existed → distinct copy ("The saved version changed…").

Implementation: extend `isDraftStaleError` (or add a
`classifyDraftConflict(error)`) to read the error `code` from the 409
body rather than lumping; extend `ConflictMessages` with the new
variants; update per-table copy constants ONCE via the shared default —
per D-1, prefer centralizing the strings and letting tables override
only the table-name interpolation, rather than N hand-written variants
(audit how `conflictMessages` is populated today and consolidate if
it's copy-paste).

Also correct the residual lie: only claim "another tab" when we have
broadcast-channel evidence (Rooms path can pass that hint); otherwise
say "outside this view".

### 2.2 One-shot self-heal (PRD D-9 — narrow by design)

In the queue's failure path, BEFORE the D-6 drain, attempt exactly one
transparent recovery when ALL of:

- error is `draft_etag_mismatch` (never `version_etag_mismatch`, never
  version-locked, never validation),
- the failed op is `cell`, `fill`, or `rowInsert` (additive/row-scoped;
  never paste — it may carry deletes —, never rowDelete/rowDuplicate,
  never schema mutations or option replaces),
- after refetching the authoritative slice, every row targeted by the
  op still exists (for `rowInsert`: no id collision with a remote row),
- this op has not already been retried (per-op retry flag).

Then: rebuild the payload from the refetched slice + resend with the
fresh etag. On success, continue the queue normally (the user never
sees a banner — their cell value or new row landed on top of the remote
edit, which is what they meant). On any failure of the retry, or any
unmet condition: standard D-6 drain + honest banner.

Log every self-heal via the existing frontend logging/announce channel
(and consider a subtle toast — decide with Ed at review; default: no
toast, silent success).

### 2.3 Test the drill

Two-tab Playwright drill (A-5): tab A and tab B editing the same table;
B's queued cell write hits A's etag rotation → self-heal succeeds
silently; B's row-delete-conflicting write → banner with the new
draft-changed copy, history cleared, table shows refetched truth.

## 3. Step-by-step

1. Backend 409 body audit: confirm code strings + response shape
   (read-only; if the body lacks a machine code, add it server-side as
   a strictly additive field — coordinate as a mini backend change).
2. `classifyDraftConflict` + `ConflictMessages` extension + copy
   consolidation sweep.
3. Self-heal in the queue failure path per §2.2 with unit tests for
   every gate (retry-once, op-kind allowlist, row-existence check,
   version-mismatch excluded).
4. Two-tab Playwright drill (§2.3).
5. Closeout gate.

## 4. Acceptance

- PRD A-5 verbatim; plus unit-proven: no retry loops (max 1), no
  self-heal on destructive ops, honest copy for both 409 codes.

## 5. Notes

- Keep the self-heal inside the queue module, not in
  `runWithConflictHandling` — the queue owns ordering and already knows
  the op kind; the controller keeps owning UX (banner/blocker).
- MCP agents share the same draft (single draft row per version+user) —
  self-heal makes agent+browser co-editing smoother, but do NOT widen
  the allowlist for that; agents can re-read like anyone else.
