import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { SortPopover } from "../components/SortPopover";
import type { FieldDef, SortRule } from "../types";

const FIELDS: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "people", field_type: "number", display_name: "People" },
];

function Harness({
  initialRules = [],
  onSortChange,
  fields = FIELDS,
}: {
  initialRules?: SortRule[];
  onSortChange: (next: SortRule[]) => void;
  fields?: FieldDef[];
}) {
  const [open, setOpen] = useState(true);
  const [rules, setRules] = useState<SortRule[]>(initialRules);
  return (
    <SortPopover
      open={open}
      onOpenChange={setOpen}
      rules={rules}
      sortableFieldDefs={fields}
      onSortChange={(next) => {
        setRules(next);
        onSortChange(next);
      }}
      trigger={<button type="button">Sort</button>}
    />
  );
}

function popover(): HTMLElement {
  return screen.getByRole("dialog", { name: "Sort rules" });
}

describe("SortPopover", () => {
  test("renders an empty-state message when no rules exist", () => {
    render(<Harness onSortChange={vi.fn()} />);
    expect(within(popover()).getByText("No sort rules applied.")).toBeInTheDocument();
  });

  test("Add another sort appends a rule defaulting to asc on the first unused field", () => {
    const onChange = vi.fn();
    render(<Harness onSortChange={onChange} />);
    fireEvent.click(within(popover()).getByText("+ Add another sort"));
    expect(onChange).toHaveBeenCalledWith([{ fieldKey: "number", direction: "asc" }]);
  });

  test("Add button is disabled when all sortable fields are used", () => {
    render(
      <Harness
        initialRules={FIELDS.map(
          (def) => ({ fieldKey: def.field_key, direction: "asc" }) as SortRule,
        )}
        onSortChange={vi.fn()}
      />,
    );
    const addButton = within(popover()).getByText("+ Add another sort");
    expect(addButton).toBeDisabled();
  });

  test("changing direction updates the rule via onSortChange", () => {
    const onChange = vi.fn();
    render(
      <Harness initialRules={[{ fieldKey: "number", direction: "asc" }]} onSortChange={onChange} />,
    );
    const directionPicker = within(popover()).getByLabelText("Sort direction");
    fireEvent.change(directionPicker, { target: { value: "desc" } });
    expect(onChange).toHaveBeenLastCalledWith([{ fieldKey: "number", direction: "desc" }]);
  });

  test("field picker excludes fields already used by other rules", () => {
    render(
      <Harness
        initialRules={[
          { fieldKey: "number", direction: "asc" },
          { fieldKey: "name", direction: "asc" },
        ]}
        onSortChange={vi.fn()}
      />,
    );
    const fieldPickers = within(popover()).getAllByLabelText("Sort field");
    // First picker: its own field (number) + remaining unused (people).
    expect(within(fieldPickers[0]!).queryByText("Name")).not.toBeInTheDocument();
    expect(within(fieldPickers[0]!).getByText("Number")).toBeInTheDocument();
    expect(within(fieldPickers[0]!).getByText("People")).toBeInTheDocument();
    // Second picker: its own (name) + unused (people); excludes number.
    expect(within(fieldPickers[1]!).queryByText("Number")).not.toBeInTheDocument();
    expect(within(fieldPickers[1]!).getByText("Name")).toBeInTheDocument();
    expect(within(fieldPickers[1]!).getByText("People")).toBeInTheDocument();
  });

  test("delete button removes a rule", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialRules={[
          { fieldKey: "number", direction: "asc" },
          { fieldKey: "name", direction: "asc" },
        ]}
        onSortChange={onChange}
      />,
    );
    const removeButtons = within(popover()).getAllByRole("button", {
      name: "Remove sort rule",
    });
    fireEvent.click(removeButtons[0]!);
    expect(onChange).toHaveBeenLastCalledWith([{ fieldKey: "name", direction: "asc" }]);
  });

  test("direction labels read A → Z and Z → A regardless of field type", () => {
    render(
      <Harness initialRules={[{ fieldKey: "people", direction: "asc" }]} onSortChange={vi.fn()} />,
    );
    expect(within(popover()).getByText("A → Z")).toBeInTheDocument();
    expect(within(popover()).getByText("Z → A")).toBeInTheDocument();
  });

  test("each rule exposes a drag handle reachable as a Reorder button", () => {
    render(
      <Harness
        initialRules={[
          { fieldKey: "number", direction: "asc" },
          { fieldKey: "name", direction: "asc" },
        ]}
        onSortChange={vi.fn()}
      />,
    );
    expect(
      within(popover()).getByRole("button", { name: "Reorder sort rule 1" }),
    ).toBeInTheDocument();
    expect(
      within(popover()).getByRole("button", { name: "Reorder sort rule 2" }),
    ).toBeInTheDocument();
  });
});
