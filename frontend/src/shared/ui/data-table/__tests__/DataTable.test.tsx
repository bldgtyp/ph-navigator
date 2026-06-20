// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  type BuildEmptyRow,
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";
import { chooseAutocompleteOption } from "./helpers/autocomplete";

type Row = { id: string; number: string; name: string; count: number; color?: string | null };

const rows: Row[] = [{ id: "rm_1", number: "101", name: "Living Room", count: 2 }];
const fieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "count", fieldKey: "count", header: "Count", accessor: (row) => row.count },
];
const buildEmptyRow: BuildEmptyRow<Row> = ({ rowId, fieldDefaults }) => ({
  id: rowId,
  number: String(fieldDefaults.number ?? ""),
  name: String(fieldDefaults.name ?? ""),
  count: Number(fieldDefaults.count ?? 0),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function pasteClipboardData(tsv: string) {
  return {
    clipboardData: { getData: (type: string) => (type === "text/plain" ? tsv : "") },
  };
}

describe("DataTable", () => {
  test("announces that paste is unavailable when no write handler is provided", async () => {
    renderTable();

    fireEvent.paste(screen.getByRole("grid"), pasteClipboardData("102"));

    expect(await screen.findByText("Paste is not enabled for this table yet.")).toBeVisible();
  });

  test("does not paste in read-only mode", () => {
    const onWrite = vi.fn();
    renderTable({ readOnly: true, onWrite });

    fireEvent.paste(screen.getByRole("grid"), pasteClipboardData("102"));

    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.queryByText(/cells pasted/i)).not.toBeInTheDocument();
  });

  test("emits a paste write when a write handler is provided", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.paste(screen.getByRole("grid"), pasteClipboardData("102"));

    expect(await screen.findByText("1 cells pasted.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "paste",
      writes: [{ rowId: "rm_1", fieldKey: "number", value: "102" }],
      rowsInserted: [],
      newOptions: {},
    });
  });

  test("shows filtered empty state separately from source empty state", () => {
    renderTable({
      view: {
        ...emptyViewState(),
        filter: [{ fieldKey: "name", operator: "contains", value: "missing" }],
      },
    });

    expect(screen.getByText("No rows match the current table view.")).toBeVisible();
    expect(screen.queryByText("No rooms yet.")).not.toBeInTheDocument();
  });

  test("builds formula field references from fieldDefs when no registry prop is supplied", async () => {
    render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={[
          ...fieldDefs,
          {
            field_key: "incoming",
            field_type: "linked_record",
            display_name: "Incoming",
            read_only: true,
          },
        ]}
        columnDefs={[
          ...columnDefs,
          {
            id: "incoming",
            fieldKey: "incoming",
            header: "Incoming",
            accessor: () => [],
          },
        ]}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onAddCustomField={vi.fn()}
        emptyMessage="No rooms yet."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const dialog = await screen.findByRole("dialog", { name: "Add field" });
    chooseAutocompleteOption("Field type", "Formula", dialog);

    expect(within(dialog).queryByText("No fields available to reference.")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Text column Number" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Text column Name" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Number column Count" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Incoming/ })).not.toBeInTheDocument();
  });

  test("keeps gutter buttons out of the tab order and renders no per-column sort UI", () => {
    renderTable();

    // Phase 4 §4.9: the per-column sort chevron is gone entirely.
    // Sort is reachable only from the toolbar Sort popover (Step 4).
    expect(screen.queryByRole("button", { name: /Sort by/ })).not.toBeInTheDocument();
    // The header `<th>` no longer carries `aria-sort` either — sort
    // state is a view-state list announced via the live region, not a
    // per-column DOM property.
    const numberHeader = screen
      .getAllByRole("columnheader")
      .find((th) => th.textContent?.includes("Number"));
    expect(numberHeader?.getAttribute("aria-sort")).toBeNull();
    expect(screen.getByRole("button", { name: "Highlight row 1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(
      screen
        .getByRole("button", { name: "Highlight row 1" })
        .compareDocumentPosition(screen.getByRole("checkbox", { name: "Select row 1" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("renders the shared footer add-row button when row insert is enabled", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite, buildEmptyRow });

    const addButton = screen.getByRole("button", { name: "Add row" });
    expect(addButton).toHaveClass("data-table-add-row-button");
    expect(addButton).toHaveTextContent("+");

    fireEvent.click(addButton);

    await screen.findByText("Row inserted.");
    expect(onWrite).toHaveBeenCalledWith({
      kind: "rowInsert",
      rows: [
        {
          rowId: expect.stringMatching(/^tmp_row_/),
          fieldDefaults: { count: 0, name: "", number: "" },
          anchorRowId: null,
        },
      ],
    });
  });

  test("body cells carry data-axis-tint='f' on a column with a contributing filter rule", () => {
    renderTable({
      view: {
        ...emptyViewState(),
        filter: [{ fieldKey: "name", operator: "contains", value: "Liv" }],
      },
    });

    const nameCell = screen.getByText("Living Room").closest("td");
    expect(nameCell).toHaveAttribute("data-axis-tint", "f");
    // Non-filtered columns carry no axis tint.
    const numberCell = screen.getByText("101").closest("td");
    expect(numberCell).not.toHaveAttribute("data-axis-tint");
  });

  test("dormant filter rules (blank value) do NOT tint their column", () => {
    renderTable({
      view: {
        ...emptyViewState(),
        filter: [{ fieldKey: "name", operator: "contains", value: "" }],
      },
    });

    const nameCell = screen.getByText("Living Room").closest("td");
    expect(nameCell).not.toHaveAttribute("data-axis-tint");
  });

  test("body cells carry data-axis-tint='s' on a sorted column", () => {
    renderTable({
      view: {
        ...emptyViewState(),
        sort: [{ fieldKey: "number", direction: "asc" }],
      },
    });

    const numberCell = screen.getByText("101").closest("td");
    expect(numberCell).toHaveAttribute("data-axis-tint", "s");
    expect(numberCell?.parentElement?.querySelectorAll("td")[1]).not.toHaveAttribute(
      "data-axis-tint",
    );
  });

  test("filter + sort on the same column composes to the 'fs' subset code", () => {
    renderTable({
      view: {
        ...emptyViewState(),
        filter: [{ fieldKey: "name", operator: "contains", value: "Liv" }],
        sort: [{ fieldKey: "name", direction: "asc" }],
      },
    });

    const nameCell = screen.getByText("Living Room").closest("td");
    expect(nameCell).toHaveAttribute("data-axis-tint", "fs");
  });

  test("emits a cell write for inline text edits", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Living" }],
    });
  });

  test("skips no-op inline edits", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("coerces cleared inline number edits to null", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("2"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Count updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "count", value: null }],
    });
  });

  test("coerces cleared inline text edits to null", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: null }],
    });
  });

  test("emits a normalized color write from the color editor", async () => {
    const onWrite = vi.fn();
    renderTable({
      onWrite,
      fieldDefsOverride: [{ field_key: "color", field_type: "color", display_name: "Color" }],
      columnDefsOverride: [
        { id: "color", fieldKey: "color", header: "Color", accessor: (row) => row.color },
      ],
      rowsOverride: [{ ...rows[0]!, color: "#111111" }],
    });

    fireEvent.doubleClick(screen.getByText("#111111"));
    const dialog = screen.getByRole("dialog", { name: "Edit color" });
    expect(document.body).toContainElement(dialog);
    expect(dialog.closest("td")).toBeNull();

    fireEvent.pointerDown(screen.getByLabelText("RGB R"));
    expect(screen.getByRole("dialog", { name: "Edit color" })).toBeVisible();
    expect(onWrite).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("RGB R"), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText("RGB G"), { target: { value: "230" } });
    fireEvent.change(screen.getByLabelText("RGB B"), { target: { value: "240" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Color updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "color", value: "#dce6f0" }],
    });
  });

  test("type-to-edit: printable key on active cell opens editor seeded with the typed char", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "K" });

    const editor = screen.getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("K");

    fireEvent.change(editor, { target: { value: "Kitchen" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Kitchen" }],
    });
  });

  test("type-to-edit: printable key after a multi-select edits the anchor cell and clears the range", () => {
    const onWrite = vi.fn();
    renderTable({
      rowsOverride: [
        { id: "rm_1", number: "101", name: "Living Room", count: 2 },
        { id: "rm_2", number: "102", name: "Kitchen", count: 1 },
      ],
      onWrite,
    });

    const grid = screen.getByRole("grid");
    const anchorCell = getBodyCell(0, 1);
    const rangeEndCell = getBodyCell(1, 1);

    fireEvent.click(anchorCell);
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });

    expect(anchorCell).toHaveClass("data-table-cell-active", "data-table-cell-selected");
    expect(rangeEndCell).toHaveClass("data-table-cell-selected");
    expect(rangeEndCell).not.toHaveClass("data-table-cell-active");

    fireEvent.keyDown(grid, { key: "K" });

    const editor = within(anchorCell).getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("K");
    expect(grid.querySelectorAll(".data-table-cell-selected")).toHaveLength(0);
    expect(rangeEndCell).not.toHaveClass("data-table-cell-active");
  });

  test("type-to-edit: printable key on a number cell seeds the typed digit", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const countCell = screen.getByText("2").closest("td") as HTMLElement;
    fireEvent.click(countCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "7" });

    const editor = screen.getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("7");
  });

  test("Backspace on an active nullable cell writes null without opening an editor", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Backspace" });

    expect(await screen.findByText("Name cleared.")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: null }],
    });
  });

  test("Delete on a required cell does not clear the value", async () => {
    const onWrite = vi.fn();
    renderTable({
      onWrite,
      fieldDefsOverride: fieldDefs.map((fieldDef) =>
        fieldDef.field_key === "name" ? { ...fieldDef, required: true } : fieldDef,
      ),
    });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Delete" });

    expect(await screen.findByText("Name requires a value.")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onWrite).not.toHaveBeenCalled();
  });

  test("type-to-edit: ⌘-shortcut keystrokes are not intercepted (⌘C still copies)", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "c", metaKey: true });

    // No editor mounted — ⌘C took the copy path, not the type-to-edit path.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("F2 opens the inline editor with prior value prefilled", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "F2" });

    const editor = screen.getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("Living Room");
  });

  test("Enter opens the inline editor with prior value prefilled (plan 04)", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });

    const editor = screen.getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("Living Room");
  });

  test("Enter on a read-only cell falls through to onRowOpen", () => {
    const onRowOpen = vi.fn();
    const onWrite = vi.fn();
    const readOnlyFieldDefs: FieldDef[] = [
      { field_key: "number", field_type: "text", display_name: "Number", read_only: true },
      ...fieldDefs.slice(1),
    ];
    render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={readOnlyFieldDefs}
        columnDefs={columnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        onRowOpen={onRowOpen}
        emptyMessage="No rooms yet."
      />,
    );

    const numberCell = screen.getByText("101").closest("td") as HTMLElement;
    fireEvent.click(numberCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });

    expect(onRowOpen).toHaveBeenCalledWith(rows[0]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("type-to-edit announces 'read-only' on a read-only column", async () => {
    const readOnlyFieldDefs: FieldDef[] = [
      { field_key: "number", field_type: "text", display_name: "Number", read_only: true },
      ...fieldDefs.slice(1),
    ];
    render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={readOnlyFieldDefs}
        columnDefs={columnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        emptyMessage="No rooms yet."
      />,
    );

    const numberCell = screen.getByText("101").closest("td") as HTMLElement;
    fireEvent.click(numberCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "K" });

    expect(await screen.findByText("This cell is read-only.")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("type-to-edit on single-select cell opens popover with the typed char in the search input (plan 05)", () => {
    const onWrite = vi.fn();
    const selectFieldDefs: FieldDef[] = [
      {
        field_key: "floor",
        field_type: "single_select",
        display_name: "Floor",
        options: [
          { id: "opt_basement", label: "Basement", color: "#3b82f6", order: 0 },
          { id: "opt_ground", label: "Ground", color: "#10b981", order: 1 },
        ],
      },
    ];
    const selectColumnDefs: DataTableColumnDef<{ id: string; floor: string }>[] = [
      { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
    ];
    render(
      <DataTable
        rows={[{ id: "rm_1", floor: "opt_ground" }]}
        getRowId={(row) => row.id}
        fieldDefs={selectFieldDefs}
        columnDefs={selectColumnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rooms yet."
      />,
    );

    // Active cell defaults to row 0 / col 0 (the only cell).
    fireEvent.keyDown(screen.getByRole("grid"), { key: "B" });

    const search = screen.getByRole("textbox", { name: "Search options" }) as HTMLInputElement;
    expect(search.value).toBe("B");
    // List is filtered to options matching "B" — Basement is in,
    // Ground is out. Scope to the listbox so the popover anchor's
    // copy of the cell label (still mounted underneath) doesn't show
    // up as a false positive for "Ground".
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Basement")).toBeInTheDocument();
    expect(within(listbox).queryByText("Ground")).toBeNull();
  });

  test("Space on a single-select cell opens popover with the current option highlighted (plan 05)", () => {
    const onWrite = vi.fn();
    const selectFieldDefs: FieldDef[] = [
      {
        field_key: "floor",
        field_type: "single_select",
        display_name: "Floor",
        options: [
          { id: "opt_basement", label: "Basement", color: "#3b82f6", order: 0 },
          { id: "opt_ground", label: "Ground", color: "#10b981", order: 1 },
        ],
      },
    ];
    const selectColumnDefs: DataTableColumnDef<{ id: string; floor: string }>[] = [
      { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
    ];
    render(
      <DataTable
        rows={[{ id: "rm_1", floor: "opt_ground" }]}
        getRowId={(row) => row.id}
        fieldDefs={selectFieldDefs}
        columnDefs={selectColumnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rooms yet."
      />,
    );

    fireEvent.keyDown(screen.getByRole("grid"), { key: " " });

    const search = screen.getByRole("textbox", { name: "Search options" }) as HTMLInputElement;
    expect(search.value).toBe("");
    // The current option (Ground) is highlighted; the other is not.
    const listbox = screen.getByRole("listbox");
    const ground = within(listbox).getByText("Ground").closest("[role='option']") as HTMLElement;
    expect(ground.getAttribute("aria-selected")).toBe("true");
  });

  test("Backspace on a nullable single-select cell writes null without opening the popover", async () => {
    const onWrite = vi.fn();
    const selectFieldDefs: FieldDef[] = [
      {
        field_key: "floor",
        field_type: "single_select",
        display_name: "Floor",
        options: [{ id: "opt_ground", label: "Ground", color: "#10b981", order: 0 }],
      },
    ];
    const selectColumnDefs: DataTableColumnDef<{ id: string; floor: string }>[] = [
      { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
    ];
    render(
      <DataTable
        rows={[{ id: "rm_1", floor: "opt_ground" }]}
        getRowId={(row) => row.id}
        fieldDefs={selectFieldDefs}
        columnDefs={selectColumnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rooms yet."
      />,
    );

    fireEvent.keyDown(screen.getByRole("grid"), { key: "Backspace" });
    expect(await screen.findByText("Floor cleared.")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Search options" })).toBeNull();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "floor", value: null }],
    });
  });

  test("commits inline edits on Tab", async () => {
    let resolveWrite: () => void = () => undefined;
    const writePromise = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const onWrite = vi.fn(() => writePromise);
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    fireEvent.keyDown(editor, { key: "Tab" });
    fireEvent.blur(editor);

    expect(onWrite).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveWrite();
      await writePromise;
    });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Living" }],
    });
  });

  test("commits inline edits on Enter and moves the active cell down", async () => {
    let resolveWrite: () => void = () => undefined;
    const writePromise = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const onWrite = vi.fn(() => writePromise);
    renderTable({
      onWrite,
      rowsOverride: [
        { id: "rm_1", number: "101", name: "Living Room", count: 2 },
        { id: "rm_2", number: "102", name: "Kitchen", count: 1 },
      ],
    });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.blur(editor);

    expect(onWrite).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveWrite();
      await writePromise;
    });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Living" }],
    });
    expect(getBodyCell(1, 1)).toHaveClass("data-table-cell-active");
  });

  test("commits inline edits when clicking another cell", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    await user.click(getBodyCell(0, 2));

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Living" }],
    });
  });

  // Plan 06: summary bar at the table bottom drives aggregation picks.
  describe("plan 06 — summary bar", () => {
    const moreRows: Row[] = [
      { id: "rm_1", number: "101", name: "Living", count: 1 },
      { id: "rm_2", number: "102", name: "Kitchen", count: 2 },
      { id: "rm_3", number: "103", name: "Bedroom", count: 3 },
    ];

    test("renders Count: N over the post-filter row set", () => {
      renderTable({ rowsOverride: moreRows });
      const bar = screen.getByTestId("data-table-summary-bar");
      expect(bar).toHaveTextContent("Count");
      expect(bar).toHaveTextContent("3");
    });

    test("Count recomputes when a filter trims the visible set", () => {
      renderTable({
        rowsOverride: moreRows,
        view: {
          ...emptyViewState(),
          filter: [{ fieldKey: "name", operator: "contains", value: "Liv" }],
        },
      });
      const bar = screen.getByTestId("data-table-summary-bar");
      expect(bar).toHaveTextContent("1");
    });

    test("picking Sum on the count column fires onViewChange with the new aggregation", () => {
      const onViewChange = vi.fn();
      renderTable({ rowsOverride: moreRows, onViewChange });
      const bar = screen.getByTestId("data-table-summary-bar");
      const summaryCells = bar.querySelectorAll("td");
      // Index 0 gutter; index 1 = number (first frozen / count cell);
      // index 2 = name; index 3 = count.
      const countSummaryCell = summaryCells[3] as HTMLElement;
      const trigger = countSummaryCell.querySelector("button") as HTMLButtonElement;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("button", { name: "Sum" }));
      expect(onViewChange).toHaveBeenCalledWith(
        expect.objectContaining({ aggregations: { count: "sum" } }),
      );
    });

    test("aggregation persists in the rendered value when set in view-state", () => {
      renderTable({
        rowsOverride: moreRows,
        view: { ...emptyViewState(), aggregations: { count: "sum" } },
      });
      const bar = screen.getByTestId("data-table-summary-bar");
      expect(bar).toHaveTextContent("6.00");
    });
  });

  describe("Plan 07 — Hide fields", () => {
    test("columns listed in view.hiddenColumns do not render in the header", () => {
      renderTable({ view: { ...emptyViewState(), hiddenColumns: ["count"] } });
      const headers = screen.getAllByRole("columnheader").map((th) => th.textContent ?? "");
      expect(headers.some((h) => h.includes("Count"))).toBe(false);
      expect(headers.some((h) => h.includes("Name"))).toBe(true);
    });

    test("primary column stays visible even when listed in hiddenColumns", () => {
      // `number` is the first column — the useGridColumns guard keeps
      // it visible regardless of what hiddenColumns says.
      renderTable({ view: { ...emptyViewState(), hiddenColumns: ["number"] } });
      const headers = screen.getAllByRole("columnheader").map((th) => th.textContent ?? "");
      expect(headers.some((h) => h.includes("Number"))).toBe(true);
    });

    test("toggling a column from the panel emits an onViewChange with the new hiddenColumns", () => {
      const onViewChange = vi.fn();
      renderTable({ onViewChange });
      fireEvent.click(screen.getByRole("button", { name: "Hide fields" }));
      const panel = screen.getByRole("dialog", { name: "Hide or show fields" });
      fireEvent.click(within(panel).getByLabelText("Hide Count"));
      expect(onViewChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ hiddenColumns: ["count"] }),
      );
    });

    test("columnOrder controls header order", () => {
      renderTable({
        view: { ...emptyViewState(), columnOrder: ["number", "count", "name"] },
      });
      const headers = screen
        .getAllByRole("columnheader")
        .map((th) => th.textContent ?? "")
        // drop the gutter header (empty / row-number column)
        .filter((label) => /Number|Name|Count/.test(label));
      expect(headers).toEqual(["Number", "Count", "Name"]);
    });
  });

  describe("Plan 08 — column reorder", () => {
    test("non-primary headers expose the drag-affordance hook (data-draggable)", () => {
      renderTable();
      const primary = screen.getByRole("columnheader", { name: /Number/ });
      const draggable = screen.getByRole("columnheader", { name: /Name/ });
      expect(primary.getAttribute("data-draggable")).toBeNull();
      expect(draggable.getAttribute("data-draggable")).toBe("true");
    });

    test("Space on a focused non-primary header marks it picked up (data-picked-up)", () => {
      renderTable();
      const header = screen.getByRole("columnheader", { name: /Name/ });
      header.focus();
      fireEvent.keyDown(header, { key: " " });
      expect(header.getAttribute("data-picked-up")).toBe("true");
      expect(header.getAttribute("aria-grabbed")).toBe("true");
    });

    test("Space on a focused primary header is ignored", () => {
      renderTable();
      const primary = screen.getByRole("columnheader", { name: /Number/ });
      primary.focus();
      fireEvent.keyDown(primary, { key: " " });
      expect(primary.getAttribute("data-picked-up")).toBeNull();
    });

    test("Space → ArrowRight → Space commits a reorder with the new columnOrder", () => {
      const onViewChange = vi.fn();
      renderTable({ onViewChange });
      const header = screen.getByRole("columnheader", { name: /Name/ });
      header.focus();
      fireEvent.keyDown(header, { key: " " });
      fireEvent.keyDown(header, { key: "ArrowRight" });
      fireEvent.keyDown(header, { key: " " });
      expect(onViewChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ columnOrder: ["number", "count", "name"] }),
      );
    });

    test("Esc during pickup cancels without firing onViewChange", () => {
      const onViewChange = vi.fn();
      renderTable({ onViewChange });
      const header = screen.getByRole("columnheader", { name: /Name/ });
      header.focus();
      fireEvent.keyDown(header, { key: " " });
      fireEvent.keyDown(header, { key: "ArrowRight" });
      fireEvent.keyDown(header, { key: "Escape" });
      expect(header.getAttribute("data-picked-up")).toBeNull();
      expect(onViewChange).not.toHaveBeenCalled();
    });

    test("ArrowLeft cannot move a column before the primary (clamp at index 1)", () => {
      const onViewChange = vi.fn();
      renderTable({ onViewChange });
      const header = screen.getByRole("columnheader", { name: /Name/ }); // visible index 1
      header.focus();
      fireEvent.keyDown(header, { key: " " });
      fireEvent.keyDown(header, { key: "ArrowLeft" });
      fireEvent.keyDown(header, { key: " " });
      // Already at index 1, moves clamped — commit treated as no-op.
      expect(onViewChange).not.toHaveBeenCalled();
    });
  });

  describe("column widths", () => {
    test("every visible <col> renders an explicit pixel width", () => {
      const { container } = renderTable();
      const cols = container.querySelectorAll("colgroup col");
      // 1 gutter col + 3 data columns + 1 tail "+" col
      expect(cols).toHaveLength(5);
      // Data columns (indexes 1, 2, 3) carry explicit width styles; the
      // gutter and tail get their widths from CSS classes.
      for (let i = 1; i <= 3; i++) {
        expect((cols[i] as HTMLElement).style.width).toMatch(/^\d+px$/);
      }
    });

    test("view.columnWidths takes precedence over field-type defaults", () => {
      const { container } = renderTable({
        view: { ...emptyViewState(), columnWidths: { name: 275 } },
      });
      const cols = container.querySelectorAll("colgroup col");
      // index 0 = gutter, 1 = number, 2 = name, 3 = count
      expect((cols[2] as HTMLElement).style.width).toBe("275px");
    });

    test("each visible column header carries a resize handle", () => {
      const { container } = renderTable();
      // 3 visible data columns → 3 handles.
      const handles = container.querySelectorAll("[data-column-resize-handle]");
      expect(handles).toHaveLength(3);
    });
  });

  describe("rowActions extension slot", () => {
    test("invokes the consumer selector at menu-open with the right context", () => {
      const onWrite = vi.fn();
      const rowActions = vi.fn().mockReturnValue([]);
      renderTable({ onWrite, rowActions });
      const cell = getBodyCell(0, 0);
      fireEvent.contextMenu(cell, { clientX: 100, clientY: 50 });
      expect(rowActions).toHaveBeenCalledTimes(1);
      expect(rowActions).toHaveBeenCalledWith({
        rowId: "rm_1",
        row: rows[0],
        selectionCount: 0,
        rowIsInSelection: false,
      });
    });

    test("renders the consumer's items and dispatches their onSelect", async () => {
      const onWrite = vi.fn();
      const onPing = vi.fn();
      const rowActions = () => [{ key: "ping", label: "Ping row", onSelect: () => onPing() }];
      renderTable({ onWrite, rowActions });
      fireEvent.contextMenu(getBodyCell(0, 0), { clientX: 10, clientY: 10 });
      const ping = await screen.findByRole("menuitem", { name: /Ping row/ });
      fireEvent.click(ping);
      expect(onPing).toHaveBeenCalledTimes(1);
    });

    test("does not invoke the selector when the menu is suppressed (readOnly)", () => {
      const rowActions = vi.fn().mockReturnValue([]);
      renderTable({ readOnly: true, rowActions });
      fireEvent.contextMenu(getBodyCell(0, 0), { clientX: 0, clientY: 0 });
      expect(rowActions).not.toHaveBeenCalled();
    });
  });
});

