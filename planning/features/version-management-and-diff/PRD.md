---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — behavior contract ready for implementation planning
AUTHOR: Ed May / Codex
SCOPE: Product and API contract for Version management and diff UX
RELATED:
  - planning/features/version-management-and-diff/README.md
  - planning/features/version-management-and-diff/PLAN.md
  - context/technical-requirements/save-versioning.md
---

# PRD — Version Management and Diff

## 1. Problem

The Version popover is adequate for opening and Save As, but not managing a
long-lived project's history. Names cannot be corrected, obsolete Versions
cannot be removed, and no edit timestamp is shown. The Diff modal exposes a
backend implementation detail—long table paths containing nested keys and row
IDs—rather than answering what changed.

## 2. Goals

- Give editors a dedicated Version Management modal reachable from the existing
  Version controls.
- Rename and safely delete saved Versions.
- Show last-edited date/time in both the existing Open-Version popover and the
  management modal.
- Redesign Diff around records, fields, operations, and before/after values.
- Keep Version locks, drafts, active/default behavior, access controls, ETags,
  and audit logging explicit.

## 3. Version list and management surface

### 3.1 Entry points

- Preserve the compact existing Version popover for quick **Open** and
  **Save As**.
- Add `Last edited {localized date/time}` to each existing Version row using
  `ProjectVersion.updated_at` and `formatProjectDateTime`.
- Here **Last edited** means the Version row's last saved-body or metadata
  mutation (including rename or lock/unlock), not exclusively a document-body
  edit.
- Add **Manage versions...** to that popover and the Project actions menu.
- Open a dedicated shared `ModalDialog`, large enough for name, kind, lock,
  default, timestamp, and actions without truncating ordinary content.

### 3.2 Management list

Each Version row shows:

- name;
- kind (`Working`, `Submitted`, `Closed`, `Snapshot`);
- Locked and Default indicators where applicable. **Default** is UI copy for
  the database/API's active Version; it remains the project active Version even
  while the URL is browsing a different `?version=`.
- `Last edited` in the user's local timezone, with the full timestamp available
  to assistive text/tooltip;
- Open, Rename, and Delete actions as permitted.

Sort in the same stable order as `ProjectDetail.versions`; this feature does not
invent a second ordering rule.

### 3.3 Rename contract

- Editors may rename active, inactive, locked, submitted, closed, and snapshot
  Versions. Lock protects the saved body, not its descriptive metadata.
- Trim surrounding whitespace; require 1–120 characters.
- Enforce the existing per-project unique-name constraint and return a stable
  `version_name_taken` conflict instead of leaking a database exception.
- Extend `VersionPatchRequest` with `name`. Validation uses Pydantic's supplied
  field set so omission is distinct from `null`/`false`: explicit `name: null`
  is invalid, `locked: false` is a valid mutation, and `make_active: false`
  alone is not a meaningful patch. Require a supplied `name`, supplied
  `locked`, or `make_active: true`.
- Update `updated_at`/`updated_by`, append an audit event, and return refreshed
  `ProjectDetail` so breadcrumb, popover, and manager update together.
- Renaming never modifies the saved body, draft body, body ETag, kind, lock, or
  active/default identity.

### 3.4 Delete contract

Deletion is destructive and server-authoritative:

- Only editors may delete.
- The active/default Version cannot be deleted. The user must open/make another
  Version active first; return `409 active_version_delete_blocked`.
- A project's sole Version cannot be deleted; return
  `409 last_version_delete_blocked`.
- Any non-active Version, including locked/submitted/closed Versions, may be
  deleted after an explicit confirmation naming it and warning that associated
  drafts are discarded.
- Lock the project row first, then all required Version rows in stable ID order
  with `SELECT ... FOR UPDATE`; re-read active identity and count while those
  locks are held. Save, Save As, make-active, and delete must all adopt this
  project-then-Version order—no transaction that touches both tables may retain
  today's Version-then-project order. This prevents deadlock as well as
  delete/delete and make-active/delete guard races.
- The transaction deletes Version-scoped drafts through the existing FK,
  preserves child Versions while their `parent_version_id` becomes null, logs
  one audit event, and returns refreshed `ProjectDetail`.
- Confirmation uses the app's standard danger action and remains disabled while
  pending. Failure leaves the manager open with a stable error.
- No optimistic removal: wait for the server response.

