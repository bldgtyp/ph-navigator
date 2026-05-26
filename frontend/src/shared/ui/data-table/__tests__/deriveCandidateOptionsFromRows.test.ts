import { describe, expect, test } from "vitest";
import { deriveCandidateOptionsFromRows } from "../lib";

describe("deriveCandidateOptionsFromRows", () => {
  test("dedupes by case-insensitive trimmed label and preserves first-seen order", () => {
    const options = deriveCandidateOptionsFromRows(
      [
        { rawValue: "Open" },
        { rawValue: " open " },
        { rawValue: "Closed" },
        { rawValue: "OPEN" },
      ],
      50,
    );
    expect(options.map((o) => o.label)).toEqual(["Open", "Closed"]);
  });

  test("coerces finite numbers to string labels", () => {
    const options = deriveCandidateOptionsFromRows(
      [{ rawValue: 1 }, { rawValue: 12 }, { rawValue: 12 }],
      50,
    );
    expect(options.map((o) => o.label)).toEqual(["1", "12"]);
  });

  test("skips null/empty/non-stringifiable values", () => {
    const options = deriveCandidateOptionsFromRows(
      [
        { rawValue: null },
        { rawValue: undefined },
        { rawValue: "" },
        { rawValue: "   " },
        { rawValue: Number.NaN },
        { rawValue: { x: 1 } },
        { rawValue: "Valid" },
      ],
      50,
    );
    expect(options.map((o) => o.label)).toEqual(["Valid"]);
  });

  test("caps the derived list and silently drops the overflow", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ rawValue: `label-${i}` }));
    const options = deriveCandidateOptionsFromRows(rows, 3);
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.label)).toEqual(["label-0", "label-1", "label-2"]);
  });

  test("assigns ascending order and cycles palette colors", () => {
    const options = deriveCandidateOptionsFromRows(
      [{ rawValue: "a" }, { rawValue: "b" }],
      50,
    );
    expect(options[0]?.order).toBe(0);
    expect(options[1]?.order).toBe(1);
    expect(options[0]?.color).toBeTruthy();
    expect(options[1]?.color).toBeTruthy();
    expect(options[0]?.id).not.toBe(options[1]?.id);
  });
});
