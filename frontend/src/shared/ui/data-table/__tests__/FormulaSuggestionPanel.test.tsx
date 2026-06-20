import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { FormulaSuggestionPanel } from "../components/FormulaSuggestionPanel";
import { formulaSuggestionOptionId, type FormulaSuggestion } from "../lib/formula/suggestions";

const suggestions: FormulaSuggestion[] = [
  {
    id: "field:name",
    kind: "field",
    label: "Name",
    detail: "Text column",
    insertText: "{Name}",
    rank: 0,
  },
  {
    id: "function:number",
    kind: "function",
    label: "number",
    detail: "function",
    insertText: "number(",
    rank: 1,
  },
];

describe("FormulaSuggestionPanel", () => {
  test("renders listbox options with active selection", () => {
    render(
      <FormulaSuggestionPanel
        id="suggestions"
        suggestions={suggestions}
        activeIndex={1}
        onActiveIndexChange={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText("Insert a field or function")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toHaveAttribute("id", "suggestions");
    expect(screen.getByRole("option", { name: /number function/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(formulaSuggestionOptionId("suggestions", 1)).toBe("suggestions-option-1");
  });

  test("selects by mouse without stealing editor focus first", () => {
    const onSelect = vi.fn();
    const onActiveIndexChange = vi.fn();
    render(
      <FormulaSuggestionPanel
        id="suggestions"
        suggestions={suggestions}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
        onSelect={onSelect}
      />,
    );
    const option = screen.getByRole("option", { name: /Name Text column/ });
    fireEvent.mouseEnter(option);
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
    expect(onSelect).toHaveBeenCalledWith(suggestions[0]);
  });
});
