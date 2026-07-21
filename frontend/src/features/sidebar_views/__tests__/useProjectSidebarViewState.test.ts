import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../api", () => ({
  fetchSidebarView: vi.fn(),
  saveSidebarView: vi.fn(),
  deleteSidebarView: vi.fn(),
}));

// Imported after the mock so the hook captures the mocked functions.
import * as api from "../api";
import { clearSidebarViewStateCache, useProjectSidebarViewState } from "../hooks";
import { DEFAULT_SIDEBAR_VIEW_STATE, type SidebarViewState } from "../types";

const fetchMock = api.fetchSidebarView as ReturnType<typeof vi.fn>;
const saveMock = api.saveSidebarView as ReturnType<typeof vi.fn>;
const deleteMock = api.deleteSidebarView as ReturnType<typeof vi.fn>;

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const VIEW_KEY = "apertures";

function manualState(order: string[]): SidebarViewState {
  return { sort_mode: "manual", order, groups: [], collapsed_group_ids: [] };
}

function renderHarness(args: { enabled?: boolean; debounceMs?: number } = {}) {
  return renderHook(
    (props: { enabled: boolean }) =>
      useProjectSidebarViewState({
        projectId: PROJECT_ID,
        viewKey: VIEW_KEY,
        enabled: props.enabled,
        debounceMs: args.debounceMs ?? 50,
      }),
    { initialProps: { enabled: args.enabled ?? true } },
  );
}

beforeEach(() => {
  clearSidebarViewStateCache();
  fetchMock.mockReset();
  saveMock.mockReset();
  deleteMock.mockReset();
  saveMock.mockResolvedValue({ view_state_schema_version: 1, view_state: null, updated_at: null });
  deleteMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useProjectSidebarViewState", () => {
  test("disabled hook never calls GET/PUT/DELETE and reports loaded immediately", async () => {
    const { result } = renderHarness({ enabled: false });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.viewState).toEqual(DEFAULT_SIDEBAR_VIEW_STATE);
    act(() => result.current.setViewState(manualState(["a"])));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  test("loads until GET settles then applies the saved state", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve)));
    const { result } = renderHarness();
    expect(result.current.isLoading).toBe(true);

    act(() =>
      resolveFetch({
        view_state_schema_version: 1,
        view_state: manualState(["b", "a"]),
        updated_at: "2026-07-16T00:00:00Z",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.viewState).toEqual(manualState(["b", "a"]));
  });

  test("missing saved row leaves the view at defaults", async () => {
    fetchMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: null,
      updated_at: null,
    });
    const { result } = renderHarness();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.viewState).toEqual(DEFAULT_SIDEBAR_VIEW_STATE);
  });

  test("rapid setViewState calls collapse to one PUT with the final state", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: null,
      updated_at: null,
    });
    const { result } = renderHarness({ debounceMs: 100 });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setViewState(manualState(["a"])));
    act(() => result.current.setViewState(manualState(["a", "b"])));
    act(() => result.current.setViewState(manualState(["a", "b", "c"])));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith(PROJECT_ID, VIEW_KEY, manualState(["a", "b", "c"]));
  });

  test("a second mount seeds from cache immediately — no default-order flash", async () => {
    fetchMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: manualState(["b", "a"]),
      updated_at: "2026-07-16T00:00:00Z",
    });
    // First mount loads + caches the saved manual order.
    const first = renderHarness();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(first.result.current.viewState).toEqual(manualState(["b", "a"]));
    first.unmount();

    // Navigate back: the remount must render the saved order on the very first
    // render with no loading flag (the fetch only revalidates in the background).
    const second = renderHarness();
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.viewState).toEqual(manualState(["b", "a"]));
  });

  test("reset deletes the saved row and returns to defaults", async () => {
    fetchMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: manualState(["a"]),
      updated_at: "2026-07-16T00:00:00Z",
    });
    const { result } = renderHarness();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.reset());

    expect(result.current.viewState).toEqual(DEFAULT_SIDEBAR_VIEW_STATE);
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(PROJECT_ID, VIEW_KEY));
  });
});
