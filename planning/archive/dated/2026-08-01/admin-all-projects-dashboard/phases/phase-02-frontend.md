---
DATE: 2026-08-01
TIME: 10:57 EDT
STATUS: Complete
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 2 — grouped rendering and owner-aware selection.
RELATED: ../PRD.md, ../decisions.md, ./phase-01-backend.md, ./phase-03-docs.md
---

# Phase 2 — Frontend

## 2.1 Types

`frontend/src/features/projects/types.ts`:

```ts
owner_id: string;
owner_display_name: string | null;
```

on `ProjectSummary`, and `grouped: boolean` on the list response. Mirror the
backend optionality exactly — if `owner_id` ended up nullable in Phase 1 §1.3,
it is nullable here too.

## 2.2 `ProjectList.tsx`

Currently one flat `.project-list` with a heading row and a `projects.map`
(`ProjectList.tsx:80-124`).

When `grouped` is false, retain the flat row/grid structure and omit owner
headings. The shared accessibility explanation node may exist in both modes;
the non-admin visual structure remains unchanged.

When `grouped` is true, walk the (already server-ordered) list and emit a group
heading whenever `owner_id` differs from the previous row:

```tsx
{projects.map((project, i) => {
  const startsGroup = grouped && project.owner_id !== projects[i - 1]?.owner_id;
  return (
    <Fragment key={project.id}>
      {startsGroup ? <GroupHeading owner={project} count={countFor(project.owner_id)} /> : null}
      <div className="project-row">…</div>
    </Fragment>
  );
})}
```

Do not sort or re-group client-side. The order is the server's (§D-2); if it
looks wrong, fix the query.

## 2.3 Owner-aware selection — required, not optional

Per PRD §4 and enforcement §D-4, admins cannot delete others' projects.

- Row checkbox `disabled` when `project.owner_id !== session.user.id`.
- Give disabled checkboxes a `title` explaining why ("Only the owner can delete
  this project") — a silently dead control is worse than none.
- `toggleAllProjects` (`Dashboard.tsx:78`) currently does
  `new Set(projects.map(p => p.id))`. It must select owned projects only.
- The "select all" header checkbox `checked` state must compute against owned
  projects, not all projects, or it never reads as fully checked for an admin.
- `Dashboard.tsx:47`'s `selectedProjects` filter and the pruning effect at
  `:49-56` already key off the visible list — verify they still behave when the
  visible list includes unselectable rows.

## 2.4 Styling

Check `context/DESIGN_SYSTEM.md` for an existing grouping/section affordance
before writing CSS. Reuse `project-section-heading` if it fits.

Plain CSS on the 3-tier tokens — no Tailwind, no ad-hoc colors. The style guards
reject off-system CSS.

## 2.5 Tests

`frontend/src/features/projects/components/__tests__/`:

- Ungrouped render is unchanged (snapshot or explicit DOM assertions).
- Grouped render emits one heading per owner with correct counts.
- Non-owned row checkbox is disabled.
- Select-all selects owned projects only.

## 2.6 Browser verification

Per `context/USING_A_WEB_BROWSER.md` — use the helper, **not** the browser MCP
tools:

```bash
make agent-browser-ready
cd frontend && node scripts/agent-browser.mjs /dashboard --out /tmp/dash.png
```

Sign in as `codex@example.com`. The fixture seeds `catalog.edit` and
`admin.users.manage` for codex (see `memory/project_local_catalog_edit_grant.md`),
so codex should resolve `projects.access.all` and see the grouped view — a
convenient natural test. You need at least two owners with projects to see
grouping at all; if the local DB has only one, seed a second owner rather than
re-seeding the whole DB (that wipes Ed's session).

Capture a screenshot into `../assets/` for the record.

## Exit criteria

- `pnpm run format` applied.
- `make frontend-dev-check` green.
- Screenshot of the grouped dashboard in `assets/`.
- Non-admin dashboard visually and structurally unchanged.

## Implementation record

Completed 2026-08-01:

- Mirrored the backend owner and grouping fields in the frontend response
  contract.
- Rendered server-ordered owner sections only when `grouped` is true; the
  ordinary owner-only response retains the flat project-list structure.
- Limited row and select-all behavior to projects owned by the signed-in user.
  Foreign-project controls are disabled and linked to an accessible owner-only
  explanation.
- Invalidated the project-list query after create/update mutations so the
  backend remains authoritative for owner grouping and ordering.
- Added focused component and route coverage for grouped headings/counts,
  ungrouped structure, foreign-only selection, and owner-only select-all.

Verification:

- Focused Vitest (`ProjectList`, `Dashboard`, and `App`) — **36 passed**.
- `make frontend-dev-check` — **passed** (18 pre-existing ESLint warnings,
  zero errors; guards and production build passed).
- `make ci` — **passed**: backend **1,756 passed / 7 skipped**; frontend
  **2,369 passed**; format, lint, type, boundary, guard, and build checks green.
- Live `/dashboard` verification through `make agent-browser-ready` — grouped
  owner sections rendered, and select-all selected only the current owner's
  project.
- Screenshot: `../assets/admin-all-projects-dashboard.png`.
