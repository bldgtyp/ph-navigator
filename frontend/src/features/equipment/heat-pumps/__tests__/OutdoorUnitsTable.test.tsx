import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryClient } from "../../../../app/query-client";
import { OutdoorUnitsTable } from "../components/OutdoorUnitsTable";
import type { HeatPumpsSlice } from "../types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OutdoorUnitsTable", () => {
  test("opens cascade-preview dialog when delete would null indoor units", async () => {
    const user = userEvent.setup();
    const slice = baseSlice({
      outdoor_units: [outdoorUnit()],
      indoor_units: [indoorUnit({ id: "hpiu_aaaaaaaaaaaaaaaaaaaaaaaaaa", tag: "AHU-1" })],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      if (url.includes("?dry-run=true")) {
        return jsonResponse({
          ...slice,
          cascade_preview: {
            affected: [
              {
                table: "indoor-units",
                row_id: "hpiu_aaaaaaaaaaaaaaaaaaaaaaaaaa",
                tag: "AHU-1",
                field: "outdoor_unit_id",
              },
            ],
          },
        });
      }
      if (init?.method === "PATCH") {
        return jsonResponse({
          ...slice,
          outdoor_units: [],
          source: "draft",
          draft_etag: "draft_2",
        });
      }
      return jsonResponse({});
    });

    renderTable(slice);
    await user.click(await screen.findByRole("button", { name: /Expand row 1/i }));
    await user.click(await screen.findByRole("button", { name: "Delete outdoor unit" }));

    expect(await screen.findByText(/clear the outdoor link on 1 indoor unit/i)).toBeInTheDocument();
    expect(screen.getByText("AHU-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete and clear links" }));

    await waitFor(() => {
      const realDelete = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/equipment/heat-pumps/outdoor-units") &&
          (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(realDelete).toBeTruthy();
    });
  });

  test("skips preview dialog when no indoor units would be affected", async () => {
    const user = userEvent.setup();
    const slice = baseSlice({
      outdoor_units: [outdoorUnit()],
      indoor_units: [],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      if (url.includes("?dry-run=true")) {
        return jsonResponse({ ...slice, cascade_preview: { affected: [] } });
      }
      return jsonResponse({ ...slice, outdoor_units: [], source: "draft", draft_etag: "draft_2" });
    });

    renderTable(slice);
    await user.click(await screen.findByRole("button", { name: /Expand row 1/i }));
    await user.click(await screen.findByRole("button", { name: "Delete outdoor unit" }));

    await waitFor(() => {
      const realDelete = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/equipment/heat-pumps/outdoor-units") &&
          (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(realDelete).toBeTruthy();
    });
    expect(screen.queryByText(/clear the outdoor link/i)).not.toBeInTheDocument();
  });
});

function renderTable(slice: HeatPumpsSlice) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OutdoorUnitsTable projectId="proj_1" slice={slice} isEditor versionLocked={false} />
    </QueryClientProvider>,
  );
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

function outdoorEquipRow() {
  return {
    id: "hpoe_01HX0000000000000000000000",
    tag: "OE-A",
    manufacturer: "opt_mitsubishi",
    model_number: "PUZ-A18NKA7",
    paired_indoor_equip_id: null,
    system_family: null,
    refrigerant: null,
    heating_cap_kw_17f: null,
    heating_cap_kw_47f: null,
    heating_data_type: null,
    heating_cop_17f: null,
    heating_cop_47f: null,
    hspf2: null,
    cooling_cap_kw_95f: null,
    cooling_data_type: null,
    eer2: null,
    seer2: null,
    ieer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

function indoorEquipRow() {
  return {
    id: "hpie_01HX0000000000000000000000",
    tag: "IE-A",
    manufacturer: null,
    model_type: null,
    model_number: "PLA-A18EA8",
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
  } satisfies HeatPumpsSlice["indoor_equip"][number];
}

function outdoorUnit(overrides: Partial<HeatPumpsSlice["outdoor_units"][number]> = {}) {
  return {
    id: "hpou_01HX0000000000000000000000",
    tag: "HP-1",
    outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    building_zone: null,
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_units"][number];
}

function indoorUnit(overrides: Partial<HeatPumpsSlice["indoor_units"][number]> = {}) {
  return {
    id: "hpiu_01HX0000000000000000000000",
    tag: "AHU-1",
    indoor_equip_id: "hpie_01HX0000000000000000000000",
    outdoor_unit_id: "hpou_01HX0000000000000000000000",
    linked_erv_unit_id: null,
    served_room_ids: [],
    floor_level: null,
    area_served: null,
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["indoor_units"][number];
}
