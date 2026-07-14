import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationRow } from "../components/OperationRow";

describe("OperationRow", () => {
  it("portals the operation type menu outside its card and commits a selection", () => {
    const onCommit = vi.fn();
    render(
      <div className="aperture-element-card" data-testid="element-card">
        <OperationRow operation={null} canEdit onCommit={onCommit} />
      </div>,
    );

    const card = screen.getByTestId("element-card");
    fireEvent.click(screen.getByRole("button", { name: "Operation type" }));

    const menu = screen.getByRole("menu");
    expect(card).not.toContainElement(menu);
    expect(document.body).toContainElement(menu);

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Slide" }));
    expect(onCommit).toHaveBeenCalledWith({ type: "slide", directions: [] });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
