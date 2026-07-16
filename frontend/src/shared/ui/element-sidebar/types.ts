import type { LucideIcon } from "lucide-react";
import type { To } from "react-router-dom";

/**
 * One extra row-action button beyond the built-in rename (e.g. duplicate,
 * delete, change-type). `key` doubles as the stable-id suffix so browser/MCP
 * automation can target it as `${idPrefix}-${key}-${itemId}`.
 */
export type ElementSidebarAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onClick: () => void;
};

export type ElementSidebarItem = {
  id: string;
  name: string;
  /** Leading glyph (e.g. the envelope assembly-type icon); omitted for apertures. */
  leadingIcon?: LucideIcon;
  /** Extra data-* attributes placed on the row link (e.g. `data-assembly-type`). */
  linkData?: Record<string, string>;
  /** Commit a new name for this item (closes over the typed entity). */
  onRename: (name: string) => void;
  /** Optional collision/validation message for a proposed name. */
  getRenameValidationMessage?: (name: string) => string | null;
  /** Additional row actions after the built-in rename, in display order. */
  actions: ElementSidebarAction[];
};

/**
 * How a row navigates. `select` renders a button that reports the clicked id;
 * `link` renders a routing `NavLink`. Active styling comes from `activeId` in
 * both modes (not NavLink's own active state), so selection and routing behave
 * identically.
 */
export type ElementSidebarNavigation =
  | { mode: "select"; onSelect: (id: string) => void }
  | { mode: "link"; buildTo: (item: ElementSidebarItem) => To };

export type ElementSidebarRename = {
  /** aria-label for the built-in rename button. */
  actionLabel: string;
  /** Labels forwarded to the inline editor. */
  inputLabel: string;
  editLabel: string;
};

export type ElementSidebarAdd = {
  label: string;
  onAdd: () => void;
  disabled: boolean;
};

export type ElementSidebarSortMode = "alphabetical" | "manual";

/** A group resolved to its items, plus its collapse state, for tree rendering. */
export type ElementSidebarGroup = {
  id: string;
  label: string;
  items: ElementSidebarItem[];
  collapsed: boolean;
};

/**
 * User-controlled ordering + grouping. Provided only for editors (persistence is
 * editor-only); its presence turns on the sort-mode toggle. In `manual` mode the
 * rows drag to reorder, and defining groups turns the flat list into a
 * collapsible tree (`groups` → items, plus an `ungrouped` remainder).
 */
export type ElementSidebarOrganization = {
  sortMode: ElementSidebarSortMode;
  onToggleSortMode: () => void;
  /** Persist a new flat / ungrouped-section order (from a drag). */
  onReorder: (orderedIds: string[]) => void;
  /** True when ≥1 group is defined — render the tree instead of the flat list. */
  hasGroups: boolean;
  groups: ElementSidebarGroup[];
  ungrouped: ElementSidebarItem[];
  onAddGroup: () => void;
  onRenameGroup: (groupId: string, label: string) => void;
  onDeleteGroup: (groupId: string) => void;
  /** Assign an item to a group, or to `null` for ungrouped. */
  onMoveItem: (itemId: string, groupId: string | null) => void;
  onReorderGroups: (orderedGroupIds: string[]) => void;
  onReorderGroupMembers: (groupId: string, orderedIds: string[]) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
};

/** Everything a row needs that is constant across the list, bundled to avoid drilling. */
export type RowContext = {
  idPrefix: string;
  title: string;
  canEdit: boolean;
  actionDisabled: boolean;
  activeId: string | null;
  navigation: ElementSidebarNavigation;
  rename: ElementSidebarRename;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  /** Group targets for the per-row "move to group" control; empty hides it. */
  groupTargets: { id: string; label: string }[];
  onMoveItem: (itemId: string, groupId: string | null) => void;
};
