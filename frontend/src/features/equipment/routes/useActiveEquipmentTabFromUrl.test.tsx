import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useActiveEquipmentTabFromUrl } from "./useActiveEquipmentTabFromUrl";

describe("useActiveEquipmentTabFromUrl", () => {
  test("seeds activeTab from the URL on mount", () => {
    const { result } = renderHook(({ key }) => useActiveEquipmentTabFromUrl(key), {
      initialProps: { key: "pumps" as string | null },
    });
    expect(result.current[0]).toBe("pumps");
  });

  test("falls back to ventilators when the URL has no recognized tab", () => {
    const { result } = renderHook(() => useActiveEquipmentTabFromUrl(null));
    expect(result.current[0]).toBe("ventilators");
  });

  // §A7 regression: subsequent URL changes (pill-click navigation that
  // only mutates `?tab=`) must update activeTab — the previous code
  // only ran the lazy initializer at mount.
  test("re-syncs activeTab when the URL tab key changes", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string | null }) => useActiveEquipmentTabFromUrl(key),
      { initialProps: { key: "pumps" } },
    );
    expect(result.current[0]).toBe("pumps");
    rerender({ key: "fans" });
    expect(result.current[0]).toBe("fans");
  });

  test("local setActiveTab is preserved across re-renders that have no URL tab", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string | null }) => useActiveEquipmentTabFromUrl(key),
      { initialProps: { key: null } },
    );
    act(() => result.current[1]("pumps"));
    expect(result.current[0]).toBe("pumps");
    rerender({ key: null });
    expect(result.current[0]).toBe("pumps");
  });
});
