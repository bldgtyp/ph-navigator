---
DATE: 2026-05-13
TIME: 18:30 EDT
STATUS: Code review of P1-07 first-pass deliverable (local implementation
        + local browser smoke complete; staging pending). Reviewer not
        yet asked to mark the slice done.
SCOPE: Project Settings modal + MCP token UI. Reviews un-committed
       changes representing the P1-07 phase against the roadmap,
       US-Settings (50-settings-ops-llm.md), NEW-LLM-API-1, the access
       model in PRD §4, and the LLM-MCP schema notes. Reviews the
       slice as MVP, not against a fully-finished app. Out-of-scope
       items deliberately deferred by P1-07's "no project delete /
       no public-link / no ownership transfer" cuts are not flagged.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - planning/ROADMAP.html (P1-07 row + ledger)
  - planning/archive/dated/2026-05-13/phase-1-full-buildout-plan.md (P1-07 slice)
  - planning/archive/dated/2026-05-13/phase-1-baseline-gap-matrix.md (G-10, G-11)
  - planning/code-reviews/2026-05-13/p1-06-code-review.md (preceding slice)
  - context/user-stories/50-settings-ops-llm.md (US-Settings AC 1-13)
  - context/user-stories/50-settings-ops-llm.md (NEW-LLM-API-1)
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/stack-auth-migration.md
  - context/UI_UX.md
---

# Code Review — P1-07 Project Settings And MCP Token UI (first pass)

## Scope Check

P1-07's roadmap scope (lines 190-201):

> Make settings and MCP token administration user-accessible.
> Includes: Project Settings modal; editable Phase 1 metadata; MCP
> token issue/list/revoke UI; one-time token display; revoked-token
> feedback; no project delete in settings.
> Tests: Settings metadata behavior; token issue/list/revoke; revoked
> token rejection; Viewer access rejection.

The un-committed diff lines up with that scope:

- **Backend** — `UpdateProjectRequest` model, `PATCH
  /api/v1/projects/{id}` route, `update_project_metadata` service +
  repository helpers, `get_project_owner_display_name` repository
  helper, `ProjectDetail.owner_display_name` field, MCP server
  exclude-list update, two project metadata tests + one Viewer
  rejection test.
- **Frontend** — `ProjectSettingsModal.tsx` (~460 lines including
  embedded `McpTokensSection` and `TokenRow`); `features/mcp/`
  (api/hooks/types) for token list/issue/revoke; `useUpdateProject
  Mutation` hook; `UpdateProjectPayload` type;
  `owner_display_name` added to `ProjectDetail`; Project Settings
  trigger button rendered in `ProjectShell` for editors only;
  settings + token CSS; one App.test.tsx integration test.

MCP token REST routes (`features/mcp/routes.py`, `service.py`,
`repository.py`) pre-date this slice (TB-04b). P1-07 is the
browser-facing surface on top of them, plus the project-metadata
PATCH endpoint.

## Verdict

Reasonable first-pass MVP. The data flow is straightforward, the
Viewer guard is doubled (route + UI), the one-time token plaintext is
shown only on issue success, and the audit log is wired. There are
no security-grade defects.

The most important divergences from US-Settings AC are UX-level
rather than data-correctness — they would not block "local
implementation complete" but should be tracked rather than silently
left for a future slice. One backend concern (owner display name in
public reads) is worth a deliberate decision before P1-13 closes
Phase 1.

## Findings

Severity tags:
- **High** — meaningful spec divergence, privacy decision, or
  blocking gap. Resolve in P1-07 or explicitly defer with a note.
- **Medium** — UX or maintainability concern. Acceptable to land if
  noted as a tracked follow-up.
- **Low** — polish / future-proofing.

### H1 — Owner display name leaks into public/Viewer project reads (backend)

`features/projects/service.py:158` always runs
`repository.get_project_owner_display_name(project_id)` inside
`get_project_detail`, regardless of `access_mode`. The result is
returned as `ProjectDetail.owner_display_name` to every caller of
`GET /api/v1/projects/{id}`, including unauthenticated public reads
through `require_project_view_access`.

The PRD §4 access model says public project URLs are
**publicly readable**, but US-Settings AC4 only requires the Owner
field inside the editor-only Settings modal. None of the public
Viewer surfaces (project shell, Status tab read-only, public version
list) need the owner display name. Exposing the owner's full display
name to anyone who knows a project URL is a small but real privacy
expansion that wasn't part of the access-model decision.

