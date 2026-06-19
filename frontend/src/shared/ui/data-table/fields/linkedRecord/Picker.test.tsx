import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { LinkedRecordPicker, type LinkedRecordPickerCandidate } from "./Picker";

const CANDIDATES: LinkedRecordPickerCandidate[] = [
  { rowId: "pmp_a", recordId: "PUMP-1", displayName: "Basement loop" },
  { rowId: "pmp_b", recordId: "PUMP-2", displayName: "Second floor" },
  { rowId: "pmp_c", recordId: null, displayName: null },
];

describe("LinkedRecordPicker", () => {
  test("renders nothing when closed", () => {
    const { container } = render(
      <LinkedRecordPicker
        open={false}
        mode="single"
        selectedIds={[]}
        candidates={CANDIDATES}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("filters candidates by case-insensitive substring on record_id", () => {
    render(
      <LinkedRecordPicker
        open
        mode="multi"
        selectedIds={[]}
        candidates={CANDIDATES}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search records"), {
      target: { value: "pump-1" },
    });
    expect(screen.getByText("PUMP-1")).toBeInTheDocument();
    expect(screen.queryByText("PUMP-2")).toBeNull();
  });

  test("falls back to row id when record_id is empty (PRD Q18)", () => {
    render(
      <LinkedRecordPicker
        open
        mode="single"
        selectedIds={[]}
        candidates={CANDIDATES}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("pmp_c")).toBeInTheDocument();
  });

  test("single-mode confirm writes a one-id selection", () => {
    const onConfirm = vi.fn();
    render(
      <LinkedRecordPicker
        open
        mode="single"
        selectedIds={[]}
        candidates={CANDIDATES}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Link PUMP-1"));
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith(["pmp_a"]);
  });

  test("multi-mode confirm writes the full selection set", () => {
    const onConfirm = vi.fn();
    render(
      <LinkedRecordPicker
        open
        mode="multi"
        selectedIds={["pmp_a"]}
        candidates={CANDIDATES}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Link PUMP-2"));
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith(["pmp_a", "pmp_b"]);
  });

  test("Cancel drops draft changes and calls onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <LinkedRecordPicker
        open
        mode="multi"
        selectedIds={[]}
        candidates={CANDIDATES}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByLabelText("Link PUMP-1"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("Escape cancels the picker", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <LinkedRecordPicker
        open
        mode="multi"
        selectedIds={[]}
        candidates={CANDIDATES}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Search records"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("flags the list as virtualized past 100 candidates", () => {
    const many: LinkedRecordPickerCandidate[] = Array.from({ length: 150 }, (_, i) => ({
      rowId: `pmp_${i}`,
      recordId: `PUMP-${i.toString().padStart(3, "0")}`,
      displayName: null,
    }));
    render(
      <LinkedRecordPicker
        open
        mode="multi"
        selectedIds={[]}
        candidates={many}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("listbox").getAttribute("data-virtualized")).toBe("true");
  });

  // §A4 regression: previously the reset effect ran on every parent
  // re-render that allocated a new `selectedIds` array reference,
  // wiping the user's draft mid-edit. The fix gates the reset on the
  // closed → open transition. This test re-renders with a freshly
  // allocated identical array AFTER the user toggled a candidate and
  // asserts the draft survives.
  test("draft survives parent re-renders with a new selectedIds array identity", () => {
    function Harness() {
      // Allocate a new array on every render so the dep changes by
      // reference but not by value — the exact race the fix targets.
      return (
        <LinkedRecordPicker
          open
          mode="multi"
          selectedIds={[]}
          candidates={CANDIDATES}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    }
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Link PUMP-1/ }));
    expect(
      (screen.getByRole("checkbox", { name: /Link PUMP-1/ }) as HTMLInputElement).checked,
    ).toBe(true);
    rerender(<Harness />);
    expect(
      (screen.getByRole("checkbox", { name: /Link PUMP-1/ }) as HTMLInputElement).checked,
    ).toBe(true);
  });
});
