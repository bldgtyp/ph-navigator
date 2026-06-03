import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { UnitSystem } from "../../../../lib/units";
import { DataTable } from "../DataTable";
import { emptyViewState, type DataTableColumnDef, type FieldDef, type ViewState } from "../types";

// Phase 03 grid-behavior coverage for number-with-units fields. These
// tests sit alongside the broader DataTable suite because unit-aware
// behavior is observable only through the rendered grid (header chip,
// cell display, edit commit, aggregation, filter).
//
// `UnitPreferenceProvider` requires a `useSessionQuery` result, which is
// supplied by the auth test harness in higher-level tests. Here we lean
// on the default `localStorage`-seeded fallback ("SI") and override it
// per test by writing `phn.units_preference` before render.

type Row = { id: string; thickness: number | null };

const lengthUnits = {
  mode: "editable" as const,
  unit_type: "length" as const,
  si_unit: "m" as const,
  ip_unit: "ft" as const,
  precision_si: 3,
  precision_ip: 2,
};

const fieldDefs: FieldDef[] = [
  {
    field_key: "thickness",
    field_type: "number",
    display_name: "Thickness",
    numberUnits: lengthUnits,
  },
];

const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "thickness", fieldKey: "thickness", header: "Thickness", accessor: (row) => row.thickness },
];

const rows: Row[] = [
  { id: "r1", thickness: 1 }, // 1 m = ~3.28 ft
  { id: "r2", thickness: 2 }, // 2 m = ~6.56 ft
];

// Stub the unit preference context directly — the real provider depends
// on a TanStack QueryClient and the auth session, which we don't need
// just to drive the DataTable's `unitSystem` read.
function UnitStub({ unitSystem, children }: { unitSystem: UnitSystem; children: ReactNode }) {
  return (
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "default",
        error: null,
        setUnitSystem: () => {},
        toggleUnitSystem: () => {},
      }}
    >
      {children}
    </UnitPreferenceContext.Provider>
  );
}

function renderWithUnits(unitSystem: "SI" | "IP", overrides?: { view?: ViewState }) {
  return render(
    <UnitStub unitSystem={unitSystem}>
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columnDefs}
        view={overrides?.view ?? emptyViewState()}
        onViewChange={vi.fn()}
        emptyMessage="empty"
      />
    </UnitStub>,
  );
}

function getBodyCellText(rowIndex: number, columnIndex: number): string {
  const rowGroup = screen.getAllByRole("rowgroup")[1];
  if (!rowGroup) throw new Error("body rowgroup missing");
  const row = within(rowGroup).getAllByRole("row")[rowIndex];
  if (!row) throw new Error(`row ${rowIndex} missing`);
  const cell = within(row).getAllByRole("gridcell")[columnIndex];
  if (!cell) throw new Error(`cell missing`);
  return cell.textContent?.trim() ?? "";
}

describe("number-with-units grid behavior (Phase 03)", () => {
  test("renders bare SI number in SI mode and header carries SI unit label", () => {
    renderWithUnits("SI");
    expect(screen.getByTestId("data-table-header-units").textContent).toBe("m");
    expect(getBodyCellText(0, 0)).toBe("1.000");
    expect(getBodyCellText(1, 0)).toBe("2.000");
  });

  test("renders converted IP number in IP mode and header swaps to ft", () => {
    renderWithUnits("IP");
    expect(screen.getByTestId("data-table-header-units").textContent).toBe("ft");
    // 1 m ≈ 3.28 ft at precision_ip=2
    expect(getBodyCellText(0, 0)).toBe("3.28");
    expect(getBodyCellText(1, 0)).toBe("6.56");
  });

  test("plain number field with no numberUnits renders no unit chip", () => {
    render(
      <UnitStub unitSystem="SI">
        <DataTable
          rows={[{ id: "r1", thickness: 1 }] as Row[]}
          getRowId={(row) => row.id}
          fieldDefs={[{ field_key: "thickness", field_type: "number", display_name: "Thickness" }]}
          columnDefs={columnDefs}
          view={emptyViewState()}
          onViewChange={vi.fn()}
          emptyMessage="empty"
        />
      </UnitStub>,
    );
    expect(screen.queryByTestId("data-table-header-units")).toBeNull();
  });

  test("filter clearing fires when numberUnits config changes between renders", () => {
    const onViewChange = vi.fn();
    const filteredView: ViewState = {
      ...emptyViewState(),
      filter: [{ fieldKey: "thickness", operator: "eq", value: "1" }],
    };
    const { rerender } = render(
      <UnitStub unitSystem="SI">
        <DataTable
          rows={rows}
          getRowId={(row) => row.id}
          fieldDefs={fieldDefs}
          columnDefs={columnDefs}
          view={filteredView}
          onViewChange={onViewChange}
          emptyMessage="empty"
        />
      </UnitStub>,
    );
    onViewChange.mockClear();
    const nextFieldDefs: FieldDef[] = [
      {
        ...fieldDefs[0]!,
        numberUnits: { ...lengthUnits, precision_si: 1 },
      },
    ];
    act(() => {
      rerender(
        <UnitStub unitSystem="SI">
          <DataTable
            rows={rows}
            getRowId={(row) => row.id}
            fieldDefs={nextFieldDefs}
            columnDefs={columnDefs}
            view={filteredView}
            onViewChange={onViewChange}
            emptyMessage="empty"
          />
        </UnitStub>,
      );
    });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const next = onViewChange.mock.calls[0]?.[0] as ViewState;
    expect(next.filter).toEqual([]);
  });

  test("IP edit commit writes the canonical SI value", async () => {
    const onWrite = vi.fn();
    render(
      <UnitStub unitSystem="IP">
        <DataTable
          rows={[{ id: "r1", thickness: 0 }] as Row[]}
          getRowId={(row) => row.id}
          fieldDefs={fieldDefs}
          columnDefs={columnDefs}
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={onWrite}
          emptyMessage="empty"
        />
      </UnitStub>,
    );
    const cell = within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("gridcell")[0]!;
    fireEvent.doubleClick(cell);
    const editor = await screen.findByDisplayValue("0.00");
    fireEvent.change(editor, { target: { value: "10" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    // 10 ft ≈ 3.048 m
    expect(onWrite).toHaveBeenCalled();
    const writeOp = onWrite.mock.calls[0]?.[0];
    expect(writeOp.kind).toBe("cell");
    expect(writeOp.writes[0].fieldKey).toBe("thickness");
    expect(writeOp.writes[0].value).toBeCloseTo(3.048, 6);
  });
});
