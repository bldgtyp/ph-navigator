import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { GridChevron } from "../components/GridChevron";

describe("GridChevron", () => {
  test("renders a button with default Open options label and an SVG", () => {
    render(<GridChevron onMouseDown={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Open options" });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("invokes onMouseDown when the button is mouse-pressed", () => {
    const onMouseDown = vi.fn();
    render(<GridChevron onMouseDown={onMouseDown} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Open options" }));
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  test("stops the mousedown from bubbling to the parent cell handler", () => {
    const onMouseDown = vi.fn();
    const parentMouseDown = vi.fn();
    render(
      <div onMouseDown={parentMouseDown}>
        <GridChevron onMouseDown={onMouseDown} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "Open options" }));
    expect(onMouseDown).toHaveBeenCalled();
    expect(parentMouseDown).not.toHaveBeenCalled();
  });

  test("honors a custom ariaLabel", () => {
    render(<GridChevron onMouseDown={vi.fn()} ariaLabel="Pick floor level" />);
    expect(screen.getByRole("button", { name: "Pick floor level" })).toBeInTheDocument();
  });
});
