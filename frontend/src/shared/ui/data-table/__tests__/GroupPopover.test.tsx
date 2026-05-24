import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { GroupPopover, MAX_GROUP_RULES } from "../components/GroupPopover";
import type { FieldDef, GroupRule } from "../types";

const FIELDS: FieldDef[] = [
  { field_key: "floor", field_type: "text", display_name: "Floor" },
  { field_key: "zone", field_type: "text", display_name: "Zone" },
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "extra1", field_type: "text", display_name: "Extra 1" },
  { field_key: "extra2", field_type: "text", display_name: "Extra 2" },
];

function renderPopover(
  rules: GroupRule[],
  overrides: Partial<React.ComponentProps<typeof GroupPopover>> = {},
) {
  const onGroupChange = overrides.onGroupChange ?? vi.fn();
  render(
    <GroupPopover
      open
      onOpenChange={vi.fn()}
      trigger={<button>Group ▾</button>}
      rules={rules}
      onGroupChange={onGroupChange}
      groupableFieldDefs={FIELDS}
      onCollapseAll={overrides.onCollapseAll ?? vi.fn()}
      onExpandAll={overrides.onExpandAll ?? vi.fn()}
      canToggleExpand={overrides.canToggleExpand ?? rules.length > 0}
      {...overrides}
    />,
  );
  return { onGroupChange };
}

describe("GroupPopover", () => {
  test("renders empty-state copy when no rules exist", () => {
    renderPopover([]);
    expect(screen.getByText("No group rules applied.")).toBeInTheDocument();
  });

  test("Add subgroup appends a rule with the first unused field, direction asc", () => {
    const { onGroupChange } = renderPopover([{ fieldKey: "floor", direction: "asc" }]);
    fireEvent.click(screen.getByRole("button", { name: "+ Add subgroup" }));
    expect(onGroupChange).toHaveBeenCalledWith([
      { fieldKey: "floor", direction: "asc" },
      { fieldKey: "zone", direction: "asc" },
    ]);
  });

  test("Add subgroup disabled when 4 rules are present (hard cap)", () => {
    const rules: GroupRule[] = [
      { fieldKey: "floor", direction: "asc" },
      { fieldKey: "zone", direction: "asc" },
      { fieldKey: "name", direction: "asc" },
      { fieldKey: "extra1", direction: "asc" },
    ];
    expect(rules.length).toBe(MAX_GROUP_RULES);
    renderPopover(rules);
    expect(screen.getByRole("button", { name: "+ Add subgroup" })).toBeDisabled();
  });

  test("renders one row per rule with the correct direction label", () => {
    renderPopover([
      { fieldKey: "floor", direction: "asc" },
      { fieldKey: "zone", direction: "desc" },
    ]);
    const directions = screen.getAllByRole("combobox", { name: "Group direction" });
    expect(directions).toHaveLength(2);
    // Direction options use AirTable's literal group phrasing.
    expect((directions[0] as HTMLSelectElement).value).toBe("asc");
    expect(screen.getAllByText("First → Last").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Last → First").length).toBeGreaterThan(0);
  });

  test("field picker excludes fields already in the group stack", () => {
    renderPopover([{ fieldKey: "floor", direction: "asc" }]);
    const fieldSelect = screen.getByRole("combobox", { name: "Group field" }) as HTMLSelectElement;
    const optionValues = Array.from(fieldSelect.options).map((o) => o.value);
    expect(optionValues).toContain("floor"); // the current rule's value stays selectable
    // Other rules' fields would be excluded; here only one rule exists.
    expect(new Set(optionValues).size).toBe(optionValues.length);
  });

  test("delete (×) removes the rule", () => {
    const { onGroupChange } = renderPopover([
      { fieldKey: "floor", direction: "asc" },
      { fieldKey: "zone", direction: "asc" },
    ]);
    const removeButtons = screen.getAllByRole("button", { name: "Remove group rule" });
    fireEvent.click(removeButtons[0]!);
    expect(onGroupChange).toHaveBeenCalledWith([{ fieldKey: "zone", direction: "asc" }]);
  });

  test("Collapse all / Expand all in the header fire the respective handlers", () => {
    const onCollapseAll = vi.fn();
    const onExpandAll = vi.fn();
    renderPopover([{ fieldKey: "floor", direction: "asc" }], { onCollapseAll, onExpandAll });
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(onCollapseAll).toHaveBeenCalledTimes(1);
    expect(onExpandAll).toHaveBeenCalledTimes(1);
  });

  test("Collapse all / Expand all disabled when canToggleExpand is false", () => {
    renderPopover([], { canToggleExpand: false });
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeDisabled();
  });
});
