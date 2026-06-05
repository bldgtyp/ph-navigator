import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DimensionLabel } from "../components/DimensionLabel";

const baseProps = {
  system: "si" as const,
  format: "mm" as const,
  ariaLabel: "Row 1 height",
  testIdPrefix: "row-h-0",
};

describe("DimensionLabel", () => {
  it("renders read-mode formatted value", () => {
    render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete
        onCommit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByTestId("row-h-0-value")).toHaveTextContent("1200.0");
  });

  it("click swaps to edit input with focus + select", () => {
    render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete
        onCommit={() => {}}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("row-h-0-value"));
    const input = screen.getByTestId("row-h-0-input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it("Enter commits parsed mm", () => {
    const onCommit = vi.fn();
    render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete
        onCommit={onCommit}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("row-h-0-value"));
    const input = screen.getByTestId("row-h-0-input");
    fireEvent.change(input, { target: { value: "800" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(800);
  });

  it("Escape reverts without committing", () => {
    const onCommit = vi.fn();
    render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete
        onCommit={onCommit}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("row-h-0-value"));
    const input = screen.getByTestId("row-h-0-input");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("row-h-0-value")).toHaveTextContent("1200.0");
  });

  it("malformed input flags input with data-error and does not commit", () => {
    const onCommit = vi.fn();
    render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete
        onCommit={onCommit}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("row-h-0-value"));
    const input = screen.getByTestId("row-h-0-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "garbage" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.getAttribute("data-error")).toBe("true");
  });

  it("delete button fires onDelete and is disabled at last-row guard", () => {
    const onDelete = vi.fn();
    const { rerender } = render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete
        onCommit={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTestId("row-h-0-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);

    rerender(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit
        canDelete={false}
        deleteDisabledReason="At least one row required"
        onCommit={() => {}}
        onDelete={onDelete}
      />,
    );
    const disabled = screen.getByTestId("row-h-0-delete") as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    expect(disabled.title).toBe("At least one row required");
  });

  it("read-only mode hides delete and disables the value button", () => {
    render(
      <DimensionLabel
        {...baseProps}
        mm={1200}
        canEdit={false}
        canDelete={false}
        onCommit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByTestId("row-h-0-delete")).toBeNull();
    const value = screen.getByTestId("row-h-0-value") as HTMLButtonElement;
    expect(value.disabled).toBe(true);
  });
});
