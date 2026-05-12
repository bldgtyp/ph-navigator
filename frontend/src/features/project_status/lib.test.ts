import { describe, expect, test } from "vitest";
import { formatProjectDate } from "../../shared/lib/dates";
import { nextStatusState, orderIndexForMove } from "./lib";
import type { StatusItem } from "./types";

function item(id: string, orderIndex: number): StatusItem {
  return {
    id,
    project_id: "project-1",
    order_index: orderIndex,
    title: id,
    state: "todo",
    completion_date: null,
    description: null,
    created_at: `2026-05-12T18:0${orderIndex}:00Z`,
    created_by: null,
    updated_at: `2026-05-12T18:0${orderIndex}:00Z`,
    updated_by: null,
  };
}

describe("project status helpers", () => {
  test("cycles status state in the UI order", () => {
    expect(nextStatusState("todo")).toBe("done");
    expect(nextStatusState("done")).toBe("na");
    expect(nextStatusState("na")).toBe("todo");
  });

  test("computes fractional order indexes for middle moves", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3)];

    expect(orderIndexForMove(items, "a", 1)).toBe(2.5);
    expect(orderIndexForMove(items, "c", -1)).toBe(1.5);
  });

  test("computes edge order indexes and rejects impossible moves", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3)];

    expect(orderIndexForMove(items, "a", -1)).toBeNull();
    expect(orderIndexForMove(items, "c", 1)).toBeNull();
    expect(orderIndexForMove(items, "b", -1)).toBe(0);
    expect(orderIndexForMove(items, "b", 1)).toBe(4);
  });

  test("formats date-only strings as local calendar dates", () => {
    expect(formatProjectDate("2026-05-01")).toBe("May 1, 2026");
  });
});
