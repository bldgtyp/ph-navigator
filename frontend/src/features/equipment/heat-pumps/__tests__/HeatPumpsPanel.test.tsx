import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createQueryClient } from "../../../../app/query-client";
import type { UnitSystem } from "../../../../lib/units";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import { emptyViewState, type ViewState } from "../../../../shared/ui/data-table";
import type { ProjectDetail } from "../../../projects/types";
import { buildRoom, buildRoomsSlice } from "../../testing/testFixtures";
import { buildEmptyIndoorUnitRow } from "../lib";
import { HeatPumpsPanel } from "../routes/HeatPumpsPanel";
import { HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME, type HeatPumpsSlice } from "../types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({ items: [] });
    }
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps")) {
      return jsonResponse(heatPumpsSlice());
    }
    if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
      return jsonResponse(roomsSlice());
    }
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/outdoor-equip")) {
      const body = JSON.parse(String(init?.body)) as { value: { tag: string } };
      return jsonResponse(
        heatPumpsSlice({
          outdoor_equip: [outdoorEquipRow({ tag: body.value.tag })],
          source: "draft",
          draft_etag: "draft_2",
        }),
      );
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HeatPumpsPanel", () => {
  test("renders nested leaf tabs and mounts the outdoor equipment table", async () => {
    renderPanel();

    expect(await screen.findByRole("tab", { name: "Equipment - Outdoor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Equipment - Indoor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Units - Outdoor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Units - Indoor" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Model number/ })).toBeInTheDocument();
    expect(screen.getByText("PUZ-A18NKA7")).toBeInTheDocument();
  });

  test("mounts the outdoor units table on the outdoor-units leaf", async () => {
    const user = userEvent.setup();
    renderPanel({ slice: heatPumpsSlice({ outdoor_units: [outdoorUnitRow()] }) });

    await user.click(await screen.findByRole("tab", { name: "Units - Outdoor" }));

    expect(await screen.findByRole("button", { name: "Add outdoor unit" })).toBeInTheDocument();
    const equipmentHeader = screen.getByRole("columnheader", { name: /Equipment/ });
    expect(equipmentHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /OE-A/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Zone" })).toBeNull();
  });

  test("mounts the indoor units table on the indoor-units leaf", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));

    expect(await screen.findByRole("button", { name: "Add indoor unit" })).toBeInTheDocument();
  });

  test("renders indoor unit native references as linked-record fields", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_units: [outdoorUnitRow()],
        indoor_units: [
          buildEmptyIndoorUnitRow({
            id: "hpiu_01HX0000000000000000000000",
            tag: "IU-A",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
            outdoor_unit_id: "hpou_01HX0000000000000000000000",
          }),
        ],
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));

    const equipmentHeader = await screen.findByRole("columnheader", { name: /Equipment/ });
    const outdoorHeader = screen.getByRole("columnheader", { name: /Outdoor unit/ });
    expect(equipmentHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(outdoorHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(await screen.findByRole("button", { name: /IE-A/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HP-1" })).toBeInTheDocument();
  });

  test("opens linked room chips in the Room modal without leaving indoor units", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        indoor_units: [
          buildEmptyIndoorUnitRow({
            id: "hpiu_01HX0000000000000000000000",
            tag: "IU-A",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
            served_room_ids: ["rm_1"],
          }),
        ],
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));
    expect(await screen.findByRole("button", { name: "Add indoor unit" })).toBeInTheDocument();

    const roomChip = await screen.findByRole("button", { name: /101.*Living Room/ });
    fireEvent.click(roomChip);
    fireEvent.click(screen.getByRole("button", { name: /101.*Living Room/ }));

    expect(await screen.findByRole("dialog", { name: "Room: 101 - Living Room" })).toBeVisible();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/proj_1/equipment/heat-pumps/units-indoor",
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/v1/projects/proj_1/table-views/rooms"),
      ),
    ).toBe(false);
  });

  test("mounts the indoor equipment table on the indoor leaf", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));

    expect(await screen.findByRole("button", { name: "Add indoor model" })).toBeInTheDocument();
    expect(screen.getByText("PLA-A18EA8")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Cooling Capacity kW/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Heating Capacity kW/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /47F/ })).toBeNull();
    expect(screen.getAllByText("5.28").length).toBeGreaterThan(0);
  });

  test("shows incoming unit links on referenced Heat Pump tables", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_units: [outdoorUnitRow()],
        indoor_units: [
          buildEmptyIndoorUnitRow({
            id: "hpiu_01HX0000000000000000000000",
            tag: "IU-A",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
            outdoor_unit_id: "hpou_01HX0000000000000000000000",
          }),
        ],
      }),
    });

    expect(await screen.findByRole("columnheader", { name: /Outdoor units/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HP-1" })).toBeInTheDocument();

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IU-A" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Units - Outdoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IU-A" })).toBeInTheDocument();
  });

  test("renders paired indoor equipment as a read-only lookup from unit links", async () => {
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_equip: [outdoorEquipRow({ paired_indoor_equip_id: null })],
        outdoor_units: [outdoorUnitRow()],
        indoor_units: [indoorUnitRow()],
      }),
    });

    const pairedHeader = await screen.findByRole("columnheader", {
      name: /Paired indoor equip/,
    });
    expect(pairedHeader.querySelector('[data-field-type-icon="lookup"]')).toBeTruthy();
    expect(screen.getByText(/PLA-A18EA8/)).toBeInTheDocument();
  });

  test("renders indoor equipment capacity columns in IP units", async () => {
    const user = userEvent.setup();
    renderPanel({ unitSystem: "IP" });

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));

    expect(
      await screen.findByRole("columnheader", { name: /Cooling Capacity kBtu\/h/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /Heating Capacity kBtu\/h/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("18.0").length).toBeGreaterThan(0);
  });

  test("keeps saved outdoor equipment field order across leaf remounts", async () => {
    const user = userEvent.setup();
    renderPanel({
      savedTableViews: {
        [HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME]: {
          ...emptyViewState(),
          columnOrder: ["manufacturer", "tag", "model_number"],
        },
      },
    });

    await expectHeaderOrder(["Manufacturer", "Tag", "Model number"]);

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("button", { name: "Add indoor model" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Equipment - Outdoor" }));
    await expectHeaderOrder(["Manufacturer", "Tag", "Model number"]);
  });

  test("adds an outdoor equipment row through the Phase 0 PATCH API", async () => {
    const user = userEvent.setup();
    renderPanel({ slice: heatPumpsSlice({ outdoor_equip: [] }) });

    await user.click(await screen.findByRole("button", { name: "Add outdoor equipment" }));
    await user.type(screen.getByLabelText("Tag"), "OE-X");
    await user.type(screen.getByLabelText("Model number"), "PUZ-A24NHA7");
    await user.click(screen.getByRole("button", { name: "Save outdoor equipment" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/projects/proj_1/equipment/heat-pumps/outdoor-equip",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"op":"add"'),
        }),
      );
    });
  });
});

