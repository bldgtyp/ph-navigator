---
DATE: 2026-05-13
TIME: 21:00 EDT
SCOPE: Code review of uncommitted P1-11 (Draft, version, and concurrency UX completion).
REVIEWER: Claude (Opus 4.7)
RELATED: docs/plans/01_IMPLEMENTATION-ROADMAP.md (P1-11);
         context/technical-requirements/save-versioning.md (§8.1–§8.6);
         context/user-stories/00-foundation-shell.md (US-Concurrency);
         context/technical-requirements/frontend-viewer-units.md.
---

# P1-11 — Draft, Version, And Concurrency UX Completion — Code Review

## Summary

The change extends `VersionControls` with a recovered-draft restore/discard
modal, a dirty-draft prompt (Save / Save As / Discard) before opening a
different version, a `beforeunload` warning while a server-side draft is
present, a stale-version-ETag conflict modal, and a locked-version
conflict modal. `EquipmentTab` gets a live lock downgrade path that
freezes the in-flight Room modal instead of silently dropping local edits
on a `409 version_locked`. A small `project_document/lib.ts` helper
centralizes the error-code classifiers and adds a session-scoped
"locally touched" set so the user is not re-prompted to restore their
own just-written draft. The two-tab Playwright E2E is updated for the
current row-open gesture.

Scope is well-aligned with the P1-11 "Includes" list and the §8.1/§8.5
requirements. The interesting gaps are (a) the MCP edit-lease UX is not
present (P1-11 does not list it explicitly, but §8.5 calls for it), and
(b) "local undo invalidation rules" is listed in Includes but is not
visibly addressed in this diff. The remaining issues are local logic /
state-hygiene concerns.

## What lines up with the spec

- **Restore / discard prompt** (§8.3): `useEffect` keyed off
  `initializedDraftVersionsRef` runs once per version, gated by
  `wasLocalDraftTouched` so an active session never re-prompts after its
  own write, and by `draftLooksRecovered` so a draft created within the
  last 5 s (i.e. a write that just landed before the summary refetch)
  does not look "recovered." Matches the §8.3 reopen behavior.
- **`beforeunload` warning** (§8.1): registered while `hasDraft && activeVersionId`.
  Server-side draft existence is the correct trigger because §8.3 makes
  the server-side draft the canonical "unsaved" signal.
- **Dirty-draft prompt before version switch** (§8.2): `openVersion` is
  gated on `hasDraft && versionId !== activeVersionId`. The switch modal
  exposes Save, Save As (with target preserved via
  `saveAsReturnVersionId`), Discard, and Cancel, and §8.5 "Version switch
  after dirty-draft Save" is honored: `saveAndOpenVersion` only calls
  `onOpenVersion(target.versionId)` *after* `saveMutation.mutateAsync`
  resolves, so a failed save keeps the user on the current version.
- **Stale Save 409** (§8.5): `handleDocumentActionError` distinguishes
  `version_etag_mismatch` from `version_locked` and opens the right
  modal. Both modals offer Save As / Discard / Keep, and the draft
  summary is refetched so the next action sees server truth.
- **Lock-with-open-draft** (§8.5): `EquipmentTab.handleVersionLockedConflict`
  flips `liveLockDowngrade`, freezes `canEdit`, sets the open `RoomModal`'s
  `frozenReason` so the user's typed edits are preserved until they
  intentionally reload, and invalidates the project + draft summary
  queries. This is exactly the "preserve the draft, freeze write
  controls, show banner" behavior in §8.5.
- **Same-editor tab conflict**: the two-tab Playwright test was updated
  to the DataTable row-open gesture; the runtime behavior in
  `useRoomsDraftBroadcast` is unchanged (already shipped in TB-06).

## Issues

### M1 — `markLocalDraftTouched` ignores the `draftEtag` argument it claims to gate on

`project_document/lib.ts` accepts `draftEtag` but builds the key from
only `(projectId, versionId)`:

```ts
export function markLocalDraftTouched(projectId, versionId, draftEtag) {
  if (!draftEtag) return;
  locallyTouchedDraftKeys.add(localDraftKey(projectId, versionId));
}
```

The argument is a sentinel ("there is a draft") rather than part of the
identity. Two consequences:

1. The signature is misleading. Anyone reading the call site (`hooks.ts`
   line 58) reasonably expects the etag to be remembered, then matched
   in `wasLocalDraftTouched`. It is not.
2. The set is *module-level* and never cleared. Once a session touches
   the draft for `(projectId, versionId)`, the restore prompt is
   suppressed for the lifetime of the JS context — including across
   route changes, sign-out / sign-in, and across vitest cases that share
   the same module. Today the test ordering happens to be safe (the
   single Rooms-PUT test runs after every restore-prompt test) but this
   is fragile.

Suggested fix: either drop the unused parameter and document the
"per-session" semantics, or actually key on
`(projectId, versionId, draftEtag)` so a *new* recovered draft (after a
reload, where etag will differ) re-prompts naturally. A reset hook on
auth boundary (similar to TB-03.5's auth-cache clear) would also avoid
test bleed.

### M2 — "Local undo invalidation rules" listed in P1-11 Includes is not addressed

P1-11's `Includes` field calls out "local undo invalidation rules"
alongside the restore prompt, beforeunload, stale ETag, and lock
downgrade. I see no undo stack or invalidation logic in this diff, nor
elsewhere in `equipment/` / `project_document/`. Two options:
either confirm undo doesn't exist yet (so there is nothing to
invalidate, and the Includes bullet should be struck or routed to a
follow-up slice) or land the rules now so the §8.5 conflict paths
(`reloadDraft`, `handleStaleDraftConflict`, `handleVersionLockedConflict`)
explicitly discard any pending local undo state. Worth a one-line note
in the roadmap ledger either way.

