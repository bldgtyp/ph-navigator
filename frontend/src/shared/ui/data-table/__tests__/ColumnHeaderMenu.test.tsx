import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ColumnHeaderMenu } from "../components/ColumnHeaderMenu";
import type { FieldDef } from "../types";

const singleSelectField: FieldDef = {
  field_key: "floor_level",
  field_type: "single_select",
  display_name: "Floor",
  options: [],
};

const numberField: FieldDef = {
  field_key: "icfa",
  field_type: "number",
  display_name: "iCFA",
};

describe("ColumnHeaderMenu — plan 06 retirement of the Aggregation entry", () => {
  test("number column with no editable options renders nothing", () => {
    const { container } = render(
      <ColumnHeaderMenu fieldDef={numberField} canEditOptions={false} onEditOptions={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("editable single_select still surfaces Edit options… but no Aggregation entry", () => {
    render(
      <ColumnHeaderMenu fieldDef={singleSelectField} canEditOptions onEditOptions={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /More actions/ }));
    const labels = screen.getAllByRole("button").map((b) => b.textContent?.trim() ?? "");
    expect(labels).toEqual(expect.arrayContaining(["Edit options…"]));
    expect(labels).not.toEqual(
      expect.arrayContaining(["Aggregation:", "Aggregation: None", "Aggregate by…"]),
    );
  });
});
