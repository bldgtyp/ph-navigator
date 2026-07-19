// Barrel for the shared UI kit (src/shared/ui). Import shared primitives from
// "shared/ui" rather than reaching into individual files. See styles/README.md
// for the styling side (which sheet owns which class) and the
// "how to style a new feature" recipe.

// Leaf components + hooks.
export * from "./AppMenu";
export * from "./AppSubTabs";
export * from "./AutocompleteSelect";
export * from "./BlockingProgressOverlay";
export * from "./DialogActions";
export * from "./InlineHeaderNameEditor";
export * from "./ModalDialog";
export * from "./ProgressBar";
export * from "./ShellMessage";
export * from "./TopbarUnitToggle";
export * from "./WorkspaceTopbar";
export * from "./useOutsidePointerDown";

// Co-located sub-packages (component + CSS + own barrel).
export * from "./element-sidebar";
export * from "./info-tooltip";
export * from "./tooltip";
export * from "./report-table";
export * from "./data-table";
