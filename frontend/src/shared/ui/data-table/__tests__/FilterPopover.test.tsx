import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { FilterPopover } from "../components/FilterPopover";
import type { FieldDef, FilterCondition } from "../types";

const FIELDS: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "num_people", field_type: "number", display_name: "People" },
  {
    field_key: "floor",
    field_type: "single_select",
    display_name: "Floor",
    options: [
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      { id: "opt_first", label: "1st", color: "#10b981", order: 1 },
    ],
  },
];

function Harness({
  initialRules = [],
  onFilterChange,
  fields = FIELDS,
}: {
  initialRules?: FilterCondition[];
  onFilterChange: (next: FilterCondition[]) => void;
  fields?: FieldDef[];
}) {
  const [open, setOpen] = useState(true);
  const [rules, setRules] = useState<FilterCondition[]>(initialRules);
  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      rules={rules}
      filterableFieldDefs={fields}
      onFilterChange={(next) => {
        setRules(next);
        onFilterChange(next);
      }}
      trigger={<button type="button">Filter</button>}
    />
  );
}

function popoverContent(): HTMLElement {
  return screen.getByRole("dialog", { name: "Filter rules" });
}

describe("FilterPopover", () => {
  test("renders an empty-state message when no rules exist", () => {
    render(<Harness onFilterChange={vi.fn()} />);
    expect(
      within(popoverContent()).getByText("No filters applied to this view."),
    ).toBeInTheDocument();
  });

  test("Add filter rule appends a dormant rule with the first field's first operator", () => {
    const onChange = vi.fn();
    render(<Harness onFilterChange={onChange} />);
    fireEvent.click(within(popoverContent()).getByText("+ Add filter rule"));
    expect(onChange).toHaveBeenCalledWith([{ fieldKey: "name", operator: "contains" }]);
  });

  test("changing the field resets the operator and clears the value", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[{ fieldKey: "name", operator: "contains", value: "abc" }]}
        onFilterChange={onChange}
      />,
    );
    const fieldPicker = within(popoverContent()).getByLabelText("Filter field");
    fireEvent.change(fieldPicker, { target: { value: "num_people" } });
    expect(onChange).toHaveBeenLastCalledWith([{ fieldKey: "num_people", operator: "eq" }]);
  });

  test("changing the operator to a none-shape clears the value slot", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[{ fieldKey: "name", operator: "contains", value: "abc" }]}
        onFilterChange={onChange}
      />,
    );
    const operatorPicker = within(popoverContent()).getByLabelText("Filter operator");
    fireEvent.change(operatorPicker, { target: { value: "is_empty" } });
    expect(onChange).toHaveBeenLastCalledWith([{ fieldKey: "name", operator: "is_empty" }]);
  });

  test("typing a value updates the rule via onFilterChange", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[{ fieldKey: "name", operator: "contains" }]}
        onFilterChange={onChange}
      />,
    );
    const valueInput = within(popoverContent()).getByLabelText("Filter value");
    fireEvent.change(valueInput, { target: { value: "Liv" } });
    expect(onChange).toHaveBeenLastCalledWith([
      { fieldKey: "name", operator: "contains", value: "Liv" },
    ]);
  });

  test("number 'between' renders two inputs and writes valuePair", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[{ fieldKey: "num_people", operator: "between" }]}
        onFilterChange={onChange}
      />,
    );
    const loInput = within(popoverContent()).getByLabelText("Filter lower bound");
    const hiInput = within(popoverContent()).getByLabelText("Filter upper bound");
    fireEvent.change(loInput, { target: { value: "1" } });
    expect(onChange).toHaveBeenLastCalledWith([
      { fieldKey: "num_people", operator: "between", valuePair: ["1", ""] },
    ]);
    fireEvent.change(hiInput, { target: { value: "5" } });
    expect(onChange).toHaveBeenLastCalledWith([
      { fieldKey: "num_people", operator: "between", valuePair: ["1", "5"] },
    ]);
  });

  test("single_select is_any_of toggles option ids via the checkbox list", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[{ fieldKey: "floor", operator: "is_any_of" }]}
        onFilterChange={onChange}
      />,
    );
    const groundCheckbox = within(popoverContent()).getByRole("checkbox", { name: /Ground/ });
    fireEvent.click(groundCheckbox);
    expect(onChange).toHaveBeenLastCalledWith([
      { fieldKey: "floor", operator: "is_any_of", valueList: ["opt_ground"] },
    ]);
  });

  test("delete button removes a rule", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[
          { fieldKey: "name", operator: "contains", value: "Liv" },
          { fieldKey: "num_people", operator: "gt", value: "1" },
        ]}
        onFilterChange={onChange}
      />,
    );
    const removeButtons = within(popoverContent()).getAllByRole("button", {
      name: "Remove filter rule",
    });
    fireEvent.click(removeButtons[0]!);
    expect(onChange).toHaveBeenLastCalledWith([
      { fieldKey: "num_people", operator: "gt", value: "1" },
    ]);
  });

  test("conjunction labels are Where for the first rule and And for subsequent rules", () => {
    render(
      <Harness
        initialRules={[
          { fieldKey: "name", operator: "contains" },
          { fieldKey: "num_people", operator: "eq" },
        ]}
        onFilterChange={vi.fn()}
      />,
    );
    expect(within(popoverContent()).getByText("Where")).toBeInTheDocument();
    expect(within(popoverContent()).getByText("And")).toBeInTheDocument();
  });
});
