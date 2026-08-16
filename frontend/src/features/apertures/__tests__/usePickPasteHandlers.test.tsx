import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePickPasteHandlers } from "../hooks/usePickPasteHandlers";
import { useApertureBuilderStore } from "../store/builder-store";
import type { ApertureElement } from "../types";
import { apertureElement } from "./aperture-ui-test-fixtures";

const noInstalls = { top: null, right: null, bottom: null, left: null };
const frames = { top: null, right: null, bottom: null, left: null };

const element = (overrides: Partial<ApertureElement> = {}) =>
  apertureElement({ id: "target", name: "Target", frames, ...overrides });

beforeEach(() => {
  useApertureBuilderStore.setState({
    pickPasteMode: "idle",
    pickedAssignment: null,
    undoStacksByAperture: {},
  });
});

describe("usePickPasteHandlers", () => {
  it("does not capture or paste onto an Empty element", async () => {
    const onPasteAssignment = vi.fn();
    const { result } = renderHook(() =>
      usePickPasteHandlers({ apertureId: "apt_1", onPasteAssignment }),
    );

    act(() => result.current.handleEyedropper());
    act(() => result.current.capturePickFromElement(element({ kind: "void" })));
    expect(useApertureBuilderStore.getState().pickPasteMode).toBe("picking");

    act(() => {
      useApertureBuilderStore.setState({
        pickPasteMode: "pasting",
        pickedAssignment: {
          source_element_id: "source",
          source_element_kind: "glazed",
          frames,
          glazing: null,
          operation: null,
        },
      });
    });

    await act(async () => result.current.pasteOnto(element({ kind: "void" })));
    expect(onPasteAssignment).not.toHaveBeenCalled();
    expect(useApertureBuilderStore.getState().undoStacksByAperture["apt_1"]).toBeUndefined();
  });

  it("catches a rejected undo command", async () => {
    const onRestoreAssignment = vi.fn().mockRejectedValue(new Error("void_element_assignment"));
    useApertureBuilderStore.getState().pushUndoEntry("apt_1", {
      target_element_id: "target",
      prior: { frames, glazing_id: null, operation: null, installs: noInstalls },
    });
    const { result } = renderHook(() =>
      usePickPasteHandlers({ apertureId: "apt_1", onRestoreAssignment }),
    );

    await expect(act(async () => result.current.undoLastPaste())).resolves.toBeUndefined();
    expect(onRestoreAssignment).toHaveBeenCalledTimes(1);
    expect(useApertureBuilderStore.getState().undoStacksByAperture["apt_1"]).toHaveLength(1);
  });

  it("restores the prior assignment through the dedicated undo callback", async () => {
    const onRestoreAssignment = vi.fn().mockResolvedValue(true);
    const prior = {
      frames: { top: "pfrm_top", right: null, bottom: null, left: null },
      installs: { top: null, right: null, bottom: null, left: null },
      glazing_id: "pglz_original",
      operation: { type: "swing" as const, directions: ["left" as const] },
    };
    useApertureBuilderStore.getState().pushUndoEntry("apt_1", {
      target_element_id: "target",
      prior,
    });
    const { result } = renderHook(() =>
      usePickPasteHandlers({ apertureId: "apt_1", onRestoreAssignment }),
    );

    await act(async () => result.current.undoLastPaste());

    expect(onRestoreAssignment).toHaveBeenCalledWith("target", prior);
    expect(useApertureBuilderStore.getState().undoStacksByAperture["apt_1"]).toEqual([]);
    expect(result.current.flashTargetId).toBe("target");
  });

  it("does not flash or record undo when the route reports paste failure", async () => {
    const onPasteAssignment = vi.fn().mockResolvedValue(false);
    useApertureBuilderStore.setState({
      pickPasteMode: "pasting",
      pickedAssignment: {
        source_element_id: "source",
        source_element_kind: "glazed",
        frames,
        glazing: null,
        operation: null,
      },
    });
    const { result } = renderHook(() =>
      usePickPasteHandlers({ apertureId: "apt_1", onPasteAssignment }),
    );

    await act(async () => result.current.pasteOnto(element()));

    expect(onPasteAssignment).toHaveBeenCalledTimes(1);
    expect(result.current.flashTargetId).toBeNull();
    expect(useApertureBuilderStore.getState().undoStacksByAperture["apt_1"]).toBeUndefined();
  });
});
