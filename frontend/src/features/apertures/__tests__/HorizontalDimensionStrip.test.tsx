import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HorizontalDimensionStrip } from "../components/HorizontalDimensionStrip";
import type { ApertureTypeEntry } from "../types";

function fixture(columns: number[]): ApertureTypeEntry {
  return {
    id: "apt_X",
    name: "Test",
    row_heights_mm: [1000],
    column_widths_mm: columns,
    elements: columns.map((_, i) => ({
      id: `aptel_${i}`,
      name: "Unnamed",
      row_span: [0, 0],
      column_span: [i, i],
      frames: { top: null, right: null, bottom: null, left: null },
      glazing: null,
      operation: null,
    })),
  } satisfies ApertureTypeEntry;
}

describe("HorizontalDimensionStrip", () => {
  it("renders one label per column and a tick at every grid line", () => {
    render(
      <HorizontalDimensionStrip
        aperture={fixture([1000, 800])}
        zoom={1}
        system="si"
        format="mm"
        canEdit
        onEditColumn={() => {}}
        onRequestDeleteColumn={() => {}}
      />,
    );
    expect(screen.getByTestId("col-w-0")).toBeTruthy();
    expect(screen.getByTestId("col-w-1")).toBeTruthy();
    expect(screen.getByTestId("col-tick-0")).toBeTruthy();
    expect(screen.getByTestId("col-tick-1")).toBeTruthy();
    expect(screen.getByTestId("col-tick-2")).toBeTruthy();
  });

  it("editing a label fires onEditColumn with the parsed mm value", () => {
    const onEditColumn = vi.fn();
    render(
      <HorizontalDimensionStrip
        aperture={fixture([1000, 800])}
        zoom={1}
        system="si"
        format="mm"
        canEdit
        onEditColumn={onEditColumn}
        onRequestDeleteColumn={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("col-w-1-value"));
    fireEvent.change(screen.getByTestId("col-w-1-input"), { target: { value: "650" } });
    fireEvent.keyDown(screen.getByTestId("col-w-1-input"), { key: "Enter" });
    expect(onEditColumn).toHaveBeenCalledWith(1, 650);
  });

  it("delete is disabled at the last-column guard", () => {
    render(
      <HorizontalDimensionStrip
        aperture={fixture([1000])}
        zoom={1}
        system="si"
        format="mm"
        canEdit
        onEditColumn={() => {}}
        onRequestDeleteColumn={() => {}}
      />,
    );
    const deleteBtn = screen.getByTestId("col-w-0-delete") as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it("delete fires onRequestDeleteColumn when allowed", () => {
    const onRequestDeleteColumn = vi.fn();
    render(
      <HorizontalDimensionStrip
        aperture={fixture([1000, 800])}
        zoom={1}
        system="si"
        format="mm"
        canEdit
        onEditColumn={() => {}}
        onRequestDeleteColumn={onRequestDeleteColumn}
      />,
    );
    fireEvent.click(screen.getByTestId("col-w-1-delete"));
    expect(onRequestDeleteColumn).toHaveBeenCalledWith(1);
  });

  it("read-only hides delete buttons", () => {
    render(
      <HorizontalDimensionStrip
        aperture={fixture([1000, 800])}
        zoom={1}
        system="si"
        format="mm"
        canEdit={false}
        onEditColumn={() => {}}
        onRequestDeleteColumn={() => {}}
      />,
    );
    expect(screen.queryByTestId("col-w-0-delete")).toBeNull();
    expect(screen.queryByTestId("col-w-1-delete")).toBeNull();
  });
});
