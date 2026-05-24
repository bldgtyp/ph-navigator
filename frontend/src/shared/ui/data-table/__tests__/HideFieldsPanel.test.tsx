import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  HideFieldsPanel,
  type HideFieldsColumn,
  type HideFieldsPanelChange,
} from "../components/HideFieldsPanel";
import type { FieldDef } from "../types";

const FIELDS: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "floor", field_type: "single_select", display_name: "Floor" },
  { field_key: "count", field_type: "number", display_name: "iCFA factor" },
  { field_key: "tags", field_type: "text", display_name: "Tags" },
];

const COLUMNS: HideFieldsColumn[] = [
  { id: "name", fieldKey: "name", header: "Name" },
  { id: "floor", fieldKey: "floor", header: "Floor" },
  { id: "count", fieldKey: "count", header: "iCFA factor" },
  { id: "tags", fieldKey: "tags", header: "Tags" },
];

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.field_key, f]));

function Harness({
  onChange,
  initialHidden = [],
  columns = COLUMNS,
}: {
  onChange: (change: HideFieldsPanelChange) => void;
  initialHidden?: string[];
  columns?: HideFieldsColumn[];
}) {
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [order, setOrder] = useState<string[]>(columns.map((c) => c.id));
  const orderedColumns = order
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is HideFieldsColumn => Boolean(c));
  return (
    <HideFieldsPanel
      orderedColumns={orderedColumns}
      fieldDefByKey={FIELD_BY_KEY}
      hiddenColumns={hidden}
      onChange={(next) => {
        if (next.hiddenColumns !== undefined) setHidden(next.hiddenColumns);
        if (next.columnOrder !== undefined) setOrder(next.columnOrder);
        onChange(next);
      }}
    />
  );
}

function panel(): HTMLElement {
  return screen.getByRole("dialog", { name: "Hide or show fields" });
}

describe("HideFieldsPanel", () => {
  test("renders one row per column in display order", () => {
    render(<Harness onChange={vi.fn()} />);
    const names = within(panel())
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(names).toEqual(["Name", "Floor", "iCFA factor", "Tags"]);
  });

  test("toggle off a non-primary column calls onChange with the id appended to hiddenColumns", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(within(panel()).getByLabelText("Hide Floor"));
    expect(onChange).toHaveBeenLastCalledWith({ hiddenColumns: ["floor"] });
  });

  test("toggle on a hidden column calls onChange with the id removed", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initialHidden={["floor", "count"]} />);
    fireEvent.click(within(panel()).getByLabelText("Show Floor"));
    expect(onChange).toHaveBeenLastCalledWith({ hiddenColumns: ["count"] });
  });

  test("primary column toggle is disabled", () => {
    render(<Harness onChange={vi.fn()} />);
    const primaryToggle = within(panel()).getByLabelText("Hide Name") as HTMLInputElement;
    expect(primaryToggle.disabled).toBe(true);
  });

  test("Hide all hides every column except the primary", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(within(panel()).getByRole("button", { name: "Hide all" }));
    expect(onChange).toHaveBeenLastCalledWith({
      hiddenColumns: ["floor", "count", "tags"],
    });
  });

  test("Show all clears the hidden list", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initialHidden={["floor", "tags"]} />);
    fireEvent.click(within(panel()).getByRole("button", { name: "Show all" }));
    expect(onChange).toHaveBeenLastCalledWith({ hiddenColumns: [] });
  });

  test("Show all is disabled when nothing is hidden", () => {
    render(<Harness onChange={vi.fn()} />);
    const showAll = within(panel()).getByRole("button", { name: "Show all" }) as HTMLButtonElement;
    expect(showAll.disabled).toBe(true);
  });

  test("search filters the visible list by display name (case-insensitive)", () => {
    render(<Harness onChange={vi.fn()} />);
    const search = within(panel()).getByLabelText("Find a field");
    fireEvent.change(search, { target: { value: "iCFA" } });
    const names = within(panel())
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(names).toEqual(["iCFA factor"]);
  });

  test("empty-state message when no fields match the search", () => {
    render(<Harness onChange={vi.fn()} />);
    fireEvent.change(within(panel()).getByLabelText("Find a field"), {
      target: { value: "nothing-matches" },
    });
    expect(within(panel()).getByText(/No fields match/)).toBeInTheDocument();
  });

  test("clearing the search restores the full list", () => {
    render(<Harness onChange={vi.fn()} />);
    const search = within(panel()).getByLabelText("Find a field");
    fireEvent.change(search, { target: { value: "iCFA" } });
    fireEvent.change(search, { target: { value: "" } });
    expect(within(panel()).getAllByRole("listitem")).toHaveLength(4);
  });

  test("drag handle for the primary column is disabled", () => {
    render(<Harness onChange={vi.fn()} />);
    const primaryDrag = within(panel()).getByLabelText("Reorder Name") as HTMLButtonElement;
    expect(primaryDrag.disabled).toBe(true);
  });
});
