import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AutocompleteSelect } from "../AutocompleteSelect";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AutocompleteSelect", () => {
  test("delays portaled listbox measurement until the parent popover has settled", async () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    render(
      <AutocompleteSelect
        aria-label="Sort field"
        value="name"
        compact
        listboxPlacement="portal"
        options={[
          { value: "name", label: "Name" },
          { value: "people", label: "People" },
        ]}
        onChange={vi.fn()}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Sort field" });
    combobox.getBoundingClientRect = vi.fn(() => rect({ left: 220, top: 250, width: 180 }));

    fireEvent.focus(combobox);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveStyle({ opacity: "0", pointerEvents: "none" });
    expect(combobox.getBoundingClientRect).not.toHaveBeenCalled();

    await flushNextAnimationFrame(animationFrames);
    expect(combobox.getBoundingClientRect).not.toHaveBeenCalled();

    await flushNextAnimationFrame(animationFrames);
    expect(combobox.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(listbox).toHaveStyle({
      position: "fixed",
      top: "286px",
      left: "220px",
      width: "180px",
    });
    expect(listbox).not.toHaveStyle({ opacity: "0", pointerEvents: "none" });
  });
});

async function flushNextAnimationFrame(animationFrames: FrameRequestCallback[]): Promise<void> {
  const callback = animationFrames.shift();
  if (!callback) throw new Error("Expected a queued animation frame");
  await act(async () => {
    callback(performance.now());
  });
}

function rect({
  left,
  top,
  width,
  height = 32,
}: {
  left: number;
  top: number;
  width: number;
  height?: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}
