import { describe, expect, test } from "vitest";
import { computeAggregate } from "../hooks/useGridAggregations";

type Row = { icfa: number | null; name: string };

const ROWS: Row[] = [
  { icfa: 1, name: "Living" },
  { icfa: 2, name: "Kitchen" },
  { icfa: 3, name: "Bedroom" },
];

const icfa = (row: Row) => row.icfa;
const name = (row: Row) => row.name;

describe("computeAggregate", () => {
  test("none returns empty string regardless of rows", () => {
    expect(computeAggregate("none", ROWS, icfa)).toBe("");
  });

  test("sum walks the accessor and formats to two decimals", () => {
    expect(computeAggregate("sum", ROWS, icfa)).toBe("6.00");
  });

  test("mean / min / max use the registry formatter", () => {
    expect(computeAggregate("mean", ROWS, icfa)).toBe("2.00");
    expect(computeAggregate("min", ROWS, icfa)).toBe("1.00");
    expect(computeAggregate("max", ROWS, icfa)).toBe("3.00");
  });

  test("count skips null / undefined / empty string", () => {
    const mixed: Row[] = [
      { icfa: 1, name: "Living" },
      { icfa: null, name: "" },
      { icfa: 2, name: "Bedroom" },
    ];
    expect(computeAggregate("count", mixed, icfa)).toBe("2");
    expect(computeAggregate("count", mixed, name)).toBe("2");
  });

  test("empty row set — sum/min/max return —, count returns 0", () => {
    expect(computeAggregate("sum", [] as Row[], icfa)).toBe("—");
    expect(computeAggregate("min", [] as Row[], icfa)).toBe("—");
    expect(computeAggregate("max", [] as Row[], icfa)).toBe("—");
    expect(computeAggregate("count", [] as Row[], icfa)).toBe("0");
  });

  test("non-numeric values in a numeric column are skipped, not thrown", () => {
    const mixed: Row[] = [
      { icfa: 1, name: "Living" },
      { icfa: null, name: "Kitchen" },
      { icfa: 3, name: "Bedroom" },
    ];
    expect(computeAggregate("sum", mixed, icfa)).toBe("4.00");
  });
});
