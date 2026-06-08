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
    const pill = screen.getByText("pmp_a");
    expect(pill.closest("button")?.dataset.fallback).toBe("true");
  });

  test("forwards pill clicks to onPillClick with the row id (PRD Q19)", () => {
    const onPillClick = vi.fn();
    render(
      <LinkedRecordCell
        ids={["pmp_a"]}
        resolve={makeResolver({ pmp_a: "PUMP-1" })}
        onPillClick={onPillClick}
      />,
    );
    fireEvent.click(screen.getByText("PUMP-1"));
    expect(onPillClick).toHaveBeenCalledWith("pmp_a");
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

  test("disables pills when no interaction handler is provided (viewer mode)", () => {
    render(<LinkedRecordCell ids={["pmp_a"]} resolve={makeResolver({ pmp_a: "PUMP-1" })} />);
    const button = screen.getByText("PUMP-1").closest("button");
    expect(button).toBeDisabled();
  });
});