Use `POST .../versions/{version_id}/delete` with
`{"confirm_name": "<current exact name>"}`. A stale/mismatched name returns
`409 version_delete_confirmation_mismatch`; a missing row reuses the existing
stable `404 project_version_not_found`. The response is refreshed
`ProjectDetail`. Do not
expose a generic repository delete.

## 4. Human-readable Diff

### 4.1 Structured backend response

The backend must expose structured changes rather than asking the frontend to
parse path strings. Extend `ProjectDiffResponse` additively:

```text
tables: DiffTable[]
DiffTable = {table, change_count, changed_paths,  # existing REST/MCP fields
             table_label, added_count, removed_count, changed_count,
             changes: DiffChange[]}
DiffChange = {operation, record_id, record_label, field_key?, field_label?,
              before, after, raw_paths: string[]}
```

For each changed table, return changes with:

- operation: `added`, `removed`, or `changed`;
- stable table key and human table label;
- record ID plus resolved record label/name when available;
- field key plus human field label when available;
- before and after JSON values;
- raw technical path as secondary diagnostic data.

An added/removed record produces one record-level change with no field key and
the whole meaningful record payload in `after`/`before`; an edited record
produces one change per changed field. Tables with no changes are absent.

Resolve labels through table contracts/field definitions or a co-located diff
presenter registry. A missing label falls back safely to the key; it must not
drop the change. Preserve raw paths for MCP/backward compatibility during a
versioned transition, but stop using them as the primary browser UI.

Large/complex values render a one-line type/count summary (`12 fields`,
`8 items`, or truncated scalar text) with the full JSON in an expandable
technical view. Values must be escaped as content, never interpreted as markup.

### 4.2 Modal composition

- Title: **Compare versions**.
- Preserve the current API direction: **From** selects a saved Version; **To**
  selects another saved Version or the current draft. Draft is never offered in
  From and the UI does not silently reverse operands. Prevent comparing a saved
  Version to itself.
- Default width `min(1100px, 94vw)` with a viewport-safe height.
- Keep shared `ModalDialog` resizing, use a `720 × 480 px` minimum capped by the
  current viewport, and constrain resize overflow to the viewport.
- Header/selectors remain visible while the results region scrolls.
- Omit tables with zero changes. If all tables are unchanged, show one clear
  **No changes** state.
- Table sections are collapsible and summarize counts by add/remove/change.
- Primary rows read like `Roxul SmartRock → Conductivity: 0.036 → 0.034`, not
  `project_materials.rows[uuid].conductivity_w_mk`.
- Added/removed records show the record label and the meaningful record
  payload, not a list of every leaf path.
- Long text wraps; IDs/paths can use `overflow-wrap:anywhere` only inside a
  disclosed Technical details region. Nothing may extend beyond the modal.
- Use current shared modal chrome and footer action standards. A view-only
  Close action is present; Escape/backdrop behavior follows the established
  viewer-modal contract.

## 5. Concurrency and refresh

- Every rename/delete checks that the Version still belongs to the project
  resolved by access control.
- Save, Save As, delete, and make-active share the project-then-Version lock
  order; delete re-checks active/last-Version rules inside that transaction.
- After any mutation, refresh/invalidate project detail, version selectors,
  draft summary where relevant, and open diff queries.
- A Version removed in another tab produces a stable not-found response and a
  refreshed manager, not a stuck optimistic row.

## 6. Acceptance criteria

- Existing popover rows display localized last-edited date/time.
- Management modal can rename every Version kind and updates the active
  breadcrumb immediately.
- Duplicate/blank names show stable inline validation.
- Active and sole-Version deletion are blocked by the backend and explained in
  the UI.
- Confirmed non-active deletion removes the Version and its drafts, preserves
  descendants, and records audit evidence.
- Viewers/anonymous users have no management or mutation affordances.
- Compare remains in its current signed-in editor UI for this packet; the
  backend's existing project-view authorization and MCP read compatibility are
  unchanged. This feature does not add a new public comparison entry point.
- Diff omits unchanged tables and presents additions, removals, field changes,
  and complex values without raw-code overflow.
- Resizing smaller/larger preserves reachable selectors, results, and footer.
- Keyboard focus, Escape, and modal buttons follow the shared contract.

## 7. Non-goals

- Restoring deleted Versions or a Version trash system.
- Branching/merging Versions.
- Changing Save/Save As or Version body ETag semantics.
- A complete audit-log viewer.
- Arbitrary JSON editing from the Diff modal.
