import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { GridToolbar } from "../components/GridToolbar";
import { emptyViewState, type FieldDef, type ViewState } from "../types";

const FIELDS: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
];

function renderToolbar(view: ViewState = emptyViewState()) {
  render(
    <GridToolbar
      readOnly={false}
      view={view}
      fieldDefs={FIELDS}
      filterableFieldDefs={FIELDS}
      onFilterChange={vi.fn()}
    />,
  );
}

describe("GridToolbar", () => {
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

  test("status chips collapse when filter chip moves into the button label", () => {
    renderToolbar();
    // Phase 4 §4.8: the old `No filters` / `Sorted by 0 fields` chips
    // were removed; the toolbar status row only carries editability +
    // grouping.
    expect(screen.queryByText(/No filters/)).not.toBeInTheDocument();
    expect(screen.getByText("Editable")).toBeInTheDocument();
    expect(screen.getByText("Ungrouped")).toBeInTheDocument();
  });
});
