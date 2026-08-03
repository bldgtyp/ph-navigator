import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "../SegmentedControl";

const OPTIONS = [
  { value: "mine", label: "Mine" },
  { value: "catalog", label: "Catalog" },
] as const;

describe("SegmentedControl", () => {
  it("renders one native-radio group and reports the selected value", () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        value="mine"
        onChange={onChange}
        ariaLabel="Value source"
        options={OPTIONS}
      />,
    );

    const mine = screen.getByRole("radio", { name: "Mine" });
    const catalog = screen.getByRole("radio", { name: "Catalog" });
    expect(screen.getByRole("radiogroup", { name: "Value source" })).toBeInTheDocument();
    expect(mine).toBeChecked();
    expect(catalog).not.toBeChecked();
    expect(mine).toHaveAttribute("name", catalog.getAttribute("name"));

    fireEvent.click(catalog);
    expect(onChange).toHaveBeenCalledWith("catalog");
  });

  it("supports whole-control and per-option disabled states", () => {
    const { rerender } = render(
      <SegmentedControl
        value="mine"
        onChange={() => undefined}
        ariaLabel="Value source"
        options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }]}
      />,
    );

    expect(screen.getByRole("radio", { name: "Mine" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Catalog" })).toBeDisabled();

    rerender(
      <SegmentedControl
        value="mine"
        onChange={() => undefined}
        ariaLabel="Value source"
        options={OPTIONS}
        disabled
      />,
    );

    expect(screen.getAllByRole("radio").every((radio) => radio.hasAttribute("disabled"))).toBe(
      true,
    );
  });
});
