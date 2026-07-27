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

  it("can follow unit preference changes and convert the active draft", () => {
    let currentUnitSystem: UnitSystem = "SI";
    const hook = renderHook(
      () => useLengthDraft(25.4, { followUnitPreference: true, unitLabelStyle: "long" }),
      {
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
      },
    );

    expect(hook.result.current.draft).toBe("25.4");
    expect(hook.result.current.unitLabel).toBe("mm");

    currentUnitSystem = "IP";
    hook.rerender();
    expect(hook.result.current.draft).toBe("1");
    expect(hook.result.current.unitLabel).toBe("inch");

    act(() => hook.result.current.setDraft("134 mm"));
    currentUnitSystem = "SI";
    hook.rerender();
    expect(hook.result.current.draft).toBe("134");
    act(() => expect(hook.result.current.parsePositive("Length")).toBe(134));
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

describe("sub-millimetre values", () => {
  // A membrane is 0.1-3 mm. At the length default of one decimal a 0.15 mm
  // sheet renders as "0.1", and a dialog that commits its fields on submit
  // would write that rounded number back over the real one.
  it("keeps a 0.15 mm value intact at the caller's precision", () => {
    const { result } = renderHook(
      () => useLengthDraft(0.15, { fractionDigitsSI: 2, fractionDigitsIP: 4 }),
      { wrapper: wrapper("SI") },
    );

    expect(result.current.draft).toBe("0.15");
    expect(result.current.parsePositive("Thickness")).toBe(0.15);
  });

  it("rounds to 0.1 without the override, which is why isDirty guards the write", () => {
    const { result } = renderHook(() => useLengthDraft(0.15, {}), { wrapper: wrapper("SI") });

    expect(result.current.draft).toBe("0.1");
    // Untouched: the caller must not commit, or 0.15 silently becomes 0.1.
    expect(result.current.isDirty).toBe(false);
  });

  it("reports dirty once the user actually types", () => {
    const { result } = renderHook(
      () => useLengthDraft(0.15, { fractionDigitsSI: 2, fractionDigitsIP: 4 }),
      { wrapper: wrapper("SI") },
    );

    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setDraft("0.25"));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.parsePositive("Thickness")).toBe(0.25);
  });
});

describe("value changing underneath an open field", () => {
  // Assigning a membrane snaps its layer thickness server-side, so the prop can
  // change while the dialog is open. Inferring "edited" by comparing the draft
  // to the value would then read as dirty and write the stale number back,
  // undoing the snap the user just triggered.
  it("follows the value while untouched, and stays clean", () => {
    const { result, rerender } = renderHook(
      ({ mm }: { mm: number }) => useLengthDraft(mm, { fractionDigitsSI: 2, fractionDigitsIP: 4 }),
      { wrapper: wrapper("SI"), initialProps: { mm: 100 } },
    );

    expect(result.current.draft).toBe("100");
    rerender({ mm: 1 });
    expect(result.current.draft).toBe("1");
    expect(result.current.isDirty).toBe(false);
  });

  it("stops following once the user types, and keeps their value", () => {
    const { result, rerender } = renderHook(
      ({ mm }: { mm: number }) => useLengthDraft(mm, { fractionDigitsSI: 2, fractionDigitsIP: 4 }),
      { wrapper: wrapper("SI"), initialProps: { mm: 100 } },
    );

    act(() => result.current.setDraft("2.5"));
    rerender({ mm: 1 });
    expect(result.current.draft).toBe("2.5");
    expect(result.current.isDirty).toBe(true);
  });
});
