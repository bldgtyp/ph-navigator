import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AddFieldTailCell } from "../components/AddFieldTailCell";

describe("AddFieldTailCell", () => {
  test("th variant renders an aria-disabled header cell with a + glyph", () => {
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
    expect((th as HTMLElement & { onclick?: unknown }).onclick).toBeFalsy();
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
