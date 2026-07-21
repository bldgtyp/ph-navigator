import { describe, expect, test } from "vitest";
import {
  UNGROUPED_CONTAINER,
  computeSidebarDrop,
  containerDroppableId,
  type DropContainer,
} from "../dnd";

const containers: DropContainer[] = [
  { id: "g1", itemIds: ["a", "b"] },
  { id: "g2", itemIds: ["c"] },
  { id: UNGROUPED_CONTAINER, itemIds: ["d", "e"] },
];

describe("computeSidebarDrop", () => {
  test("no-op when there is no target or the target is the item itself", () => {
    expect(computeSidebarDrop("a", null, containers)).toEqual({ kind: "none" });
    expect(computeSidebarDrop("a", "a", containers)).toEqual({ kind: "none" });
  });

  test("reorder within the same container", () => {
    // Drag 'a' onto 'b' inside g1 → g1 becomes [b, a].
    expect(computeSidebarDrop("a", "b", containers)).toEqual({
      kind: "reorder",
      containerId: "g1",
      orderedIds: ["b", "a"],
    });
  });

  test("reorder within the ungrouped remainder", () => {
    expect(computeSidebarDrop("e", "d", containers)).toEqual({
      kind: "reorder",
      containerId: UNGROUPED_CONTAINER,
      orderedIds: ["e", "d"],
    });
  });

  test("move across groups, inserting before the row dropped on", () => {
    // Drag 'a' (g1) onto 'c' (g2) → g2 becomes [a, c].
    expect(computeSidebarDrop("a", "c", containers)).toEqual({
      kind: "move",
      itemId: "a",
      targetContainerId: "g2",
      orderedIds: ["a", "c"],
    });
  });

  test("move onto an empty container's body appends", () => {
    const withEmpty: DropContainer[] = [
      { id: "g1", itemIds: ["a"] },
      { id: "g2", itemIds: [] },
    ];
    expect(computeSidebarDrop("a", containerDroppableId("g2"), withEmpty)).toEqual({
      kind: "move",
      itemId: "a",
      targetContainerId: "g2",
      orderedIds: ["a"],
    });
  });

  test("move an item out to the ungrouped container", () => {
    expect(computeSidebarDrop("a", containerDroppableId(UNGROUPED_CONTAINER), containers)).toEqual({
      kind: "move",
      itemId: "a",
      targetContainerId: UNGROUPED_CONTAINER,
      orderedIds: ["d", "e", "a"],
    });
  });
});