function renderPanel({
  slice = heatPumpsSlice(),
  unitSystem = "SI",
  savedTableViews = {},
}: {
  slice?: HeatPumpsSlice;
  unitSystem?: UnitSystem;
  savedTableViews?: Record<string, ViewState>;
} = {}) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({ items: [] });
    }
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps")) {
      return jsonResponse(slice);
    }
    if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
      return jsonResponse(roomsSlice());
    }
    const tableViewMatch = url.match(/\/api\/v1\/projects\/proj_1\/table-views\/([^/?]+)$/);
    const tableKey = tableViewMatch?.[1];
    if (tableKey) {
      const view = savedTableViews[tableKey];
      return jsonResponse({
        view_state_schema_version: 1,
        view_state: view ? { schema_fingerprint: "test-fingerprint", view_state: view } : null,
        updated_at: view ? "2026-06-16T00:00:00Z" : null,
      });
    }
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/outdoor-equip")) {
      return jsonResponse({
        ...slice,
        source: "draft",
        draft_etag: "draft_2",
        outdoor_equip: [outdoorEquipRow({ tag: "OE-X", model_number: "PUZ-A24NHA7" })],
      });
    }
    return jsonResponse({});
  });
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter initialEntries={["/projects/proj_1/equipment/heat-pumps/equipment-outdoor"]}>
      <QueryClientProvider client={queryClient}>
        <UnitPreferenceContext.Provider
          value={{
            unitSystem,
            source: "default",
            error: null,
            setUnitSystem: () => undefined,
            toggleUnitSystem: () => undefined,
          }}
        >
          <LocationProbe />
          <HeatPumpsPanel project={project()} />
        </UnitPreferenceContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function expectHeaderOrder(expectedHeaders: string[]) {
  const firstHeader = expectedHeaders[0];
  if (!firstHeader) throw new Error("Expected at least one header.");
  await screen.findByRole("columnheader", { name: new RegExp(firstHeader) });
  const headers = screen.getAllByRole("columnheader");
  const indexes = expectedHeaders.map((header) =>
    headers.findIndex((element) => element.textContent?.includes(header)),
  );
  expect(indexes.every((index) => index >= 0)).toBe(true);
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function project(): ProjectDetail {
  return {
    id: "proj_1",
    name: "Test Project",
    bt_number: "BT-001",
    client: null,
    cert_programs: ["phius"],
    phius_number: null,
    phius_dropbox_url: null,
    access_mode: "editor",
    active_version_id: "ver_1",
    active_version: version(),
    versions: [version()],
    last_saved_at: null,
    created_at: "2026-06-09T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
    owner_display_name: "Ed",
  };
}

function version() {
  return {
    id: "ver_1",
    project_id: "proj_1",
    name: "Base",
    kind: "working",
    locked: false,
    schema_version: 1,
    body_size_bytes: 100,
    created_at: "2026-06-09T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
  } satisfies ProjectDetail["active_version"];
}

function heatPumpsSlice(overrides: Partial<HeatPumpsSlice> = {}): HeatPumpsSlice {
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

function roomsSlice() {
  return buildRoomsSlice({
    project_id: "proj_1",
    version_id: "ver_1",
    source: "version",
    version_etag: "version_1",
    draft_etag: null,
    rooms: [buildRoom()],
    rows_computed: {},
  });
}

function outdoorEquipRow(overrides: Partial<HeatPumpsSlice["outdoor_equip"][number]> = {}) {
  return {
    id: "hpoe_01HX0000000000000000000000",
    tag: "OE-A",
    manufacturer: "opt_mitsubishi",
    model_number: "PUZ-A18NKA7",
    paired_indoor_equip_id: "hpie_01HX0000000000000000000000",
    system_family: "opt_puz",
    refrigerant: "opt_r_410a",
    heating_cap_kw_17f: 3.52,
    heating_cap_kw_47f: 5.28,
    heating_data_type: "COPs",
    heating_cop_17f: 2.1,
    heating_cop_47f: 3.2,
    hspf: null,
    cooling_cap_kw_95f: 5.28,
    cooling_data_type: "EER2/SEER2",
    eer: 10.5,
    seer: 17,
    ieer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

function indoorEquipRow(overrides: Partial<HeatPumpsSlice["indoor_equip"][number]> = {}) {
  return {
    id: "hpie_01HX0000000000000000000000",
    tag: "IE-A",
    manufacturer: "opt_mitsubishi",
    model_type: "opt_wall",
    model_number: "PLA-A18EA8",
    install_type: "opt_standard",
    nominal_tons: 1.5,
    fan_speed_cfm: null,
    cooling_btuh: 5.28,
    heating_btuh_47f: 5.28,
    heating_btuh_17f: null,
    heating_cop: null,
    seer: null,
    eer: null,
    hspf: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
  } satisfies HeatPumpsSlice["indoor_equip"][number];
}

function outdoorUnitRow(overrides: Partial<HeatPumpsSlice["outdoor_units"][number]> = {}) {
  return {
    id: "hpou_01HX0000000000000000000000",
    tag: "HP-1",
    outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_units"][number];
}

function indoorUnitRow(overrides: Partial<HeatPumpsSlice["indoor_units"][number]> = {}) {
  return {
    id: "hpiu_01HX0000000000000000000000",
    tag: "IU-A",
    indoor_equip_id: "hpie_01HX0000000000000000000000",
    outdoor_unit_id: "hpou_01HX0000000000000000000000",
    linked_erv_unit_id: null,
    served_room_ids: [],
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["indoor_units"][number];
}
