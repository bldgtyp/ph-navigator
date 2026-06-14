// Barrel for the shared UI kit (src/shared/ui). Import shared primitives from
// "shared/ui" rather than reaching into individual files. See styles/README.md
// for the styling side (which sheet owns which class) and the
// "how to style a new feature" recipe.
//
// TablePrimitiveStub is intentionally not re-exported: it has no callers and is
// flagged for removal (see planning/archive/css-structure-discoverability).

// Leaf components + hooks.
export * from "./AppMenu";
export * from "./AppSubTabs";
export * from "./AutocompleteSelect";
export * from "./DialogActions";
export * from "./InlineHeaderNameEditor";
export * from "./ModalDialog";
export * from "./ShellMessage";
export * from "./TopbarUnitToggle";
export * from "./WorkspaceTopbar";
export * from "./useOutsidePointerDown";

// Co-located sub-packages (component + CSS + own barrel).
export * from "./info-tooltip";
export * from "./report-table";
export * from "./data-table";
