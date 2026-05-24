import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";

type Row = { id: string; number: string; name: string; count: number };

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

  test("coerces cleared inline number edits to zero", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("2"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Count updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "count", value: 0 }],
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

  test("type-to-edit: printable key on a number cell seeds the typed digit", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const countCell = screen.getByText("2").closest("td") as HTMLElement;
    fireEvent.click(countCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "7" });

    const editor = screen.getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("7");
  });

  test("type-to-edit: Backspace on active editable cell opens editor with empty draft", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    const nameCell = screen.getByText("Living Room").closest("td") as HTMLElement;
    fireEvent.click(nameCell);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Backspace" });

    const editor = screen.getByRole("textbox") as HTMLInputElement;
    expect(editor.value).toBe("");
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

  test("Backspace on a single-select cell is a no-op (does not open popover)", () => {
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
    expect(screen.queryByRole("textbox", { name: "Search options" })).toBeNull();
  });

  test("commits inline edits on Tab", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    fireEvent.keyDown(editor, { key: "Tab" });

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
});

function renderTable({
  view = emptyViewState(),
  readOnly = false,
  onWrite,
  onViewChange,
  rowsOverride,
}: {
  view?: ViewState;
  readOnly?: boolean;
  onWrite?: DataTableProps<Row>["onWrite"];
  onViewChange?: DataTableProps<Row>["onViewChange"];
  rowsOverride?: Row[];
} = {}) {
  return render(
    <DataTable
      rows={rowsOverride ?? rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columnDefs}
      view={view}
      onViewChange={onViewChange ?? vi.fn()}
      onWrite={onWrite}
      readOnly={readOnly}
      emptyMessage="No rooms yet."
    />,
  );
}