The MCP `ProjectSummary` exclude in `features/mcp/server.py` already
acknowledges that `owner_display_name` is a detail-only field and
not part of the canonical `ProjectSummary` contract. Apply the same
posture to public REST reads.

Recommend either:

1. Only populate `owner_display_name` when `access_mode == "editor"`
   (return `None` for viewer reads), or
2. Move the owner display name to a separate
   `GET /api/v1/projects/{id}/settings-meta` (or
   `GET /api/v1/projects/{id}?include=owner`) call wired only from
   the Settings modal.

Option 1 is the smallest cut and matches the existing
`access_mode`-aware shape. Either way, the unconditional second DB
roundtrip per project-detail fetch should also go away when not
needed (see L1).

### H2 — Spec calls for the trigger to live in the project header `⋯` overflow menu

US-Settings AC1 (and PRD §11.1) explicitly require the trigger to be
the project header `⋯ → Project settings` menu item. The
implementation renders "Project settings" as a standalone secondary
button in `ProjectShell` (`routes/ProjectShell.tsx:139-147`).

This is a known short-term cut — the `⋯` overflow menu component
doesn't exist yet in the scaffold and no other items currently live
there. The P1-04 lessons explicitly noted that named primitives
(menus, popovers) are deferred until shadcn/Tailwind is installed.

This is **fine for MVP local landing**, but it should be either:

- Noted as a P1-07 lesson + tracked into a later slice (P1-08 or
  P1-13 docs pass) that introduces the project header `⋯` menu, or
- Documented in the gap matrix G-10 entry.

Without that bookkeeping, the slice will close with an implicit
deferral that nobody is tracking, and the future `⋯` menu work won't
know to migrate Settings into it.

### H3 — Field-level validation is not actually field-level

US-Settings AC6 says:

> Field-level validation runs on blur AND on Save. Errors render
> inline (red border + error icon + tooltip). Save button disabled
> while any field is in error state.

The current `ProjectSettingsModal` only renders a single combined
`<p className="form-error">` message from `settingsValidationError`
(`ProjectSettingsModal.tsx:176`). There is no inline per-field error
slot, no red-border state on the offending input, no blur handler,
and no error tooltip.

The Save button is correctly disabled, so users can't submit invalid
data — that is the load-bearing rule. But the UX falls short of the
spec's stated AC, and the error surface for BT-number-taken is a
toast-style banner inside the modal footer rather than an inline
error attached to the BT-number input.

For MVP this is acceptable if the spec divergence is recorded; AC6's
red-border/tooltip styling almost certainly waits on shadcn/Tailwind
primitives anyway. Recommend noting this as a deferred subset of
US-Settings AC6 in the P1-07 lessons.

### H4 — No ownership check on PATCH

`require_project_edit_access` in `features/projects/access.py` only
verifies a signed-in session exists; it does **not** check that the
signed-in user is the project owner. Any signed-in editor — even one
from a different organization sharing the deployment — can PATCH any
project's metadata, including its `bt_number`.

