import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createQueryClient } from "../../../app/query-client";
import { emptyViewState } from "../../../shared/ui/data-table";
import { VentilatorsTable } from "../components/VentilatorsTable";
import type { HeatPumpIndoorUnitRow } from "../heat-pumps/types";
import {
  buildVentilator,
  buildVentilatorsSlice,
  schemaForVentilators,
} from "../testing/testFixtures";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({
        items: [
          {
            asset_id: "asset_pdf_1",
            preview_url: "https://fake-r2.test/file-preview.pdf",
            preview_expires_at: "2026-05-26T13:15:00Z",
            download_url: "https://fake-r2.test/file.pdf",
            download_expires_at: "2026-05-26T14:00:00Z",
            thumbnail_url: null,
            thumbnail_status: "pending",
            thumbnail_expires_at: null,
            content_type: "application/pdf",
            original_filename: "ventilator-datasheet.pdf",
            display_name: "Ventilator datasheet",
            size_bytes: 512,
          },
        ],
      });
    }
    return jsonResponse({ items: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("VentilatorsTable DataTable reuse", () => {
  test("renders AirTable-matched ventilator columns, units, and single-select labels", () => {
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Airflow Rate/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Electrical Efficiency/ })).toBeInTheDocument();
    expect(screen.getByText("m3/h")).toBeInTheDocument();
    expect(screen.getByText("Wh/m3")).toBeInTheDocument();
    expect(screen.getByText("ERV-1")).toBeInTheDocument();
    expect(screen.getByText("Inside")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /HP indoor units/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Status/ })).toBeInTheDocument();
  });

  test("renders incoming HP indoor unit links from linked_erv_unit_id", () => {
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator({ id: "vent_1" })] });
    const tableSchema = schemaForVentilators(slice);
    const onIncomingIndoorUnitOpen = vi.fn();
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        heatPumpIndoorUnits={[indoorUnit({ linked_erv_unit_id: "vent_1" })]}
        onIncomingIndoorUnitOpen={onIncomingIndoorUnitOpen}
      />,
    );

    const incomingHeader = screen.getByRole("columnheader", { name: /HP indoor units/ });
    expect(incomingHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    let incomingPill = screen.getByRole("button", { name: "AHU-1" });
    fireEvent.click(incomingPill);
    incomingPill = screen.getByRole("button", { name: "AHU-1" });
    fireEvent.click(incomingPill);
    expect(onIncomingIndoorUnitOpen).toHaveBeenCalledWith("hpiu_01HX0000000000000000000001");
  });

  test("shows the active-cell add affordance for incoming HP indoor unit links", () => {
    const row = buildVentilator({ id: "vent_1" });
    const slice = buildVentilatorsSlice({ ventilators: [row] });
    const tableSchema = schemaForVentilators(slice);
    const onIncomingIndoorUnitsLinkEdit = vi.fn();
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        heatPumpIndoorUnits={[indoorUnit({ linked_erv_unit_id: "vent_1" })]}
        onIncomingIndoorUnitOpen={vi.fn()}
        onIncomingIndoorUnitsLinkEdit={onIncomingIndoorUnitsLinkEdit}
      />,
    );

    const incomingPill = screen.getByRole("button", { name: "AHU-1" });
    const incomingCell = incomingPill.closest('[role="gridcell"]');
    expect(incomingCell).not.toBeNull();
    fireEvent.click(incomingCell as HTMLElement);

    const addButton = screen.getByRole("button", { name: "Add linked record" });
    fireEvent.click(addButton);
    expect(onIncomingIndoorUnitsLinkEdit).toHaveBeenCalledWith(row);
  });

  test("double-clicking an incoming HP indoor unit link cell opens link editing", () => {
    const row = buildVentilator({ id: "vent_1" });
    const slice = buildVentilatorsSlice({ ventilators: [row] });
    const tableSchema = schemaForVentilators(slice);
    const onEdit = vi.fn();
    const onIncomingIndoorUnitsLinkEdit = vi.fn();
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        onEdit={onEdit}
        heatPumpIndoorUnits={[indoorUnit({ linked_erv_unit_id: "vent_1" })]}
        onIncomingIndoorUnitOpen={vi.fn()}
        onIncomingIndoorUnitsLinkEdit={onIncomingIndoorUnitsLinkEdit}
      />,
    );

    const incomingPill = screen.getByRole("button", { name: "AHU-1" });
    fireEvent.doubleClick(incomingPill.closest('[role="gridcell"]') as HTMLElement);

    expect(onIncomingIndoorUnitsLinkEdit).toHaveBeenCalledWith(row);
    expect(onEdit).not.toHaveBeenCalled();
  });

  test("wires DataTable row expansion to Ventilator edit", async () => {
    const user = userEvent.setup();
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    const onEdit = vi.fn();
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand row 1" }));
    expect(onEdit).toHaveBeenCalledWith(slice.ventilators[0]);
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    await user.dblClick(screen.getByText("ERV-1"));
    await user.keyboard("{Control>}a{/Control}ERV-2{Enter}");

    expect(onWrite).toHaveBeenCalled();
  });

  test("emits a cell write when deleting a datasheet attachment", async () => {
    const slice = buildVentilatorsSlice({
      ventilators: [buildVentilator({ datasheet_asset_ids: ["asset_pdf_1"] })],
    });
    const tableSchema = schemaForVentilators(slice);
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const attachment = await screen.findByTitle("ventilator-datasheet.pdf · application/pdf");
    fireEvent.click(attachment);
    fireEvent.click(await screen.findByRole("button", { name: "Detach" }));

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "vent_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });
});

function indoorUnit(overrides: Partial<HeatPumpIndoorUnitRow> = {}): HeatPumpIndoorUnitRow {
  return {
    id: "hpiu_01HX0000000000000000000001",
    tag: "AHU-1",
    indoor_equip_id: "hpie_01HX0000000000000000000001",
    outdoor_unit_id: null,
    linked_erv_unit_id: null,
    served_room_ids: [],
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  };
}
