import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDimensionDraft } from "../hooks/useDimensionDraft";

describe("useDimensionDraft", () => {
  it("starts in read mode with display string for the initial mm", () => {
    const { result } = renderHook(() =>
      useDimensionDraft({ initialMm: 1200, system: "si", format: "mm" }),
    );
    expect(result.current.editing).toBe(false);
    expect(result.current.display).toBe("1200.0");
  });

  it("startEditing flips to edit mode", () => {
    const { result } = renderHook(() =>
      useDimensionDraft({ initialMm: 1200, system: "si", format: "mm" }),
    );
    act(() => result.current.startEditing());
    expect(result.current.editing).toBe(true);
    expect(result.current.draft).toBe("1200.0");
  });

  it("commits a parsed value, exits edit mode", () => {
    const { result } = renderHook(() =>
      useDimensionDraft({ initialMm: 1200, system: "si", format: "mm" }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.setDraft("500"));
    let outcome: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      outcome = result.current.commit();
    });
    expect(outcome).toEqual({ ok: true, mm: 500, preserved: false });
    expect(result.current.editing).toBe(false);
  });

  it("precision-preserves when typed value rounds back to original mm", () => {
    // 305.5625 mm → "12-1/32\"" is below 1/16 rounding; we use 306.3875 as
    // the canonical "12-1/16\"" stored mm. Typing "12-1/16\"" parses back
    // to exactly the same mm — the hook still returns preserved=true to
    // signal "no real change."
    const initialMm = 306.3875;
    const { result } = renderHook(() =>
      useDimensionDraft({ initialMm, system: "ip", format: "in-frac" }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.setDraft('12-1/16"'));
    let outcome: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      outcome = result.current.commit();
    });
    expect(outcome).toEqual({ ok: true, mm: initialMm, preserved: true });
  });

  it("returns parse error and stays editing on malformed input", () => {
    const { result } = renderHook(() =>
      useDimensionDraft({ initialMm: 1200, system: "si", format: "mm" }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.setDraft("abc"));
    let outcome: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      outcome = result.current.commit();
    });
    expect(outcome && (outcome as { ok: boolean }).ok).toBe(false);
    expect(result.current.editing).toBe(true);
    expect(result.current.error).toMatch(/Couldn't parse/);
  });

  it("cancel reverts draft and exits edit mode", () => {
    const { result } = renderHook(() =>
      useDimensionDraft({ initialMm: 1200, system: "si", format: "mm" }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.setDraft("nonsense"));
    act(() => result.current.cancel());
    expect(result.current.editing).toBe(false);
    expect(result.current.draft).toBe("1200.0");
    expect(result.current.error).toBeNull();
  });
});