This is consistent with TB-02 lessons ("Keeping ownership as a
dashboard filter only") and with the current 2-user firm reality,
so it is probably an intentional MVP posture rather than a P1-07
regression. But US-Settings doesn't restate the access model and
NEW-LLM-API-1 reuses the same access path for MCP writes
post-MVP — once MCP write tools land, every project-scoped editor
token can edit metadata on every project the issuing user can sign
in to.

Recommend:

1. Confirm with Ed that "any editor can edit any project" is
   intentional MVP (probably yes).
2. Add a one-line `require_editor_user` + `project.owner_id == user.id`
   ownership guard, or explicitly defer it to a documented post-MVP
   slice (PRD §4 / access-model).

If deferring, capture this in `context/user-stories/90-open-questions.md`
or the access-model section of `stack-auth-migration.md` so the
implicit permission posture is visible.

### M1 — Settings modal is a single ~460-line file with three components

`frontend/CODING_STANDARDS` ("split large component files") and the
TB-03.5 / P1-06 reviews both pushed splitting non-trivial features
into route/components/helpers. `ProjectSettingsModal.tsx` currently
holds:

- `ProjectSettingsModal` (the form),
- `McpTokensSection`,
- `TokenRow`,
- `ReadOnlyMetadata`,
- `changedProjectFields` helper,
- `settingsValidationError` helper,
- `settingsSaveError` helper.

That's a Status-tab-shaped amount of content in one file. Split it
under `frontend/src/features/projects/components/project_settings/`:

```
project_settings/
  ProjectSettingsModal.tsx        (top-level form + Cancel/Save)
  ProjectMetadataFields.tsx       (editable metadata block)
  ReadOnlyMetadata.tsx
  McpTokensSection.tsx
  TokenRow.tsx
  lib.ts                          (changedProjectFields, validation, error mapping)
  lib.test.ts                     (pure helper tests)
```

This also lets a real unit test exist for `changedProjectFields`
(see M5).

### M2 — Click-to-copy on the issued token plaintext is missing

US-Settings AC9 says the one-time token plaintext is "shown exactly
once in a copy field". The current implementation renders the token
inside a styled `<code>` block (good — selectable, monospace) but
provides no explicit copy-to-clipboard control. The user has to
manually drag-select the text.

For day-1 MCP usage, the friction matters: this is the only chance
the user gets to capture the token, and a typo or partial selection
silently loses it. Add a "Copy" button next to the `<code>` element
that calls `navigator.clipboard.writeText`, plus a transient
"Copied." confirmation. Stay defensive against the
non-secure-context path (clipboard API unavailable).

### M3 — Revoke is a one-click destructive action

A single click of the per-token "Revoke" button immediately revokes
the token. US-Settings AC9 doesn't strictly require confirmation,
but every other destructive surface in V2 (delete a status item,
delete a project) is two-click. Add a confirmation step (inline
"Revoke / Cancel" toggle on the row, or a small modal) so a
mis-aimed click on a long-lived MCP token doesn't immediately break
a Claude tool integration the user is mid-call against.

### M4 — `cert_programs` change detection is order-sensitive

`changedProjectFields` (`ProjectSettingsModal.tsx:435`) compares
`next.cert_programs.join("|")` against
`project.cert_programs.join("|")`. Toggling PHI off then back on
preserves order so this works. Toggling both PHI off, then Phius
off, then PHI on, then Phius on yields `["phi","phius"]` either way,
so this also works.

But toggling Phius first then PHI yields `["phius","phi"]` while
the server stored `["phi","phius"]` — the diff detection then thinks
`cert_programs` changed and PATCHes the field. Functionally
correct (server validator dedupes and the order isn't user-visible)
but it generates noise in the audit log fields list and a spurious
PATCH on no-op toggles.

Compare as sorted sets, e.g. `Array.from(new Set(next)).sort()`
vs the same on the project value.

### M5 — Frontend test coverage is one integration happy-path

`App.test.tsx`'s new test exercises edit name + edit client + issue
token + revoke + save in one flow. That's a reasonable smoke check
but it doesn't cover any of:

- Viewer access path (read-only metadata view, no Save button, no
  MCP section, "Close" button label).
- BT-number-taken response → inline error.
- Validation error (empty name, empty BT, malformed Dropbox URL).
- Discard guard (dirty edits + Cancel triggers "You have unsaved
  changes. Discard?" prompt).
- Token issue without `project:write` scope (custom scope picking).
- Token expires_at conversion.
- Revoke failure / error display.

The roadmap's "Tests" row for P1-07 explicitly lists "Viewer access
rejection" and "revoked token rejection". The backend test covers
Viewer's 401 on PATCH; the frontend has no Viewer-modal test
because the modal trigger is hidden — that is fine — but the modal
itself can still be rendered with viewer access mode (the code path
exists at `ProjectSettingsModal.tsx:24,80-82,194`) and isn't
exercised. If `ReadOnlyMetadata` is going to ship, give it a unit
test.

Recommend at minimum:

- Pure-helper tests for `changedProjectFields` and
  `settingsValidationError` (no React needed once M1's split lands).
- One viewer-mode render test asserting Save is absent and the
  read-only block renders.
- One BT-number-taken test asserting the modal stays open with the
  field preserved and an error message visible.

### M6 — `useMcpTokensQuery` cache survives sign-out

`features/mcp/hooks.ts` doesn't participate in the auth-boundary
refresh/clear policy that TB-03.5 lessons learned to apply to
project queries. After sign-out, the cached token list survives in
the QueryClient. Today this only matters if the same browser then
signs back in as a different editor (low-probability in a 2-user
firm), but it is the same pattern TB-03.5 specifically flagged as a
trap: "access-mode-aware keys or auth-boundary refresh/clear".

Either invalidate `["mcp-tokens", ...]` on the auth-boundary alongside
`projectQueryKeys`, or scope the key by user id so the cache is
implicitly partitioned. The same applies to the new
`useUpdateProjectMutation`'s `setQueryData(detail(...))` call, but
that one is opportunistic write-after-PATCH so the risk is smaller.

### M7 — `update_project_metadata` writes all fields, not just the changed ones

`backend/features/projects/repository.py:update_project_metadata`
takes a `payload: UpdateProjectRequest`, then fills in the unset
fields from the current row (`values.get("name", current["name"])`),
then writes all six columns regardless. This works correctly but:

1. Always advances `updated_at` even when nothing changed.
2. Loses the "PATCH = sparse" semantic at the SQL layer.
3. Makes the audit-log `fields` list (which uses
   `payload.model_fields_set`) the only place where "what actually
   changed" is recorded.

Two cleaner shapes:

- Build the `SET` clause from `payload.model_fields_set` so only the
  truly changed columns appear in SQL, or
- Compare incoming vs current and short-circuit when no field
  actually changed (return current row, skip audit log).

For Phase 1 this is acceptable as-is; flag in the P1-07 lessons so
the next service touching this code knows the audit log is
authoritative for change tracking, not the SQL `UPDATE`.

### L1 — Extra DB roundtrip on every project-detail fetch

`get_project_detail` now issues three sequential SQL calls
(`get_project_by_id` if no cached `project`, `list_versions_for_project`,
and the new `get_project_owner_display_name`). When the caller
already passes `project`, only the latter two run, but the new query
always runs even though it's only needed inside the Settings modal
(see H1).

If H1 is resolved by gating `owner_display_name` to editor reads,
also skip the new query when `access_mode == "viewer"` (or fold it
into the existing `get_project_by_id` JOIN). The project shell is
loaded on every tab navigation; this is a cheap query but
unnecessary.

### L2 — `getQueryData` setter ignores `current === undefined`

`useIssueMcpTokenMutation.onSuccess` and
`useRevokeMcpTokenMutation.onSuccess` both call
`queryClient.setQueryData(key, (current) => ({ tokens: ... }))`. If
the list query hasn't loaded yet (the modal opens and Issue/Revoke
races the initial fetch), `current` is `undefined` and the setter
returns a single-element list that becomes the new cache truth — the
in-flight fetch result then races. In practice the issue form is
behind the loaded list (you can't revoke a token you can't see), so
this is unlikely to fire. Acceptable for MVP; consider invalidating
instead of opportunistically writing when `current === undefined`.

### L3 — `expires_at` interpreted as local time without UI feedback

The frontend converts the `datetime-local` input via
`new Date(value).toISOString()`, which interprets the entered value
as local-browser time and sends UTC. Users in different time zones
will see different actual expirations than they typed if they
copy/paste a token between machines. The spec doesn't dictate this,
and matching the local-calendar pattern from TB-03 is reasonable,
but the modal could helpfully display "Expires `<formatted local
time>` (UTC `<isoString>`)" beside the input. Low priority.

### L4 — Project ID has no click-to-copy + no monospace styling

US-Settings AC4 says the Project ID should be "small monospace;
click-to-copy icon for sharing in tickets / debugging". Today it
renders as plain `<dd>{project.id}</dd>` inside
`settings-readonly-grid`. The grid styling does inherit some
metadata typography but the value isn't monospaced and there's no
copy affordance. Low priority polish; bundle with M2's copy button.

### L5 — `ProjectShell` has lost its single-row layout assumption

The new `.project-header-actions` flex container in
`ProjectShell.tsx` works, but the existing CSS for
`.project-header` is unchanged. If `VersionControls` becomes wider
or wraps on narrow viewports, the Project Settings button may
visually crowd the version popover trigger. Low-priority visual
follow-up; P1-04 owns the design system, and a narrow-tablet
screenshot would confirm whether the existing media queries hold.

## Spec Conformance Matrix (US-Settings AC 1-13)

| AC | Requirement | Implementation | Status |
|---|---|---|---|
| 1 | Trigger from header `⋯ → Project settings` | Standalone secondary button in header | **Diverges (H2)** |
| 2 | Modal title + subtitle "name · BT-number" | `Project settings` + `name · bt_number` subtitle | Met |
| 3 | Editable: name, bt_number, phius_number, phius_dropbox_url | Implemented; also exposes `client` + `cert_programs` (not in spec but reasonable extension) | Met (+) |
| 4 | Read-only: Owner, Created, Last saved, Project ID + click-to-copy | Implemented except click-to-copy + monospace ID styling | Partial (L4) |
| 5 | bt_number uniqueness check, self-collision OK | Backend self-safe; frontend surfaces 409 | Met |
| 6 | Field-level validation on blur + Save, inline red border + icon + tooltip | Combined error paragraph only; no blur; no per-field UI | **Diverges (H3)** |
| 7 | Save/Cancel with dirty-edit discard prompt; Save disabled when clean | Save disabled when clean; discard banner appears | Met |
| 8 | Renaming has no side effects | Backend writes don't touch URLs/files | Met |
| 9 | MCP token list/create/revoke + one-time plaintext + scopes default to all four | Implemented; missing copy button + revoke confirmation | Partial (M2, M3) |
| 10 | No project delete in modal | None present | Met |
| 11 | Viewer: trigger hidden; if modal opens, read-only with Close | Trigger hidden via `!isViewer`; modal supports `ReadOnlyMetadata` + "Close" label | Met |
| 12 | Locked-version handling: N/A | Modal lives on relational `projects` row | Met |
| 13 | MCP-callable PATCH endpoint | `PATCH /api/v1/projects/{id}` returns `ProjectDetail` | Met |

## Recommended Resolution Before Marking P1-07 Complete

In rough priority order:

1. **H1** — Decide whether `owner_display_name` should reach
   anonymous public reads. Default recommendation: gate to editor
   access. Otherwise, document the decision in
   `context/user-stories/50-settings-ops-llm.md` (AC4 cross-reference
   to PRD §4 access model) so future contributors know the privacy
   posture is intentional.
2. **H4** — Confirm "any editor can PATCH any project" is intended
   MVP. If not, add an owner-id check. If so, record it as an
   open-question note for the access-model revisit slice.
3. **H2 + H3 + M2 + M3 + L4** — Record as P1-07 deferrals in the
   lessons row and tracked into the slice that introduces the
   project header `⋯` menu / shadcn primitives (P1-08 design system
   work or a dedicated chrome polish slice). None block functional
   correctness.
4. **M1** — Split `ProjectSettingsModal.tsx` before any further
   feature work touches it (e.g., adding the copy button or the
   revoke confirmation will compound the size).
5. **M4 + M5 + M6 + M7** — Address during the P1-07 simplify pass,
   following the same review/simplify cadence the prior P1-xx
   slices have used.

## Notes on Out-of-Scope Items

P1-07 explicitly does **not** include:

- Project delete (US-1.4 dashboard-only).
- Public link / share-link management (does not exist post 2026-05-10
  PRD §4 update).
- Ownership transfer UI (Q-OWN-2 — post-MVP).
- MCP write tools (TB-17 / NEW-LLM-API-1 write scope).
- "Danger zone" section.

None of these appear in the diff, so no action needed.

## Verification Evidence Confirmed In The Diff

- Backend: `UpdateProjectRequest` validators, route `PATCH`,
  service `update_project_metadata` with audit log + UniqueViolation
  handling, repository `update_project_metadata` + owner-display-name
  helper, MCP server exclude-list update.
- Tests: editor PATCH happy path with audit row assertion, duplicate
  BT-number rejection, public viewer PATCH 401.
- Frontend: `ProjectSettingsModal`, MCP token list/issue/revoke
  hooks, project-shell button gating, App.test.tsx integration test
  for the edit + issue + revoke + save flow.
- Roadmap ledger updated to "In progress" with local evidence;
  baseline gap matrix G-09 marked complete (P1-06 close-out, not
  P1-07).

## Summary

P1-07 is a well-scoped, mechanically sound first pass. It lands the
metadata PATCH endpoint, the modal, the MCP token UI, and the audit
log entries the slice promised. The Viewer guard is doubled at the
route and the UI; the one-time plaintext is shown only on issue
response; the access-control path reuses the existing
`require_project_edit_access` seam.

The remaining work is mostly tracked-deferral bookkeeping (H2, H3,
M2, M3, L4 will all naturally land alongside the `⋯` menu and
shadcn primitives) plus one privacy-posture decision (H1) and one
access-model confirmation (H4). Get H1 + H4 decided before P1-07 is
marked complete; the rest can be P1-07 lesson notes plus follow-up
tickets.
