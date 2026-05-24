import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AggregationMenuItem } from "../components/AggregationMenuItem";
import type { FieldDef } from "../types";

const numberField: FieldDef = {
  field_key: "icfa",
  field_type: "number",
  display_name: "iCFA",
};
const textField: FieldDef = {
  field_key: "name",
  field_type: "text",
  display_name: "Name",
};
const attachmentField: FieldDef = {
  field_key: "files",
  field_type: "attachment",
  display_name: "Files",
};

describe("AggregationMenuItem", () => {
  test("renders nothing for fields with no aggregation catalogue", () => {
    const { container } = render(
      <AggregationMenuItem fieldDef={attachmentField} current="none" onPick={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("renders the trigger with the current kind label", () => {
    render(<AggregationMenuItem fieldDef={numberField} current="mean" onPick={vi.fn()} />);
    expect(screen.getByText("Mean")).toBeInTheDocument();
  });

  test("number field lists None + count + sum + mean + min + max in submenu", () => {
    render(<AggregationMenuItem fieldDef={numberField} current="none" onPick={vi.fn()} />);
    fireEvent.click(screen.getByText("None"));
    // Open submenu — Radix portals it to document.body.
    const items = screen.getAllByRole("button");
    const labels = items.map((b) => b.textContent?.trim() ?? "");
    expect(labels).toEqual(expect.arrayContaining(["None", "Count", "Sum", "Mean", "Min", "Max"]));
  });

  test("text field lists only None + Count in submenu", () => {
    render(<AggregationMenuItem fieldDef={textField} current="none" onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Aggregation/ }));
    const items = screen.getAllByRole("button").map((b) => b.textContent?.trim() ?? "");
    expect(items).toEqual(expect.arrayContaining(["None", "Count"]));
    expect(items).not.toEqual(expect.arrayContaining(["Sum", "Mean", "Min", "Max"]));
  });

  test("picking a kind fires onPick", () => {
    const onPick = vi.fn();
    render(<AggregationMenuItem fieldDef={numberField} current="none" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Aggregation/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mean" }));
    expect(onPick).toHaveBeenCalledWith("mean");
  });

  test("picking 'None' fires onPick with 'none' (caller deletes the key)", () => {
    const onPick = vi.fn();
    render(<AggregationMenuItem fieldDef={numberField} current="mean" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Aggregation/ }));
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onPick).toHaveBeenCalledWith("none");
  });
});
