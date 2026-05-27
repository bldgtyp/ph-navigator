import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitPreferenceContextValue } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import { useLengthDraft } from "../hooks/useLengthDraft";

function wrapper(unitSystem: UnitSystem) {
  const value: UnitPreferenceContextValue = {
    unitSystem,
    source: "local",
    error: null,
    setUnitSystem: vi.fn(),
    toggleUnitSystem: vi.fn(),
  };
  return function UnitWrapper({ children }: { children: ReactNode }) {
    return (
      <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>
    );
  };
}

describe("useLengthDraft", () => {
  it("formats the initial draft with the modal-open unit system", () => {
    expect(
      renderHook(() => useLengthDraft(25.4), { wrapper: wrapper("SI") }).result.current.draft,
    ).toBe("25.4");
    expect(
      renderHook(() => useLengthDraft(25.4), { wrapper: wrapper("IP") }).result.current.draft,
    ).toBe("1");
  });

  it("keeps the draft string stable when the page unit system changes mid-edit", () => {
    let currentUnitSystem: UnitSystem = "IP";
    const hook = renderHook(() => useLengthDraft(25.4), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <UnitPreferenceContext.Provider
          value={{
            unitSystem: currentUnitSystem,
            source: "local",
            error: null,
            setUnitSystem: vi.fn(),
            toggleUnitSystem: vi.fn(),
          }}
        >
          {children}
        </UnitPreferenceContext.Provider>
      ),
    });
    expect(hook.result.current.draft).toBe("1");
    currentUnitSystem = "SI";
    hook.rerender();
    expect(hook.result.current.draft).toBe("1");
    expect(hook.result.current.unitLabel).toBe("in");
  });

  it("rejects zero and negative positive-length input", () => {
    const hook = renderHook(() => useLengthDraft(25.4), { wrapper: wrapper("SI") });
    act(() => hook.result.current.setDraft("0"));
    act(() => expect(hook.result.current.parsePositive("Length")).toBeNull());
    expect(hook.result.current.error).toBe("Length must be greater than zero.");

    act(() => hook.result.current.setDraft("-1"));
    act(() => expect(hook.result.current.parsePositive("Length")).toBeNull());
    expect(hook.result.current.error).toBeTruthy();
  });

  it("parses optional empty values as null and invalid values as undefined", () => {
    const hook = renderHook(() => useLengthDraft(null), { wrapper: wrapper("SI") });
    expect(hook.result.current.parseOptional()).toBeNull();
    act(() => hook.result.current.setDraft("not a length"));
    act(() => expect(hook.result.current.parseOptional()).toBeUndefined());
    expect(hook.result.current.error).toBeTruthy();
  });
});
