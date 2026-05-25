import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AddFieldTailCell } from "../components/AddFieldTailCell";

describe("AddFieldTailCell", () => {
  test("th variant without onClick renders an aria-disabled preview cell", () => {
    const { container } = render(
      <table>
        <thead>
          <tr>
            <AddFieldTailCell variant="th" />
          </tr>
        </thead>
      </table>,
    );
    const th = container.querySelector("[data-add-field-cell='th']") as HTMLElement;
    expect(th).not.toBeNull();
    expect(th.tagName).toBe("TH");
    expect(th.getAttribute("aria-disabled")).toBe("true");
    expect(th.textContent).toContain("+");
    expect(th.querySelector("button")).toBeNull();
  });

  test("th variant with onClick renders a focusable button that invokes the callback", () => {
    const onClick = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <AddFieldTailCell variant="th" onClick={onClick} />
          </tr>
        </thead>
      </table>,
    );
    const button = screen.getByRole("button", { name: "Add field" }) as HTMLButtonElement;
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("td variant renders an empty body cell", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <AddFieldTailCell variant="td" />
          </tr>
        </tbody>
      </table>,
    );
    const td = container.querySelector("[data-add-field-cell='td']") as HTMLElement;
    expect(td).not.toBeNull();
    expect(td.tagName).toBe("TD");
    expect(td.textContent).toBe("");
  });
});
