import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("describes small equal-width native radios with delayed shared tooltips", () => {
    vi.useFakeTimers();
    try {
      render(
        <SegmentedControl
          value="mine"
          onChange={() => undefined}
          ariaLabel="Value source"
          options={[
            { ...OPTIONS[0], ariaLabel: "My project values" },
            { ...OPTIONS[1], tooltip: "Browse shared catalog values" },
          ]}
          equalWidth
        />,
      );

      const mine = screen.getByRole("radio", { name: "My project values" });
      fireEvent.mouseEnter(mine);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole("tooltip")).toHaveTextContent("My project values");
      expect(mine).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);

      fireEvent.mouseLeave(mine);
      const catalog = screen.getByRole("radio", { name: "Catalog" });
      fireEvent.focus(catalog);
      expect(screen.getByRole("tooltip")).toHaveTextContent("Browse shared catalog values");
      expect(catalog).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
      expect(fireEvent.keyDown(catalog, { key: "ArrowLeft" })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("only adds fallback tooltip copy to the small equal-width variant", () => {
    const { rerender } = render(
      <SegmentedControl
        value="mine"
        onChange={() => undefined}
        ariaLabel="Value source"
        options={OPTIONS}
        size="md"
        title="Validation error"
      />,
    );

    expect(screen.getByRole("radiogroup")).toHaveAttribute("title", "Validation error");
    fireEvent.focus(screen.getByRole("radio", { name: "Mine" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <SegmentedControl
        value="mine"
        onChange={() => undefined}
        ariaLabel="Value source"
        options={[{ ...OPTIONS[0], tooltip: "Explicit help" }, OPTIONS[1]]}
        size="md"
      />,
    );

    fireEvent.focus(screen.getByRole("radio", { name: "Mine" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Explicit help");
  });
});