function renderTable({
  view = emptyViewState(),
  readOnly = false,
  onWrite,
  onViewChange,
  rowsOverride,
  fieldDefsOverride,
  columnDefsOverride,
  rowActions,
  buildEmptyRow,
}: {
  view?: ViewState;
  readOnly?: boolean;
  onWrite?: DataTableProps<Row>["onWrite"];
  onViewChange?: DataTableProps<Row>["onViewChange"];
  rowsOverride?: Row[];
  fieldDefsOverride?: FieldDef[];
  columnDefsOverride?: DataTableColumnDef<Row>[];
  rowActions?: DataTableProps<Row>["rowActions"];
  buildEmptyRow?: DataTableProps<Row>["buildEmptyRow"];
} = {}) {
  return render(
    <DataTable
      rows={rowsOverride ?? rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefsOverride ?? fieldDefs}
      columnDefs={columnDefsOverride ?? columnDefs}
      view={view}
      onViewChange={onViewChange ?? vi.fn()}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      readOnly={readOnly}
      emptyMessage="No rooms yet."
      rowActions={rowActions}
    />,
  );
}

function getBodyCell(rowIndex: number, columnIndex: number): HTMLTableCellElement {
  const rowGroup = screen.getAllByRole("rowgroup")[1];
  if (!rowGroup) throw new Error("body rowgroup missing");
  const row = within(rowGroup).getAllByRole("row")[rowIndex];
  if (!row) throw new Error(`body row ${rowIndex} missing`);
  return within(row).getAllByRole("gridcell")[columnIndex] as HTMLTableCellElement;
}
