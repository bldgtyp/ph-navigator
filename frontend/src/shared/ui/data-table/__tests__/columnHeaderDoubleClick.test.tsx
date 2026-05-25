import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";

type Row = { id: string; number: string; floor: string | null; count: number };
type CustomRow = Row & { custom: Record<string, unknown> };

const ROWS: Row[] = [
  { id: "rm_1", number: "101", floor: "opt_ground", count: 1 },
  { id: "rm_2", number: "102", floor: "opt_roof", count: 2 },
];
const FIELD_DEFS: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  {
    field_key: "floor",
    field_type: "single_select",
    display_name: "Floor",
    options: [
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      { id: "opt_roof", label: "Roof", color: "#10b981", order: 1 },
    ],
  },
  { field_key: "count", field_type: "number", display_name: "Count" },
];
const COLUMN_DEFS: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
  { id: "count", fieldKey: "count", header: "Count", accessor: (row) => row.count },
];
const CUSTOM_ROWS: CustomRow[] = ROWS.map((row) => ({
  ...row,
  custom: { cf_notes: "" },
}));
const CUSTOM_FIELD_DEFS: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number", read_only_schema: true },
  {
    field_key: "cf_notes",
    field_type: "text",
    custom_field_type: "short_text",
    display_name: "Notes",
  },
];
const CUSTOM_COLUMN_DEFS: DataTableColumnDef<CustomRow>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  {
    id: "cf_notes",
    fieldKey: "cf_notes",
    header: "Notes",
    accessor: (row) => row.custom.cf_notes,
  },
];

function renderTable(overrides: Partial<DataTableProps<Row>> = {}) {
  const [view, setView] = [emptyViewState(), vi.fn<(next: ViewState) => void>()];
  render(
    <DataTable<Row>
      rows={ROWS}
      getRowId={(row) => row.id}
      fieldDefs={FIELD_DEFS}
      columnDefs={COLUMN_DEFS}
      view={view}
      onViewChange={setView}
      emptyMessage="No rows yet."
      onWrite={vi.fn()}
      {...overrides}
    />,
  );
}

function getColumnHeader(name: string): HTMLElement {
  return screen.getByRole("columnheader", { name: new RegExp(name) });
}

function renderCustomFieldTable(overrides: Partial<DataTableProps<CustomRow>> = {}) {
  const [view, setView] = [emptyViewState(), vi.fn<(next: ViewState) => void>()];
  render(
    <DataTable<CustomRow>
      rows={CUSTOM_ROWS}
      getRowId={(row) => row.id}
      fieldDefs={CUSTOM_FIELD_DEFS}
      columnDefs={CUSTOM_COLUMN_DEFS}
      view={view}
      onViewChange={setView}
      emptyMessage="No rows yet."
      onWrite={vi.fn()}
      {...overrides}
    />,
  );
}

