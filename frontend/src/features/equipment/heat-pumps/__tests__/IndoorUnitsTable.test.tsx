import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../../app/query-client";
import { buildRoom, buildRoomsSlice } from "../../testing/testFixtures";
import { IndoorUnitsTable } from "../components/IndoorUnitsTable";
import type { HeatPumpsSlice } from "../types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IndoorUnitsTable", () => {
  test("linked-record equipment edits persist the scalar indoor_equip_id field", async () => {
    const user = userEvent.setup();
    const slice = baseSlice({
      indoor_equip: [
        indoorEquipRow({ id: "hpie_a", tag: "IE-A", model_number: "MSZ-A" }),
        indoorEquipRow({ id: "hpie_b", tag: "IE-B", model_number: "MSZ-B" }),
      ],
      indoor_units: [indoorUnit({ indoor_equip_id: "hpie_a" })],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
        return jsonResponse(roomsSlice());
      }
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/ventilators")) {
        return jsonResponse({ ventilators: [] });
      }
      if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/indoor-units")) {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          ...slice,
          source: "draft",
          draft_etag: "draft_2",
          indoor_units: [body.value],
        });
      }
      return jsonResponse({});
    });

    renderTable(slice);

    const currentPill = await screen.findByRole("button", { name: /IE-A/ });
    const cell = currentPill.closest('[role="gridcell"]');
    expect(cell).toBeTruthy();
    fireEvent.doubleClick(cell!);
    await user.click(await screen.findByRole("radio", { name: /Link IE-B/ }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      const write = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/equipment/heat-pumps/indoor-units") &&
          (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(write).toBeTruthy();
      const body = JSON.parse(String((write?.[1] as RequestInit).body));
      expect(body.value.indoor_equip_id).toBe("hpie_b");
      expect(Array.isArray(body.value.indoor_equip_id)).toBe(false);
    });
  });

  test("linked-record outdoor unit edits persist the nullable scalar outdoor_unit_id field", async () => {
    const user = userEvent.setup();
    const slice = baseSlice({
      outdoor_units: [
        outdoorUnit({ id: "hpou_a", tag: "HP-A" }),
        outdoorUnit({ id: "hpou_b", tag: "HP-B" }),
      ],
      indoor_units: [indoorUnit({ outdoor_unit_id: "hpou_a" })],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
        return jsonResponse(roomsSlice());
      }
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/ventilators")) {
        return jsonResponse({ ventilators: [] });
      }
      if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/indoor-units")) {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          ...slice,
          source: "draft",
          draft_etag: "draft_2",
          indoor_units: [body.value],
        });
      }
      return jsonResponse({});
    });

    renderTable(slice);

    const currentPill = await screen.findByRole("button", { name: "HP-A" });
    const cell = currentPill.closest('[role="gridcell"]');
    expect(cell).toBeTruthy();
    fireEvent.doubleClick(cell!);
    await user.click(await screen.findByRole("radio", { name: /Link HP-B/ }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      const write = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/equipment/heat-pumps/indoor-units") &&
          (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(write).toBeTruthy();
      const body = JSON.parse(String((write?.[1] as RequestInit).body));
      expect(body.value.outdoor_unit_id).toBe("hpou_b");
      expect(Array.isArray(body.value.outdoor_unit_id)).toBe(false);
    });
  });

  test("linked-record ventilator edits persist the nullable scalar linked_erv_unit_id field", async () => {
    const user = userEvent.setup();
    const slice = baseSlice({
      indoor_units: [indoorUnit({ linked_erv_unit_id: "vent_a" })],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
        return jsonResponse(roomsSlice());
      }
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/ventilators")) {
        return jsonResponse({
          ventilators: [ventilator("vent_a", "ERV-A"), ventilator("vent_b", "ERV-B")],
        });
      }
      if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/indoor-units")) {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          ...slice,
          source: "draft",
          draft_etag: "draft_2",
          indoor_units: [body.value],
        });
      }
      return jsonResponse({});
    });

    renderTable(slice);

    const currentPill = await screen.findByRole("button", { name: /ERV-A/ });
    const cell = currentPill.closest('[role="gridcell"]');
    expect(cell).toBeTruthy();
    fireEvent.doubleClick(cell!);
    await user.click(await screen.findByRole("radio", { name: /Link ERV-B/ }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      const write = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/equipment/heat-pumps/indoor-units") &&
          (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(write).toBeTruthy();
      const body = JSON.parse(String((write?.[1] as RequestInit).body));
      expect(body.value.linked_erv_unit_id).toBe("vent_b");
      expect(Array.isArray(body.value.linked_erv_unit_id)).toBe(false);
    });
  });

  test("linked-record ventilator chip opens the Ventilator modal", async () => {
    const slice = baseSlice({
      indoor_units: [indoorUnit({ linked_erv_unit_id: "vent_a" })],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/assets/bulk-urls")) return jsonResponse({ items: [] });
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
        return jsonResponse(roomsSlice());
      }
      if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/ventilators")) {
        return jsonResponse({
          ...ventilatorsSlice(),
          ventilators: [ventilator("vent_a", "ERV-A")],
        });
      }
      return jsonResponse({});
    });

    renderTable(slice);

    let linkedErvPill = await screen.findByRole("button", { name: /ERV-A/ });
    fireEvent.click(linkedErvPill);
    linkedErvPill = await screen.findByRole("button", { name: /ERV-A/ });
    fireEvent.click(linkedErvPill);

    expect(await screen.findByRole("dialog", { name: /Ventilator: ERV-A/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("ERV-A unit");
  });
});

function renderTable(slice: HeatPumpsSlice) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <IndoorUnitsTable projectId="proj_1" slice={slice} isEditor versionLocked={false} />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

function ventilatorsSlice() {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "version_1",
    draft_etag: "draft_1",
    ventilators: [],
    field_defs: [],
    single_select_options: {
      "ventilators.inside_outside": [],
    },
  };
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
    outdoor_units: [outdoorUnit()],
    indoor_units: [indoorUnit()],
    single_select_options: {},
    ...overrides,
  };
}

function outdoorEquipRow() {
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
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

function indoorEquipRow(overrides: Partial<HeatPumpsSlice["indoor_equip"][number]> = {}) {
  return {
    id: "hpie_01HX0000000000000000000000",
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
  } satisfies HeatPumpsSlice["indoor_equip"][number];
}

function outdoorUnit(overrides: Partial<HeatPumpsSlice["outdoor_units"][number]> = {}) {
  return {
    id: "hpou_01HX0000000000000000000000",
    tag: "HP-A",
    outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_units"][number];
}

function indoorUnit(overrides: Partial<HeatPumpsSlice["indoor_units"][number]> = {}) {
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

function ventilator(id: string, recordId: string) {
  return {
    id,
    inside_outside: null,
    url: null,
    notes: null,
    custom_values: {
      record_id: recordId,
      name: `${recordId} unit`,
    },
  };
}
