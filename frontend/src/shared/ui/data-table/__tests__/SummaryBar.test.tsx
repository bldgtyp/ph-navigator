import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SummaryBar } from "../components/SummaryBar";
import type { DataTableColumnDef, FieldDef } from "../types";

type Row = { id: string; name: string; icfa: number };

const ROWS: Row[] = [
  { id: "rm_1", name: "Living", icfa: 1 },
  { id: "rm_2", name: "Kitchen", icfa: 2 },
  { id: "rm_3", name: "Bedroom", icfa: 3 },
];

const COLUMNS: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "icfa", fieldKey: "icfa", header: "iCFA", accessor: (row) => row.icfa },
];

const FIELD_DEFS = new Map<string, FieldDef>([
  ["name", { field_key: "name", field_type: "text", display_name: "Name" }],
  ["icfa", { field_key: "icfa", field_type: "number", display_name: "iCFA" }],
]);

function renderBar(overrides: Partial<React.ComponentProps<typeof SummaryBar<Row>>> = {}) {
  const onAggregationChange = vi.fn();
  render(
    <table>
      <SummaryBar<Row>
        columns={COLUMNS}
        visibleRows={ROWS}
        aggregations={{}}
        fieldDefByKey={FIELD_DEFS}
        readOnly={false}
        onAggregationChange={onAggregationChange}
        {...overrides}
      />
    </table>,
  );
  return { onAggregationChange };
}

function getCells() {
  // Gutter cell is aria-hidden, so cell[0] is the first data column.
  const tfoot = screen.getByTestId("data-table-summary-bar");
  return within(tfoot).getAllByRole("cell");
}

function getLatestCells() {
  const bars = screen.getAllByTestId("data-table-summary-bar");
  const latest = bars[bars.length - 1] as HTMLElement;
  return within(latest).getAllByRole("cell");
}

describe("SummaryBar", () => {
  test("first cell shows Count: N for the supplied row set", () => {
    renderBar();
    const cells = getCells();
    expect(cells[0]).toHaveTextContent("Count");
    expect(cells[0]).toHaveTextContent("3");
  });

  test("non-first cells render empty when no aggregation picked", () => {
    renderBar();
    const cells = getCells();
    const trigger = within(cells[1] as HTMLElement).getByRole("button");
    expect(trigger).toHaveTextContent(/^Calculate$/);
  });

  test("picking Sum on a number column renders the formatted total", () => {
    renderBar({ aggregations: { icfa: "sum" } });
    const cells = getCells();
    expect(cells[1]).toHaveTextContent("Sum");
    expect(cells[1]).toHaveTextContent("6.00");
  });

  test("changing visibleRows recomputes the aggregate value", () => {
    const { rerender } = render(
      <table>
        <SummaryBar<Row>
          columns={COLUMNS}
          visibleRows={ROWS}
          aggregations={{ icfa: "sum" }}
          fieldDefByKey={FIELD_DEFS}
          readOnly={false}
          onAggregationChange={vi.fn()}
        />
      </table>,
    );
    expect(getCells()[1]).toHaveTextContent("6.00");
    rerender(
      <table>
        <SummaryBar<Row>
          columns={COLUMNS}
          visibleRows={[ROWS[0]!, ROWS[1]!]}
          aggregations={{ icfa: "sum" }}
          fieldDefByKey={FIELD_DEFS}
          readOnly={false}
          onAggregationChange={vi.fn()}
        />
      </table>,
    );
    expect(getCells()[1]).toHaveTextContent("3.00");
    expect(getCells()[0]).toHaveTextContent("2");
  });

  test("clicking an empty summary cell opens the picker", () => {
    renderBar();
    const cells = getCells();
    fireEvent.click(within(cells[1] as HTMLElement).getByRole("button"));
    // Submenu items render in a Radix portal — query the document.
    const items = screen.getAllByRole("button").map((b) => b.textContent?.trim() ?? "");
    expect(items).toEqual(expect.arrayContaining(["None", "Sum", "Mean", "Min", "Max", "Count"]));
  });

  test("selecting a kind fires onAggregationChange with the picked kind", () => {
    const { onAggregationChange } = renderBar();
    fireEvent.click(within(getCells()[1] as HTMLElement).getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "Sum" }));
    expect(onAggregationChange).toHaveBeenCalledWith("icfa", "sum");
  });

  test("text column offers only None + Count in the picker", () => {
    const cols: DataTableColumnDef<Row>[] = [
      { id: "icfa", fieldKey: "icfa", header: "iCFA", accessor: (row) => row.icfa },
      { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
    ];
    render(
      <table>
        <SummaryBar<Row>
          columns={cols}
          visibleRows={ROWS}
          aggregations={{}}
          fieldDefByKey={FIELD_DEFS}
          readOnly={false}
          onAggregationChange={vi.fn()}
        />
      </table>,
    );
    const cells = getLatestCells();
    fireEvent.click(within(cells[1] as HTMLElement).getByRole("button"));
    const items = screen.getAllByRole("button").map((b) => b.textContent?.trim() ?? "");
    expect(items).toEqual(expect.arrayContaining(["None", "Count"]));
    expect(items).not.toEqual(expect.arrayContaining(["Sum", "Mean", "Min", "Max"]));
  });

  test("read-only mode hides the picker but still renders the value", () => {
    renderBar({ readOnly: true, aggregations: { icfa: "sum" } });
    const cells = getCells();
    expect(within(cells[1] as HTMLElement).queryByRole("button")).toBeNull();
    expect(cells[1]).toHaveTextContent("6.00");
    expect((cells[1] as HTMLElement).dataset.readonly).toBe("true");
  });

  test("null aggregation value is treated as no pick (plan 09 forward-compat)", () => {
    renderBar({ aggregations: { icfa: null } });
    const cells = getCells();
    const trigger = within(cells[1] as HTMLElement).getByRole("button");
    expect(trigger).toHaveTextContent(/^Calculate$/);
  });
});
