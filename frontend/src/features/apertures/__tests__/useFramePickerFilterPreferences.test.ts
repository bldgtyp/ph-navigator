import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY,
  useFramePickerFilterPreferences,
} from "../hooks/useFramePickerFilterPreferences";

describe("useFramePickerFilterPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to side filtering on and operation filtering off", () => {
    const { result } = renderHook(() => useFramePickerFilterPreferences("project-1"));

    expect(result.current.filterFramesBySide).toBe(true);
    expect(result.current.filterFramesByOperation).toBe(false);
    expect(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("persists values under the current project id", () => {
    const { result, rerender } = renderHook(
      ({ projectId }) => useFramePickerFilterPreferences(projectId),
      { initialProps: { projectId: "project-1" } },
    );

    act(() => {
      result.current.setFilterFramesBySide(false);
      result.current.setFilterFramesByOperation(true);
    });

    rerender({ projectId: "project-2" });
    expect(result.current.filterFramesBySide).toBe(true);
    expect(result.current.filterFramesByOperation).toBe(false);

    rerender({ projectId: "project-1" });
    expect(result.current.filterFramesBySide).toBe(false);
    expect(result.current.filterFramesByOperation).toBe(true);

    expect(
      JSON.parse(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)!),
    ).toEqual({
      "project-1": {
        filterFramesBySide: false,
        filterFramesByOperation: true,
      },
    });
  });

  it("falls back to defaults for invalid JSON and overwrites on explicit changes only", () => {
    window.localStorage.setItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY, "not-json");

    const { result } = renderHook(() => useFramePickerFilterPreferences("project-1"));

    expect(result.current.filterFramesBySide).toBe(true);
    expect(result.current.filterFramesByOperation).toBe(false);
    expect(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)).toBe(
      "not-json",
    );

    act(() => result.current.setFilterFramesBySide(false));

    expect(
      JSON.parse(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)!),
    ).toEqual({
      "project-1": {
        filterFramesBySide: false,
        filterFramesByOperation: false,
      },
    });
  });

  it("uses defaults and skips writes when project id is missing", () => {
    const { result } = renderHook(() => useFramePickerFilterPreferences(null));

    act(() => {
      result.current.setFilterFramesBySide(false);
      result.current.setFilterFramesByOperation(true);
    });

    expect(result.current.filterFramesBySide).toBe(false);
    expect(result.current.filterFramesByOperation).toBe(true);
    expect(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("skips storage writes when setting the current value", () => {
    const { result } = renderHook(() => useFramePickerFilterPreferences("project-1"));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => result.current.setFilterFramesBySide(true));
    act(() => result.current.setFilterFramesByOperation(false));

    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)).toBeNull();
    setItem.mockRestore();
  });
});
