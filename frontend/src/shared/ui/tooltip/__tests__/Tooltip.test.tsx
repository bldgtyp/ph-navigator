import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Tooltip } from "../Tooltip";

describe("Tooltip", () => {
  test("portals the visible tooltip and describes the trigger only while open", () => {
    render(
      <Tooltip content="Shared tooltip content" placement="bottom">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger).not.toHaveAttribute("aria-describedby");

    fireEvent.focus(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Shared tooltip content");
    expect(portalRoot(tooltip)?.parentElement).toBe(document.body);
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);

    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  test("preserves existing described-by ids while the tooltip is open", () => {
    render(
      <>
        <p id="existing-help">Existing help text</p>
        <Tooltip content="Tooltip help" placement="bottom">
          <button type="button" aria-describedby="existing-help">
            Trigger
          </button>
        </Tooltip>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.focus(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(trigger).toHaveAttribute("aria-describedby", `existing-help ${tooltip.id}`);
  });

  test("stays open while either hover or focus is still active", () => {
    render(
      <Tooltip content="Persistent tooltip" placement="bottom">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.focus(trigger);
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Persistent tooltip");

    fireEvent.mouseLeave(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Persistent tooltip");

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("stays open while hovered after focus leaves", () => {
    render(
      <Tooltip content="Persistent tooltip" placement="bottom">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.mouseEnter(trigger);
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Persistent tooltip");

    fireEvent.blur(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Persistent tooltip");

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("delays a hover-only tooltip when requested", () => {
    vi.useFakeTimers();
    try {
      render(
        <Tooltip content="Delayed tooltip" hoverDelay={300}>
          <button type="button">Trigger</button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(300));
      expect(screen.getByRole("tooltip")).toHaveTextContent("Delayed tooltip");
    } finally {
      vi.useRealTimers();
    }
  });
});

function portalRoot(element: HTMLElement): HTMLElement | null {
  return element.closest("[data-radix-popper-content-wrapper]");
}
