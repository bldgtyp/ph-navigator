import { describe, expect, test } from "vitest";
import {
  addGroup,
  buildSidebarTree,
  deleteGroup,
  moveItemToContainer,
  renameGroup,
  reorderGroups,
  setGroupMemberOrder,
} from "../groups";
import type { SidebarGroup, SidebarViewState } from "../types";

type Item = { id: string };
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));

function state(over: Partial<SidebarViewState> = {}): SidebarViewState {
  return {
    sort_mode: "manual",
    order: [],
    groups: [],
    collapsed_group_ids: [],
    ...over,
  };
}

const group = (id: string, ...members: string[]): SidebarGroup => ({
  id,
  label: id,
  member_ids: members,
});

describe("buildSidebarTree", () => {
  test("splits items into groups (in member order) and an ungrouped remainder", () => {
    const vs = state({ groups: [group("g1", "b", "a")], order: ["c"] });
    const tree = buildSidebarTree(items("a", "b", "c", "d"), vs);
    expect(tree.groups[0]!.items.map((i) => i.id)).toEqual(["b", "a"]);
    // 'c' ordered first by `order`, 'd' (new) appended.
    expect(tree.ungrouped.map((i) => i.id)).toEqual(["c", "d"]);
  });

  test("an item claimed by an earlier group is not double-listed in a later group", () => {
    const vs = state({ groups: [group("g1", "a"), group("g2", "a", "b")] });
    const tree = buildSidebarTree(items("a", "b"), vs);
    expect(tree.groups[0]!.items.map((i) => i.id)).toEqual(["a"]);
    expect(tree.groups[1]!.items.map((i) => i.id)).toEqual(["b"]);
    expect(tree.ungrouped).toHaveLength(0);
  });

  test("stale member ids (deleted items) are dropped", () => {
    const vs = state({ groups: [group("g1", "gone", "a")] });
    const tree = buildSidebarTree(items("a"), vs);
    expect(tree.groups[0]!.items.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("group mutations", () => {
  test("addGroup appends an empty group and pins manual mode", () => {
    const next = addGroup(state({ sort_mode: "alphabetical" }), "North");
    expect(next.sort_mode).toBe("manual");
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]!.label).toBe("North");
    expect(next.groups[0]!.member_ids).toEqual([]);
    expect(next.groups[0]!.id).toMatch(/^grp_/);
  });

  test("renameGroup changes only the target label", () => {
    const next = renameGroup(state({ groups: [group("g1"), group("g2")] }), "g2", "South");
    expect(next.groups.map((g) => g.label)).toEqual(["g1", "South"]);
  });

  test("deleteGroup removes the group and its collapsed flag; members fall back to ungrouped", () => {
    const vs = state({ groups: [group("g1", "a")], collapsed_group_ids: ["g1"] });
    const next = deleteGroup(vs, "g1");
    expect(next.groups).toHaveLength(0);
    expect(next.collapsed_group_ids).toEqual([]);
    expect(buildSidebarTree(items("a"), next).ungrouped.map((i) => i.id)).toEqual(["a"]);
  });

  test("moveItemToContainer places the item in the target group at the given order and removes it from its old group", () => {
    const vs = state({ groups: [group("g1", "a", "b"), group("g2", "c")] });
    // Drag 'a' into g2 between existing members: caller passes the resulting order.
    const next = moveItemToContainer(vs, "a", "g2", ["c", "a"]);
    expect(next.groups[0]!.member_ids).toEqual(["b"]);
    expect(next.groups[1]!.member_ids).toEqual(["c", "a"]);
    expect(next.sort_mode).toBe("manual");
  });

  test("moveItemToContainer to ungrouped writes `order` and clears the item from all groups", () => {
    const vs = state({ groups: [group("g1", "a", "b")], order: ["c"] });
    const next = moveItemToContainer(vs, "a", null, ["a", "c"]);
    expect(next.groups[0]!.member_ids).toEqual(["b"]);
    expect(next.order).toEqual(["a", "c"]);
  });

  test("reorderGroups honors the given order and appends unknowns", () => {
    const vs = state({ groups: [group("g1"), group("g2"), group("g3")] });
    const next = reorderGroups(vs, ["g3", "g1"]);
    expect(next.groups.map((g) => g.id)).toEqual(["g3", "g1", "g2"]);
  });

  test("setGroupMemberOrder reorders only that group's members", () => {
    const vs = state({ groups: [group("g1", "a", "b", "c")] });
    const next = setGroupMemberOrder(vs, "g1", ["c", "a", "b"]);
    expect(next.groups[0]!.member_ids).toEqual(["c", "a", "b"]);
  });
});
