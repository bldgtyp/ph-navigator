import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { FramePickerFilterProvider, useFramePickerFilters } from "../hooks/useFramePickerFilters";

describe("useFramePickerFilters", () => {
  it("returns picker defaults when no provider is mounted", () => {
    const { result } = renderHook(() => useFramePickerFilters());

    expect(result.current).toEqual({
      filterFramesBySide: true,
      filterFramesByOperation: false,
    });
  });

  it("returns the mounted frame picker filter context", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FramePickerFilterProvider
        value={{
          filterFramesBySide: false,
          filterFramesByOperation: true,
        }}
      >
        {children}
      </FramePickerFilterProvider>
    );

    const { result } = renderHook(() => useFramePickerFilters(), { wrapper });

    expect(result.current).toEqual({
      filterFramesBySide: false,
      filterFramesByOperation: true,
    });
  });
});
