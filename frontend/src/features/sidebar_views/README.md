# Sidebar Views

Headless feature package for persisted, per-user element-sidebar organization
(sort mode, manual order, groups, collapse) across the Apertures and Envelope
sidebars. It has no route surface; the sidebar UI is owned by
`shared/ui/element-sidebar` and the feature adapters
(`features/apertures/components/ApertureSidebar`,
`features/envelope/components/EnvelopeSidebar`) consume these hooks.

State is scoped **per-user × per-project × per-sidebar** (`view_key`, e.g.
`apertures` / `assemblies`) and stored server-side in `user_sidebar_views` — the
sibling of `features/table_views` for sidebars. See
`backend/features/sidebar_views` and Alembic `20260716_0006`.

- `useProjectSidebarViewState` loads one sidebar's state (GET) and debounced-saves
  it (PUT), with single-flight coalescing and a `(projectId, viewKey)` scope
  guard; `reset()` DELETEs so code defaults rebuild. Persistence is editor-only
  (`enabled: canEdit`) — viewers get in-memory defaults with no I/O.
- `useSidebarOrganization` composes that hook with ordering so both sidebars get
  identical behavior by construction: it returns `orderedItems` (items reordered
  by the persisted manual `order`) and `onToggleSortMode` (alphabetical ⇄ manual;
  switching to manual freezes the current display order).
- `lib.applySidebarOrder` is the pure ordering helper (persisted ids lead;
  unknown/new items append; stale ids drop).

The persisted document (`types.SidebarViewState`, schema version 1) already
carries `order` / `groups` / `collapsed_group_ids` so Phases 2–4 (dnd-kit manual
order, grouping, collapse) extend it without a new migration.
