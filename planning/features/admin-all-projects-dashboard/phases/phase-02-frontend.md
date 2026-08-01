---
DATE: 2026-08-01
TIME: 08:25 EDT
STATUS: Planned — blocked on phase-01
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

When `grouped` is false, render exactly today's DOM — no wrapper changes, no new
classes. The non-admin path should be diff-invisible.

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
