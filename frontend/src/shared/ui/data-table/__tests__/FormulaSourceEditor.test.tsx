import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { FormulaSourceEditor } from "../components/FormulaSourceEditor";
import { highlightFormulaSource } from "../lib/formula/highlight";

function Harness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <FormulaSourceEditor
      id="formula-source"
      value={value}
      maxLength={500}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("highlightFormulaSource", () => {
  test("marks field refs, strings, and numeric literals", () => {
    expect(highlightFormulaSource('{Number} + " - " + 4.5')).toEqual([
      { kind: "field", text: "{Number}", start: 0, end: 8 },
      { kind: "plain", text: " + ", start: 8, end: 11 },
      { kind: "string", text: '" - "', start: 11, end: 16 },
      { kind: "plain", text: " + ", start: 16, end: 19 },
      { kind: "number", text: "4.5", start: 19, end: 22 },
    ]);
  });

  test("keeps partial field and string drafts highlighted", () => {
    expect(highlightFormulaSource('{Name} + "unfinished')).toEqual([
      { kind: "field", text: "{Name}", start: 0, end: 6 },
      { kind: "plain", text: " + ", start: 6, end: 9 },
      { kind: "string", text: '"unfinished', start: 9, end: 20 },
    ]);
  });
});

describe("FormulaSourceEditor", () => {
  test("renders a multiline textarea with token highlight spans", () => {
    const { container } = render(<Harness initialValue={'{Number} + "A" + 12'} />);
    expect(screen.getByRole("textbox")).toBeInstanceOf(HTMLTextAreaElement);
    expect(container.querySelector("[data-token-kind='field']")).toHaveTextContent("{Number}");
    expect(container.querySelector("[data-token-kind='string']")).toHaveTextContent('"A"');
    expect(container.querySelector("[data-token-kind='number']")).toHaveTextContent("12");
  });

  test("keeps native editing semantics", () => {
    const onKeyDown = vi.fn();
    render(
      <FormulaSourceEditor
        id="formula-source"
        value=""
        maxLength={500}
        onChange={() => undefined}
        onKeyDown={onKeyDown}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalled();
  });
});
