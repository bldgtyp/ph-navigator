---
DATE: 2026-05-26
TIME: 19:36 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Dashboard selection, bulk soft-delete modal, Recently Deleted,
       and restore UX.
RELATED:
  - planning/features/delete-project/PRD.md
  - planning/features/delete-project/phases/phase-02-rest-soft-delete-restore-410.md
  - frontend/src/features/projects/routes/Dashboard.tsx
  - frontend/src/features/projects/components/ProjectList.tsx
  - frontend/src/features/projects/api.ts
  - frontend/src/features/projects/hooks.ts
---

# Phase 4 - Dashboard Bulk Soft-Delete And Restore

## Goal

Add the user-facing project deletion workflow on `/dashboard`.
Editors can select one or more project rows, soft-delete them through a
confirmation modal, inspect Recently Deleted, and restore projects.
Hard-delete is deliberately absent from the normal dashboard UX.

## In Scope

- Project-row checkbox/check-mark control in `ProjectList`.
- Select-all checkbox in the project-list heading.
- Bulk Delete button when selection is non-empty.
- Confirmation modal showing:
  - selected project count;
  - project names and BT numbers;
  - 90-day restore window;
  - soft-delete-only action.
- API client and TanStack Query hooks for:
  - bulk soft-delete;
  - list deleted projects;
  - restore project.
- Recently Deleted dashboard section or toggle.
- Restore action for deleted projects.
- Route/project-shell handling for `410 project_deleted` when a user
  opens a deleted project directly.

## Out Of Scope

- Dashboard hard-delete.
- Admin/dev script UI.
- MCP tools.
- Automatic purge.

## Constraints

- Checkbox clicks must not trigger row navigation.
- Row link behavior must remain intact outside the checkbox.
- Selection state belongs in `Dashboard`, not each row.
- Clear selection after successful delete or project-list refresh.
- Keep UI dense and work-focused; do not turn the dashboard into a
  marketing/empty-state page.
- No visible hard-delete or "Permanently delete" control in normal
  dashboard views.

## Workstreams

### API And Hooks

Add frontend API functions for Phase 2 endpoints and query keys that
invalidate:

- active project list;
- deleted project list;
- project detail for restored projects.

### ProjectList Selection

Update `ProjectList` props to accept:

- selected ids;
- select/toggle handlers;
- select-all state;
- bulk action slot or callback.

Keep row layout stable by adding a fixed-width leading selection column.

### Delete Modal

Use existing modal/dialog patterns. The modal copy should be concrete:

- "Delete 3 projects";
- list BT numbers and names;
- "Can be restored for 90 days";
- primary action: "Delete projects".

### Recently Deleted

Add a compact section or toggle on the dashboard. Include:

- BT number;
- project name;
- deleted date;
- hard-delete-after date;
- Restore action.

## Tests

Add frontend tests for:

- checkbox toggles selection without navigation;
- select-all selects and clears all visible projects;
- bulk Delete button text changes with count;
- modal lists selected project names and BT numbers;
- soft-delete mutation clears selection and invalidates list;
- Recently Deleted loads deleted projects;
- Restore returns a project to the active list;
- hard-delete controls are absent.

Add browser/Playwright smoke for:

1. create two projects;
2. select both;
3. soft-delete;
4. confirm they disappear from active dashboard;
5. open Recently Deleted;
6. restore one;
7. confirm restored project opens;
8. confirm the still-deleted project direct URL shows deleted/gone
   state rather than a generic crash.

Suggested commands:

```bash
cd frontend
pnpm run format
pnpm test -- --run Dashboard
pnpm run build
```

## Success Criteria

1. Dashboard supports bulk soft-delete.
2. Recently Deleted supports restore.
3. No normal dashboard hard-delete affordance exists.
4. Direct deleted project links render a clear deleted/gone state.