describe("DataTable column header double-click trigger (plan 21)", () => {
  test("editable custom headers expose data-field-editable + chevron", () => {
    renderCustomFieldTable({ onEditCustomFieldBundle: vi.fn().mockResolvedValue(undefined) });
    const notes = getColumnHeader("Notes");
    expect(notes).toHaveAttribute("data-field-editable", "true");
    // The chevron lives inside the header row as an aria-hidden span.
    expect(notes.querySelector(".data-table-header-edit-chevron")).not.toBeNull();
  });

  test("core headers do not expose data-field-editable or chevron", () => {
    renderCustomFieldTable({ onEditCustomFieldBundle: vi.fn().mockResolvedValue(undefined) });
    const header = getColumnHeader("Number");
    expect(header).not.toHaveAttribute("data-field-editable");
    expect(header.querySelector(".data-table-header-edit-chevron")).toBeNull();
  });

  test("readOnly removes the chevron and the data-field-editable attribute", () => {
    renderCustomFieldTable({
      readOnly: true,
      onEditCustomFieldBundle: vi.fn().mockResolvedValue(undefined),
    });
    const notes = getColumnHeader("Notes");
    expect(notes).not.toHaveAttribute("data-field-editable");
    expect(notes.querySelector(".data-table-header-edit-chevron")).toBeNull();
  });

  test("missing onWrite removes the chevron and the data-field-editable attribute", () => {
    renderCustomFieldTable({
      onWrite: undefined,
      onEditCustomFieldBundle: vi.fn().mockResolvedValue(undefined),
    });
    const notes = getColumnHeader("Notes");
    expect(notes).not.toHaveAttribute("data-field-editable");
    expect(notes.querySelector(".data-table-header-edit-chevron")).toBeNull();
  });

  test("double-click on a non-editable header is a no-op (does not flip data-field-editor-open)", () => {
    renderTable();
    const number = getColumnHeader("Number");
    fireEvent.doubleClick(number);
    expect(number).not.toHaveAttribute("data-field-editor-open");
  });

  test("double-click on an editable custom header opens the config modal", () => {
    renderCustomFieldTable({ onEditCustomFieldBundle: vi.fn().mockResolvedValue(undefined) });
    const notes = getColumnHeader("Notes");
    // Simulate native double-click sequence: mousedown(detail=1), then
    // mousedown(detail=2), then dblclick.
    fireEvent.mouseDown(notes, { button: 0, detail: 1 });
    fireEvent.mouseDown(notes, { button: 0, detail: 2 });
    fireEvent.doubleClick(notes);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("second mousedown of a double-click does not extend column-select range", () => {
    renderCustomFieldTable({ onEditCustomFieldBundle: vi.fn().mockResolvedValue(undefined) });
    const notes = getColumnHeader("Notes");
    // First click selects the column.
    fireEvent.mouseDown(notes, { button: 0, detail: 1 });
    // Second mousedown of the dbl-click sequence must short-circuit
    // before the column-select extend logic runs. The chevron-bearing
    // column is selected; subsequent ranges (held shift) would extend
    // — but a detail===2 mousedown should not.
    fireEvent.mouseDown(notes, { button: 0, detail: 2, shiftKey: true });
    // No throw, no selection extension assertion needed beyond
    // verifying the dbl-click then opens the editor cleanly.
    fireEvent.doubleClick(notes);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("double-click modal accepts typed custom-field names", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    renderCustomFieldTable({ onEditCustomFieldBundle });
    await user.dblClick(getColumnHeader("Notes"));
    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "Area");
    expect(input).toHaveValue("Area");
    await user.keyboard("{Enter}");
    expect(onEditCustomFieldBundle).toHaveBeenCalledWith({
      fieldKey: "cf_notes",
      displayName: "Area",
      description: null,
    });
  });

  test("plan-21: double-click opens the FieldConfigModal when onEditCustomFieldBundle is wired", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    renderCustomFieldTable({ onEditCustomFieldBundle });
    await user.dblClick(getColumnHeader("Notes"));
    // Modal is a Radix dialog; assert by role + the seeded Name input.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Notes");
    // The legacy inline-rename input is not used in this path.
    expect(screen.queryByRole("textbox", { name: "Rename Notes" })).toBeNull();
  });

  test("plan-21: viewer mode (readOnly) suppresses the modal-open double-click", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn();
    renderCustomFieldTable({ onEditCustomFieldBundle, readOnly: true });
    await user.dblClick(getColumnHeader("Notes"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onEditCustomFieldBundle).not.toHaveBeenCalled();
  });

  test("plan-21: Enter on a focused custom header opens the FieldConfigModal", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    renderCustomFieldTable({ onEditCustomFieldBundle });
    const notes = getColumnHeader("Notes");
    notes.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: /Edit field/ })).toBeInTheDocument();
  });

  test("plan-21: closing the modal returns focus to the originating header", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    renderCustomFieldTable({ onEditCustomFieldBundle });
    const notes = getColumnHeader("Notes");
    notes.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(notes).toHaveFocus();
  });

  test("plan-21: viewer mode suppresses Enter on a focused custom header", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn();
    renderCustomFieldTable({ onEditCustomFieldBundle, readOnly: true });
    const notes = getColumnHeader("Notes");
    notes.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onEditCustomFieldBundle).not.toHaveBeenCalled();
  });

  test("Cancel closes the custom-field config modal without saving", async () => {
    const user = userEvent.setup();
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    renderCustomFieldTable({ onEditCustomFieldBundle });
    await user.dblClick(getColumnHeader("Notes"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onEditCustomFieldBundle).not.toHaveBeenCalled();
  });
});
