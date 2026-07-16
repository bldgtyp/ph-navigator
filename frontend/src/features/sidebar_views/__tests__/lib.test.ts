import { describe, expect, test } from "vitest";
import { applySidebarOrder } from "../lib";

type Item = { id: string };

const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));
const ids = (list: Item[]): string[] => list.map((item) => item.id);

describe("applySidebarOrder", () => {
  test("empty order is the identity", () => {
    const list = items("a", "b", "c");
    expect(applySidebarOrder(list, [])).toBe(list);
  });

  test("orders items by the persisted id list", () => {
    expect(ids(applySidebarOrder(items("a", "b", "c"), ["c", "a", "b"]))).toEqual(["c", "a", "b"]);
  });

  test("appends items missing from the order in incoming order", () => {
    // 'd' was created after the order was saved — it lands at the end.
    expect(ids(applySidebarOrder(items("a", "b", "d"), ["b", "a"]))).toEqual(["b", "a", "d"]);
  });

  test("skips stale ids that no longer match an item", () => {
    // 'z' was deleted since the order was saved — it is dropped, not surfaced.
    expect(ids(applySidebarOrder(items("a", "b"), ["z", "b", "a"]))).toEqual(["b", "a"]);
  });

  test("de-duplicates repeated ids in the order", () => {
    expect(ids(applySidebarOrder(items("a", "b"), ["a", "a", "b"]))).toEqual(["a", "b"]);
  });
});
