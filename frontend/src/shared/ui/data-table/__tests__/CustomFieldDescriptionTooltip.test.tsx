import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CustomFieldDescriptionTooltip } from "../components/CustomFieldDescriptionTooltip";

describe("CustomFieldDescriptionTooltip", () => {
  test("renders nothing when description is empty / whitespace-only", () => {
    const { container } = render(
      <CustomFieldDescriptionTooltip description="   " fieldDisplayName="Notes" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("renders an accessible `?` trigger when description is non-empty", () => {
    render(<CustomFieldDescriptionTooltip description="Optional notes" fieldDisplayName="Notes" />);
    const trigger = screen.getByRole("button", { name: "Description for Notes" });
    expect(trigger.textContent).toBe("?");
  });

  test("hovering the trigger reveals the trimmed description in a tooltip role", () => {
    render(
      <CustomFieldDescriptionTooltip
        description="   Used by the LCA pipeline.   "
        fieldDisplayName="Notes"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Description for Notes" });
    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("Used by the LCA pipeline.");
  });

  test("focusing the trigger via keyboard reveals the tooltip", () => {
    render(<CustomFieldDescriptionTooltip description="Optional notes" fieldDisplayName="Notes" />);
    const trigger = screen.getByRole("button", { name: "Description for Notes" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  test("blurring closes the tooltip", () => {
    render(<CustomFieldDescriptionTooltip description="Optional notes" fieldDisplayName="Notes" />);
    const trigger = screen.getByRole("button", { name: "Description for Notes" });
    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
