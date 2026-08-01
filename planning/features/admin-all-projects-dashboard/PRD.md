---
DATE: 2026-08-01
TIME: 08:25 EDT
STATUS: Ready — ownership dependency implemented and verified
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Behavior contract for the admin all-projects dashboard.
RELATED: ./README.md, ./decisions.md, ./STATUS.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/PRD.md,
  context/ui/pages/dashboard.md
---

# PRD — Admin all-projects dashboard

## 1. Story

As an admin, I open the dashboard and see every project in PH-Navigator,
grouped under the user who owns it, so I can find and support any project
without asking whose account it is under.

## 2. Behavior

| Actor | Live projects list | Deleted panel |
| --- | --- | --- |
| Admin (`projects.access.all`) | **All projects, grouped by owner** | **Own only** (unchanged, §D-3) |
| Everyone else | Own only, ungrouped (unchanged) | Own only (unchanged) |

Non-admin behavior is byte-identical to today. That is a test, not an
aspiration — the existing `test_dashboard_list_is_filtered_to_owner` stays green
untouched.

## 3. Response shape

`GET /api/v1/projects` keeps one shape for both actors.

`ProjectSummary` gains two fields:

```python
owner_id: UUID
owner_display_name: str | None = None
```

`ProjectListResponse` gains:

```python
grouped: bool = False   # true only when the caller sees more than their own
```

### Why a sorted flat list + a flag, not nested groups

`CLAUDE.md` requires that data manipulation live in the backend. It does here:
the **server** decides the grouping key (`owner_id`), the group label
(`owner_display_name`), and the full ordering — `owner_display_name ASC`, then
`bt_number DESC` within each owner. The client inserts a heading whenever
`owner_id` changes between adjacent rows. It sorts nothing and decides nothing.

A nested `groups: [{owner, projects[]}]` shape was considered and rejected: it
forks the response into two shapes the frontend must branch on, for no gain over
a flag plus a server-defined order. (§D-2.)

### `owner_id` typing caution

`ProjectSummary` is constructed in several places, including
`backend/features/projects/access.py:95`, which filters to fields present on the
row:

```python
{field: project_row[field] for field in ProjectSummary.model_fields if field in project_row}
```

A **required** `owner_id` breaks any construction site whose row lacks it.
`PROJECT_COLUMNS_WITH_OWNER` (`repository.py:22`) does select `owner_id`, but
every construction path must be checked before making the field required — see
`phases/phase-01-backend.md` §1.3. `owner_display_name` comes from a `JOIN` and
is genuinely absent on most paths, so it stays optional.

## 4. Selection and bulk delete

Per the enforcement refactor §D-4, an admin may read and edit another user's
project but **not delete it** — delete/restore stay owner-only.

Therefore on the grouped dashboard:

- The row checkbox is **disabled** for any project the admin does not own.
- "Select all" selects **only owned** projects.
- The bulk-delete count reflects owned selections only.

Without this, an admin selects rows and gets a wall of 404s. This is the one
place where §D-4's asymmetry becomes visible in the UI, and it is a required
part of the feature, not a nicety.

## 5. Presentation

- Group heading per owner: display name, plus that owner's project count.
- Reuse the existing `project-section-heading` pattern rather than inventing a
  new one; check `context/DESIGN_SYSTEM.md` for a blessed grouping affordance
  before adding CSS.
- The "All projects" heading count becomes the total across groups.
- Ungrouped rendering for non-admins is untouched — same DOM as today.
- An admin's own group sorts first; other owners follow alphabetically. (§D-4.)

## 6. Out of scope

- Deleted-projects panel changes (§D-3).
- Admin delete/restore of others' projects (enforcement §D-4).
- Filtering, search, or per-owner collapse. Add if the list gets unwieldy; the
  firm has dozens of projects, not thousands.
- Any change to project *creation* ownership.

## 7. Acceptance criteria

1. Admin `GET /api/v1/projects` returns every non-deleted project, ordered by
   owner display name then `bt_number` desc, with `grouped: true`.
2. Non-admin response is unchanged, `grouped: false`, and
   `test_dashboard_list_is_filtered_to_owner` passes untouched.
3. Admin dashboard renders a heading per owner with correct counts.
4. Checkboxes are disabled on non-owned rows; select-all picks owned only.
5. Deleted panel still shows own-only for admins.
6. `owner_display_name` is not leaked to any viewer-mode or anonymous response.
7. `make ci` green; `pnpm run format` applied.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Making `owner_id` required breaks a `ProjectSummary` construction site | Phase 1 §1.3 enumerates all sites before changing the model |
| Owner display name leaks into the public viewer payload | Criterion 6; `get_project_detail` already nulls it for viewers (`service.py:466`) — add an assertion |
| Grouped list becomes long enough to need search | Accepted for now; revisit at ~100 projects |
