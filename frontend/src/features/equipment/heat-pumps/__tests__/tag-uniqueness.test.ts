import { describe, expect, test } from "vitest";
import { tagCollides, uniqueTagForAdd } from "../lib";

describe("uniqueTagForAdd", () => {
  test("returns the desired tag when no collision exists", () => {
    const existing = [{ tag: "HP-1" }];
    expect(uniqueTagForAdd("HP-2", existing)).toBe("HP-2");
  });

  test("appends a (2) suffix on collision", () => {
    const existing = [{ tag: "HP-1" }];
    expect(uniqueTagForAdd("HP-1", existing)).toBe("HP-1 (2)");
  });

  test("walks suffixes until a free slot is found", () => {
    const existing = [{ tag: "HP-1" }, { tag: "HP-1 (2)" }, { tag: "HP-1 (3)" }];
    expect(uniqueTagForAdd("HP-1", existing)).toBe("HP-1 (4)");
  });

  test("collisions are case-insensitive and ignore trim whitespace", () => {
    const existing = [{ tag: "hp-1" }];
    expect(uniqueTagForAdd("  HP-1  ", existing)).toBe("HP-1 (2)");
  });
});

describe("tagCollides", () => {
  test("returns false when no other row matches", () => {
    const existing = [
      { id: "a", tag: "HP-1" },
      { id: "b", tag: "HP-2" },
    ];
    expect(tagCollides("HP-3", existing, "a")).toBe(false);
  });

  test("returns false when the matching row is the row being renamed", () => {
    const existing = [{ id: "a", tag: "HP-1" }];
    expect(tagCollides("HP-1", existing, "a")).toBe(false);
  });

  test("returns true when a different row has the same tag (case-fold + trim)", () => {
    const existing = [
      { id: "a", tag: "HP-1" },
      { id: "b", tag: "hp-1" },
    ];
    expect(tagCollides("  HP-1 ", existing, "a")).toBe(true);
  });
});
