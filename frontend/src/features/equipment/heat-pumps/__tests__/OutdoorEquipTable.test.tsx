import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../../app/query-client";
import type { WriteOp } from "../../../../shared/ui/data-table";
import { OutdoorEquipTable } from "../components/OutdoorEquipTable";
import { heatPumpOutdoorEquipPayloadBuilders } from "../lib";
import { outdoorEquipFieldDefs } from "../outdoor-equip-columns";
import type {
  HeatPumpIndoorEquipSlice,
  HeatPumpOutdoorEquipSlice,
  HeatPumpOutdoorUnitsSlice,
  HeatPumpsSlice,
} from "../types";
import { heatPumpTestController } from "./heatPumpControllerTestUtils";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OutdoorEquipTable", () => {
  test("paired indoor equipment uses the shared linked-record affordance and writes the scalar FK", async () => {
    const user = userEvent.setup();
    const slice = baseSlice({
      outdoor_equip: [
        outdoorEquipRow({ paired_indoor_equip_id: "hpie_01HX0000000000000000000001" }),
      ],
      indoor_equip: [
        indoorEquipRow({
          id: "hpie_01HX0000000000000000000001",
          tag: "IE-A",
          model_number: "MSZ-A",
        }),
        indoorEquipRow({
          id: "hpie_01HX0000000000000000000002",
          tag: "IE-B",
          model_number: "MSZ-B",
        }),
      ],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      return jsonResponse({});
    });
    const writes: WriteOp[] = [];

    renderTable(slice, { writes });

    const currentPill = await screen.findByRole("button", { name: /IE-A/ });
    const cell = currentPill.closest('[role="gridcell"]');
    expect(cell).toBeTruthy();

    await user.click(cell!);
    expect(screen.getByRole("button", { name: "Add linked record" })).toBeInTheDocument();

    fireEvent.doubleClick(cell!);
    expect(await screen.findByRole("dialog", { name: "Link Paired indoor equip" })).toBeVisible();
    await user.click(await screen.findByRole("radio", { name: /Link IE-B/ }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const op = writes[0];
    if (!op || op.kind !== "cell") throw new Error("Expected a cell write");
    const payload = heatPumpOutdoorEquipPayloadBuilders.fromCellWrites(
      outdoorEquipLeafSlice(slice),
      op.writes,
      {},
      {},
    );
    expect(payload.outdoor_equip[0]?.paired_indoor_equip_id).toBe(
      "hpie_01HX0000000000000000000002",
    );
  });
});

function renderTable(slice: HeatPumpsSlice, options: { writes?: WriteOp[] } = {}) {
  const queryClient = createQueryClient();
  const leafSlice = outdoorEquipLeafSlice(slice);
  const controller = heatPumpTestController<HeatPumpOutdoorEquipSlice>({
    fieldDefs: outdoorEquipFieldDefs({ options: slice.single_select_options }),
    onWrite: (op) => {
      options.writes?.push(op);
    },
  });
  const indoorEquipController = heatPumpTestController<HeatPumpIndoorEquipSlice>({
    fieldDefs: [],
  });
  const outdoorUnitsController = heatPumpTestController<HeatPumpOutdoorUnitsSlice>({
    fieldDefs: [],
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OutdoorEquipTable
        projectId="proj_1"
        btNumber="BT-001"
        slice={slice}
        leafSlice={leafSlice}
        controller={controller}
        indoorEquipController={indoorEquipController}
        outdoorUnitsController={outdoorUnitsController}
        isEditor
        versionLocked={false}
      />
    </QueryClientProvider>,
  );
}

function outdoorEquipLeafSlice(slice: HeatPumpsSlice): HeatPumpOutdoorEquipSlice {
  return {
    project_id: slice.project_id,
    version_id: slice.version_id,
    source: slice.source,
    version_etag: slice.version_etag,
    draft_etag: slice.draft_etag,
    outdoor_equip: slice.outdoor_equip,
    field_defs: [],
    single_select_options: {},
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function baseSlice(overrides: Partial<HeatPumpsSlice> = {}): HeatPumpsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "version",
    version_etag: "version_1",
    draft_etag: null,
    outdoor_equip: [outdoorEquipRow()],
    indoor_equip: [indoorEquipRow()],
    outdoor_units: [],
    indoor_units: [],
    single_select_options: {},
    ...overrides,
  };
}

function outdoorEquipRow(overrides: Partial<HeatPumpsSlice["outdoor_equip"][number]> = {}) {
  return {
    id: "hpoe_01HX0000000000000000000000",
    tag: "OE-A",
    manufacturer: null,
    model_number: "PUZ-A18NKA7",
    paired_indoor_equip_id: null,
    system_family: null,
    refrigerant: null,
    heating_cap_kw_17f: null,
    heating_cap_kw_47f: null,
    heating_data_type: null,
    heating_cop_17f: null,
    heating_cop_47f: null,
    hspf: null,
    cooling_cap_kw_95f: null,
    cooling_data_type: null,
    eer: null,
    seer: null,
    ieer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
    photo_asset_ids: overrides.photo_asset_ids ?? [],
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

function indoorEquipRow(overrides: Partial<HeatPumpsSlice["indoor_equip"][number]> = {}) {
  return {
    id: "hpie_01HX0000000000000000000001",
    tag: "IE-A",
    manufacturer: null,
    model_type: null,
    model_number: "MSZ-A",
    install_type: null,
    nominal_tons: null,
    fan_speed_cfm: null,
    cooling_btuh: null,
    heating_btuh_47f: null,
    heating_btuh_17f: null,
    heating_cop: null,
    seer: null,
    eer: null,
    hspf: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
    photo_asset_ids: overrides.photo_asset_ids ?? [],
  } satisfies HeatPumpsSlice["indoor_equip"][number];
}