### M3 — MCP edit-lease UX deferred without an explicit deferral note

§8.5 ("MCP/browser collision policy") requires that during an MCP write
lease the browser shows an "MCP editing" indicator and freezes write
controls, then offers Review / Reload after the MCP write completes.
P1-11's Includes line does not list MCP lease, so the omission is
likely intentional — P1-11 focuses on browser-only concurrency. But
TB-04b is already complete with read-only MCP, and TB-17 is the next
MCP-write slice. If the lease UX is being routed to TB-17 rather than
P1-11, that should be called out in the P1-11 ledger row so the
"concurrency UX" claim is bounded.

### L1 — Stale-save modal stacks on top of an inline error string

`handleDocumentActionError` sets both `actionError` *and* `confirmation`
for `version_etag_mismatch` / `version_locked`. The inline
`p.inline-action-error` remains rendered behind the open modal. When the
user dismisses the modal with "Keep draft", the inline error is the
only feedback left, which is fine, but during the modal life the
double-up is noisy and the inline text duplicates the modal body. Pick
one: either suppress `actionError` while a related confirmation modal
is open, or skip the inline string for these two codes.

### L2 — `liveLockDowngrade` is local component state, not query-derived

`EquipmentTab` flips a local boolean on `version_locked` and then
invalidates the project / draft queries. The boolean is reset on
`activeVersionId` change but not when the project query returns with
`active_version.locked === true` — at which point the local boolean
becomes redundant, not wrong. Functionally fine, but consider deriving
`isLocked` purely from query state once invalidation lands, so the
freeze persists across remount/refetch without needing the component
to remember it.

### L3 — `draftLooksRecovered` 5 s heuristic is implicit

The constant `5_000` is the only thing distinguishing "the user just
saved a patch and the summary is reflecting it" from "this draft is
from an earlier session." It works because writes go through
`markLocalDraftTouched` first and the `wasLocalDraftTouched` check
short-circuits the prompt. The 5 s fallback only matters if a draft was
touched in another tab or by MCP without local state. A one-line
comment explaining the role would prevent future "why 5 s?" churn, and
this is exactly the kind of non-obvious why-comment the project's
coding rule allows.

### L4 — Save As "switch target" path silently overrides server's new active version

In `saveAs`, when `saveAsReturnVersionId` is set (switch-flow path),
`onOpenVersion(saveAsReturnVersionId ?? response.version.id)` opens the
*original* requested target, not the newly created version. Per §8.2,
Save As "create new `project_versions` row from draft body; set as
active version", so the server has just moved `active_version_id` to
the new row, and the project detail query will reflect that on the next
refetch — but the route will be pointing at the user's original switch
target. This is the right product behavior (the user picked Save As
because they wanted to *keep editing the target they picked*, not the
freshly minted version), but it does mean the active version on the
server and the open version in the URL can diverge briefly. Worth a
short code comment so the next reader doesn't "fix" it.

### L5 — `dispatchEvent(beforeunload)` test asserts `defaultPrevented`, not the legacy `returnValue` UX

Browsers no longer honor a custom `returnValue` string — the test
correctly observes `defaultPrevented`. The handler still assigns
`event.returnValue = ""`, which is the only reliable Chrome/Safari
trigger for the native prompt. This is correct; flagging only so the
two-line handler is not "simplified" away later.

## Architectural / security / performance

- No new server endpoints; this slice is pure frontend over existing
  REST and existing ETag rules. ETag use stays correct: Save sends the
  `version_etag` captured at draft open via `draftSummary.version_etag`,
  which matches §8.5 "Save / Save As: sends `If-Match: <version_body_etag>`
  taken at draft open."
- The new `locallyTouchedDraftKeys` module-level set is small and
  per-tab; not a memory concern.
- `BroadcastChannel` use is unchanged. The two-tab E2E gesture update is
  the only behavior shift, driven by P1-08's DataTable row-open change.
- No new auth boundaries. Editor-only behavior is correctly gated by
  `project.access_mode === "editor"` before any draft-summary fetch.

## Tests vs. P1-11 acceptance

P1-11 Tests row: "Draft restore/discard; version-switch prompt; stale
write; lock with open draft; same-editor tab conflict behavior."

- Draft restore/discard — `App.test.tsx`
  "prompts to restore or discard a recovered draft and warns before
  unload" covers both branches and the beforeunload prevention.
- Version-switch prompt — "requires a save, save-as, or discard choice
  before switching away from a dirty version" covers Save then open;
  Save As / Discard paths are exercised through the dialog button
  presence in the stale-save and locked-save modals but not end-to-end
  for the switch flow. Consider one more case driving "Discard changes"
  inside the switch modal.
- Stale write — "shows Save As and discard exits when Save finds a
  stale version ETag" covers the modal surface but does not assert that
  the draft survives (i.e. that `discardDraft` was *not* called).
- Lock with open draft — "downgrades an open room edit when the
  version is locked elsewhere" covers the frozen-input + disabled-Save
  surface; it does not assert that the user's typed text is still
  present after reload-draft is chosen, which is the core §8.5 promise.
- Same-editor tab conflict behavior — E2E covers the freeze; no unit
  test covers the broadcast-message → freeze path, which is acceptable
  given the E2E pass.

## Recommendation

Land. The slice delivers the §8.1–§8.5 UX surface promised by P1-11
and the tests exercise the load-bearing paths. Before marking P1-11
complete, address M1 (rename or properly key the
`locallyTouchedDraftKeys` set) and resolve M2 / M3 in the roadmap
ledger — either by implementing the missing piece or by routing it to
a named follow-up. The L-tier items can be cleaned up opportunistically
with the rest of the Phase 1 hardening pass in P1-13.
