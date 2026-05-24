import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { FillHandle } from "../components/FillHandle";

describe("FillHandle", () => {
  test("renders a button with aria-label 'Drag to fill'", () => {
    render(<FillHandle onMouseDown={() => {}} />);
    expect(screen.getByRole("button", { name: "Drag to fill" })).toBeInTheDocument();
  });

  test("calls onMouseDown when pressed", () => {
    const onMouseDown = vi.fn();
    render(<FillHandle onMouseDown={onMouseDown} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Drag to fill" }));
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  test("is not Tab-reachable (tabIndex=-1)", () => {
    render(<FillHandle onMouseDown={() => {}} />);
    const button = screen.getByRole("button", { name: "Drag to fill" });
    expect(button).toHaveAttribute("tabindex", "-1");
  });

  test("carries the data-table-fill-handle class", () => {
    render(<FillHandle onMouseDown={() => {}} />);
    const button = screen.getByRole("button", { name: "Drag to fill" });
    expect(button).toHaveClass("data-table-fill-handle");
  });
});
