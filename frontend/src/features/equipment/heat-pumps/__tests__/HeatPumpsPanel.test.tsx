import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../../../../app/query-client";
import type { ProjectDetail } from "../../../projects/types";
import { HeatPumpsPanel } from "../routes/HeatPumpsPanel";
import type { HeatPumpsSlice } from "../types";

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
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/outdoor-equip")) {
      const body = JSON.parse(String(init?.body)) as { value: { model_number: string } };
      return jsonResponse(
        heatPumpsSlice({
          outdoor_equip: [outdoorEquipRow({ model_number: body.value.model_number })],
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

  test("renders coming-soon placeholders for later leaves", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Units - Outdoor" }));

    expect(screen.getByRole("status")).toHaveTextContent("Coming in Phase 3");
  });

  test("mounts the indoor equipment table on the indoor leaf", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));

    expect(await screen.findByRole("button", { name: "Add indoor model" })).toBeInTheDocument();
    expect(screen.getByText("PLA-A18EA8")).toBeInTheDocument();
  });

  test("adds an outdoor equipment row through the Phase 0 PATCH API", async () => {
    const user = userEvent.setup();
    renderPanel({ slice: heatPumpsSlice({ outdoor_equip: [] }) });

    await user.click(await screen.findByRole("button", { name: "Add outdoor equipment" }));
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

function renderPanel({ slice = heatPumpsSlice() }: { slice?: HeatPumpsSlice } = {}) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({ items: [] });
    }
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps")) {
      return jsonResponse(slice);
    }
    if (url.endsWith("/api/v1/projects/proj_1/equipment/heat-pumps/outdoor-equip")) {
      return jsonResponse({
        ...slice,
        source: "draft",
        draft_etag: "draft_2",
        outdoor_equip: [outdoorEquipRow({ model_number: "PUZ-A24NHA7" })],
      });
    }
    return jsonResponse({});
  });
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter initialEntries={["/projects/proj_1/equipment/heat-pumps/equipment-outdoor"]}>
      <QueryClientProvider client={queryClient}>
        <HeatPumpsPanel project={project()} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
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
    ...overrides,
  };
}

function outdoorEquipRow(overrides: Partial<HeatPumpsSlice["outdoor_equip"][number]> = {}) {
  return {
    id: "hpoe_01HX0000000000000000000000",
    manufacturer: "opt_mitsubishi",
    model_number: "PUZ-A18NKA7",
    paired_indoor_equip_id: "hpie_01HX0000000000000000000000",
    system_family: "opt_puz",
    refrigerant: "opt_r_410a",
    heating_data_type: "cops",
    heating_cap_kbtuh_17f: 12,
    heating_cap_kbtuh_47f: 18,
    heating_cop_17f: 2.1,
    heating_cop_47f: 3.2,
    hspf2: null,
    hspf: null,
    cooling_data_type: "eer2_seer2",
    cooling_cap_kbtuh_95f: 18,
    eer2: 10.5,
    seer2: 17,
    ieer: null,
    eer: null,
    seer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

function indoorEquipRow(overrides: Partial<HeatPumpsSlice["indoor_equip"][number]> = {}) {
  return {
    id: "hpie_01HX0000000000000000000000",
    manufacturer: "opt_mitsubishi",
    model_type: "opt_wall",
    model_number: "PLA-A18EA8",
    install_type: "opt_standard",
    nominal_tons: 1.5,
    fan_speed_cfm: null,
    cooling_btuh: 18000,
    heating_btuh_47f: 18000,
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
