import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { LinkedRecordCell, type LinkedRecordPillResolver } from "./LinkedRecordCell";

function makeResolver(map: Record<string, string | null>): LinkedRecordPillResolver {
  return (rowId) => {
    if (!(rowId in map)) return null;
    return { recordId: map[rowId] ?? null };
  };
}

describe("LinkedRecordCell", () => {
  test("renders an empty-state caption when ids is empty", () => {
    render(<LinkedRecordCell ids={[]} resolve={() => null} />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  test("renders a pill per id using the resolver's record_id", () => {
    render(
      <LinkedRecordCell
        ids={["pmp_a", "pmp_b"]}
        resolve={makeResolver({ pmp_a: "PUMP-1", pmp_b: "PUMP-2" })}
      />,
    );
    expect(screen.getByText("PUMP-1")).toBeInTheDocument();
    expect(screen.getByText("PUMP-2")).toBeInTheDocument();
  });

  test("falls back to the row id when record_id is empty/null (PRD Q18)", () => {
    render(<LinkedRecordCell ids={["pmp_a"]} resolve={makeResolver({ pmp_a: null })} />);
    // No interaction handler → inert <span> pill; data-fallback lives
    // on the chip element wrapping the label.
    const label = screen.getByText("pmp_a");
    const chip = label.closest("[data-row-id]") as HTMLElement | null;
    expect(chip).not.toBeNull();
    expect(chip?.dataset.fallback).toBe("true");
  });

  test("forwards pill clicks to onPillClick only when isActive (Airtable parity)", () => {
    const onPillClick = vi.fn();
    const { rerender } = render(
      <LinkedRecordCell
        ids={["pmp_a"]}
        resolve={makeResolver({ pmp_a: "PUMP-1" })}
        onPillClick={onPillClick}
      />,
    );
    // Inactive cell: the click bubbles so the cell activates instead.
    fireEvent.click(screen.getByText("PUMP-1"));
    expect(onPillClick).not.toHaveBeenCalled();

    rerender(
      <LinkedRecordCell
        ids={["pmp_a"]}
        resolve={makeResolver({ pmp_a: "PUMP-1" })}
        onPillClick={onPillClick}
        isActive
      />,
    );
    fireEvent.click(screen.getByText("PUMP-1"));
    expect(onPillClick).toHaveBeenCalledWith("pmp_a");
  });

  test("renders an inline x button on each pill when isActive (PRD Q19 follow-up)", () => {
    const onPillUnlink = vi.fn();
    render(
      <LinkedRecordCell
        ids={["pmp_a", "pmp_b"]}
        resolve={makeResolver({ pmp_a: "PUMP-1", pmp_b: "PUMP-2" })}
        onPillUnlink={onPillUnlink}
        isActive
      />,
    );
    const unlinkButtons = screen.getAllByRole("button", { name: "Unlink record" });
    expect(unlinkButtons).toHaveLength(2);
    fireEvent.click(unlinkButtons[0]);
    expect(onPillUnlink).toHaveBeenCalledWith("pmp_a");
  });

  test("does not render x buttons when inactive", () => {
    render(
      <LinkedRecordCell
        ids={["pmp_a"]}
        resolve={makeResolver({ pmp_a: "PUMP-1" })}
        onPillUnlink={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Unlink record" })).toBeNull();
  });

  test("Backspace on a focused pill calls onPillUnlink", () => {
    const onPillUnlink = vi.fn();
    render(
      <LinkedRecordCell
        ids={["pmp_a"]}
        resolve={makeResolver({ pmp_a: "PUMP-1" })}
        onPillUnlink={onPillUnlink}
      />,
    );
    fireEvent.keyDown(screen.getByText("PUMP-1"), { key: "Backspace" });
    expect(onPillUnlink).toHaveBeenCalledWith("pmp_a");
  });

  test("renders pills as inert <span>s when no interaction handler is provided", () => {
    // Inert pills let click events bubble up so the cell-level handler
    // (which opens the linked-record picker) still fires. A disabled
    // <button> would swallow the click and surface a `not-allowed`
    // cursor on the chip.
    render(<LinkedRecordCell ids={["pmp_a"]} resolve={makeResolver({ pmp_a: "PUMP-1" })} />);
    const pill = screen.getByText("PUMP-1");
    expect(pill.tagName).toBe("SPAN");
    expect(pill.closest("button")).toBeNull();
  });
});
