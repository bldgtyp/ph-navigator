import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { GridToolbar } from "../components/GridToolbar";
import type { HideFieldsColumn } from "../components/HideFieldsPanel";
import { emptyViewState, type FieldDef, type ViewState } from "../types";

const FIELDS: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
];

const COLUMNS: HideFieldsColumn[] = [
  { id: "name", fieldKey: "name", header: "Name" },
  { id: "count", fieldKey: "count", header: "Count" },
];

function renderToolbar(
  view: ViewState = emptyViewState(),
  handlers: {
    onResetView?: () => void;
    onDownloadCsv?: () => void;
    onGroupChange?: () => void;
    onCollapseAllGroups?: () => void;
    onExpandAllGroups?: () => void;
    onHideFieldsChange?: () => void;
  } = {},
) {
  render(
    <GridToolbar
      tableName="Rooms"
      view={view}
      fieldDefByKey={new Map(FIELDS.map((def) => [def.field_key, def]))}
      filterableFieldDefs={FIELDS}
      sortableFieldDefs={FIELDS}
      groupableFieldDefs={FIELDS}
      orderedColumnsForHidePanel={COLUMNS}
      onFilterChange={vi.fn()}
      onSortChange={vi.fn()}
      onGroupChange={handlers.onGroupChange ?? vi.fn()}
      onCollapseAllGroups={handlers.onCollapseAllGroups ?? vi.fn()}
      onExpandAllGroups={handlers.onExpandAllGroups ?? vi.fn()}
      onResetView={handlers.onResetView ?? vi.fn()}
      onDownloadCsv={handlers.onDownloadCsv ?? vi.fn()}
      canDownloadCsv
      onHideFieldsChange={handlers.onHideFieldsChange ?? vi.fn()}
    />,
  );
}

