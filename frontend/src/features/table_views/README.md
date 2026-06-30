# Table Views

Headless feature package for persisted project table view state. It has
no route surface; table-facing UI is owned by `shared/ui/data-table` and
feature adapters consume these hooks.

`useProjectTableViewState` loads/saves one table's view state (per-table
GET/PUT/DELETE). When a page mounts many tables it can avoid the per-table
GET fan-out: `useProjectTableViewsBatchValue` + `ProjectTableViewsBatchProvider`
(`batchContext.ts`) fetch every table's config in one request, and
`useProjectTableViewState` reads its entry from that shared result via
`useProjectTableViewsBatch`, falling back to its own GET when no provider is
mounted (deep links, un-wrapped pages). Saves/resets stay per-table and
`prime`/`drop` the shared cache so a remount reads fresh.
