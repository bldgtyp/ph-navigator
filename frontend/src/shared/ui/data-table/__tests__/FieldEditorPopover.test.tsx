import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
  type WriteOp,
} from "../types";

type Row = { id: string; number: string; floor: string | null };

const baseRows: Row[] = [
  { id: "rm_1", number: "101", floor: "opt_ground" },
  { id: "rm_2", number: "102", floor: "opt_ground" },
  { id: "rm_3", number: "103", floor: "opt_first" },
];

function baseFieldDefs(): FieldDef[] {
  return [
    { field_key: "number", field_type: "text", display_name: "Number" },
    {
      field_key: "floor",
      field_type: "single_select",
      display_name: "Floor",
      options: [
        { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
        { id: "opt_first", label: "1st", color: "#10b981", order: 1 },
        { id: "opt_roof", label: "Roof", color: "#a16207", order: 2 },
      ],
    },
  ];
}

const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
];

function Harness({
  onWrite,
  fieldDefsSeed,
}: {
  onWrite: (op: WriteOp) => void | Promise<void>;
  fieldDefsSeed?: FieldDef[];
}) {
  const [view, setView] = useState<ViewState>(emptyViewState());
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>(fieldDefsSeed ?? baseFieldDefs());
  return (
    <DataTable<Row>
      rows={baseRows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columnDefs}
      view={view}
      onViewChange={setView}
      emptyMessage="No rows."
      onWrite={(op) => {
        onWrite(op);
        if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
          const { after } = op;
          setFieldDefs((prev) =>
            prev.map((def) => (def.field_key === after.field_key ? after : def)),
          );
        }
      }}
    />
  );
}

function openEditor() {
  const header = screen.getByRole("columnheader", { name: /Floor/ });
  fireEvent.doubleClick(header);
}

function popoverContent(): HTMLElement {
  return screen.getByRole("dialog", { name: /Edit Floor options/ });
}