describe("GridToolbar", () => {
  test("renders the table name as the toolbar title", () => {
    renderToolbar();
    expect(screen.getByRole("heading", { name: "Rooms" })).toHaveClass("data-table-toolbar-title");
  });

  test("renders a neutral Filter button when no rules are present", () => {
    renderToolbar();
    const button = screen.getByRole("button", { name: "Filter" });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute("data-axis-active");
  });

  test("Filter button tints when any rule is present (matches AirTable chip color)", () => {
    renderToolbar({
      ...emptyViewState(),
      filter: [{ fieldKey: "name", operator: "contains" }],
    });
    const button = screen.getByRole("button", { name: /Filtered by Name/ });
    expect(button).toHaveAttribute("data-axis-active", "true");
    expect(button).toHaveAttribute("data-axis", "filter");
  });

  test("Filter button label reads 'Filtered by N fields' for multi-rule stacks", () => {
    renderToolbar({
      ...emptyViewState(),
      filter: [
        { fieldKey: "name", operator: "contains" },
        { fieldKey: "count", operator: "gt" },
      ],
    });
    expect(screen.getByRole("button", { name: "Filtered by 2 fields" })).toBeInTheDocument();
  });

  test("status chips collapse when state moves into button labels and footer chrome", () => {
    renderToolbar();
    // Phase 4 §4.8: the old `No filters` / `Sorted by 0 fields` chips
    // were removed. Phase 6: the `Ungrouped` chip is also removed —
    // the Group ▾ button label now carries the grouping info, and the
    // "Ungroup to paste" banner moves out of the status row (only
    // surfaces on a paste attempt). Editability lives in the table footer.
    expect(screen.queryByText(/No filters/)).not.toBeInTheDocument();
    expect(screen.queryByText("Ungrouped")).not.toBeInTheDocument();
    expect(screen.queryByText("Ungroup to paste")).not.toBeInTheDocument();
  });

  test("status row surfaces 'Ungroup to paste' chip when any group rule is active", () => {
    renderToolbar({
      ...emptyViewState(),
      group: [{ fieldKey: "name", direction: "asc" }],
    });
    expect(screen.getByText("Ungroup to paste")).toBeInTheDocument();
  });

  test("Group button label is 'Group' when neutral and 'Grouped by N fields' when active", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Group" })).toBeInTheDocument();
    renderToolbar({
      ...emptyViewState(),
      group: [
        { fieldKey: "name", direction: "asc" },
        { fieldKey: "count", direction: "desc" },
      ],
    });
    expect(screen.getByRole("button", { name: "Grouped by 2 fields" })).toBeInTheDocument();
  });

  test("Group button tints lavender when any rule is present", () => {
    renderToolbar({
      ...emptyViewState(),
      group: [{ fieldKey: "name", direction: "asc" }],
    });
    const button = screen.getByRole("button", { name: /Grouped by Name/ });
    expect(button).toHaveAttribute("data-axis-active", "true");
    expect(button).toHaveAttribute("data-axis", "group");
  });

  test("Sort button label is 'Sort' when neutral and 'Sorted by N fields' when active", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    renderToolbar({
      ...emptyViewState(),
      sort: [
        { fieldKey: "name", direction: "asc" },
        { fieldKey: "count", direction: "desc" },
      ],
    });
    expect(screen.getByRole("button", { name: "Sorted by 2 fields" })).toBeInTheDocument();
  });

  test("Sort button tints peach when any rule is present", () => {
    renderToolbar({
      ...emptyViewState(),
      sort: [{ fieldKey: "name", direction: "asc" }],
    });
    const button = screen.getByRole("button", { name: /Sorted by Name/ });
    expect(button).toHaveAttribute("data-axis-active", "true");
    expect(button).toHaveAttribute("data-axis", "sort");
  });

  test("Reset view action in the overflow menu fires onResetView", () => {
    const onResetView = vi.fn();
    renderToolbar(
      {
        ...emptyViewState(),
        filter: [{ fieldKey: "name", operator: "contains", value: "x" }],
        sort: [{ fieldKey: "name", direction: "asc" }],
      },
      { onResetView },
    );
    fireEvent.click(screen.getByRole("button", { name: "More view actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(onResetView).toHaveBeenCalledTimes(1);
  });

  test("Download CSV action in the overflow menu fires onDownloadCsv", () => {
    const onDownloadCsv = vi.fn();
    renderToolbar(emptyViewState(), { onDownloadCsv });
    fireEvent.click(screen.getByRole("button", { name: "More view actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(onDownloadCsv).toHaveBeenCalledTimes(1);
  });

  test("Download CSV stays enabled even with an empty view (it is a read action)", () => {
    const onDownloadCsv = vi.fn();
    renderToolbar(emptyViewState(), { onDownloadCsv });
    fireEvent.click(screen.getByRole("button", { name: "More view actions" }));
    const item = screen.getByRole("button", { name: "Download CSV" });
    expect(item).toBeEnabled();
  });

  test("overflow trigger uses the shared icon-only toolbar style", () => {
    renderToolbar();
    const trigger = screen.getByRole("button", { name: "More view actions" });
    expect(trigger).toHaveClass("data-table-toolbar-button--icon");
    expect(trigger.querySelector(".lucide-ellipsis-vertical")).not.toBeNull();
  });

  test("Reset view is disabled when both filter and sort are empty", () => {
    const onResetView = vi.fn();
    renderToolbar(emptyViewState(), { onResetView });
    fireEvent.click(screen.getByRole("button", { name: "More view actions" }));
    const item = screen.getByRole("button", { name: "Reset view" });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(onResetView).not.toHaveBeenCalled();
  });

  test("Hide fields button label is 'Hide fields' when nothing is hidden", () => {
    renderToolbar();
    const button = screen.getByRole("button", { name: "Hide fields" });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute("data-axis-active");
  });

  test("Hide fields button label shows a count when columns are hidden", () => {
    renderToolbar({ ...emptyViewState(), hiddenColumns: ["count"] });
    const button = screen.getByRole("button", { name: "Hide fields (1)" });
    expect(button).toHaveAttribute("data-axis-active", "true");
  });

  test("clicking Hide fields opens the panel", () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Hide fields" }));
    const panel = screen.getByRole("dialog", { name: "Hide or show fields" });
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByLabelText("Find a field")).toBeInTheDocument();
  });

  test("toggling a field in the panel fires onHideFieldsChange", () => {
    const onHideFieldsChange = vi.fn();
    renderToolbar(emptyViewState(), { onHideFieldsChange });
    fireEvent.click(screen.getByRole("button", { name: "Hide fields" }));
    const panel = screen.getByRole("dialog", { name: "Hide or show fields" });
    fireEvent.click(within(panel).getByLabelText("Hide Count"));
    expect(onHideFieldsChange).toHaveBeenLastCalledWith({ hiddenColumns: ["count"] });
  });
});
