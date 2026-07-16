// Per-user × per-project × per-sidebar organization state (sort mode, manual
// order, groups, collapse). Sibling of `features/table_views` for element
// sidebars. The backend stores `view_state` opaquely; this is the frontend's
// canonical schema for that document.

export const SIDEBAR_VIEW_SCHEMA_VERSION = 1;

export type SidebarSortMode = "alphabetical" | "manual";

/** A user-defined group of items in the sidebar tree (Phase 3). */
export type SidebarGroup = {
  id: string;
  label: string;
  member_ids: string[];
};

export type SidebarViewState = {
  sort_mode: SidebarSortMode;
  /** Ordered item ids for manual mode (Phase 2); empty falls back to given order. */
  order: string[];
  /** User-defined groups (Phase 3). */
  groups: SidebarGroup[];
  /** Ids of groups currently rolled up (Phase 4). */
  collapsed_group_ids: string[];
};

export const DEFAULT_SIDEBAR_VIEW_STATE: SidebarViewState = {
  sort_mode: "alphabetical",
  order: [],
  groups: [],
  collapsed_group_ids: [],
};

export type SidebarViewResponse = {
  view_state_schema_version: number;
  view_state: SidebarViewState | null;
  updated_at: string | null;
};

export type SidebarViewUpsertRequest = {
  view_state_schema_version: number;
  view_state: SidebarViewState;
};
