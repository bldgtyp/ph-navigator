import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import { emptyViewState } from "../../../shared/ui/data-table";
import { RoomsTable } from "../components/RoomsTable";
import {
  buildRoom,
  buildRoomsSlice,
  schemaForRooms,
  withRoomCustomValues,
} from "../testing/testFixtures";

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

function renderRoomsTable(unitSystem: UnitSystem, onWrite = vi.fn()) {
  const room = withRoomCustomValues(buildRoom({ id: "rm_1" }), {
    supply_airflow_m3h: 170,
    extract_airflow_m3h: null,
  });
  const slice = buildRoomsSlice({ rooms: [room] });
  const result = render(
    <UnitStub unitSystem={unitSystem}>
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
      />
    </UnitStub>,
  );
  return { ...result, onWrite };
}

function getGridCell(container: HTMLElement, rowId: string, fieldKey: string): HTMLElement {
  const cell = container.querySelector(`td[data-row-id="${rowId}"][data-field-key="${fieldKey}"]`);
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Missing grid cell ${rowId}/${fieldKey}`);
  }
  return cell;
}

describe("RoomsTable airflow built-ins", () => {
  test("renders airflow fields with unit pills and blank null values", () => {
    const { container } = renderRoomsTable("SI");

    const supplyHeader = screen.getByRole("columnheader", { name: /Supply airflow rate/ });
    expect(within(supplyHeader).getByTestId("data-table-header-units").textContent).toBe("m3/h");
    expect(supplyHeader).not.toHaveTextContent("Supply airflow rate m3/h");
    expect(getGridCell(container, "rm_1", "supply_airflow_m3h")).toHaveTextContent("170.0");
    expect(getGridCell(container, "rm_1", "extract_airflow_m3h")).toHaveTextContent("");
  });

  test("switches airflow headers and display values to IP", () => {
    const { container } = renderRoomsTable("IP");

    const supplyHeader = screen.getByRole("columnheader", { name: /Supply airflow rate/ });
    expect(within(supplyHeader).getByTestId("data-table-header-units").textContent).toBe("cfm");
    expect(getGridCell(container, "rm_1", "supply_airflow_m3h")).toHaveTextContent("100.1");
  });

  test("clearing an airflow cell writes null through the table write path", async () => {
    const onWrite = vi.fn();
    const { container } = renderRoomsTable("SI", onWrite);

    fireEvent.doubleClick(getGridCell(container, "rm_1", "supply_airflow_m3h"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Supply airflow rate updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "supply_airflow_m3h", value: null }],
    });
  });

  test("editing in IP writes canonical SI airflow", async () => {
    const onWrite = vi.fn();
    const { container } = renderRoomsTable("IP", onWrite);

    fireEvent.doubleClick(getGridCell(container, "rm_1", "supply_airflow_m3h"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "50" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Supply airflow rate updated.")).toBeVisible();
    const write = onWrite.mock.calls[0]?.[0];
    expect(write?.kind).toBe("cell");
    expect(write?.writes[0]?.rowId).toBe("rm_1");
    expect(write?.writes[0]?.fieldKey).toBe("supply_airflow_m3h");
    expect(write?.writes[0]?.value).toBeCloseTo(84.9505, 4);
  });
});
