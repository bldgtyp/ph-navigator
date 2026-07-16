import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../hooks", () => ({
  useProjectSidebarViewState: vi.fn(),
}));

import { useProjectSidebarViewState } from "../hooks";
import { DEFAULT_SIDEBAR_VIEW_STATE, type SidebarViewState } from "../types";
import { useSidebarOrganization } from "../useSidebarOrganization";

const hookMock = useProjectSidebarViewState as ReturnType<typeof vi.fn>;

type Item = { id: string };
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));
const setViewState = vi.fn();

function mockState(viewState: SidebarViewState): void {
  hookMock.mockReturnValue({
    viewState,
    setViewState,
    isLoading: false,
    saveError: null,
  });
}

function render(list: Item[]) {
  return renderHook(() =>
    useSidebarOrganization({ projectId: "p1", viewKey: "apertures", canEdit: true, items: list }),
  );
}

beforeEach(() => {
  hookMock.mockReset();
  setViewState.mockReset();
});

describe("useSidebarOrganization", () => {
  test("alphabetical mode returns items unchanged", () => {
    mockState(DEFAULT_SIDEBAR_VIEW_STATE);
    const list = items("a", "b", "c");
    const { result } = render(list);
    expect(result.current.sortMode).toBe("alphabetical");
    expect(result.current.orderedItems).toBe(list);
  });

  test("manual mode applies the persisted order", () => {
    mockState({ sort_mode: "manual", order: ["c", "a", "b"], groups: [], collapsed_group_ids: [] });
    const { result } = render(items("a", "b", "c"));
    expect(result.current.orderedItems.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  test("toggling to manual with no saved order freezes the current order", () => {
    mockState(DEFAULT_SIDEBAR_VIEW_STATE);
    const { result } = render(items("a", "b", "c"));

    act(() => result.current.onToggleSortMode());

    expect(setViewState).toHaveBeenCalledWith({
      sort_mode: "manual",
      order: ["a", "b", "c"],
      groups: [],
      collapsed_group_ids: [],
    });
  });

  test("toggling back to alphabetical keeps the saved order for later", () => {
    mockState({ sort_mode: "manual", order: ["c", "a"], groups: [], collapsed_group_ids: [] });
    const { result } = render(items("a", "c"));

    act(() => result.current.onToggleSortMode());

    expect(setViewState).toHaveBeenCalledWith({
      sort_mode: "alphabetical",
      order: ["c", "a"],
      groups: [],
      collapsed_group_ids: [],
    });
  });

  test("onReorder persists the new order and pins manual mode", () => {
    // Even if state somehow read alphabetical, a drag pins manual so the new
    // order can't be stranded behind an alphabetical sort.
    mockState({ sort_mode: "alphabetical", order: [], groups: [], collapsed_group_ids: [] });
    const { result } = render(items("a", "b", "c"));

    act(() => result.current.onReorder(["c", "b", "a"]));

    expect(setViewState).toHaveBeenCalledWith({
      sort_mode: "manual",
      order: ["c", "b", "a"],
      groups: [],
      collapsed_group_ids: [],
    });
  });
});
