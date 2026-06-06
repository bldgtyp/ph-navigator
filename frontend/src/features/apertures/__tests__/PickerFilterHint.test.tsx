import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PickerFilterHint } from "../components/PickerFilterHint";

describe("PickerFilterHint", () => {
  it("renders when fewer manufacturers are visible than the roster", () => {
    render(
      <PickerFilterHint
        visibleManufacturers={12}
        rosterManufacturers={18}
        onOpenFilters={() => {}}
      />,
    );
    expect(screen.getByText(/Showing 12 of 18 manufacturers/)).toBeTruthy();
  });

  it("does not render when the picker shows the full roster", () => {
    const { container } = render(
      <PickerFilterHint
        visibleManufacturers={18}
        rosterManufacturers={18}
        onOpenFilters={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when the roster is empty (no catalog rows yet)", () => {
    const { container } = render(
      <PickerFilterHint
        visibleManufacturers={0}
        rosterManufacturers={0}
        onOpenFilters={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens the filter modal when the link is clicked", () => {
    const onOpenFilters = vi.fn();
    render(
      <PickerFilterHint
        visibleManufacturers={1}
        rosterManufacturers={3}
        onOpenFilters={onOpenFilters}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Adjust filter/ }));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});
