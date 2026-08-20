// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useVersionControlsState } from "../hooks/useVersionControlsState";
import { DRAFT_DIFF_TARGET } from "../types/versionControls";

describe("useVersionControlsState diff lifecycle", () => {
  test("resets self-comparisons and restores defaults on close and reopen", () => {
    const { result } = renderHook(() => useVersionControlsState());

    act(() => result.current.openDiff("working"));
    expect(result.current.diffOpen).toBe(true);
    expect(result.current.diffFromVersionId).toBe("working");
    expect(result.current.diffTarget).toBe(DRAFT_DIFF_TARGET);

    act(() => result.current.setDiffTarget("round-1"));
    act(() => result.current.changeDiffFrom("round-1"));
    expect(result.current.diffFromVersionId).toBe("round-1");
    expect(result.current.diffTarget).toBe(DRAFT_DIFF_TARGET);

    act(() => result.current.setDiffTarget("working"));
    act(() => result.current.closeDiff());
    expect(result.current.diffOpen).toBe(false);
    expect(result.current.diffFromVersionId).toBeNull();
    expect(result.current.diffTarget).toBe(DRAFT_DIFF_TARGET);

    act(() => result.current.openDiff("round-2"));
    expect(result.current.diffFromVersionId).toBe("round-2");
    expect(result.current.diffTarget).toBe(DRAFT_DIFF_TARGET);
  });
});
