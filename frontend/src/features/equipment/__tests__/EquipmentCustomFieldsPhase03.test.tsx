import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../app/query-client";
import {
  buildTableSchema,
  emptyViewState,
  type AddCustomFieldRequest,
  type TableFieldDef,
} from "../../../shared/ui/data-table";
import { ThermalBridgesTable } from "../../assets/thermal-bridges/ThermalBridgesTable";
import {
  THERMAL_BRIDGE_BUILT_IN_FIELD_DEFS,
  thermalBridgesFieldOverlay,
} from "../../assets/thermal-bridges/constants";
import { AppliancesTable } from "../components/AppliancesTable";
import { ElectricHeatersTable } from "../components/ElectricHeatersTable";
import { FansTable } from "../components/FansTable";
import { HotWaterHeatersTable } from "../components/HotWaterHeatersTable";
import { HotWaterTanksTable } from "../components/HotWaterTanksTable";
import { PumpsTable } from "../components/PumpsTable";
import { VentilatorsTable } from "../components/VentilatorsTable";
import {
  buildAppliance,
  buildAppliancesSlice,
  buildCustomField,
  buildElectricHeater,
  buildElectricHeatersSlice,
  buildFan,
  buildFormulaField,
  buildFansSlice,
  buildHotWaterHeater,
  buildHotWaterHeatersSlice,
  buildHotWaterTank,
  buildHotWaterTanksSlice,
  buildPump,
  buildPumpsSlice,
  buildVentilator,
  buildVentilatorsSlice,
  schemaForAppliances,
  schemaForElectricHeaters,
  schemaForFans,
  schemaForHotWaterHeaters,
  schemaForHotWaterTanks,
  schemaForPumps,
  schemaForVentilators,
} from "../testing/testFixtures";
import {
  THERMAL_BRIDGES_TABLE_NAME,
  THERMAL_BRIDGE_TYPE_OPTION_KEY,
  type ThermalBridgeRow,
  type ThermalBridgesSlice,
} from "../types";
const fetchMock = vi.fn();
type AddCustomFieldHandler = (request: AddCustomFieldRequest) => Promise<{ newFieldKey: string }>;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({
        items: [
          assetUrl("asset_pdf_1", "equipment-datasheet.pdf"),
          assetUrl("asset_report_1", "tb-report.pdf"),
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
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function assetUrl(assetId: string, filename: string) {
  return {
    asset_id: assetId,
    preview_url: `https://fake-r2.test/${filename}`,
    preview_expires_at: "2026-05-26T13:15:00Z",
    download_url: `https://fake-r2.test/${filename}`,
    download_expires_at: "2026-05-26T14:00:00Z",
    thumbnail_url: null,
    thumbnail_status: "pending",
    thumbnail_expires_at: null,
    content_type: "application/pdf",
    original_filename: filename,
    display_name: filename,
    size_bytes: 512,
  };
}

const editableTableCases: Array<{
  name: string;
  render: (onAddCustomField?: AddCustomFieldHandler) => ReactElement;
}> = [
  {
    name: "Ventilators",
    render: (onAddCustomField) => {
      const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
      return (
        <VentilatorsTable
          ventilatorsSlice={slice}
          tableSchema={schemaForVentilators(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Pumps",
    render: (onAddCustomField) => {
      const slice = buildPumpsSlice({ pumps: [buildPump()] });
      return (
        <PumpsTable
          pumpsSlice={slice}
          tableSchema={schemaForPumps(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Fans",
    render: (onAddCustomField) => {
      const slice = buildFansSlice({ fans: [buildFan()] });
      return (
        <FansTable
          fansSlice={slice}
          tableSchema={schemaForFans(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Hot Water Heaters",
    render: (onAddCustomField) => {
      const slice = buildHotWaterHeatersSlice({ hot_water_heaters: [buildHotWaterHeater()] });
      return (
        <HotWaterHeatersTable
          hotWaterHeatersSlice={slice}
          tableSchema={schemaForHotWaterHeaters(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Hot Water Tanks",
    render: (onAddCustomField) => {
      const slice = buildHotWaterTanksSlice({ hot_water_tanks: [buildHotWaterTank()] });
      return (
        <HotWaterTanksTable
          hotWaterTanksSlice={slice}
          tableSchema={schemaForHotWaterTanks(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Electric Heaters",
    render: (onAddCustomField) => {
      const slice = buildElectricHeatersSlice({ electric_heaters: [buildElectricHeater()] });
      return (
        <ElectricHeatersTable
          electricHeatersSlice={slice}
          tableSchema={schemaForElectricHeaters(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Appliances",
    render: (onAddCustomField) => {
      const slice = buildAppliancesSlice({ appliances: [buildAppliance()] });
      return (
        <AppliancesTable
          appliancesSlice={slice}
          tableSchema={schemaForAppliances(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
  {
    name: "Thermal Bridges",
    render: (onAddCustomField) => {
      const slice = buildThermalBridgesSlice({ thermal_bridges: [buildThermalBridge()] });
      return (
        <ThermalBridgesTable
          slice={slice}
          tableSchema={schemaForThermalBridges(slice)}
          isEditor
          projectId="proj_1"
          view={emptyViewState()}
          onViewChange={vi.fn()}
          onWrite={vi.fn()}
          onAddCustomField={onAddCustomField}
        />
      );
    },
  },
];

describe("equipment custom fields Phase 03", () => {
  test.each(editableTableCases)(
    "$name opens Add field and dispatches submit",
    async ({ render }) => {
      const onAddCustomField = vi.fn().mockResolvedValue({ newFieldKey: "cf_status" });
      renderWithQueryClient(render(onAddCustomField));

      fireEvent.click(screen.getByRole("button", { name: "Add field" }));
      const dialog = await screen.findByRole("dialog", { name: "Add field" });
      fireEvent.change(within(dialog).getByLabelText("Name"), {
        target: { value: "Status" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));

      await waitFor(() => expect(onAddCustomField).toHaveBeenCalledTimes(1));
      const request = onAddCustomField.mock.calls[0]?.[0] as AddCustomFieldRequest;
      expect(request.displayName).toBe("Status");
      expect(request.fieldType).toBe("short_text");
    },
  );

  test.each(editableTableCases)("$name hides Add field when handlers are omitted", ({ render }) => {
    const rendered = renderWithQueryClient(render(vi.fn()));
    expect(screen.getByRole("button", { name: "Add field" })).toBeInTheDocument();
    rendered.unmount();

    renderWithQueryClient(renderWithoutAddHandler(render));
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
  });

  test("renders custom columns and exposes custom-field header actions", async () => {
    const statusField = buildCustomField({ field_key: "cf_status", display_name: "Status" });
    const heater = buildElectricHeater({
      custom_values: { ...buildElectricHeater().custom_values, cf_status: "Installed" },
    });
    const slice = buildElectricHeatersSlice({
      electric_heaters: [heater],
      field_defs: [...buildElectricHeatersSlice().field_defs, statusField],
    });
    const onDeleteCustomField = vi.fn();
    const onDuplicateCustomField = vi.fn();
    const onEditCustomFieldBundle = vi.fn();

    renderWithQueryClient(
      <ElectricHeatersTable
        electricHeatersSlice={slice}
        tableSchema={schemaForElectricHeaters(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        onDeleteCustomField={onDeleteCustomField}
        onAddCustomField={vi.fn().mockResolvedValue({ newFieldKey: "cf_next" })}
        onDuplicateCustomField={onDuplicateCustomField}
        onEditCustomFieldBundle={onEditCustomFieldBundle}
      />,
    );

    const statusHeader = screen.getByRole("columnheader", { name: /^Status\b/ });
    expect(statusHeader).toBeInTheDocument();
    expect(screen.getByText("Installed")).toBeInTheDocument();

    fireEvent.contextMenu(statusHeader);
    expect(await screen.findByRole("menuitem", { name: "Edit field…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate field" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete field" })).toBeInTheDocument();
  });

  test("renders computed formula overlays for newly enabled table families", () => {
    const formulaField = buildFormulaField({
      field_key: "cf_label",
      display_name: "Label",
      config: { result_type: "text" },
    });
    const pumpSlice = buildPumpsSlice({
      pumps: [buildPump({ id: "pump_1" })],
      field_defs: [...buildPumpsSlice().field_defs, formulaField],
      rows_computed: { pump_1: { cf_label: "Pump label" } },
    });
    const ventilatorSlice = buildVentilatorsSlice({
      ventilators: [buildVentilator({ id: "erv_1" })],
      field_defs: [...buildVentilatorsSlice().field_defs, formulaField],
      rows_computed: { erv_1: { cf_label: "ERV label" } },
    });
    const thermalBridgeSlice = buildThermalBridgesSlice({
      thermal_bridges: [buildThermalBridge({ id: "tb_1" })],
      field_defs: [...buildThermalBridgesSlice().field_defs, formulaField],
      rows_computed: { tb_1: { cf_label: "TB label" } },
    });

    const { unmount } = renderWithQueryClient(
      <PumpsTable
        pumpsSlice={pumpSlice}
        tableSchema={schemaForPumps(pumpSlice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.getByText("Pump label")).toBeInTheDocument();
    unmount();

    const renderedVentilator = renderWithQueryClient(
      <VentilatorsTable
        ventilatorsSlice={ventilatorSlice}
        tableSchema={schemaForVentilators(ventilatorSlice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.getByText("ERV label")).toBeInTheDocument();
    renderedVentilator.unmount();

    renderWithQueryClient(
      <ThermalBridgesTable
        slice={thermalBridgeSlice}
        tableSchema={schemaForThermalBridges(thermalBridgeSlice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.getByText("TB label")).toBeInTheDocument();
  });

  test("attachment tables still emit attachment writes with Add field enabled", async () => {
    const slice = buildFansSlice({
      fans: [buildFan({ datasheet_asset_ids: ["asset_pdf_1"] })],
    });
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <FansTable
        fansSlice={slice}
        tableSchema={schemaForFans(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        onAddCustomField={vi.fn().mockResolvedValue({ newFieldKey: "cf_status" })}
      />,
    );

    expect(screen.getByRole("button", { name: "Add field" })).toBeInTheDocument();
    const attachment = await screen.findByTitle("equipment-datasheet.pdf · application/pdf");
    const attachmentCell = attachment.closest(".attachment-cell");
    expect(attachmentCell).not.toBeNull();
    fireEvent.keyDown(attachmentCell as HTMLElement, { key: "Delete" });

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "fan_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });

  test("Thermal Bridges opens Add field while preserving PDF report attachments", async () => {
    const slice = buildThermalBridgesSlice({
      thermal_bridges: [buildThermalBridge({ pdf_report_asset_ids: ["asset_report_1"] })],
    });
    renderWithQueryClient(
      <ThermalBridgesTable
        slice={slice}
        tableSchema={schemaForThermalBridges(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        onAddCustomField={vi.fn().mockResolvedValue({ newFieldKey: "cf_status" })}
      />,
    );

    expect(await screen.findByTitle("tb-report.pdf · application/pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(await screen.findByRole("dialog", { name: "Add field" })).toBeInTheDocument();
  });
});

function renderWithoutAddHandler(
  renderCase: (onAddCustomField?: AddCustomFieldHandler) => ReactElement,
): ReactElement {
  return renderCase(undefined);
}

function buildThermalBridge(overrides: Partial<ThermalBridgeRow> = {}): ThermalBridgeRow {
  return {
    id: "tb_1",
    thermal_bridge_type: "opt_linear",
    pdf_report_asset_ids: [],
    notes: null,
    custom_values: {
      record_id: "TB-1",
      name: "Balcony slab",
      sheet_name: "A-501",
      drawing_number: "D1",
      psi_value_w_mk: 0.12,
      frsi_value: 0.72,
    },
    ...overrides,
  };
}

function buildThermalBridgesSlice(
  overrides: Partial<ThermalBridgesSlice> = {},
): ThermalBridgesSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    thermal_bridges: [],
    field_defs: THERMAL_BRIDGE_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
    single_select_options: {
      [THERMAL_BRIDGE_TYPE_OPTION_KEY]: [
        { id: "opt_linear", label: "Linear", color: "#0ea5e9", order: 0 },
      ],
    },
    ...overrides,
  };
}

function schemaForThermalBridges(slice: ThermalBridgesSlice) {
  return buildTableSchema({
    tableKey: THERMAL_BRIDGES_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: thermalBridgesFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}
