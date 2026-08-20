import { describe, expect, test } from "vitest";
import { naturalSortByName } from "./sort";

describe("naturalSortByName", () => {
  test("uses portable normalized numeric ordering with id as the final tie-break", () => {
    const items = [
      { id: "asm_z", name: "Wall 10" },
      { id: "asm_b", name: "Ｗall 02" },
      { id: "asm_a", name: "Wall 2" },
      { id: "asm_c", name: "wall 1" },
    ];

    expect(naturalSortByName(items).map((item) => item.id)).toEqual([
      "asm_c",
      "asm_a",
      "asm_b",
      "asm_z",
    ]);
  });
});