describe("FieldEditorPopover", () => {
  test("renders one row per option in order, with the field name as heading", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    const content = popoverContent();
    expect(within(content).getByText("Floor")).toBeInTheDocument();
    const labelInputs = within(content).getAllByRole("textbox");
    expect(labelInputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      "Ground",
      "1st",
      "Roof",
    ]);
  });

  test("editing a label, then Save, dispatches schemaMutation with the new label", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(inputs[1]!, { target: { value: "First Floor" } });
    const save = within(popoverContent()).getByRole("button", { name: "Save" });
    expect(save).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(save);
    });
    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    expect(op.kind).toBe("schemaMutation");
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      const after = op.after.options ?? [];
      expect(after.find((o) => o.id === "opt_first")?.label).toBe("First Floor");
      // No cellWrites for a pure rename.
      expect(op.cellWrites).toBeUndefined();
    }
  });

  test("Save is disabled when the draft is identical to the source", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    const save = within(popoverContent()).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
  });

  test("duplicate labels block Save and show an inline warning", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(inputs[0]!, { target: { value: "1st" } });
    const save = within(popoverContent()).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    expect(within(popoverContent()).getByText("Option labels must be unique.")).toBeInTheDocument();
    // Restoring the label re-enables Save.
    fireEvent.change(inputs[0]!, { target: { value: "Ground Level" } });
    expect(save).not.toBeDisabled();
  });

  test("Add option appends an empty draft option and focuses its label input", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    const addButton = within(popoverContent()).getByRole("button", { name: "⊕ Add option" });
    fireEvent.click(addButton);
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs).toHaveLength(4);
    expect(inputs[3]!.value).toBe("");
    expect(document.activeElement).toBe(inputs[3]);
  });

  test("Empty label blocks Save even with no duplicates", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    const addButton = within(popoverContent()).getByRole("button", { name: "⊕ Add option" });
    fireEvent.click(addButton);
    const save = within(popoverContent()).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    expect(within(popoverContent()).getByText("Every option needs a label.")).toBeInTheDocument();
  });

  test("Alphabetize reorders the draft case-insensitively", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    fireEvent.click(within(popoverContent()).getByRole("button", { name: "↕ Alphabetize" }));
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(["1st", "Ground", "Roof"]);
    await act(async () => {
      fireEvent.click(within(popoverContent()).getByRole("button", { name: "Save" }));
    });
    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      const after = op.after.options ?? [];
      expect(after.map((o) => o.label)).toEqual(["1st", "Ground", "Roof"]);
      expect(after.map((o) => o.order)).toEqual([0, 1, 2]);
    }
  });

  test("Color-code options toggle off persists on the dispatched op", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    const toggle = within(popoverContent()).getByRole("checkbox", {
      name: /Color-code options/,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    await act(async () => {
      fireEvent.click(within(popoverContent()).getByRole("button", { name: "Save" }));
    });
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      expect(op.after.colorCodeOptions).toBe(false);
      const beforeColor = op.before.colorCodeOptions;
      expect(beforeColor === undefined || beforeColor === true).toBe(true);
    }
  });

  test("Delete with no references removes the row immediately and Save dispatches without cellWrites", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    // Roof is not referenced by any row.
    const deleteBtn = within(popoverContent()).getByRole("button", {
      name: /Delete option Roof/,
    });
    fireEvent.click(deleteBtn);
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(["Ground", "1st"]);
    await act(async () => {
      fireEvent.click(within(popoverContent()).getByRole("button", { name: "Save" }));
    });
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      const after = op.after.options ?? [];
      expect(after.find((o) => o.id === "opt_roof")).toBeUndefined();
      expect(op.cellWrites).toBeUndefined();
    }
  });

  test("Delete with references opens the cascade sub-dialog (Clear path)", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    const deleteBtn = within(popoverContent()).getByRole("button", {
      name: /Delete option Ground/,
    });
    fireEvent.click(deleteBtn);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/2 rows currently reference/)).toBeInTheDocument();
    // Default for non-required field is Clear.
    const clearRadio = within(dialog).getByRole("radio", { name: /Clear referenced cells/ });
    expect(clearRadio).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    // Dialog closes; row removed from draft.
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(["1st", "Roof"]);
    await act(async () => {
      fireEvent.click(within(popoverContent()).getByRole("button", { name: "Save" }));
    });
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    expect(op.kind).toBe("schemaMutation");
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      const cellWrites = op.cellWrites ?? [];
      expect(cellWrites).toHaveLength(2);
      expect(cellWrites.every((w) => w.value === null && w.fieldKey === "floor")).toBe(true);
      expect(new Set(cellWrites.map((w) => w.rowId))).toEqual(new Set(["rm_1", "rm_2"]));
    }
  });

  test("Delete with references — Replace with… dispatches per-row target values", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    fireEvent.click(within(popoverContent()).getByRole("button", { name: /Delete option Ground/ }));
    const dialog = screen.getByRole("alertdialog");
    const replaceRadio = within(dialog).getByRole("radio", { name: /Replace with:/ });
    fireEvent.click(replaceRadio);
    const select = within(dialog).getByRole("combobox", { name: /Replacement option/ });
    fireEvent.change(select, { target: { value: "opt_roof" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await act(async () => {
      fireEvent.click(within(popoverContent()).getByRole("button", { name: "Save" }));
    });
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      const cellWrites = op.cellWrites ?? [];
      expect(cellWrites).toHaveLength(2);
      expect(cellWrites.every((w) => w.value === "opt_roof")).toBe(true);
    }
  });

  test("required field disables Clear and requires a replacement", () => {
    const required: FieldDef[] = baseFieldDefs().map((def) =>
      def.field_key === "floor" ? { ...def, required: true } : def,
    );
    render(<Harness onWrite={vi.fn()} fieldDefsSeed={required} />);
    openEditor();
    fireEvent.click(within(popoverContent()).getByRole("button", { name: /Delete option Ground/ }));
    const dialog = screen.getByRole("alertdialog");
    const clearRadio = within(dialog).getByRole("radio", { name: /Clear referenced cells/ });
    expect(clearRadio).toBeDisabled();
    expect(
      within(dialog).getByText(/Floor is required — pick a replacement option\./),
    ).toBeInTheDocument();
    // The default Replace-with is the first available (1st). Confirm
    // is enabled because a replacement is already picked.
    const confirm = within(dialog).getByRole("button", { name: "Delete" });
    expect(confirm).not.toBeDisabled();
  });

  test("Cancel on the cascade sub-dialog leaves the option in the draft", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    fireEvent.click(within(popoverContent()).getByRole("button", { name: /Delete option Ground/ }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(["Ground", "1st", "Roof"]);
  });

  test("inverse cellWrites carry the original per-row values", async () => {
    const onWrite = vi.fn();
    render(<Harness onWrite={onWrite} />);
    openEditor();
    fireEvent.click(within(popoverContent()).getByRole("button", { name: /Delete option Ground/ }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await act(async () => {
      fireEvent.click(within(popoverContent()).getByRole("button", { name: "Save" }));
    });
    // We assert the forward op was dispatched; the inverse rides
    // through `dispatchWrite` privately. Verify via reducer-level
    // tests (useGridWriteReducer.test.ts) — here we sanity-check that
    // the forward arrived with the expected shape.
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind === "schemaMutation" && op.variant === "legacyOptions") {
      expect(op.cellWrites).toBeDefined();
      expect(op.cellWrites?.length).toBe(2);
    }
  });

  test("Cancel discards the draft and closes the popover", () => {
    render(<Harness onWrite={vi.fn()} />);
    openEditor();
    const inputs = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(inputs[0]!, { target: { value: "Changed" } });
    fireEvent.click(within(popoverContent()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: /Edit Floor options/ })).toBeNull();
    // Reopen — original label is restored.
    openEditor();
    const reopened = within(popoverContent()).getAllByRole("textbox") as HTMLInputElement[];
    expect(reopened[0]!.value).toBe("Ground");
  });
});
